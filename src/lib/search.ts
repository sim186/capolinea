import { norm, type RouteIdx, type StopIdx } from './data';

export interface StopHit {
	s: StopIdx;
	score: number;
}

export function searchStops(stops: StopIdx[], q: string, limit = 25): StopHit[] {
	const nq = norm(q);
	if (!nq) return [];
	const toks = nq.split(' ');
	const hits: StopHit[] = [];
	for (const s of stops) {
		const n = norm(s[1]);
		if (!toks.every((t) => n.includes(t))) continue;
		let score = 0;
		if (n === nq) score += 100;
		if (n.startsWith(nq)) score += 50;
		if (n.split(' ').some((w) => w.startsWith(toks[0]))) score += 20;
		score -= n.length * 0.1;
		hits.push({ s, score });
	}
	return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function searchRoutes(routes: RouteIdx[], q: string): RouteIdx[] {
	const nq = norm(q);
	if (!nq) return [];
	return routes
		.filter((r) => norm(r.name) === nq || norm(r.name).startsWith(nq))
		.sort((a, b) => (norm(a.name) === nq ? -1 : norm(b.name) === nq ? 1 : a.name.localeCompare(b.name, 'it', { numeric: true })))
		.slice(0, 10);
}

/** tutte le fermate con lo stesso nome entro 400 m (pali dello stesso nodo) */
export function samePlace(stops: StopIdx[], s: StopIdx): StopIdx[] {
	const n = norm(s[1]);
	return stops.filter(
		(o) => norm(o[1]) === n && Math.abs(o[2] - s[2]) < 0.004 && Math.abs(o[3] - s[3]) < 0.005
	);
}
