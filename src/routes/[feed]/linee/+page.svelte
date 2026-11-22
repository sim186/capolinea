<script lang="ts">
	import { onMount } from 'svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import { loadRoutes, MODES, MODE_ORDER, titleCase, type Mode, type RouteIdx, B } from '$lib/data';

	let routes = $state<RouteIdx[]>([]);
	let filter = $state<Mode | null>(null);
	onMount(async () => (routes = await loadRoutes()));

	const groups = $derived(
		MODE_ORDER.filter((m) => !filter || m === filter)
			.map((m) => ({
				mode: m,
				items: routes
					.filter((r) => r.mode === m)
					.sort((a, b) => a.name.localeCompare(b.name, 'it', { numeric: true }))
			}))
			.filter((g) => g.items.length)
	);
</script>

<div class="page stack">
	<h1 class="display">Linee</h1>
	<div class="filters" role="group" aria-label="Filtra per tipo">
		<button class="chip" aria-pressed={filter === null} onclick={() => (filter = null)}>Tutte</button>
		{#each MODE_ORDER as m (m)}
			<button class="chip" aria-pressed={filter === m} onclick={() => (filter = filter === m ? null : m)}>
				{MODES[m].plural}
			</button>
		{/each}
	</div>

	{#each groups as g (g.mode)}
		<section>
			<h2 class="label">{MODES[g.mode].plural} · {g.items.length}</h2>
			<ul class="list">
				{#each g.items as r (r.id)}
					<li>
						<a href="{B()}/linea/{r.id}">
							<LineBadge name={r.name} mode={r.mode} />
							<span class="grow ellipsis">→ {titleCase(r.to)}</span>
							<span class="muted n">{r.stops} ferm.</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</div>

<style>
	.filters {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		padding-bottom: 4px;
		scrollbar-width: none;
	}
	.n {
		font-size: 0.8125rem;
	}
	section h2 {
		margin: 8px 0 4px;
	}
</style>
