<script lang="ts">
	let { size = 30 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
	<circle cx="15" cy="15" r="10" fill="none" stroke="var(--accent)" stroke-width="4" />
	<rect x="1" y="11.5" width="28" height="7" rx="1" fill="var(--primary)" />
</svg>
