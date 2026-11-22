<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import LineBadge from '$lib/components/LineBadge.svelte';
	import { B, getCfg, lineColor, loadParking, loadRoute, loadStops, titleCase, type ParkingLot, type Route, type StopIdx } from '$lib/data';

	let el: HTMLDivElement;
	let selected = $state<StopIdx | null>(null);
	let route = $state<Route | null>(null);
	let lot = $state<ParkingLot | null>(null);

	onMount(() => {
		let map: import('maplibre-gl').Map | undefined;
		let ro: ResizeObserver | undefined;
		let dead = false;
		(async () => {
			const maplibregl = await import('maplibre-gl');
			maplibregl.setWorkerUrl(workerUrl);
			const stops = await loadStops();
			if (dead) return;
			const lineId = page.url.searchParams.get('linea');
			const stopId = page.url.searchParams.get('fermata');
			const focus = stops.find((s) => s[0] === stopId);
			const parking = (await loadParking())?.items.filter((p) => p.lat != null && p.lon != null) ?? [];
			const lotId = page.url.searchParams.get('parcheggio');
			const lotFocus = parking.find((p) => p.id === lotId);

			map = new maplibregl.Map({
				container: el,
				center: focus ? [focus[3], focus[2]] : lotFocus ? [lotFocus.lon!, lotFocus.lat!] : (getCfg()?.center ?? [12.5, 42]),
				zoom: focus || lotFocus ? 16 : (getCfg()?.zoom ?? 5),
				attributionControl: { compact: true },
				style: {
					version: 8,
					sources: {
						osm: {
							type: 'raster',
							tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
							tileSize: 256,
							maxzoom: 19,
							attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
						}
					},
					layers: [{ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.6, 'raster-opacity': 0.9 } }]
				}
			});
			ro = new ResizeObserver(() => map?.resize());
			ro.observe(el);
			map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
			map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false, positionOptions: { enableHighAccuracy: true } }), 'top-right');

			map.on('load', async () => {
				const m = map!;
				m.addSource('stops', {
					type: 'geojson',
					data: {
						type: 'FeatureCollection',
						features: stops.map((s) => ({
							type: 'Feature',
							properties: { id: s[0] },
							geometry: { type: 'Point', coordinates: [s[3], s[2]] }
						}))
					}
				});
				m.addLayer({
					id: 'stops',
					type: 'circle',
					source: 'stops',
					minzoom: 12,
					paint: {
						'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 7],
						'circle-color': '#ffffff',
						'circle-stroke-color': '#0a5fa8',
						'circle-stroke-width': 2
					}
				});
				m.on('click', 'stops', (e) => {
					const id = e.features?.[0]?.properties?.id;
					selected = stops.find((s) => s[0] === id) ?? null;
					lot = null;
				});
				m.on('mouseenter', 'stops', () => (m.getCanvas().style.cursor = 'pointer'));
				m.on('mouseleave', 'stops', () => (m.getCanvas().style.cursor = ''));
				if (focus) selected = focus;
				for (const p of parking) {
					const el = document.createElement('button');
					el.className = 'pk';
					el.textContent = 'P';
					el.setAttribute('aria-label', `Parcheggio ${p.name}`);
					el.onclick = (ev) => {
						ev.stopPropagation();
						lot = p;
						selected = null;
					};
					new maplibregl.Marker({ element: el }).setLngLat([p.lon!, p.lat!]).addTo(m);
				}
				if (lotFocus) lot = lotFocus;

				if (lineId) {
					route = await loadRoute(lineId);
					const col = lineColor(route.name, route.mode).bg;
					const b = new maplibregl.LngLatBounds();
					route.dirs.forEach((d, i) => {
						const coords = d.shape ?? d.stops.map((id) => stops.find((s) => s[0] === id)).filter(Boolean).map((s) => [s![3], s![2]]);
						coords.forEach((c) => b.extend(c as [number, number]));
						m.addSource(`r${i}`, { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } } });
						m.addLayer({
							id: `r${i}`,
							type: 'line',
							source: `r${i}`,
							layout: { 'line-cap': 'round', 'line-join': 'round' },
							paint: { 'line-color': col, 'line-width': 5, 'line-opacity': i === 0 ? 0.95 : 0.5 }
						}, 'stops');
					});
					if (!b.isEmpty()) m.fitBounds(b, { padding: 40 });
				}
			});
		})();
		return () => {
			dead = true;
			ro?.disconnect();
			map?.remove();
		};
	});
</script>

<div class="wrap">
	<div class="map" bind:this={el} aria-label="Mappa delle fermate"></div>
	{#if route}
		<a class="topchip" href="{B()}/linea/{route.id}">
			<LineBadge name={route.name} mode={route.mode} size="s" /> <span>Dettagli linea</span>
		</a>
	{/if}
	{#if lot}
		<div class="sheet" role="dialog" aria-label="Parcheggio selezionato">
			<div class="grow">
				<div class="title-m ellipsis">Parcheggio {lot.name}</div>
				<div class="muted body">{lot.status}{lot.spots ? ` · ${lot.spots}` : ''}</div>
			</div>
			<a class="btn" href="{B()}/parcheggi#{lot.id}">Dettagli</a>
			<button class="btn text" onclick={() => (lot = null)} aria-label="Chiudi">✕</button>
		</div>
	{:else if selected}
		<div class="sheet" role="dialog" aria-label="Fermata selezionata">
			<div class="grow">
				<div class="title-m ellipsis">{titleCase(selected[1])}</div>
				<div class="muted body">{selected[4].slice(0, 10).join(' · ')}</div>
			</div>
			<a class="btn" href="{B()}/fermata/{selected[0]}">Partenze</a>
			<button class="btn text" onclick={() => (selected = null)} aria-label="Chiudi">✕</button>
		</div>
	{/if}
</div>

<style>
	:global(.pk) {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		border: 2px solid #fff;
		background: #1b5fa8;
		color: #fff;
		font: 800 16px/1 'Overpass Variable', system-ui, sans-serif;
		cursor: pointer;
		display: grid;
		place-items: center;
		padding: 0;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.4);
	}
	.wrap {
		position: fixed;
		inset: calc(var(--bar-h) + env(safe-area-inset-top)) 0 calc(var(--nav-h) + env(safe-area-inset-bottom)) 0;
	}
	.map {
		position: absolute;
		inset: 0;
	}
	.sheet {
		position: absolute;
		left: 12px;
		right: 12px;
		bottom: 12px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 8px 14px 16px;
		background: var(--surface-container-low);
		border-radius: var(--r-lg);
		box-shadow: var(--shadow);
		z-index: 2;
	}
	.topchip {
		position: absolute;
		z-index: 2;
		top: 10px;
		left: 10px;
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: var(--r-sm);
		background: var(--surface);
		box-shadow: var(--shadow);
		font-weight: 700;
	}
</style>
