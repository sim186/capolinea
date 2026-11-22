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
	for (const category of ['Metro', 'Bus', 'Funicolare']) {
		const groups = await apexDirect(ctx, 'RetrieveStatoLinee/ACTION$retrieveLinee', { category });
		for (const g of groups ?? [])
			for (const l of g.linee ?? [])
				services.push({
					name: l.Name,
					type: l.tipoLabel ?? category,
					category,
					status: l.statoLineaLabel ?? g.statoLabel ?? '',
					detail: l.Stato_Linea__c ?? '',
					level: level(l.Stato_Linea__c ?? l.statoLineaLabel ?? '')
				});
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

	return { news, status: { services, elevators } };
}
