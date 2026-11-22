<script lang="ts">
	import { onMount } from 'svelte';
	import { getCfg, loadNews, loadRoutes, loadStatus, B, type News, type NewsItem, type RouteIdx, type Status } from '$lib/data';
	import NewsCard from '$lib/components/NewsCard.svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';

	let news = $state<News | null | undefined>(undefined);
	let status = $state<Status | null | undefined>(undefined);
	let routes = $state<Map<string, RouteIdx>>(new Map());
	let filter = $state<'all' | NewsItem['kind']>('all');
	const cfg = getCfg();

	onMount(async () => {
		[news, status] = await Promise.all([loadNews(), loadStatus()]);
		routes = new Map((await loadRoutes()).map((r) => [r.name, r]));
	});

	const strikes = $derived(news?.items.filter((n) => n.kind === 'strike').slice(0, 3) ?? []);
	const list = $derived(news?.items.filter((n) => filter === 'all' || n.kind === filter) ?? []);
	const notOk = $derived(status?.services.filter((s) => s.level !== 'ok') ?? []);
	const upd = (iso?: string) =>
		iso ? new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '';
	const FILTERS = [
		['all', 'Tutte'],
		['strike', 'Scioperi'],
		['closure', 'Chiusure'],
		['change', 'Variazioni'],
		['info', 'Info']
	] as const;
</script>

<div class="page stack">
	<h1 class="display">Avvisi</h1>

	{#if news === undefined}
		<p class="muted body">Carico…</p>
	{:else if news === null}
		<p class="body">Per questa città non ci sono ancora avvisi.</p>
	{:else}
		{#if status}
			<section>
				<h2 class="label">Stato dei servizi</h2>
				<div class="card status">
					{#each ['Metro', 'Funicolare'] as cat (cat)}
						{#each status.services.filter((s) => s.category === cat) as s (s.name)}
							<a class="row" href={routes.get(s.name) ? `${B()}/linea/${routes.get(s.name)!.id}` : undefined}>
								{#if s.name.length <= 4}
									<LineBadge name={s.name} mode={routes.get(s.name)?.mode ?? 'metro'} size="s" />
									<span class="grow">{s.type}</span>
								{:else}
									<span class="grow">{s.name}</span>
								{/if}
								<span class="pillst {s.level}">{s.status}</span>
							</a>
						{/each}
					{/each}
					<div class="row">
						<span class="grow">Bus e tram</span>
						<span class="pillst {notOk.filter((s) => s.category === 'Bus').length ? 'warn' : 'ok'}">
							{notOk.filter((s) => s.category === 'Bus').length} linee con variazioni
						</span>
					</div>
				</div>
				{#if notOk.filter((s) => s.category === 'Bus').length}
					<details class="more">
						<summary class="btn text">Quali linee bus?</summary>
						<ul class="bl">
							{#each notOk.filter((s) => s.category === 'Bus') as s (s.name)}
								<li>
									{#if routes.get(s.name)}
										<a href="{B()}/linea/{routes.get(s.name)!.id}"><LineBadge name={s.name} mode={routes.get(s.name)!.mode} size="s" /></a>
									{:else}
										<span class="mini">{s.name}</span>
									{/if}
									<span class="muted body">{s.status}</span>
								</li>
							{/each}
						</ul>
					</details>
				{/if}
			</section>
		{/if}

		{#if strikes.length}
			<section class="stack">
				<h2 class="label">Scioperi</h2>
				{#each strikes as n (n.id)}
					<NewsCard item={n} {routes} />
				{/each}
			</section>
		{/if}

		<section class="stack">
			<h2 class="label">Notizie</h2>
			<div class="filters" role="group" aria-label="Filtra per tipo">
				{#each FILTERS as [k, l] (k)}
					<button class="chip" aria-pressed={filter === k} onclick={() => (filter = k)}>{l}</button>
				{/each}
			</div>
			{#each list as n (n.id)}
				<NewsCard item={n} {routes} />
			{:else}
				<p class="muted body">Nessuna notizia in questa categoria.</p>
			{/each}
		</section>

		<p class="muted body foot">
			Fonte: <a href={cfg?.website} target="_blank" rel="noopener noreferrer">{cfg?.operatorFull}</a>.
			Aggiornato il {upd(news.updated)}. Capolinea è un progetto indipendente: per
			comunicazioni ufficiali fai riferimento al sito dell'azienda.
		</p>
	{/if}
</div>

<style>
	section h2 {
		margin-bottom: 8px;
	}
	.status {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 8px 12px;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 48px;
	}
	.pillst {
		font-size: 0.8125rem;
		font-weight: 800;
		padding: 4px 10px;
		border-radius: 12px;
		text-align: right;
		flex: none;
		max-width: 55%;
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
	.more summary {
		list-style: none;
		cursor: pointer;
		width: fit-content;
	}
	.bl {
		list-style: none;
		padding: 0;
		margin: 4px 0 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 8px;
	}
	.bl li {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.mini {
		font-weight: 800;
	}
	.filters {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.foot a {
		color: var(--primary);
		font-weight: 700;
	}
</style>
