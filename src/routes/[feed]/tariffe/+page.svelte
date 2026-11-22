<script lang="ts">
	import { onMount } from 'svelte';
	import { euro, getCfg, loadFares, type Fares } from '$lib/data';
	import InfoTabs from '$lib/components/InfoTabs.svelte';

	let fares = $state<Fares | null | undefined>(undefined);
	let scope = $state(0);
	const cfg = getCfg();
	onMount(async () => (fares = await loadFares()));

	const cur = $derived(fares?.scopes[scope]);
	const label = (id: string) => id.replace(/\s+A$/, '');
	const hasCompany = $derived(cur?.items.some((i) => i.company != null));
	const fine = $derived(fares?.fines.find((f) => f.scope === cur?.id) ?? fares?.fines[0]);
	const upd = (iso?: string) =>
		iso ? new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }) : '';
</script>

<div class="page stack">
	<h1 class="display">Info</h1>
	<InfoTabs current="tariffe" />

	{#if fares === undefined}
		<p class="muted body">Carico…</p>
	{:else if fares === null}
		<p class="body">Per questa città non ci sono ancora le tariffe.</p>
	{:else}
		<div class="filters" role="group" aria-label="Ambito tariffario">
			{#each fares.scopes as s, i (s.id)}
				<button class="chip" aria-pressed={scope === i} onclick={() => (scope = i)}>{label(s.name)}</button>
			{/each}
		</div>

		{#if cur}
			<section>
				<div class="card tbl" role="table" aria-label="Tariffe {label(cur.name)}">
					<div class="head" role="row">
						<span role="columnheader" class="grow">Titolo</span>
						{#if hasCompany}<span role="columnheader" class="price">Solo {cfg?.operator ?? 'azienda'}</span>{/if}
						<span role="columnheader" class="price">Integrato</span>
					</div>
					{#each cur.items as it (it.name)}
						<div class="line" role="row">
							<span role="cell" class="grow name">{it.name}</span>
							{#if hasCompany}<span role="cell" class="price" class:na={it.company == null}>{euro(it.company)}</span>{/if}
							<span role="cell" class="price" class:na={it.integrated == null}>{euro(it.integrated)}</span>
						</div>
					{/each}
				</div>
				<p class="muted body note">
					<strong>Solo {cfg?.operator}</strong>: vale solo sui mezzi dell'azienda.
					<strong>Integrato</strong>: vale su più aziende (circuito Unico Campania).
				</p>
			</section>
		{/if}

		{#if fine}
			<section>
				<h2 class="label">Se viaggi senza biglietto valido</h2>
				<div class="card fines">
					<div class="f"><span class="muted">Pagando subito (5 giorni)</span><strong>{euro(fine.within5)}</strong></div>
					<div class="f"><span class="muted">Entro 60 giorni</span><strong>{euro(fine.within60)}</strong></div>
					<div class="f"><span class="muted">Oltre i 60 giorni</span><strong>{euro(fine.full)}</strong></div>
				</div>
			</section>
		{/if}

		{#each fares.info as i (i.title)}
			<details class="card">
				<summary class="title-m">{i.title}</summary>
				<!-- HTML sanitizzato in fase di build (scripts/sources) -->
				<div class="html body">{@html i.html}</div>
			</details>
		{/each}

		<p class="muted body foot">
			Fonte: <a href={fares.source} target="_blank" rel="noopener noreferrer">{cfg?.operatorFull}</a>,
			letto il {upd(fares.updated)}. Le tariffe possono cambiare: in caso di dubbio vale quanto indicato
			dall'azienda o al punto vendita.
		</p>
	{/if}
</div>

<style>
	.filters {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tbl {
		display: flex;
		flex-direction: column;
		padding: 4px 16px;
	}
	.head,
	.line {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 52px;
	}
	.head {
		min-height: 40px;
		font-size: 0.75rem;
		font-weight: 800;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--on-surface-variant);
	}
	.line + .line,
	.head + .line {
		border-top: 1px solid var(--outline-variant);
	}
	.name {
		font-weight: 700;
	}
	.price {
		width: 84px;
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		flex: none;
	}
	.head .price {
		font-weight: 800;
	}
	.price.na {
		font-weight: 400;
		color: var(--on-surface-variant);
	}
	.note {
		margin-top: 8px;
	}
	.fines {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.f {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 12px;
	}
	summary {
		cursor: pointer;
	}
	.html {
		margin-top: 10px;
	}
	.html :global(p) {
		margin: 0 0 8px;
	}
	.html :global(ul) {
		padding-left: 20px;
	}
	.foot a {
		color: var(--primary);
		font-weight: 700;
	}
	section h2 {
		margin-bottom: 8px;
	}
</style>
