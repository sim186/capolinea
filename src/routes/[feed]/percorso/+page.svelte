<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import StopPicker from '$lib/components/StopPicker.svelte';
	import {
		hhmm, loadServices, loadStop, loadStops, nextDepartures, romeNow, titleCase,
		type StopIdx
	} from '$lib/data';
	import { plan, type Journey } from '$lib/planner';

	type Place = { label: string; ids: string[]; la: number; lo: number };
	let a = $state<Place | null>(null);
	let b = $state<Place | null>(null);
	let pa: StopPicker | undefined = $state();
	let pb: StopPicker | undefined = $state();
	let results = $state<Journey[] | null>(null);
	let busy = $state(false);
	let names = $state<Map<string, StopIdx>>(new Map());
	let nextTimes = $state<Record<string, string>>({});

	onMount(async () => {
		names = new Map((await loadStops()).map((s) => [s[0], s]));
		const qa = page.url.searchParams.get('a'), qb = page.url.searchParams.get('b');
		// attende il caricamento dei picker
		setTimeout(() => {
			if (qa) pa?.setById(qa);
			if (qb) pb?.setById(qb);
		}, 50);
	});

	const nm = (id: string) => titleCase(names.get(id)?.[1] ?? id);

	async function go() {
		if (!a || !b) return;
		busy = true;
		results = null;
		nextTimes = {};
		try {
			results = await plan(a.ids, b.ids);
			const services = await loadServices();
			const now = romeNow();
			for (const [ji, j] of results.entries()) {
				const first = j.legs.find((l) => l.type === 'ride');
				if (first?.type !== 'ride') continue;
				const sd = await loadStop(first.stops[0]);
				const ups = nextDepartures(sd, services, now, 40).filter((u) => u.i === first.routeId).slice(0, 3);
				nextTimes[ji] = ups.length ? ups.map((u) => hhmm(u.secs)).join(' · ') : '';
			}
		} finally {
			busy = false;
		}
	}
	function swap() {
		[a, b] = [b, a];
		results = null;
	}
	$effect(() => {
		if (a && b) go();
	});
</script>

<div class="page stack">
	<h1 class="display">Percorso</h1>

	<div class="pickers">
		<div class="col">
			<StopPicker bind:this={pa} label="Da" bind:value={a} />
			<StopPicker bind:this={pb} label="A" bind:value={b} />
		</div>
		<button class="swap" onclick={swap} aria-label="Inverti partenza e arrivo"><Icon name="swap" /></button>
	</div>

	{#if busy}
		<p class="muted body" role="status">Calcolo…</p>
	{:else if results && !results.length}
		<p class="body" role="status">Nessun percorso trovato. Prova con fermate diverse.</p>
	{:else if results}
		{#each results as j, ji (ji)}
			<article class="card j">
				<header class="jh">
					<span class="title-l">~{j.minutes} min</span>
					<span class="muted body">{j.transfers === 0 ? 'senza cambi' : j.transfers === 1 ? '1 cambio' : `${j.transfers} cambi`}</span>
				</header>
				<ol class="legs">
					{#each j.legs as l, li (li)}
						{#if l.type === 'ride'}
							<li class="ride">
								<LineBadge name={l.name} mode={l.mode} />
								<div class="grow">
									<div class="title-m">Sali a {nm(l.stops[0])}</div>
									<div class="muted body">
										{l.stops.length - 1} {l.stops.length === 2 ? 'fermata' : 'fermate'} · scendi a {nm(l.stops[l.stops.length - 1])}
									</div>
									{#if li === j.legs.findIndex((x) => x.type === 'ride') && nextTimes[ji]}
										<div class="body next">Prossime: <strong>{nextTimes[ji]}</strong></div>
									{/if}
								</div>
							</li>
						{:else}
							<li class="walk">
								<span class="wi"><Icon name="walk" /></span>
								<div class="grow muted body">
									A piedi {l.meters} m (~{l.minutes} min) fino a {nm(l.to)}
								</div>
							</li>
						{/if}
					{/each}
				</ol>
			</article>
		{/each}
		<p class="muted body">
			Stima basata sulla rete e su tempi medi di percorrenza, non sugli orari reali: usala per
			capire <em>quali linee prendere</em>. Controlla le partenze alla fermata.
		</p>
	{:else}
		<p class="muted body">Scegli partenza e arrivo. Puoi usare la tua posizione.</p>
	{/if}
</div>

<style>
	.pickers {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.col {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.swap {
		flex: none;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 0;
		background: var(--secondary-container);
		color: var(--on-secondary-container);
		display: grid;
		place-items: center;
		cursor: pointer;
	}
	.j {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.jh {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}
	.legs {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.legs li {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}
	.wi {
		width: 40px;
		display: grid;
		place-items: center;
		color: var(--on-surface-variant);
		flex: none;
	}
	.next {
		margin-top: 2px;
	}
</style>
