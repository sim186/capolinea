<script lang="ts">
	import '../app.css';
	import { base } from '$lib/paths';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>Capolinea · Trasporto pubblico</title>
	<link rel="icon" href="{base}/favicon.svg" type="image/svg+xml" />
</svelte:head>

{@render children()}
