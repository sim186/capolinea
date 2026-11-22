// Converte il GTFS ufficiale ANM in JSON statici per il sito.
// Uso: node scripts/build-data.mjs [feed-id] [percorso/al/gtfs.zip | cartella-estratta]
// Senza argomenti costruisce tutti i feed in feeds/feeds.json scaricando il GTFS.
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const DATA = new URL('../static/data/', import.meta.url).pathname;
const feeds = JSON.parse(readFileSync(new URL('../feeds/feeds.json', import.meta.url), 'utf8'));
let OUT = DATA;

// ---------- lettura GTFS ----------
async function loadFiles(src, url) {
	if (src && existsSync(src) && statSync(src).isDirectory()) {
		return (name) => (existsSync(`${src}/${name}`) ? readFileSync(`${src}/${name}`, 'utf8') : null);
	}
	const buf = src ? readFileSync(src) : Buffer.from(await (await fetch(url)).arrayBuffer());
	const files = unzipSync(new Uint8Array(buf));
	return (name) => (files[name] ? strFromU8(files[name]) : null);
}

function parseCsv(text) {
	if (!text) return [];
	const rows = [];
	let row = [], field = '', q = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (q) {
			if (c === '"') {
				if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
			} else field += c;
		} else if (c === '"') q = true;
		else if (c === ',') { row.push(field); field = ''; }
		else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
		else if (c !== '\r') field += c;
	}
	if (field || row.length) { row.push(field); rows.push(row); }
	const head = rows.shift().map((h) => h.replace(/^﻿/, ''));
	return rows.filter((r) => r.length === head.length).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

const secs = (t) => { const [h, m, s] = t.split(':').map(Number); return h * 3600 + m * 60 + s; };
const dayNum = (ymd) => Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8)) / 864e5);
const r5 = (n) => Math.round(n * 1e5) / 1e5;

const MODE = { 0: 'tram', 1: 'metro', 3: 'bus', 7: 'funicolare', 11: 'filobus' };

// ---------- Douglas-Peucker per le shape ----------
function simplify(pts, eps) {
	if (pts.length < 3) return pts;
	const keep = new Uint8Array(pts.length);
	keep[0] = keep[pts.length - 1] = 1;
	const stack = [[0, pts.length - 1]];
	while (stack.length) {
		const [a, b] = stack.pop();
		let max = 0, idx = -1;
		const [ax, ay] = pts[a], [bx, by] = pts[b];
		const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy || 1e-12;
		for (let i = a + 1; i < b; i++) {
			const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / len2));
			const d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy));
			if (d > max) { max = d; idx = i; }
		}
		if (max > eps && idx > 0) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
	}
	return pts.filter((_, i) => keep[i]);
}

