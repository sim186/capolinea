import { distance, loadNetwork, loadStops, type Mode, type StopIdx } from './data';

/** Planner topologico (non basato sugli orari): stima tempi di corsa, attese e cambi. */

const RIDE_MIN: Record<Mode, number> = { metro: 2, funicolare: 2, tram: 2.5, filobus: 2.5, bus: 2.2 };
const WAIT_MIN: Record<Mode, number> = { metro: 4, funicolare: 5, tram: 7, filobus: 8, bus: 8 };
const WALK_M_PER_MIN = 75;
const MAX_WALK = 250;

export type Leg =
	| { type: 'walk'; from: string; to: string; meters: number; minutes: number }
	| { type: 'ride'; routeId: string; name: string; mode: Mode; stops: string[]; minutes: number };
export interface Journey {
	minutes: number;
	transfers: number;
	legs: Leg[];
}

interface Graph {
	stops: Map<string, StopIdx>;
	rides: Map<string, { to: string; line: number }[]>; // stop -> archi di corsa
	lines: { routeId: string; name: string; mode: Mode }[];
	walk: Map<string, { to: string; m: number }[]>;
}

let graphP: Promise<Graph> | null = null;
export function loadGraph(): Promise<Graph> {
	return (graphP ??= (async () => {
		const [net, stopsArr] = await Promise.all([loadNetwork(), loadStops()]);
		const stops = new Map(stopsArr.map((s) => [s[0], s]));
		const lines: Graph['lines'] = [];
		const rides = new Map<string, { to: string; line: number }[]>();
		const seen = new Set<string>();
		for (const r of net) {
			for (const seq of r.lines) {
				const li = lines.push({ routeId: r.id, name: r.name, mode: r.mode }) - 1;
				for (let i = 0; i < seq.length - 1; i++) {
					const k = `${r.id}|${seq[i]}|${seq[i + 1]}`;
					if (seen.has(k)) continue;
					seen.add(k);
					let a = rides.get(seq[i]);
					if (!a) rides.set(seq[i], (a = []));
					a.push({ to: seq[i + 1], line: li });
				}
			}
		}
		// camminate fra fermate vicine (griglia)
		const cell = (la: number, lo: number) => `${Math.floor(la / 0.003)}|${Math.floor(lo / 0.004)}`;
		const grid = new Map<string, StopIdx[]>();
		for (const s of stopsArr) {
			const k = cell(s[2], s[3]);
			(grid.get(k) ?? grid.set(k, []).get(k)!).push(s);
		}
		const walk = new Map<string, { to: string; m: number }[]>();
		for (const s of stopsArr) {
			const ci = Math.floor(s[2] / 0.003), cj = Math.floor(s[3] / 0.004);
			const list: { to: string; m: number }[] = [];
			for (let di = -1; di <= 1; di++)
				for (let dj = -1; dj <= 1; dj++)
					for (const o of grid.get(`${ci + di}|${cj + dj}`) ?? []) {
						if (o[0] === s[0]) continue;
						const m = distance(s[2], s[3], o[2], o[3]);
						if (m <= MAX_WALK) list.push({ to: o[0], m });
					}
			if (list.length) walk.set(s[0], list);
		}
		return { stops, rides, lines, walk };
	})());
}

class Heap {
	a: [number, number][] = [];
	push(v: [number, number]) {
		const a = this.a;
		a.push(v);
		let i = a.length - 1;
		while (i > 0) {
			const p = (i - 1) >> 1;
			if (a[p][0] <= a[i][0]) break;
			[a[p], a[i]] = [a[i], a[p]];
			i = p;
		}
	}
	pop(): [number, number] | undefined {
		const a = this.a;
		if (!a.length) return;
		const top = a[0], last = a.pop()!;
		if (a.length) {
			a[0] = last;
			let i = 0;
			for (;;) {
				const l = 2 * i + 1, r = l + 1;
				let m = i;
				if (l < a.length && a[l][0] < a[m][0]) m = l;
				if (r < a.length && a[r][0] < a[m][0]) m = r;
				if (m === i) break;
				[a[m], a[i]] = [a[i], a[m]];
				i = m;
			}
		}
		return top;
	}
}

/**
 * Stati: (fermata, linea|-1). Linea -1 = a terra.
 * @param transferPenalty minuti extra per ogni salita (scoraggia i cambi)
 */
