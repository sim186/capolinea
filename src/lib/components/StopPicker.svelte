<script lang="ts">
	import { distance, loadStops, norm, titleCase, type StopIdx } from '$lib/data';
	import { samePlace, searchStops } from '$lib/search';
	import Icon from './Icon.svelte';

	export interface Place {
		label: string;
		ids: string[];
		la: number;
		lo: number;
	}
	let { label, value = $bindable(null) }: { label: string; value: Place | null } = $props();

	let stops = $state<StopIdx[]>([]);
	let q = $state('');
	let open = $state(false);
	let msg = $state('');
	loadStops().then((s) => (stops = s));

	const hits = $derived.by(() => {
		const seen = new Set<string>();
		const out: StopIdx[] = [];
		for (const h of searchStops(stops, q, 60)) {
			const k = norm(h.s[1]);
			if (seen.has(k)) continue;
			seen.add(k);
			out.push(h.s);
			if (out.length >= 7) break;
		}
		return out;
	});

	function pick(s: StopIdx) {
		const ids = samePlace(stops, s).map((x) => x[0]);
		value = { label: titleCase(s[1]), ids, la: s[2], lo: s[3] };
		open = false;
		q = '';
	}
	function here() {
		msg = 'Cerco la posizione…';
		navigator.geolocation.getCurrentPosition(
			(p) => {
				const { latitude: la, longitude: lo } = p.coords;
				const near = stops
					.map((s) => ({ s, d: distance(la, lo, s[2], s[3]) }))
					.filter((x) => x.d < 500)
					.sort((a, b) => a.d - b.d)
					.slice(0, 6);
				if (!near.length) return (msg = 'Nessuna fermata entro 500 m dalla tua posizione.');
				value = { label: 'La mia posizione', ids: near.map((n) => n.s[0]), la, lo };
				msg = '';
				open = false;
			},
			() => (msg = 'Posizione non disponibile.'),
			{ enableHighAccuracy: true, timeout: 10000 }
		);
	}
	export function setById(id: string) {
		const s = stops.find((x) => x[0] === id);
		if (s) pick(s);
	}
</script>

<div class="picker">
	{#if value && !open}
		<button class="sel" onclick={() => ((open = true), (q = ''))} aria-label="{label}: {value.label}. Cambia">
			<span class="label">{label}</span>
			<span class="v title-m ellipsis">{value.label}</span>
		</button>
	{:else}
		<div class="field">
			<label class="label" for="pk-{label}">{label}</label>
			<input
				id="pk-{label}"
				type="search"
				bind:value={q}
				placeholder="Cerca una fermata"
				autocomplete="off"
				autocapitalize="off"
				onfocus={() => (open = true)}
			/>
		</div>
		{#if open}
			<ul class="sug list">
				<li>
					<button class="row" onclick={here}><Icon name="locate" /> <span>La mia posizione</span></button>
				</li>
				{#each hits as s (s[0])}
					<li>
						<button class="row" onclick={() => pick(s)}>
							<Icon name="stop" />
							<span class="grow ellipsis">{titleCase(s[1])}</span>
							<span class="muted n">{s[4].slice(0, 3).join(' ')}</span>
						</button>
					</li>
				{/each}
			</ul>
			{#if msg}<p class="muted body" role="status">{msg}</p>{/if}
		{/if}
	{/if}
</div>

<style>
	.picker {
		position: relative;
	}
	.sel,
	.field {
		display: flex;
		flex-direction: column;
		gap: 2px;
		width: 100%;
		min-height: 60px;
		padding: 8px 16px;
		border-radius: var(--r-md);
		background: var(--surface-container-high);
		border: 0;
		text-align: left;
		cursor: pointer;
		justify-content: center;
	}
	.v {
		max-width: 100%;
	}
	.field input {
		border: 0;
		outline: 0;
		background: none;
		font-size: 1rem;
		height: 28px;
		padding: 0;
	}
	.field:focus-within {
		outline: 3px solid var(--primary);
	}
	.sug {
		margin-top: 4px;
		background: var(--surface-container);
		border-radius: var(--r-md);
		padding: 4px 8px;
		box-shadow: var(--shadow);
	}
	.n {
		font-size: 0.75rem;
	}
</style>
