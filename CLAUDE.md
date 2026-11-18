# TheGameLibrary (The Library)

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
- `data/users.json` profili; ogni profilo ha `dir` con `games.json`, `upcoming.json`, `backlog.json`, `collection.json`
  (collezione: `format` `physical`/`digital`, `value` valore attuale in € o null, `gameId` facoltativo che collega un gioco della classifica)
  e `consoles.json` (console possedute: `name`, `model`, `image`, `value`, `notes`); le foto caricate stanno in `<dir>/images/`
- `js/media.js` sezioni Manga, Libri, Film e Serie TV (Home, liste, classifiche, moduli). Ogni profilo sceglie le sezioni in
  `users.json` → `sections` (assente = solo `games`). File nella cartella del profilo: `manga.json` (saghe: `total`, `vols` con
  `"own"`/`"read"`, i volumi assenti sono mancanti), `books.json`, `books-wishlist.json`, `movies.json`, `movies-watchlist.json`,
  `movies-owned.json`, `series.json` (`seasons` = episodi per stagione, `status`, `score` null se "In corso", `at` = ultimo episodio visto),
  `series-watchlist.json`. Ovunque `favorite: true` segna i preferiti
- `assets/sections/` loghi delle sezioni e `assets/logo.svg` / `assets/icon.svg` generati da `tools/make_logos.py`
  (tranne `assets/sections/games.svg`); le icone PNG si ricavano da `assets/icon.svg`
- `assets/avatars/` avatar generati da `tools/make_avatars.py`
