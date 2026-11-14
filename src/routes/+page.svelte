<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { messages } from '$lib/i18n';

	let { data } = $props();
	const t = $derived(messages(data.lang));
</script>

<svelte:head>
	<title>Fulla</title>
</svelte:head>

<main class="page">
	<div class="column">
		<header class="brand">
			<span class="brand-mark"><Icon name="shield" size={28} /></span>
			<h1>Fulla</h1>
			<p>{t.tagline}</p>
		</header>
		<section class="card center">
			<p>{t.newIntro}</p>
			<a class="btn btn-primary" href={data.signedIn ? '/admin' : '/auth'}>
				<Icon name="lock" />
				{data.signedIn ? t.yourSecrets : t.signInTitle}
			</a>
		</section>
		<p class="footnote">{t.footer}</p>
	</div>
</main>
