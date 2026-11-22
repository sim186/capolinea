// Scarica notizie, scioperi e stato servizi per ogni feed che ha una sorgente "news".
// Uso: node scripts/fetch-news.mjs [feed-id]
// Se la sorgente fallisce, i file precedenti restano intatti (exit code 1).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fetchAnm } from './sources/anm.mjs';

const DATA = new URL('../static/data/', import.meta.url).pathname;
const feeds = JSON.parse(readFileSync(new URL('../feeds/feeds.json', import.meta.url), 'utf8'));
const SOURCES = { anm: fetchAnm };
const only = process.argv[2];
let failed = 0;

for (const f of feeds) {
	if (!f.news || (only && only !== f.id)) continue;
	const dir = `${DATA}${f.id}/`;
	try {
		const routesFile = `${dir}routes.json`;
		const routeNames = existsSync(routesFile)
			? [...new Set(JSON.parse(readFileSync(routesFile, 'utf8')).map((r) => r.name))]
			: [];
		const { news, status, fares, parking, lines } = await SOURCES[f.news]({ routeNames });
		const updated = new Date().toISOString();
		mkdirSync(dir, { recursive: true });
		writeFileSync(`${dir}news.json`, JSON.stringify({ updated, items: news }));
		writeFileSync(`${dir}status.json`, JSON.stringify({ updated, ...status }));
		if (parking?.length) writeFileSync(`${dir}parking.json`, JSON.stringify({ updated, items: parking }));
		if (lines && Object.keys(lines).length) writeFileSync(`${dir}lines.json`, JSON.stringify({ updated, items: lines }));
		if (fares) writeFileSync(`${dir}fares.json`, JSON.stringify({ updated, ...fares }));
		console.log(`${f.id}: ${news.length} notizie (${news.filter((n) => n.kind === 'strike').length} scioperi), ${status.services.length} linee, ${status.elevators.length} ascensori, parcheggi: ${parking?.length ?? 0}, testi linea: ${Object.keys(lines ?? {}).length}, tariffe: ${fares ? fares.scopes.reduce((n, x) => n + x.items.length, 0) : 'no'}`);
	} catch (e) {
		failed++;
		console.error(`${f.id}: ${e.message}`);
	}
}
process.exit(failed ? 1 : 0);
