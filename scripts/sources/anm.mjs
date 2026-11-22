// Sorgente dati ANM Napoli: il sito è Salesforce Experience Cloud (Aura).
// Usa gli stessi endpoint pubblici (guest) che il sito chiama da browser, in sola lettura.
// Sono interni e non documentati: possono cambiare senza preavviso.
import sanitizeHtml from 'sanitize-html';

const ORIGIN = 'https://www.anm.it';
const UA = 'Capolinea/0.1 (progetto open source indipendente)';

async function session() {
	const res = await fetch(`${ORIGIN}/s/?language=it`, { headers: { 'user-agent': UA } });
	const link = res.headers.get('link') ?? '';
	const fwuid = /fwuid%22%3A%22([^%]+)%22/.exec(link)?.[1];
	const loaded = /APPLICATION%40markup%3A%2F%2Fsiteforce%3AcommunityApp%22%3A%22([^%]+)%22/.exec(link)?.[1];
	if (!fwuid) throw new Error('fwuid non trovato: il sito ANM è cambiato?');
	return {
		mode: 'PROD',
		fwuid,
		app: 'siteforce:communityApp',
		loaded: { 'APPLICATION@markup://siteforce:communityApp': loaded ?? '' },
		dn: [],
		globals: {},
		uad: false
	};
}

