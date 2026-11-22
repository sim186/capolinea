<script lang="ts">
	import { page } from '$app/state';
	import Icon from '$lib/components/Icon.svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import NewsCard from '$lib/components/NewsCard.svelte';
	import {
		hhmm, lineColor, loadNews, loadRoute, loadRoutes, loadStatus, loadStops, MODES, titleCase,
		type NewsItem, type Route, type RouteIdx, type ServiceStatus, type StopIdx, B } from '$lib/data';

	let route = $state<Route | null>(null);
	let stops = $state<Map<string, StopIdx>>(new Map());
	let dir = $state(0);
	let error = $state('');
	let st = $state<ServiceStatus | null>(null);
	let related = $state<NewsItem[]>([]);
	let routeMap = $state<Map<string, RouteIdx>>(new Map());

	$effect(() => {
		const id = page.params.id!;
		route = null;
		error = '';
		Promise.all([loadRoute(id), loadStops()])
			.then(([r, s]) => {
				route = r;
				stops = new Map(s.map((x) => [x[0], x]));
				dir = 0;
				Promise.all([loadStatus(), loadNews(), loadRoutes()]).then(([status, news, rs]) => {
					st = status?.services.find((x) => x.name === r.name) ?? null;
					related = news?.items.filter((n) => n.lines.includes(r.name)).slice(0, 4) ?? [];
					routeMap = new Map(rs.map((x) => [x.name, x]));
				});
			})
			.catch(() => (error = 'Linea non trovata.'));
	});

	const cur = $derived(route?.dirs[dir] ?? route?.dirs[0]);
	const color = $derived(route ? lineColor(route.name, route.mode).bg : 'var(--primary)');
</script>

<div class="page stack" style:--line={color}>
	<a class="back" href="{B()}/linee"><Icon name="back" size={20} /> Linee</a>

	{#if error}
		<p class="body">{error}</p>
	{:else if !route || !cur}
		<p class="muted body">Carico…</p>
	{:else}
		<header class="head">
			<LineBadge name={route.name} mode={route.mode} size="l" />
			<div class="grow">
				<h1 class="title-l">{MODES[route.mode].label} {route.name}</h1>
				<p class="muted body">{route.agency}</p>
			</div>
		</header>

		{#if route.dirs.length > 1}
			<div class="seg" role="group" aria-label="Direzione">
				{#each route.dirs as d, i (d.dir)}
					<button aria-pressed={dir === i} onclick={() => (dir = i)}>
						<span class="muted s">verso</span>
						<span class="ellipsis">{titleCase(d.headsign)}</span>
					</button>
				{/each}
			</div>
		{/if}

		{#if st && st.level !== 'ok'}
			<p class="statusbar {st.level}" role="status"><Icon name="alert" size={20} /> {st.status}</p>
		{/if}
		<p class="muted body">
			Prima partenza {hhmm(cur.first)}, ultima {hhmm(cur.last)} dal capolinea.
			{cur.trips} corse nel periodo.
		</p>
		<a class="btn tonal" href="{B()}/mappa?linea={route.id}"><Icon name="map" /> Vedi sulla mappa</a>

		{#if related.length}
			<section class="stack">
				<h2 class="label">Avvisi su questa linea</h2>
				{#each related as n (n.id)}
					<NewsCard item={n} routes={routeMap} />
				{/each}
			</section>
		{/if}

		<ol class="strip">
			{#each cur.stops as sid, i (sid + i)}
				{@const s = stops.get(sid)}
				{#if s}
					{@const others = s[4].filter((n) => n !== route!.name)}
					<li class:term={i === 0 || i === cur.stops.length - 1}>
						<a href="{B()}/fermata/{sid}">
							<span class="tick" aria-hidden="true"></span>
							<span class="name grow">
								{titleCase(s[1])}
								{#if others.length}
									<span class="inter">
										{#each others.slice(0, 7) as n (n)}<span class="mini">{n}</span>{/each}
										{#if others.length > 7}<span class="muted">+{others.length - 7}</span>{/if}
									</span>
								{/if}
							</span>
						</a>
					</li>
				{/if}
			{/each}
		</ol>
	{/if}
</div>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		color: var(--primary);
		width: fit-content;
		min-height: 40px;
	}
	.head {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.statusbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		border-radius: var(--r-md);
		font-weight: 700;
		background: color-mix(in srgb, #e0a100 28%, var(--surface));
	}
	.statusbar.bad {
		background: color-mix(in srgb, var(--error) 22%, var(--surface));
	}
	.seg {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: 1fr;
		border: 1px solid var(--outline);
		border-radius: 20px;
		overflow: hidden;
	}
	.seg button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		padding: 8px 14px;
		min-height: 52px;
		background: none;
		border: 0;
		cursor: pointer;
		font-weight: 700;
		text-align: left;
	}
	.seg button + button {
		border-left: 1px solid var(--outline);
	}
	.seg button[aria-pressed='true'] {
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
	.seg .s {
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.seg button > :global(.ellipsis) {
		max-width: 100%;
	}

	/* schema a linea, stile mappa metropolitana */
	.strip {
		list-style: none;
		margin: 8px 0 0;
		padding: 0;
	}
	.strip li a {
		position: relative;
		display: flex;
		align-items: center;
		gap: 16px;
		min-height: 52px;
		padding: 6px 4px 6px 0;
	}
	.strip li a:active {
		background: var(--surface-container);
	}
	.tick {
		position: relative;
		width: 28px;
		align-self: stretch;
		flex: none;
	}
	.tick::before {
		content: '';
		position: absolute;
		left: 10px;
		width: 8px;
		top: 0;
		bottom: 0;
		background: var(--line);
	}
	li:first-child .tick::before {
		top: 50%;
	}
	li:last-child .tick::before {
		bottom: 50%;
	}
	.tick::after {
		content: '';
		position: absolute;
		left: 6px;
		top: calc(50% - 8px);
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--surface);
		border: 4px solid var(--on-surface);
		box-sizing: content-box;
	}
	li.term .tick::after {
		left: 3px;
		top: calc(50% - 11px);
		width: 18px;
		height: 18px;
		border-width: 5px;
	}
	.name {
		font-weight: 600;
		line-height: 1.25;
	}
	li.term .name {
		font-weight: 800;
		text-transform: uppercase;
	}
	.inter {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}
	.mini {
		font-size: 0.6875rem;
		font-weight: 800;
		padding: 0 5px;
		border-radius: 4px;
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
</style>
