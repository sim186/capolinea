<script lang="ts">
	import { B } from '$lib/data';
	let { current }: { current: 'avvisi' | 'tariffe' } = $props();
</script>

<div class="seg" role="group" aria-label="Sezione informazioni">
	<a href="{B()}/avvisi" aria-current={current === 'avvisi' ? 'page' : undefined}>Avvisi e scioperi</a>
	<a href="{B()}/tariffe" aria-current={current === 'tariffe' ? 'page' : undefined}>Biglietti e abbonamenti</a>
</div>

<style>
	.seg {
		display: grid;
		grid-template-columns: 1fr 1fr;
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
		font-size: 0.875rem;
		line-height: 1.2;
	}
	a + a {
		border-left: 1px solid var(--outline);
	}
	a[aria-current='page'] {
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
</style>
