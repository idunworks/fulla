<script lang="ts">
	/**
	 * Create a secret. The text is encrypted here, with a key made here; the
	 * server gets only ciphertext and hands back one token per recipient. The
	 * links (token + key, both in the #fragment) exist only on this page,
	 * until it is left.
	 */
	import { untrack } from 'svelte';
	import { base } from '$app/paths';
	import { ApiError, createSecret } from '$lib/api';
	import Icon from '$lib/components/Icon.svelte';
	import { buildShareLink, encrypt, generateKey } from '$lib/crypto';
	import { fill, messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));

	/** "1 hour", "10 minutes": the lifetimes the server offers, in minutes. */
	function lifetimeLabel(minutes: number): string {
		if (minutes === 10) return t.minutes_10;
		return t[`hours_${minutes / 60}` as 'hours_1' | 'hours_4' | 'hours_24' | 'hours_72' | 'hours_168'];
	}

	interface Row {
		key: number;
		label: string;
		email: string;
	}

	let label = $state('');
	let secretText = $state('');
	// 24 hours where it is offered, else the longest there is.
	let minutes = $state(untrack(() => (data.lifetimes.includes(1440) ? 1440 : data.lifetimes[data.lifetimes.length - 1])));
	let nextKey = 1;
	let rows = $state<Row[]>([{ key: 0, label: '', email: '' }]);

	let busy = $state(false);
	let message = $state('');
	let links = $state<{ label: string; url: string }[]>([]);
	let copiedIndex = $state<number | 'all' | null>(null);

	function addRow(): void {
		if (rows.length >= data.maxRecipients) return;
		rows = [...rows, { key: nextKey++, label: '', email: '' }];
	}

	function removeRow(key: number): void {
		rows = rows.filter((r) => r.key !== key);
	}

	/** What's wrong with the form, in the visitor's language, or '' when it can be sent. */
	function problemWithForm(recipients: { label: string }[]): string {
		if (!label.trim()) return t.needLabel;
		if (!secretText.trim()) return t.needSecret;
		if (recipients.length === 0) return t.needRecipient;
		if (recipients.length > data.maxRecipients) return fill(t.tooManyRecipients, { max: String(data.maxRecipients) });
		return '';
	}

	async function submit(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const recipients = rows
			.filter((r) => r.label.trim())
			.map((r) => ({
				label: r.label.trim(),
				...(data.askEmails && r.email.trim() ? { email: r.email.trim() } : {})
			}));
		message = problemWithForm(recipients);
		if (message) return;

		busy = true;
		try {
			const { key, exported } = await generateKey();
			const sealed = await encrypt(secretText, key);
			const created = await createSecret({
				label: label.trim(),
				...sealed,
				expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
				recipients
			});
			links = created.links.map((l) => ({
				label: l.label,
				url: buildShareLink(`${window.location.origin}${base}`, l.token, exported)
			}));
			// Nothing on this page needs the plain text any more.
			secretText = '';
		} catch (err) {
			message = fill(t.createFailed, { detail: err instanceof ApiError ? err.message : t.failed });
		} finally {
			busy = false;
		}
	}

	async function copy(text: string, which: number | 'all'): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			copiedIndex = which;
			setTimeout(() => (copiedIndex = null), 2000);
		} catch {
			// No clipboard access: the links are still selectable on the page.
		}
	}
</script>

<svelte:head>
	<title>{t.newTitle} · Fulla</title>
</svelte:head>

<a href="{base}/admin" class="back small"><Icon name="chevronLeft" size={14} /> {t.backToList}</a>

<header class="page-head">
	<h1>{t.newTitle}</h1>
</header>

{#if links.length > 0}
	<section class="card warn">
		<h2><Icon name="alert" /> {t.linksTitle}</h2>
		<p>{t.linksBody}</p>
	</section>
	<ul class="links">
		{#each links as link, i (link.url)}
			<li class="card">
				<div class="link-head">
					<strong>{link.label}</strong>
					<span class="link-buttons">
						{#if data.demo}
							<!-- Demo only: in real use, opening a link here would spend that recipient's one view. -->
							<a class="btn btn-small btn-quiet" href={link.url} target="_blank" rel="noopener noreferrer">
								<Icon name="eye" />
								{t.openAsRecipient}
							</a>
						{/if}
						<button type="button" class="btn btn-small {copiedIndex === i ? 'btn-ok' : 'btn-quiet'}" onclick={() => copy(link.url, i)}>
							<Icon name={copiedIndex === i ? 'check' : 'copy'} />
							{copiedIndex === i ? t.copied : t.copyLink}
						</button>
					</span>
				</div>
				<code class="link-url">{link.url}</code>
			</li>
		{/each}
	</ul>
	<div class="actions">
		{#if links.length > 1}
			<button type="button" class="btn {copiedIndex === 'all' ? 'btn-ok' : 'btn-primary'}" onclick={() => copy(links.map((l) => `${l.label}: ${l.url}`).join('\n'), 'all')}>
				<Icon name={copiedIndex === 'all' ? 'check' : 'copy'} />
				{copiedIndex === 'all' ? t.copied : t.copyAll}
			</button>
		{/if}
		<a href="{base}/admin" class="btn btn-quiet">{t.done}</a>
	</div>
{:else}
	<p class="intro">{t.newIntro}</p>
	<form class="card stack" onsubmit={submit}>
		<div class="field">
			<label for="label">{t.labelLabel}</label>
			<input id="label" type="text" bind:value={label} maxlength="200" autocomplete="off" aria-describedby="label-hint" />
			<small id="label-hint">{t.labelHint}</small>
		</div>

		<div class="field">
			<label for="secret"><Icon name="lock" size={14} /> {t.secretLabel}</label>
			<textarea id="secret" bind:value={secretText} rows="5" class="mono" autocomplete="off" spellcheck="false" aria-describedby="secret-hint"></textarea>
			<small id="secret-hint">{t.secretHint}</small>
		</div>

		<fieldset class="field" aria-describedby="recipients-hint">
			<legend>{t.recipientsLabel}</legend>
			{#each rows as row (row.key)}
				<div class="recipient" class:no-email={!data.askEmails}>
					<input type="text" bind:value={row.label} placeholder={t.recipientName} aria-label={t.recipientName} maxlength="100" />
					{#if data.askEmails}
						<input type="email" bind:value={row.email} placeholder={t.recipientEmail} aria-label={t.recipientEmail} maxlength="254" />
					{/if}
					{#if rows.length > 1}
						<button type="button" class="btn btn-quiet btn-icon" onclick={() => removeRow(row.key)} aria-label={fill(t.removeRecipient, { name: row.label || '…' })}>
							<Icon name="x" />
						</button>
					{/if}
				</div>
			{/each}
			{#if rows.length < data.maxRecipients}
				<button type="button" class="btn btn-quiet btn-small" onclick={addRow}>+ {t.addRecipient}</button>
			{/if}
			<small id="recipients-hint">{data.askEmails ? t.recipientsHint : t.recipientsHintDemo}</small>
		</fieldset>

		<div class="field">
			<label for="expires">{t.expiresLabel}</label>
			<select id="expires" bind:value={minutes}>
				{#each data.lifetimes as m (m)}
					<option value={m}>{lifetimeLabel(m)}</option>
				{/each}
			</select>
		</div>

		{#if message}<p class="form-error" role="alert">{message}</p>{/if}

		<button type="submit" class="btn btn-primary btn-block" disabled={busy}>
			<Icon name="lock" />
			{busy ? t.creating : t.create}
		</button>
	</form>
{/if}