async function aura(ctx, descriptor, params) {
	const body = new URLSearchParams({
		message: JSON.stringify({ actions: [{ id: '1;a', descriptor, callingDescriptor: 'UNKNOWN', params }] }),
		'aura.context': JSON.stringify(ctx),
		'aura.pageURI': '/s/',
		'aura.token': 'undefined'
	});
	const res = await fetch(`${ORIGIN}/s/sfsites/aura?r=1&other.capolinea.read=1`, {
		method: 'POST',
		headers: { 'user-agent': UA, 'content-type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) throw new Error(`aura ${descriptor}: HTTP ${res.status}`);
	const a = (await res.json()).actions?.[0];
	if (a?.state !== 'SUCCESS') throw new Error(`aura ${descriptor}: ${a?.state} ${JSON.stringify(a?.error)?.slice(0, 200)}`);
	const rv = a.returnValue;
	return rv && typeof rv === 'object' && 'returnValue' in rv ? rv.returnValue : rv;
}
const apexClass = (ctx, cls, method, params = {}) =>
	aura(ctx, 'aura://ApexActionController/ACTION$execute', {
		namespace: '', classname: cls, method, params, cacheable: false, isContinuation: false
	});
const apexDirect = (ctx, desc, params = {}) => aura(ctx, `apex://${desc}`, params);

const clean = (html) =>
	sanitizeHtml(html ?? '', {
		allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'h3', 'h4'],
		allowedAttributes: { a: ['href'] },
		allowedSchemes: ['http', 'https', 'mailto', 'tel'],
		transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
		exclusiveFilter: (f) => f.tag === 'p' && !f.text.trim() // toglie paragrafi vuoti
	}).trim();
const text = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

function classify(title) {
	const t = title.toLowerCase();
	if (/sciopero|agitazione|astensione/.test(t)) return 'strike';
	if (/chiusur|sospes|interrott|non in servizio|guasto/.test(t)) return 'closure';
	if (/deviazion|variazion|modific|percorso|navetta|sostitutiv/.test(t)) return 'change';
	return 'info';
}

function relatedLines(str, names) {
	const tokens = new Set(str.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean));
	// "METRO LINEA 1" -> L1
	for (const m of str.toUpperCase().matchAll(/\bLINEA\s+([126])\b/g)) tokens.add(`L${m[1]}`);
	return names.filter((n) => tokens.has(n.toUpperCase()) && !/^\d{1,2}$/.test(n));
}

const level = (s) =>
	/regolar|in servizio$/i.test(s) ? 'ok' : /sosp|chius|interrott|non in servizio|guast/i.test(s) ? 'bad' : 'warn';

const euro = (v) => {
	const n = parseFloat(String(v ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
	return Number.isFinite(n) ? n : null;
};

/** Tariffe e sanzioni ufficiali + testi esplicativi della pagina "Biglietti e abbonamenti". */
async function fetchFares(ctx) {
	const rows = await apexDirect(ctx, 'RetrieveInfoTitoliDIViaggio/ACTION$retrieveTariffe');
	const scopes = new Map();
	for (const r of [...rows].sort((a, b) => (a.Posizione__c ?? 0) - (b.Posizione__c ?? 0))) {
		const id = r.Ambito__c;
		if (!scopes.has(id)) scopes.set(id, { id, name: id, items: [] });
		scopes.get(id).items.push({
			name: text(r.Descrizione__c).replace(/\s*\*+$/, ''),
			company: euro(r.Tariffa_Aziendale_ANM__c),
			integrated: euro(r.Tariffa_Integrata__c)
		});
	}
	const fineRows = await apexDirect(ctx, 'RetrieveInfoTitoliDIViaggio/ACTION$retrieveSanzioni');
	const fines = [...fineRows]
		.sort((a, b) => (a.Posizione__c ?? 0) - (b.Posizione__c ?? 0))
		.map((f) => ({
			scope: f.Ambito__c,
			within5: euro(f.Oblazione_entro_5_giorni__c),
			within60: euro(f.Oblazione_entro_60_giorni__c),
			full: euro(f.Sanzione_Intera__c)
		}));
	const info = [];
	for (const [n, title] of [[2, 'Tipologie di titoli'], [3, 'Tariffe urbane ed extraurbane'], [4, 'Dove acquistare']]) {
		try {
			const html = clean(await apexDirect(ctx, 'SiteContentController/ACTION$getContenuto', { lingua: 'IT', nomePagina: `biglietti-e-abbonamenti${n}` }));
			if (html) info.push({ title, html });
		} catch (e) {
			console.warn(`contenuto tariffe ${n}: ${e.message}`);
		}
	}
	return { scopes: [...scopes.values()], fines, info, source: `${ORIGIN}/s/biglietti-e-abbonamenti` };
}

/** Parcheggi di interscambio e in struttura gestiti dall'azienda. */
async function fetchParking(ctx) {
	const groups = await apexDirect(ctx, 'RetrieveStatoLinee/ACTION$retrieveParcheggiLocation');
	const items = [];
	for (const g of groups ?? []) {
		for (const p of g.parcs ?? []) {
			const [lat, lon] = String(p.Indirizzo__c ?? g.indirizzo ?? '').split(',').map((x) => parseFloat(x));
			const status = text(p.statusLabel ?? p.Status__c);
			items.push({
				id: p.Id,
				name: text(p.Name ?? g.location),
				address: text(p.Info__c),
				lat: Number.isFinite(lat) ? lat : null,
				lon: Number.isFinite(lon) ? lon : null,
				status,
				level: /apert/i.test(status) ? 'ok' : /chius|non/i.test(status) ? 'bad' : 'warn',
				hours: text(p.Orario__c),
				spots: text(p.Posti_Auto__c),
				charging: /^s/i.test(p.Colonnina__c ?? ''),
				guarded: /^s/i.test(p.Custodito__c ?? ''),
				payment: text(p.Modalita_Pagamento__c),
				rates: clean(p.Tariffa__c),
				passes: clean(p.Abbonamenti__c)
			});
		}
	}
	return items.sort((a, b) => a.name.localeCompare(b.name, 'it'));
}

export async function fetchAnm({ routeNames = [], maxDetails = 25 } = {}) {
	const ctx = await session();

	// ---- notizie ----
	const list = await apexClass(ctx, 'listViewNotiziaHomeController', 'getNotizie');
	const sorted = [...list].sort((a, b) => (b.Data__c ?? '').localeCompare(a.Data__c ?? ''));
	const news = [];
	for (const [i, n] of sorted.entries()) {
		const title = text(n.Titolo__c || n.Name);
		let body = '';
		if (i < maxDetails) {
			try {
				const d = await apexClass(ctx, 'listViewNotiziaHomeController', 'getNotiziaDetails', { recordId: n.Id });
				body = clean(d?.Notizia__c);
				await new Promise((r) => setTimeout(r, 150));
			} catch (e) {
				console.warn(`dettaglio ${n.Id}: ${e.message}`);
			}
		}
		news.push({
			id: n.Id,
			date: n.Data__c ?? null,
			title,
			summary: text(n.Sintesi1__c),
			body,
			kind: classify(title),
			lines: relatedLines(`${title} ${n.Sintesi1__c ?? ''}`, routeNames),
			url: `${ORIGIN}/s/notizia-home/${n.Id}`
		});
	}

	// ---- stato servizi ----
	const services = [];
	const lineIds = [];
	for (const category of ['Metro', 'Bus', 'Funicolare']) {
		const groups = await apexDirect(ctx, 'RetrieveStatoLinee/ACTION$retrieveLinee', { category });
		for (const g of groups ?? [])
			for (const l of g.linee ?? []) {
				lineIds.push([l.Name, l.Id]);
				services.push({
					name: l.Name,
					type: l.tipoLabel ?? category,
					category,
					status: l.statoLineaLabel ?? g.statoLabel ?? '',
					detail: l.Stato_Linea__c ?? '',
					level: level(l.Stato_Linea__c ?? l.statoLineaLabel ?? '')
				});
			}
	}
	let elevators = [];
	try {
		const groups = await apexDirect(ctx, 'RetrieveStatoLinee/ACTION$retrieveAscensori');
		elevators = (groups ?? []).flatMap((g) => g.ascs ?? []).map((a) => ({
			name: a.Name,
			status: a.statusLabel ?? a.Status__c ?? '',
			info: text(a.Info__c),
			hours: text(a.Orario__c),
			level: /manutenz|guast|fuori/i.test(a.Status__c ?? '') ? 'warn' : 'ok'
		}));
	} catch (e) {
		console.warn(`ascensori: ${e.message}`);
	}

	// ---- orari e frequenze testuali per linea ----
	const lines = {};
	for (const [name, id] of lineIds) {
		try {
			const d = await apexDirect(ctx, 'lineaDetailApexController/ACTION$getLinea', { lineaId: id });
			const hours = clean(d?.Orario_in_vigore__c), frequency = clean(d?.Frequenza_corse__c);
			if (hours || frequency) lines[name] = { type: text(d?.Type__c), hours, frequency };
			await new Promise((r) => setTimeout(r, 100));
		} catch (e) {
			console.warn(`linea ${name}: ${e.message}`);
		}
	}

	let parking = [];
	try {
		parking = await fetchParking(ctx);
	} catch (e) {
		console.warn(`parcheggi: ${e.message}`);
	}

	let fares = null;
	try {
		fares = await fetchFares(ctx);
	} catch (e) {
		console.warn(`tariffe: ${e.message}`);
	}

	return { news, status: { services, elevators }, fares, parking, lines };
}
