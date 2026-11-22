import { base } from '$lib/paths';

export type Mode = 'metro' | 'tram' | 'bus' | 'filobus' | 'funicolare';

export interface RouteIdx {
	id: string;
	name: string;
	mode: Mode;
	agency: string;
	from: string;
	to: string;
	stops: number;
}
/** [id, nome, lat, lon, linee] */
export type StopIdx = [string, string, number, number, string[]];

export interface RouteDir {
	dir: number;
	headsign: string;
	stops: string[];
	trips: number;
	first: number;
	last: number;
	shape: [number, number][] | null;
}
export interface Route {
	id: string;
	name: string;
	mode: Mode;
	agency: string;
	dirs: RouteDir[];
	variants: { dir: number; stops: string[]; trips: number }[];
}
export interface Dep {
	r: string; // nome linea
	i: string; // id linea
	m: Mode;
	h: string; // capolinea
	t: [number, number][]; // [secondi dalla mezzanotte, indice servizio]
}
export interface StopDetail {
	id: string;
	n: string;
	la: number;
	lo: number;
	deps: Dep[];
}
export interface Meta {
	built: string;
	validFrom: number;
	validTo: number;
	source: string;
}
export interface Network {
	id: string;
	name: string;
	mode: Mode;
	lines: string[][];
}

// ---------- feed (azienda/città) ----------
export interface FeedCfg {
	id: string;
	name: string;
	operator: string;
	operatorFull: string;
	website: string;
	center: [number, number];
	zoom: number;
	lineColors: Record<string, string>;
	lineTextColors: Record<string, string>;
	news?: string;
}
let currentFeed = '';
let currentCfg: FeedCfg | null = null;
export function setFeed(id: string, cfg: FeedCfg | null) {
	currentFeed = id;
	currentCfg = cfg;
}
export const getFeed = () => currentFeed;
export const getCfg = () => currentCfg;
/** prefisso URL della sezione corrente, es. "/napoli" (con base path) */
export const B = () => `${base}/${currentFeed}`;

export interface NewsItem {
	id: string;
	date: string | null;
	title: string;
	summary: string;
	body: string;
	kind: 'strike' | 'closure' | 'change' | 'info';
	lines: string[];
	url: string;
}
export interface News {
	updated: string;
	items: NewsItem[];
}
export interface ServiceStatus {
	name: string;
	type: string;
	category: string;
	status: string;
	detail: string;
	level: 'ok' | 'warn' | 'bad';
}
export interface Status {
	updated: string;
	services: ServiceStatus[];
	elevators: { name: string; status: string; info: string; hours: string; level: 'ok' | 'warn' }[];
}

export interface FareItem {
	name: string;
	company: number | null;
	integrated: number | null;
}
export interface Fares {
	updated: string;
	scopes: { id: string; name: string; items: FareItem[] }[];
	fines: { scope: string; within5: number | null; within60: number | null; full: number | null }[];
	info: { title: string; html: string }[];
	source: string;
}
export interface ParkingLot {
	id: string;
	name: string;
	address: string;
	lat: number | null;
	lon: number | null;
	status: string;
	level: 'ok' | 'warn' | 'bad';
	hours: string;
	spots: string;
	charging: boolean;
	guarded: boolean;
	payment: string;
	rates: string;
	passes: string;
}
export interface LineText {
	type: string;
	hours: string;
	frequency: string;
}
export const euro = (n: number | null) =>
	n == null ? '—' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

// ---------- fetch con cache ----------
const cache = new Map<string, Promise<unknown>>();
function fetchJson<T>(url: string): Promise<T> {
	let p = cache.get(url) as Promise<T> | undefined;
	if (!p) {
		p = fetch(url).then((r) => {
			if (!r.ok) throw new Error(`${url}: ${r.status}`);
			return r.json() as Promise<T>;
		});
		p.catch(() => cache.delete(url));
		cache.set(url, p);
	}
	return p;
}
const load = <T>(path: string) => fetchJson<T>(`${base}/data/${currentFeed}/${path}.json`);
export const loadFeeds = () => fetchJson<FeedCfg[]>(`${base}/data/feeds.json`);
export const loadRoutes = () => load<RouteIdx[]>('routes');
export const loadStops = () => load<StopIdx[]>('stops');
export const loadMeta = () => load<Meta>('meta');
export const loadServices = () => load<number[][]>('services');
export const loadNetwork = () => load<Network[]>('network');
export const loadRoute = (id: string) => load<Route>(`route/${id}`);
export const loadStop = (id: string) => load<StopDetail>(`stop/${id}`);
/** null se il feed non ha notizie/stato */
export const loadNews = () => load<News>('news').catch(() => null);
export const loadFares = () => load<Fares>('fares').catch(() => null);
export const loadParking = () => load<{ updated: string; items: ParkingLot[] }>('parking').catch(() => null);
export const loadLineTexts = () => load<{ updated: string; items: Record<string, LineText> }>('lines').catch(() => null);
export const loadStatus = () => load<Status>('status').catch(() => null);

