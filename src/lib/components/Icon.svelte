<script lang="ts">
	/** A handful of line icons, drawn inline so the page loads nothing from elsewhere. */
	const PATHS = {
		shield: 'M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3z',
		lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
		eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
		copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
		check: 'M5 12.5l4.5 4.5L19 7.5',
		alert: 'M12 4l9 16H3l9-16zm0 6v4m0 3v.01',
		chevronDown: 'M6 9l6 6 6-6',
		chevronRight: 'M9 6l6 6-6 6'
	} as const;

	let { name, size = 20 }: { name: keyof typeof PATHS; size?: number } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"><path d={PATHS[name]} /></svg>
