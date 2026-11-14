<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import StatusPill from '$lib/components/StatusPill.svelte';
	import { fill, formatDate, messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));
</script>

<svelte:head>
	<title>{t.yourSecrets} · Fulla</title>
</svelte:head>

<header class="page-head">
	<h1>{t.yourSecrets}</h1>
	<a href="/admin/new" class="btn btn-primary">
		<Icon name="lock" />
		{t.newSecret}
	</a>
</header>

{#if data.secrets.length === 0}
	<section class="card center">
		<h2>{t.listEmpty}</h2>
		<p>{t.listEmptyHint}</p>
	</section>
{:else}
	<ul class="rows">
		{#each data.secrets as secret (secret.id)}
			<li>
				<a class="row" href="/admin/{secret.id}">
					<span class="row-main">
						<strong>{secret.label}</strong>
						<span class="small">
							{fill(t.revealedOf, {
								revealed: String(secret.revealed_count),
								total: String(secret.recipient_count)
							})}
							·
							{fill(secret.status === 'active' ? t.expiresOn : t.createdOn, {
								date: formatDate(secret.status === 'active' ? secret.expires_at : secret.created_at, data.lang)
							})}
						</span>
					</span>
					<StatusPill status={secret.status} lang={data.lang} />
				</a>
			</li>
		{/each}
	</ul>
{/if}
