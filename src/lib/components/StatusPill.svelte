<script lang="ts">
	import { messages, type Lang } from '$lib/i18n';

	type Status = 'active' | 'expired' | 'burned' | 'revoked';
	let { status, lang }: { status: Status; lang: Lang } = $props();
	const t = $derived(messages(lang));
</script>

<span class="pill pill-{status}">{t[`status_${status}` as const]}</span>