function search(g: Graph, from: string[], to: string[], transferPenalty: number, avoid?: Set<string>): Journey | null {
	const ids = [...g.stops.keys()];
	const sIdx = new Map(ids.map((s, i) => [s, i]));
	const L = g.lines.length + 1; // 0 = a terra, 1..n = linea+1
	const key = (s: number, l: number) => s * L + l;
	const dist = new Map<number, number>();
	const prev = new Map<number, { k: number; leg: 'walk' | 'ride' | 'board' | 'alight' }>();
	const heap = new Heap();
	const target = new Set(to.map((t) => sIdx.get(t)!).filter((x) => x != null));
	for (const f of from) {
		const k = key(sIdx.get(f)!, 0);
		dist.set(k, 0);
		heap.push([0, k]);
	}
	let end = -1;
	while (true) {
		const top = heap.pop();
		if (!top) break;
		const [d, k] = top;
		if (d > (dist.get(k) ?? Infinity)) continue;
		const s = Math.floor(k / L), l = k % L;
		const sid = ids[s];
		if (l === 0 && target.has(s)) { end = k; break; }
		const relax = (nk: number, nd: number, leg: 'walk' | 'ride' | 'board' | 'alight') => {
			if (nd < (dist.get(nk) ?? Infinity)) {
				dist.set(nk, nd);
				prev.set(nk, { k, leg });
				heap.push([nd, nk]);
			}
		};
		if (l === 0) {
			for (const w of g.walk.get(sid) ?? [])
				relax(key(sIdx.get(w.to)!, 0), d + w.m / WALK_M_PER_MIN + 1, 'walk');
			for (const e of g.rides.get(sid) ?? []) {
				const ln = g.lines[e.line];
				if (avoid?.has(ln.routeId)) continue;
				relax(key(s, e.line + 1), d + WAIT_MIN[ln.mode] + transferPenalty, 'board');
			}
		} else {
			const ln = g.lines[l - 1];
			relax(key(s, 0), d, 'alight');
			for (const e of g.rides.get(sid) ?? [])
				if (e.line === l - 1) relax(key(sIdx.get(e.to)!, l), d + RIDE_MIN[ln.mode], 'ride');
		}
	}
	if (end < 0) return null;

	// ricostruzione
	const path: { k: number; leg: string }[] = [];
	for (let k = end; ; ) {
		const p = prev.get(k);
		path.push({ k, leg: p?.leg ?? 'start' });
		if (!p) break;
		k = p.k;
	}
	path.reverse();
	const legs: Leg[] = [];
	let cur: Extract<Leg, { type: 'ride' }> | null = null;
	for (let i = 1; i < path.length; i++) {
		const { k, leg } = path[i];
		const s = ids[Math.floor(k / L)], pk = path[i - 1].k, ps = ids[Math.floor(pk / L)];
		if (leg === 'board') {
			const ln = g.lines[(k % L) - 1];
			cur = { type: 'ride', routeId: ln.routeId, name: ln.name, mode: ln.mode, stops: [s], minutes: 0 };
			legs.push(cur);
		} else if (leg === 'ride' && cur) {
			cur.stops.push(s);
			cur.minutes += RIDE_MIN[cur.mode];
		} else if (leg === 'walk') {
			const a = g.stops.get(ps)!, b = g.stops.get(s)!;
			const meters = Math.round(distance(a[2], a[3], b[2], b[3]));
			legs.push({ type: 'walk', from: ps, to: s, meters, minutes: Math.max(1, Math.round(meters / WALK_M_PER_MIN)) });
		} else if (leg === 'alight') cur = null;
	}
	const rideLegs = legs.filter((l) => l.type === 'ride');
	// unisce camminate consecutive in un solo tratto
	for (let i = legs.length - 1; i > 0; i--) {
		const cur = legs[i], before = legs[i - 1];
		if (cur.type === 'walk' && before.type === 'walk') {
			before.to = cur.to;
			before.meters += cur.meters;
			before.minutes = Math.max(1, Math.round(before.meters / WALK_M_PER_MIN));
			legs.splice(i, 1);
		}
	}
	// durata mostrata: corsa + camminate + attesa media, senza penalità di ricerca
	const minutes = legs.reduce(
		(t, l) => t + l.minutes + (l.type === 'ride' ? WAIT_MIN[l.mode] : 0),
		0
	);
	return {
		minutes: Math.round(minutes),
		transfers: Math.max(0, rideLegs.length - 1),
		legs
	};
}

/** Restituisce fino a 3 alternative (più veloce, meno cambi, variante). */
export async function plan(from: string[], to: string[]): Promise<Journey[]> {
	const g = await loadGraph();
	const results: Journey[] = [];
	const sig = (j: Journey) => j.legs.map((l) => (l.type === 'ride' ? l.routeId : 'w')).join('>');
	const add = (j: Journey | null) => {
		if (j && !results.some((r) => sig(r) === sig(j))) results.push(j);
	};
	add(search(g, from, to, 0));
	add(search(g, from, to, 12));
	const first = results[0];
	if (first) {
		const used = first.legs.find((l) => l.type === 'ride');
		if (used && used.type === 'ride') add(search(g, from, to, 3, new Set([used.routeId])));
	}
	return results.sort((a, b) => a.minutes - b.minutes).slice(0, 3);
}
