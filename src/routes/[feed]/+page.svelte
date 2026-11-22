<script lang="ts">
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import {
		distance, getCfg, loadMeta, loadNews, loadRoutes, loadStops, romeNow, titleCase,
		type Meta, type NewsItem, type RouteIdx, type StopIdx, B } from '$lib/data';
	import { searchRoutes, searchStops } from '$lib/search';

	let q = $state('');
	let routes = $state<RouteIdx[]>([]);
	let stops = $state<StopIdx[]>([]);
	let meta = $state<Meta | null>(null);
	let near = $state<{ s: StopIdx; d: number }[] | null>(null);
	let geoMsg = $state('');
	let recent = $state<NewsItem[]>([]);
	const cfg = getCfg();

	onMount(async () => {
		[routes, stops, meta] = await Promise.all([loadRoutes(), loadStops(), loadMeta()]);
		const news = await loadNews();
		if (news) {
			const limit = new Date(romeNow().day * 864e5 - 10 * 864e5).toISOString().slice(0, 10);
			recent = news.items
				.filter((n) => (n.date ?? '') >= limit)
				.sort((a, b) => Number(b.kind === 'strike') - Number(a.kind === 'strike'))
				.slice(0, 3);
		}
	});

	const routeHits = $derived(searchRoutes(routes, q));
	const stopHits = $derived(searchStops(stops, q));
	const expired = $derived(meta ? romeNow().day > meta.validTo : false);

	function locate() {
		geoMsg = 'Cerco la tua posizione…';
		navigator.geolocation.getCurrentPosition(
			(p) => {
				const { latitude: la, longitude: lo } = p.coords;
				near = stops
					.map((s) => ({ s, d: distance(la, lo, s[2], s[3]) }))
					.filter((x) => x.d < 800)
					.sort((a, b) => a.d - b.d)
					.slice(0, 15);
				geoMsg = near.length ? '' : 'Nessuna fermata entro 800 m.';
			},
			() => (geoMsg = 'Posizione non disponibile. Controlla i permessi del browser.'),
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}
</script>

<div class="page stack">
	<h1 class="display">Dove vai?</h1>

	<div class="search">
		<Icon name="search" />
		<input
			type="search"
			bind:value={q}
			placeholder="Linea o fermata (es. 24, Vergini)"
			aria-label="Cerca linea o fermata"
			autocomplete="off"
			autocapitalize="off"
			enterkeyhint="search"
		/>
		{#if q}
			<button class="clear" onclick={() => (q = '')} aria-label="Cancella"><Icon name="close" /></button>
		{/if}
	</div>

	{#if expired}
		<div class="card warn" role="status">
			<strong>Orari scaduti.</strong> Il feed ANM usato copre fino al {new Date((meta?.validTo ?? 0) * 864e5).toLocaleDateString('it-IT', { timeZone: 'UTC' })}. Le partenze potrebbero non essere mostrate.
		</div>
	{/if}

	{#if q}
		{#if routeHits.length}
			<section>
				<h2 class="label">Linee</h2>
				<ul class="list">
					{#each routeHits as r (r.id)}
						<li>
							<a href="{B()}/linea/{r.id}">
								<LineBadge name={r.name} mode={r.mode} />
								<span class="grow ellipsis">→ {titleCase(r.to)}</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
		<section>
			<h2 class="label">Fermate</h2>
			{#if stopHits.length}
				<ul class="list">
					{#each stopHits as h (h.s[0])}
						<li>
							<a href="{B()}/fermata/{h.s[0]}">
								<div class="grow">
									<div class="title-m ellipsis">{titleCase(h.s[1])}</div>
									<div class="chips">
										{#each h.s[4].slice(0, 8) as n (n)}<span class="mini">{n}</span>{/each}
										{#if h.s[4].length > 8}<span class="muted">+{h.s[4].length - 8}</span>{/if}
									</div>
								</div>
								<span class="muted code">#{h.s[0]}</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted body">Nessuna fermata trovata.</p>
			{/if}
		</section>
	{:else}
		<div class="actions">
			<button class="btn tonal" onclick={locate}><Icon name="locate" /> Fermate vicine</button>
			<a class="btn tonal" href="{B()}/percorso"><Icon name="route" /> Pianifica</a>
			<a class="btn tonal" href="{B()}/tariffe"><Icon name="ticket" /> Biglietti e prezzi</a>
		</div>
		{#if geoMsg}<p class="muted body" role="status">{geoMsg}</p>{/if}
		{#if near?.length}
			<section>
				<h2 class="label">Vicino a te</h2>
				<ul class="list">
					{#each near as { s, d } (s[0])}
						<li>
							<a href="{B()}/fermata/{s[0]}">
								<div class="grow">
									<div class="title-m ellipsis">{titleCase(s[1])}</div>
									<div class="chips">
										{#each s[4].slice(0, 8) as n (n)}<span class="mini">{n}</span>{/each}
									</div>
								</div>
								<span class="muted code">{Math.round(d / 10) * 10} m</span>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{:else}
			{#if recent.length}
				<section>
					<h2 class="label">Avvisi recenti</h2>
					<ul class="list alerts">
						{#each recent as n (n.id)}
							<li>
								<a href="{B()}/avvisi#{n.id}" class={n.kind}>
									<Icon name="alert" />
									<span class="grow">{n.title}</span>
								</a>
							</li>
						{/each}
					</ul>
					<a class="btn text" href="{B()}/avvisi">Tutti gli avvisi e scioperi</a>
				</section>
			{/if}
			<section class="card about">
				<h2 class="title-m">Il trasporto pubblico di Napoli, senza fatica.</h2>
				<p class="body muted">
					Cerca una linea o una fermata, guarda le prossime partenze, pianifica un percorso.
					Progetto open source indipendente: non è un sito ufficiale{cfg ? ` di ${cfg.operator}` : ''}.
				</p>
				<p class="body muted">
					Gli orari sono quelli <strong>programmati</strong> dal feed GTFS pubblico{cfg ? ` di ${cfg.operator}` : ''}. Non
					includono ritardi, soppressioni o scioperi.
				</p>
			</section>
		{/if}
	{/if}
</div>

<style>
	.search {
		display: flex;
		align-items: center;
		gap: 12px;
		height: 56px;
		padding: 0 16px;
		border-radius: 28px;
		background: var(--surface-container-high);
		position: sticky;
		top: calc(var(--bar-h) + 8px);
		z-index: 5;
	}
	.search input {
		flex: 1;
		min-width: 0;
		height: 100%;
		border: 0;
		outline: 0;
		background: none;
		font-size: 1rem;
	}
	.search:focus-within {
		outline: 3px solid var(--primary);
		outline-offset: 0;
	}
	.search input::-webkit-search-cancel-button {
		display: none;
	}
	.clear {
		background: none;
		border: 0;
		padding: 8px;
		margin-right: -8px;
		cursor: pointer;
		display: grid;
	}
	.actions {
		display: flex;
		gap: 12px;
		flex-wrap: wrap;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
		margin-top: 4px;
	}
	.mini {
		font-size: 0.75rem;
		font-weight: 700;
		padding: 1px 6px;
		border-radius: 4px;
		background: var(--secondary-container);
		color: var(--on-secondary-container);
	}
	.code {
		font-size: 0.8125rem;
		font-variant-numeric: tabular-nums;
	}
	section h2 {
		margin-bottom: 4px;
	}
	.about {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.alerts a {
		color: var(--on-surface);
	}
	.alerts a.strike {
		color: var(--accent);
		font-weight: 700;
	}
	.warn {
		background: color-mix(in srgb, var(--error) 14%, var(--surface));
	}
</style>
