<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import {
		hhmm, loadMeta, loadServices, loadStop, loadStops, nextDepartures, romeNow, titleCase,
		type Meta, type StopDetail, type StopIdx, B } from '$lib/data';
	import { samePlace } from '$lib/search';

	let stop = $state<StopDetail | null>(null);
	let services = $state<number[][]>([]);
	let meta = $state<Meta | null>(null);
	let all = $state<StopIdx[]>([]);
	let now = $state(romeNow());
	let error = $state('');
	let onlyLine = $state<string | null>(null);

	$effect(() => {
		const id = page.params.id!;
		stop = null;
		error = '';
		onlyLine = null;
		Promise.all([loadStop(id), loadServices(), loadStops(), loadMeta()])
			.then(([s, sv, st, m]) => ([stop, services, all, meta] = [s, sv, st, m]))
			.catch(() => (error = 'Fermata non trovata.'));
	});
	onMount(() => {
		const t = setInterval(() => (now = romeNow()), 20_000);
		return () => clearInterval(t);
	});

	const lines = $derived(
		stop ? [...new Map(stop.deps.map((d) => [d.i, d])).values()].sort((a, b) => a.r.localeCompare(b.r, 'it', { numeric: true })) : []
	);
	const deps = $derived(
		stop ? nextDepartures(stop, services, now, 80).filter((d) => !onlyLine || d.i === onlyLine).slice(0, 15) : []
	);
	const siblings = $derived(
		stop ? samePlace(all, all.find((s) => s[0] === stop!.id)!).filter((s) => s[0] !== stop!.id) : []
	);
	const expired = $derived(meta ? now.day > meta.validTo : false);
	const wait = (m: number) => (m <= 0 ? 'ora' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`);
	const dayLabel = (d: number) =>
		d === 0 ? '' : d === 1 ? 'domani ' : new Date((now.day + d) * 864e5).toLocaleDateString('it-IT', { weekday: 'long', timeZone: 'UTC' }) + ' ';
</script>

<div class="page stack">
	<a class="back" href="{B()}/"><Icon name="back" size={20} /> Cerca</a>

	{#if error}
		<p class="body">{error}</p>
	{:else if !stop}
		<p class="muted body">Carico…</p>
	{:else}
		<header>
			<p class="label">Fermata #{stop.id}</p>
			<h1 class="display">{titleCase(stop.n)}</h1>
		</header>

		<div class="chips" role="group" aria-label="Filtra per linea">
			<button class="chip" aria-pressed={onlyLine === null} onclick={() => (onlyLine = null)}>Tutte</button>
			{#each lines as l (l.i)}
				<button class="lchip" aria-pressed={onlyLine === l.i} onclick={() => (onlyLine = onlyLine === l.i ? null : l.i)}>
					<LineBadge name={l.r} mode={l.m} size="s" />
				</button>
			{/each}
		</div>

		<section>
			<h2 class="label">Prossime partenze (orario programmato)</h2>
			{#if expired}
				<p class="body muted">Il feed ANM è scaduto: gli orari non sono disponibili.</p>
			{:else if !deps.length}
				<p class="body muted">Nessuna partenza programmata per oggi.</p>
			{:else}
				<ul class="list">
					{#each deps as d (d.i + d.secs + d.h)}
						<li>
							<a href="{B()}/linea/{d.i}">
								<LineBadge name={d.r} mode={d.m} />
								<div class="grow">
									<div class="title-m ellipsis">{titleCase(d.h)}</div>
									<div class="muted body">{d.day === 0 ? hhmm(d.secs) : dayLabel(d.day).trim()}</div>
								</div>
								<span class="wait" class:soon={d.wait <= 3}>{d.day === 0 ? wait(d.wait) : hhmm(d.secs)}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<div class="actions">
			<a class="btn tonal" href="{B()}/percorso?a={stop.id}"><Icon name="route" /> Parti da qui</a>
			<a class="btn tonal" href="{B()}/percorso?b={stop.id}"><Icon name="stop" /> Arriva qui</a>
			<a class="btn text" href="{B()}/mappa?fermata={stop.id}"><Icon name="map" /> Mappa</a>
		</div>

		{#if siblings.length}
			<section>
				<h2 class="label">Altri pali qui vicino</h2>
				<ul class="list">
					{#each siblings as s (s[0])}
						<li>
							<a href="{B()}/fermata/{s[0]}">
								<div class="grow">
									<div class="title-m">#{s[0]}</div>
									<div class="muted body">{s[4].join(' · ')}</div>
								</div>
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
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
	.chips {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		align-items: center;
		scrollbar-width: none;
		padding: 2px;
	}
	.lchip {
		background: none;
		border: 2px solid transparent;
		border-radius: 10px;
		padding: 2px;
		cursor: pointer;
	}
	.lchip[aria-pressed='true'] {
		border-color: var(--primary);
	}
	.wait {
		font-weight: 800;
		font-size: 1.125rem;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.wait.soon {
		color: var(--accent);
	}
	.actions {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	section h2 {
		margin-bottom: 4px;
	}
</style>
