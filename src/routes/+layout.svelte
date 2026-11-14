<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { messages } from '$lib/i18n';

	let { children } = $props();
	const demo = $derived(page.data.demo === true);
	const t = $derived(messages(page.data.lang ?? 'en'));
</script>

{#if demo}
	<p class="demo-banner" role="note">{t.demoBanner}</p>
{/if}

{@render children()}
