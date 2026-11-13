# TheGameLibrary

Sito statico (HTML/CSS/JS, nessuna build) pubblicato con GitHub Pages dal branch `main`.
I dati stanno in `data/` e vengono scritti dal sito tramite la GitHub Contents API: non modificarli a mano
nelle modifiche al codice.

## Prima di ogni commit che modifica il codice
Esegui:

    python3 tools/bump_version.py

Aggiorna `version.json` e i `?v=` di CSS/JS in `index.html`. Il sito confronta la propria versione con
`version.json` e si ricarica da solo quando ne esce una nuova (evita che i browser usino file vecchi).
Non serve per i commit dei soli dati.

## Struttura
- `index.html`, `css/style.css`
- `js/storage.js` lettura/scrittura dei file JSON su GitHub
- `js/lookup.js` ricerca dati e copertine (Wikidata/Wikipedia)
- `js/app.js` interfaccia
- `data/users.json` profili; ogni profilo ha `dir` con `games.json`, `upcoming.json`, `backlog.json`
- `assets/avatars/` avatar generati da `tools/make_avatars.py`
