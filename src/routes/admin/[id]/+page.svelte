<script lang="ts">
	/** One secret: who has opened and revealed it, and a way to revoke it. Never the links. */
	import { invalidateAll } from '$app/navigation';
	import { base } from '$app/paths';
	import { revokeSecret } from '$lib/api';
	import Icon from '$lib/components/Icon.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { fill, formatDate, messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));
	const secret = $derived(data.secret);

	let confirming = $state(false);
	let busy = $state(false);
	let message = $state('');

	async function revoke(): Promise<void> {
		busy = true;
		message = '';
		try {
			await revokeSecret(secret.id);
			confirming = false;
			await invalidateAll();
		} catch {
			message = t.revokeFailed;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{secret.label} · Fulla</title>
</svelte:head>

<a href="{base}/admin" class="back small"><Icon name="chevronLeft" size={14} /> {t.backToList}</a>

<header class="page-head">
	<h1>{secret.label}</h1>
	<StatusPill status={secret.status} lang={data.lang} />
</header>

<section class="card">
	<p class="small">
		{fill(t.createdOn, { date: formatDate(secret.created_at, data.lang) })}
		·
		{fill(secret.status === 'expired' ? t.expiredOn : t.expiresOn, { date: formatDate(secret.expires_at, data.lang) })}
	</p>
	<p>
		{fill(t.revealedOf, { revealed: String(secret.revealed_count), total: String(secret.recipient_count) })}
	</p>
	{#if secret.wiped_at}
		<p class="small">{t.secretGone}</p>
	{/if}
</section>

<ul class="rows">
	{#each secret.recipients as r (r.id)}
		<li class="row">
			<span class="row-main">
				<strong>{r.label}</strong>
				{#if r.email}<span class="small">{r.email}</span>{/if}
			</span>
			<span class="small row-side">
				{#if r.revealed_at}
					<Icon name="eye" size={14} /> {fill(t.revealedOn, { date: formatDate(r.revealed_at, data.lang) })}
				{:else if r.opened_at}
					<Icon name="clock" size={14} /> {fill(t.openedOn, { date: formatDate(r.opened_at, data.lang) })}
				{:else}
					{t.notOpened}
				{/if}
			</span>
		</li>
	{/each}
</ul>

{#if secret.status === 'active'}
	<section class="card danger-zone">
		{#if confirming}
			<p>{t.revokeBody}</p>
			<div class="actions">
				<button type="button" class="btn btn-danger" onclick={revoke} disabled={busy}>{t.revokeConfirm}</button>
				<button type="button" class="btn btn-quiet" onclick={() => (confirming = false)} disabled={busy}>{t.revokeCancel}</button>
			</div>
		{:else}
			<button type="button" class="btn btn-quiet" onclick={() => (confirming = true)}>{t.revoke}</button>
		{/if}
		{#if message}<p class="form-error" role="alert">{message}</p>{/if}
	</section>
{/if}
