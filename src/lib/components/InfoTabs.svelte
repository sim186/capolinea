<script lang="ts">
	import { B } from '$lib/data';
	let { current }: { current: 'avvisi' | 'tariffe' | 'parcheggi' } = $props();
	const tabs = [
		['avvisi', 'Avvisi'],
		['tariffe', 'Biglietti'],
		['parcheggi', 'Parcheggi']
	] as const;
</script>

<div class="seg" role="group" aria-label="Sezione informazioni">
	{#each tabs as [k, label] (k)}
		<a href="{B()}/{k}" aria-current={current === k ? 'page' : undefined}>{label}</a>
	{/each}
</div>

<style>
	.seg {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border: 1px solid var(--outline);
		border-radius: 20px;
		overflow: hidden;
	}
	a {
		display: grid;
		place-items: center;
		text-align: center;
		min-height: 44px;
		padding: 4px 8px;
		font-weight: 700;
		font-size: 0.9375rem;
	}
	a + a {
		border-left: 1px solid var(--outline);
	}
	a[aria-current='page'] {
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
</style>
