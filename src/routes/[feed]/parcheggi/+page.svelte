<script lang="ts">
	import { onMount } from 'svelte';
	import { B, getCfg, loadParking, type ParkingLot } from '$lib/data';
	import InfoTabs from '$lib/components/InfoTabs.svelte';
	import Icon from '$lib/components/Icon.svelte';

	let lots = $state<{ updated: string; items: ParkingLot[] } | null | undefined>(undefined);
	const cfg = getCfg();
	onMount(async () => (lots = await loadParking()));

	const upd = (iso?: string) =>
		iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '';
</script>

<div class="page stack">
	<h1 class="display">Info</h1>
	<InfoTabs current="parcheggi" />

	{#if lots === undefined}
		<p class="muted body">Carico…</p>
	{:else if lots === null}
		<p class="body">Per questa città non ci sono ancora i parcheggi.</p>
	{:else}
		<p class="muted body">{lots.items.length} parcheggi gestiti da {cfg?.operator}, ordinati per nome.</p>
		{#each lots.items as p (p.id)}
			<article class="card lot" id={p.id}>
				<header>
					<h2 class="title-m grow">{p.name}</h2>
					<span class="pillst {p.level}">{p.status || '—'}</span>
				</header>
				{#if p.address && p.address !== p.name}<p class="muted body">{p.address}</p>{/if}
				<dl>
					{#if p.spots}<div><dt>Posti</dt><dd>{p.spots}</dd></div>{/if}
					{#if p.hours}<div><dt>Orari</dt><dd>{p.hours}</dd></div>{/if}
					{#if p.payment}<div><dt>Pagamento</dt><dd>{p.payment}</dd></div>{/if}
				</dl>
				<div class="tags">
					{#if p.charging}<span class="tag">Colonnine di ricarica</span>{/if}
					{#if p.guarded}<span class="tag">Custodito</span>{/if}
				</div>
				{#if p.rates}
					<details>
						<summary class="btn text">Tariffe</summary>
						<!-- HTML sanitizzato in fase di build -->
						<div class="html body">{@html p.rates}</div>
					</details>
				{/if}
				{#if p.passes}
					<details>
						<summary class="btn text">Abbonamenti</summary>
						<div class="html body">{@html p.passes}</div>
					</details>
				{/if}
				{#if p.lat != null && p.lon != null}
					<a class="btn tonal" href="{B()}/mappa?parcheggio={p.id}"><Icon name="map" /> Sulla mappa</a>
				{/if}
			</article>
		{/each}
		<p class="muted body foot">
			Fonte: {cfg?.operatorFull}. Aggiornato il {upd(lots.updated)}. Controlla sempre orari e tariffe sul posto.
		</p>
	{/if}
</div>

<style>
	.lot {
		display: flex;
		flex-direction: column;
		gap: 8px;
		align-items: flex-start;
	}
	header {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
	}
	.pillst {
		font-size: 0.8125rem;
		font-weight: 800;
		padding: 4px 10px;
		border-radius: 12px;
	}
	.pillst.ok {
		background: color-mix(in srgb, #2e7d4f 20%, var(--surface));
	}
	.pillst.warn {
		background: color-mix(in srgb, #e0a100 28%, var(--surface));
	}
	.pillst.bad {
		background: color-mix(in srgb, var(--error) 22%, var(--surface));
	}
	dl {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 0.9375rem;
	}
	dl div {
		display: flex;
		gap: 12px;
	}
	dt {
		width: 84px;
		flex: none;
		color: var(--on-surface-variant);
		font-weight: 600;
	}
	dd {
		margin: 0;
	}
	.tags {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}
	.tag {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 6px;
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
	summary {
		list-style: none;
		cursor: pointer;
		width: fit-content;
		padding-left: 0;
	}
	.html {
		margin: 4px 0 4px 0;
	}
	.html :global(p) {
		margin: 0 0 6px;
	}
	article > :global(.btn) {
		margin-top: 4px;
	}
</style>
