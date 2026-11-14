<script lang="ts">
	import '$lib/styles-admin.css';
	import { goto } from '$app/navigation';
	import { signOut } from '$lib/api';
	import Icon from '$lib/components/Icon.svelte';
	import { fill, messages } from '$lib/i18n';

	let { data, children } = $props();
	const t = $derived(messages(data.lang));

	async function leave(): Promise<void> {
		try {
			await signOut();
		} finally {
			await goto('/auth', { invalidateAll: true });
		}
	}
</script>

<main class="page">
	<div class="column wide">
		<nav class="topbar">
			<a href="/admin" class="topbar-brand">
				<Icon name="shield" size={20} />
				Fulla
			</a>
			<span class="small topbar-who">{fill(t.signedInAs, { email: data.creator })}</span>
			<button type="button" class="btn btn-quiet btn-small" onclick={leave}>{t.signOut}</button>
		</nav>
		{@render children()}
	</div>
</main>