async function build(feed, srcOverride) {
	OUT = `${DATA}${feed.id}/`;
	const read = await loadFiles(srcOverride, feed.gtfs);
	const routesRaw = parseCsv(read('routes.txt'));
	const stopsRaw = parseCsv(read('stops.txt'));
	const tripsRaw = parseCsv(read('trips.txt'));
	const calRaw = parseCsv(read('calendar_dates.txt'));
	const shapesRaw = parseCsv(read('shapes.txt'));
	const stRaw = parseCsv(read('stop_times.txt'));
	const agencies = Object.fromEntries(parseCsv(read('agency.txt')).map((a) => [a.agency_id, a.agency_name]));
	console.log(`GTFS: ${routesRaw.length} routes, ${stopsRaw.length} stops, ${tripsRaw.length} trips, ${stRaw.length} stop_times`);

	rmSync(OUT, { recursive: true, force: true });
	mkdirSync(`${OUT}route`, { recursive: true });
	mkdirSync(`${OUT}stop`, { recursive: true });

	// servizi: date -> intervalli di numeri-giorno (run-length)
	const svcIds = [...new Set(tripsRaw.map((t) => t.service_id))];
	const svcIdx = new Map(svcIds.map((s, i) => [s, i]));
	const svcDays = svcIds.map(() => []);
	for (const c of calRaw) {
		if (c.exception_type === '1' && svcIdx.has(c.service_id)) svcDays[svcIdx.get(c.service_id)].push(dayNum(c.date));
	}
	const services = svcDays.map((days) => {
		days.sort((a, b) => a - b);
		const runs = [];
		for (const d of days) {
			const last = runs[runs.length - 1];
			if (last && d === last[1] + 1) last[1] = d;
			else if (!last || d > last[1]) runs.push([d, d]);
		}
		return runs.flat();
	});
	const allDays = svcDays.flat();
	const validFrom = Math.min(...allDays), validTo = Math.max(...allDays);

	// fermate
	const stops = new Map(stopsRaw.map((s) => [s.stop_id, { id: s.stop_id, n: s.stop_name, la: r5(+s.stop_lat), lo: r5(+s.stop_lon), r: new Set() }]));

	// stop_times per trip
	const byTrip = new Map();
	for (const st of stRaw) {
		let a = byTrip.get(st.trip_id);
		if (!a) byTrip.set(st.trip_id, (a = []));
		a.push([+st.stop_sequence, st.stop_id, secs(st.departure_time || st.arrival_time), secs(st.arrival_time || st.departure_time)]);
	}
	for (const a of byTrip.values()) a.sort((x, y) => x[0] - y[0]);

	// shapes
	const shapes = new Map();
	for (const p of shapesRaw) {
		let a = shapes.get(p.shape_id);
		if (!a) shapes.set(p.shape_id, (a = []));
		a.push([+p.shape_pt_sequence, +p.shape_pt_lon, +p.shape_pt_lat]);
	}
	for (const [id, a] of shapes) shapes.set(id, a.sort((x, y) => x[0] - y[0]).map((p) => [p[1], p[2]]));

	// raggruppa trip per route+direzione+pattern
	const routes = routesRaw.map((r) => ({
		id: r.route_id,
		name: r.route_short_name,
		type: +r.route_type,
		mode: MODE[+r.route_type] ?? 'bus',
		agency: agencies[r.agency_id] ?? r.agency_id
	}));
	const routeById = new Map(routes.map((r) => [r.id, r]));
	const patternsByRoute = new Map(); // routeId -> Map(key -> {dir, stops, shape, count, trips:[]})
	const stopDeps = new Map(); // stopId -> Map(routeId|headsignStop -> {r, h, t:[]})

	for (const t of tripsRaw) {
		const sts = byTrip.get(t.trip_id);
		const route = routeById.get(t.route_id);
		if (!sts || sts.length < 2 || !route) continue;
		const key = t.direction_id + '|' + sts.map((s) => s[1]).join(',');
		let m = patternsByRoute.get(t.route_id);
		if (!m) patternsByRoute.set(t.route_id, (m = new Map()));
		let p = m.get(key);
		if (!p) m.set(key, (p = { dir: +t.direction_id, stops: sts.map((s) => s[1]), shape: t.shape_id, count: 0, first: Infinity, last: -Infinity }));
		p.count++;
		p.first = Math.min(p.first, sts[0][2]);
		p.last = Math.max(p.last, sts[0][2]);

		const svc = svcIdx.get(t.service_id);
		const lastStop = sts[sts.length - 1][1];
		for (let i = 0; i < sts.length - 1; i++) {
			const [, sid, dep] = sts[i];
			stops.get(sid)?.r.add(route.name);
			let g = stopDeps.get(sid);
			if (!g) stopDeps.set(sid, (g = new Map()));
			const gk = t.route_id + '|' + lastStop;
			let e = g.get(gk);
			if (!e) g.set(gk, (e = { r: route.name, i: route.id, m: route.mode, h: stops.get(lastStop)?.n ?? '', t: [] }));
			e.t.push([dep, svc]);
		}
	}

	// scrivi route
	const routeIndex = [];
	for (const r of routes) {
		const pats = [...(patternsByRoute.get(r.id) ?? new Map()).values()].sort((a, b) => b.count - a.count);
		const out = { ...r, dirs: [] };
		for (const dir of [0, 1]) {
			const main = pats.find((p) => p.dir === dir);
			if (!main) continue;
			const sh = shapes.get(main.shape);
			out.dirs.push({
				dir,
				headsign: stops.get(main.stops[main.stops.length - 1])?.n ?? '',
				stops: main.stops,
				trips: main.count,
				first: main.first,
				last: main.last,
				shape: sh ? simplify(sh, 0.00005).map(([x, y]) => [r5(x), r5(y)]) : null
			});
			for (const sid of main.stops) stops.get(sid)?.r.add(r.name);
		}
		// varianti (altri pattern significativi): solo fermate extra
		out.variants = pats
			.filter((p) => !out.dirs.some((d) => d.dir === p.dir && d.stops.join() === p.stops.join()))
			.slice(0, 4)
			.map((p) => ({ dir: p.dir, stops: p.stops, trips: p.count }));
		writeFileSync(`${OUT}route/${r.id}.json`, JSON.stringify(out));
		routeIndex.push({ id: r.id, name: r.name, mode: r.mode, agency: r.agency, from: out.dirs[0]?.stops[0], to: out.dirs[0]?.headsign, stops: out.dirs[0]?.stops.length ?? 0 });
	}

	// scrivi fermate
	const stopIndex = [];
	for (const s of stops.values()) {
		const rs = [...s.r].sort((a, b) => a.localeCompare(b, 'it', { numeric: true }));
		if (!rs.length) continue;
		stopIndex.push([s.id, s.n, s.la, s.lo, rs]);
		const deps = [...(stopDeps.get(s.id)?.values() ?? [])];
		for (const d of deps) d.t.sort((a, b) => a[0] - b[0]);
		writeFileSync(`${OUT}stop/${s.id}.json`, JSON.stringify({ id: s.id, n: s.n, la: s.la, lo: s.lo, deps }));
	}

	// rete compatta per il planner
	const network = routes.map((r) => {
		const f = JSON.parse(readFileSync(`${OUT}route/${r.id}.json`, 'utf8'));
		return { id: r.id, name: r.name, mode: r.mode, lines: [...f.dirs.map((d) => d.stops), ...f.variants.map((v) => v.stops)] };
	});
	writeFileSync(`${OUT}network.json`, JSON.stringify(network));
	writeFileSync(`${OUT}routes.json`, JSON.stringify(routeIndex));
	writeFileSync(`${OUT}stops.json`, JSON.stringify(stopIndex));
	writeFileSync(`${OUT}services.json`, JSON.stringify(services));
	writeFileSync(`${OUT}meta.json`, JSON.stringify({ built: new Date().toISOString(), validFrom, validTo, source: feed.gtfs }));
	console.log(`OK: ${routeIndex.length} linee, ${stopIndex.length} fermate, validità giorni ${validFrom}..${validTo}`);

}

const [only, src] = process.argv.slice(2);
for (const f of feeds) if (!only || only === f.id) await build(f, src);
// configurazione pubblica per il sito
const pub = feeds.map(({ gtfs, ...rest }) => rest);
writeFileSync(`${DATA}feeds.json`, JSON.stringify(pub));
