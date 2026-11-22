# Capolinea

Sito minimale (mobile first, Material Design 3, sapore "mappa della metro") per capire
linee, fermate e partenze del trasporto pubblico ANM di Napoli.

> Progetto indipendente e open source. **Non è un sito ufficiale ANM.**
> Gli orari sono quelli *programmati* del feed GTFS pubblico di ANM: niente real-time,
> ritardi, soppressioni o scioperi.

## Cosa fa

- **Cerca** linee e fermate, anche con "fermate vicine" dalla posizione
- **Avvisi**: scioperi, chiusure, deviazioni e stato dei servizi (metro, funicolari, bus, ascensori)
- **Biglietti e abbonamenti**: tariffe ufficiali per ambito (aziendali e integrate) e sanzioni
- **Parcheggi**: parcheggi di interscambio con stato, orari, posti, tariffe e marker sulla mappa
- **Linee**: schema a linea con fermate, interscambi, avvisi, orari e frequenza indicati dall'azienda
- **Fermata**: prossime partenze programmate, anche nei giorni successivi
- **Mappa**: fermate e tracciati (MapLibre + OpenStreetMap)
- **Percorso A→B**: stima per capire *quali linee prendere* (non basata sugli orari)

## Come funziona

Nessun backend. Due script generano JSON statici in `static/data/<città>/`:

- `npm run data` — scarica il GTFS di ogni feed e lo converte (linee, fermate, partenze, shape)
- `npm run news` — scarica notizie, scioperi, stato servizi, tariffe, parcheggi e testi delle linee dalla sorgente dell'azienda

Il sito è una SPA SvelteKit statica che legge quei file. Una GitHub Action
(`.github/workflows/deploy.yml`) ricostruisce e pubblica su GitHub Pages ogni 30 minuti.

```bash
npm install
npm run data && npm run news
npm run dev
npm run build                          # output in build/
BASE_PATH=/capolinea npm run build     # hosting in sottocartella
```

## Aggiungere una città / azienda

1. Aggiungi un oggetto a `feeds/feeds.json` (id, nome, URL GTFS, centro mappa, colori delle linee).
2. `npm run data` genera `static/data/<id>/`. Il sito la serve su `/<id>`.
3. Per avvisi e stato servizi serve una sorgente in `scripts/sources/` (vedi `anm.mjs`):
   una funzione che restituisce `{ news, status }`. Registrala in `scripts/fetch-news.mjs`
   e imposta `"news": "<nome>"` nel feed. Senza sorgente, la pagina Avvisi mostra solo che non ci sono dati.

## Sorgenti dati e correttezza

- **GTFS**: feed pubblico dell'azienda (Napoli: `https://www.anm.it/google/google-transit.zip`).
- **Avvisi ANM**: il sito ANM è una piattaforma Salesforce; `scripts/sources/anm.mjs` legge gli stessi
  endpoint pubblici (accesso guest, sola lettura) che il sito usa nel browser. Sono interni e non
  documentati: possono cambiare o rompersi. Se falliscono, il sito resta in piedi senza avvisi.
  Ogni notizia rimanda alla pagina originale. L'HTML delle notizie è sanitizzato in fase di build.
- Il testo dei comunicati è dell'azienda. Un accordo esplicito con ANM sarebbe l'ideale.

## Limiti noti

- Il planner usa tempi medi di percorrenza e attesa, non gli orari reali.
- Nessun dato real-time (non c'è un feed pubblico GTFS-RT).
- Mappa: tile OSM pubbliche, adatte a traffico basso; per produzione usare un provider dedicato.

## Licenza

Codice: [MIT](LICENSE). Dati: © aziende di trasporto; mappe © OpenStreetMap contributors.
