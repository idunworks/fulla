<script lang="ts">
	/**
	 * The recipient's page. Opening it only asks what the link may do (no
	 * ciphertext), so a mail scanner or a link preview spends nothing. The
	 * secret is fetched once, when the recipient presses the button, and
	 * decrypted here with the key from the #fragment, which never leaves the
	 * browser. The fragment is removed from the address bar straight away.
	 *
	 * Links look like /view#t=<token>&key=<key>.
	 */
	import { afterNavigate, replaceState } from '$app/navigation';
	import { ApiError, openLink, revealSecret } from '$lib/api';
	import Icon from '$lib/components/Icon.svelte';
	import { decrypt, importKey, parseShareFragment } from '$lib/crypto';
	import { fill, formatDate, messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));

	type ViewState = 'loading' | 'ready' | 'revealing' | 'revealed' | 'used' | 'gone' | 'invalid' | 'error';

	const HELP_KEY = 'fulla-help-expanded';

	let viewState = $state<ViewState>('loading');
	let helpOpen = $state(true);
	let errorText = $state('');
	let expiresAt = $state<string | null>(null);
	let plaintext = $state('');
	let copied = $state(false);
	// Held in memory only: the address bar is cleaned and nothing is stored.
	let token = '';
	let key = '';

	function showFailure(err: unknown): void {
		const status = err instanceof ApiError ? err.status : 0;
		if (status === 404) viewState = 'invalid';
		else if (status === 410) viewState = 'used';
		else {
			viewState = 'error';
			errorText = status === 429 ? t.tooMany : t.failed;
		}
	}

	async function check(): Promise<void> {
		viewState = 'loading';
		try {
			const info = await openLink(token);
			expiresAt = info.expires_at;
			viewState = info.state === 'ready' ? 'ready' : info.state === 'revealed' ? 'used' : 'gone';
		} catch (err) {
			showFailure(err);
		}
	}

	async function reveal(): Promise<void> {
		viewState = 'revealing';
		let sealed;
		try {
			sealed = await revealSecret(token);
		} catch (err) {
			showFailure(err);
			return;
		}
		try {
			plaintext = await decrypt(sealed.ciphertext_b64, sealed.iv_b64, await importKey(key));
			viewState = 'revealed';
		} catch {
			viewState = 'error';
			errorText = t.badKey;
		}
	}

	afterNavigate(() => {
		try {
			const stored = localStorage.getItem(HELP_KEY);
			if (stored !== null) helpOpen = stored === 'true';
		} catch {
			// No localStorage (private mode): keep the default.
		}
		readLink();
	});

	/**
	 * Another link pasted into this tab changes only the fragment: the browser
	 * stays on the page and Kit runs no navigation, so listen for it directly.
	 */
	function onHashChange(): void {
		if (!window.location.hash) return;
		plaintext = '';
		copied = false;
		readLink();
	}

	function readLink(): void {
		const fragment = parseShareFragment(window.location.hash);
		token = fragment.token ?? '';
		key = fragment.key ?? '';
		if (window.location.hash) {
			// Out of the address bar, the history and anything copied from it. One
			// microtask later: on first load Kit runs afterNavigate before it marks
			// its router as started, and replaceState throws until then.
			const clean = `${window.location.pathname}${window.location.search}`;
			queueMicrotask(() => replaceState(clean, {}));
		}
		if (!token || !key) {
			viewState = 'invalid';
			return;
		}
		void check();
	}

	function toggleHelp(): void {
		helpOpen = !helpOpen;
		try {
			localStorage.setItem(HELP_KEY, String(helpOpen));
		} catch {
			// No localStorage: the toggle still works for this visit.
		}
	}

	async function copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(plaintext);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// No clipboard access: the text is still selectable on the page.
		}
	}
</script>

<svelte:window onhashchange={onHashChange} />

<svelte:head>
	<title>Fulla</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="page">
	<div class="column">
		<header class="brand">
			<span class="brand-mark"><Icon name="shield" size={28} /></span>
			<h1>Fulla</h1>
			<p>{t.tagline}</p>
		</header>

		<section class="help">
			<button
				type="button"
				class="help-toggle"
				onclick={toggleHelp}
				aria-expanded={helpOpen}
				aria-controls="help-body"
			>
				<span>{t.helpTitle}</span>
				<Icon name={helpOpen ? 'chevronDown' : 'chevronRight'} size={16} />
			</button>
			{#if helpOpen}
				<div id="help-body" class="help-body">
					<p>{t.helpWhat}</p>
					<p>{t.helpOnce}</p>
					<p>{t.helpExpiry}</p>
					<details>
						<summary>{t.helpTechTitle}</summary>
						<p>{t.helpTech}</p>
					</details>
				</div>
			{/if}
		</section>

		<div aria-live="polite">
			{#if viewState === 'loading' || viewState === 'revealing'}
				<section class="card center">
					<span class="spinner" aria-hidden="true"></span>
					<p>{viewState === 'revealing' ? t.decrypting : t.checking}</p>
				</section>
			{:else if viewState === 'ready'}
				<section class="card center">
					<span class="icon-lg"><Icon name="lock" size={44} /></span>
					<h2>{t.readyTitle}</h2>
					<p>
						{t.readyBody}
						{#if expiresAt}<br /><span class="small">{fill(t.expires, { date: formatDate(expiresAt, data.lang) })}</span>{/if}
					</p>
					<button type="button" class="btn btn-primary" onclick={reveal}>
						<Icon name="eye" />
						{t.show}
					</button>
				</section>
			{:else if viewState === 'revealed'}
				<section class="card">
					<h2>{t.revealedTitle}</h2>
					<pre class="secret">{plaintext}</pre>
					<button type="button" class="btn btn-block {copied ? 'btn-ok' : 'btn-quiet'}" onclick={copy}>
						<Icon name={copied ? 'check' : 'copy'} />
						{copied ? t.copied : t.copy}
					</button>
					<p class="small spaced"><strong>{t.saveNow}</strong> {t.spent}</p>
				</section>
			{:else}
				<section class="card center danger">
					<span class="icon-lg"><Icon name="alert" size={44} /></span>
					{#if viewState === 'used'}
						<h2>{t.usedTitle}</h2>
						<p>{t.usedBody}</p>
					{:else if viewState === 'gone'}
						<h2>{t.goneTitle}</h2>
						<p>{t.goneBody}</p>
					{:else if viewState === 'invalid'}
						<h2>{t.invalidTitle}</h2>
						<p>{t.invalidBody}</p>
					{:else}
						<h2>{t.errorTitle}</h2>
						<p>{errorText}</p>
					{/if}
				</section>
			{/if}
		</div>

		<p class="footnote">{t.footer}</p>
	</div>
</main>