export async function stopMap(): Promise<Map<string, StopIdx>> {
	return new Map((await loadStops()).map((s) => [s[0], s]));
}

// ---------- modalità ----------
export const MODES: Record<Mode, { label: string; plural: string; color: string; on: string }> = {
	metro: { label: 'Metropolitana', plural: 'Metropolitane', color: '#0A5FA8', on: '#fff' },
	funicolare: { label: 'Funicolare', plural: 'Funicolari', color: '#2E7D4F', on: '#fff' },
	tram: { label: 'Tram', plural: 'Tram', color: '#C8461E', on: '#fff' },
	filobus: { label: 'Filobus', plural: 'Filobus', color: '#7A3E9D', on: '#fff' },
	bus: { label: 'Bus', plural: 'Bus', color: '#46515F', on: '#fff' }
};
export const MODE_ORDER: Mode[] = ['metro', 'funicolare', 'tram', 'filobus', 'bus'];

/** colori delle linee: personalizzabili per feed in feeds/feeds.json */
export function lineColor(name: string, mode: Mode): { bg: string; fg: string } {
	const bg = currentCfg?.lineColors[name] ?? MODES[mode].color;
	return { bg, fg: currentCfg?.lineTextColors[name] ?? '#fff' };
}

// ---------- tempo (Europe/Rome) ----------
const fmt = new Intl.DateTimeFormat('en-GB', {
	timeZone: 'Europe/Rome',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hourCycle: 'h23'
});
export function romeNow(d = new Date()): { day: number; secs: number } {
	const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, +x.value]));
	return {
		day: Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 864e5),
		secs: p.hour * 3600 + p.minute * 60 + p.second
	};
}
export const dayToDate = (day: number) => new Date(day * 864e5);
export function hhmm(secs: number): string {
	const s = ((secs % 86400) + 86400) % 86400;
	return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

function isActive(runs: number[] | undefined, day: number): boolean {
	if (!runs) return false;
	for (let i = 0; i < runs.length; i += 2) if (day >= runs[i] && day <= runs[i + 1]) return true;
	return false;
}

export interface Upcoming {
	secs: number; // secondi dalla mezzanotte di oggi (>= 86400 se non è oggi)
	day: number; // 0 = oggi, 1 = domani, ...
	wait: number; // minuti di attesa
	r: string;
	i: string;
	m: Mode;
	h: string;
}
/** Prossime partenze programmate (non real-time). Guarda anche i giorni successivi. */
export function nextDepartures(
	stop: StopDetail,
	services: number[][],
	now = romeNow(),
	limit = 12
): Upcoming[] {
	const out: Upcoming[] = [];
	for (const g of stop.deps) {
		let n = 0;
		// offset di giorno: -1 (corse oltre mezzanotte di ieri), 0, 1, 2
		for (const off of [-1, 0, 1, 2]) {
			for (const [t, svc] of g.t) {
				if (off === -1 && t < 86400) continue;
				const secs = t + off * 86400;
				if (secs < now.secs || !isActive(services[svc], now.day + off)) continue;
				out.push({
					secs,
					day: Math.floor(secs / 86400),
					wait: Math.round((secs - now.secs) / 60),
					r: g.r,
					i: g.i,
					m: g.m,
					h: g.h
				});
				n++;
			}
			if (n >= limit) break;
		}
	}
	return out.sort((a, b) => a.secs - b.secs).slice(0, limit);
}

export const norm = (s: string) =>
	s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9 ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

const ROMAN = /^(ii|iii|iv|vi|vii|viii|ix|xi|xii|xiii)$/;
export function titleCase(s: string): string {
	return s
		.toLowerCase()
		.replace(/(^|[\s\-(/'.])(\p{L})/gu, (_, a, b) => a + b.toUpperCase())
		.replace(/\b\p{L}+\b/gu, (w) => (ROMAN.test(w.toLowerCase()) ? w.toUpperCase() : w));
}

export function distance(la1: number, lo1: number, la2: number, lo2: number): number {
	const R = 6371000, rad = Math.PI / 180;
	const dLa = (la2 - la1) * rad, dLo = (lo2 - lo1) * rad;
	const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLo / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(a));
}
