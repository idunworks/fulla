<script lang="ts">
	/**
	 * Sign-in for creators.
	 *
	 * Without a token: ask for a link by email. With one (#token=… from the
	 * email): a button spends it. Nothing is spent on page load, so a mail
	 * scanner that opens the link changes nothing. The fragment leaves the
	 * address bar straight away.
	 */
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { ApiError, requestSignInLink, startDemo, verifySignIn } from '$lib/api';
	import Icon from '$lib/components/Icon.svelte';
	import { messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));

	type AuthState = 'loading' | 'ask' | 'sent' | 'ready' | 'failed';

	let authState = $state<AuthState>('loading');
	let email = $state('');
	let busy = $state(false);
	let message = $state('');
	let token = '';

	// A second sign-in link pasted into this tab changes only the fragment (see view/+page.svelte).
	afterNavigate(readToken);

	function onHashChange(): void {
		if (window.location.hash) readToken();
	}

	function readToken(): void {
		const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('token')?.trim() ?? '';
		if (window.location.hash) {
			// See view/+page.svelte: replaceState must wait one microtask on first load.
			const clean = `${window.location.pathname}${window.location.search}`;
			queueMicrotask(() => replaceState(clean, {}));
		}
		token = fromHash;
		authState = token ? 'ready' : 'ask';
	}

	async function ask(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		busy = true;
		message = '';
		try {
			await requestSignInLink(email, page.url.searchParams.get('next') ?? '');
			authState = 'sent';
		} catch (err) {
			const status = err instanceof ApiError ? err.status : 0;
			message = status === 400 ? t.badEmail : status === 429 ? t.tooMany : t.failed;
		} finally {
			busy = false;
		}
	}

	async function signIn(): Promise<void> {
		busy = true;
		try {
			const { next } = await verifySignIn(token);
			token = '';
			await goto(next, { replaceState: true, invalidateAll: true });
		} catch (err) {
			const status = err instanceof ApiError ? err.status : 0;
			authState = 'failed';
			message = status === 400 ? t.signInFailedBody : status === 429 ? t.tooMany : t.failed;
		} finally {
			busy = false;
		}
	}

	/** The demo: a throwaway session, then straight to the creator's pages. */
	async function beginDemo(): Promise<void> {
		busy = true;
		message = '';
		try {
			await startDemo();
			await goto(`${base}/admin/new`, { replaceState: true, invalidateAll: true });
		} catch (err) {
			const status = err instanceof ApiError ? err.status : 0;
			message = status === 429 ? t.tooMany : t.failed;
		} finally {
			busy = false;
		}
	}

	function startOver(): void {
		authState = 'ask';
		message = '';
	}
</script>

<svelte:window onhashchange={onHashChange} />

<svelte:head>
	<title>{t.signIn} · Fulla</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="page">
	<div class="column">
		<header class="brand">
			<span class="brand-mark"><Icon name="shield" size={28} /></span>
			<h1>Fulla</h1>
			<p>{t.tagline}</p>
		</header>

		<div aria-live="polite">
			{#if data.demo}
				<section class="card center">
					<h2>{t.demoTitle}</h2>
					<p>{t.demoBody}</p>
					{#if message}<p class="form-error" role="alert">{message}</p>{/if}
					<button type="button" class="btn btn-primary" onclick={beginDemo} disabled={busy}>
						{busy ? t.demoStarting : t.demoStart}
					</button>
				</section>
			{:else if authState === 'loading'}
				<section class="card center">
					<span class="spinner" aria-hidden="true"></span>
				</section>
			{:else if authState === 'ask'}
				<section class="card">
					<h2>{t.signInTitle}</h2>
					<p>{t.signInBody}</p>
					<form class="stack" onsubmit={ask}>
						<label class="field">
							<span>{t.emailLabel}</span>
							<input type="email" bind:value={email} required autocomplete="email" maxlength="254" />
						</label>
						{#if message}<p class="form-error" role="alert">{message}</p>{/if}
						<button type="submit" class="btn btn-primary btn-block" disabled={busy}>
							{busy ? t.sending : t.sendLink}
						</button>
					</form>
				</section>
			{:else if authState === 'sent'}
				<section class="card center">
					<span class="icon-lg"><Icon name="check" size={44} /></span>
					<h2>{t.linkSentTitle}</h2>
					<p>{t.linkSentBody}</p>
					<button type="button" class="btn btn-quiet" onclick={startOver}>{t.otherAddress}</button>
				</section>
			{:else if authState === 'ready'}
				<section class="card center">
					<span class="icon-lg"><Icon name="lock" size={44} /></span>
					<h2>{t.signInReadyTitle}</h2>
					<p>{t.signInReadyBody}</p>
					<button type="button" class="btn btn-primary" onclick={signIn} disabled={busy}>
						{busy ? t.signingIn : t.signIn}
					</button>
				</section>
			{:else}
				<section class="card center danger">
					<span class="icon-lg"><Icon name="alert" size={44} /></span>
					<h2>{t.signInFailedTitle}</h2>
					<p>{message}</p>
					<button type="button" class="btn btn-quiet" onclick={startOver}>{t.askNewLink}</button>
				</section>
			{/if}
		</div>
	</div>
</main>
