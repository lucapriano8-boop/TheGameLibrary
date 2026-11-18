/*
 * Media: le sezioni Manga, Libri, Film e Serie TV.
 * La parte Videogiochi resta in app.js e non usa niente di questo file.
 *
 * File di ogni profilo (nella sua cartella, come i giochi):
 *   manga.json            saghe: { title, author, cover, total, vols: { "1": "own" | "read" }, favorite, notes }
 *                         (i volumi che non compaiono in "vols" sono mancanti, cioè da comprare)
 *   books.json            libri posseduti: { title, author, cover, format, read, favorite, notes }
 *   books-wishlist.json   libri da comprare
 *   movies.json           film visti (classifica): { title, year, director, cover, score, favorite, review }
 *   movies-watchlist.json film da vedere
 *   movies-owned.json     film fisici posseduti: { title, cover, format, edition, notes, favorite }
 *   series.json           serie: { title, year, cover, seasons: [episodi per stagione], status, score, at: { s, e }, favorite, review }
 *                         status: "In corso" (senza voto) | "Completata" | "Abbandonata"; "at" = ultimo episodio visto
 *   series-watchlist.json serie da vedere
 */
const Media = (() => {
  'use strict';

  const A = () => window.App;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (v) => A().esc(v);
  const cover = (url, title, cls) => A().coverHTML(url, title, cls);
  const fmtInt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });
  const norm = (t) => (t || '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
  const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  const now = () => new Date().toISOString();

  const SECTIONS = {
    manga: { hash: 'manga', label: 'Manga', files: ['manga'], lookup: 'manga',
      tabs: [['home', 'Home', 'home'], ['libreria', 'Libreria', 'shelf'], ['comprare', 'Da comprare', 'cart']] },
    books: { hash: 'libri', label: 'Libri', files: ['books', 'books-wishlist'], lookup: 'book',
      tabs: [['home', 'Home', 'home'], ['libreria', 'Libreria', 'book'], ['comprare', 'Da comprare', 'cart']] },
    movies: { hash: 'film', label: 'Film', files: ['movies', 'movies-watchlist', 'movies-owned'], lookup: 'movie',
      tabs: [['home', 'Home', 'home'], ['classifica', 'Classifica', 'trophy'], ['vedere', 'Da vedere', 'eye'], ['libreria', 'Libreria', 'disc']] },
    series: { hash: 'serie', label: 'Serie TV', files: ['series', 'series-watchlist'], lookup: 'series',
      tabs: [['home', 'Home', 'home'], ['incorso', 'In corso', 'play'], ['classifica', 'Classifica', 'trophy'], ['vedere', 'Da vedere', 'eye']] },
  };
  const FROM_HASH = { manga: 'manga', libri: 'books', film: 'movies', serie: 'series' };
  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/>',
    shelf: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 5l3.5 1-3.5 14-3.5-1z"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11.5l2-8H6.2"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    disc: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    play: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M10 8.5v5l4-2.5z M8 21h8"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  };
  const BOOK_FORMATS = ['Cartaceo', 'Ebook', 'Audiolibro'];
  const MOVIE_FORMATS = ['4K UHD', 'Blu-ray', 'DVD', 'Altro'];
  const SERIES_STATUS = ['In corso', 'Completata', 'Abbandonata'];

  // ---------- dati ----------
  const cache = { pid: null, data: {}, loaded: new Set(), loading: {} };
  const cur = { section: null, tab: 'home', filter: {}, search: {} };
  let work = null; // modifiche in corso dentro la finestra (volumi, episodi)

  const list = (kind) => cache.data[kind] || [];
  const find = (kind, id) => list(kind).find((x) => x.id === id);
  const profileId = () => A().profile()?.id || null;

  function checkProfile() {
    if (cache.pid !== profileId()) { cache.pid = profileId(); cache.data = {}; cache.loaded = new Set(); cache.loading = {}; }
  }
  function ensure(section) {
    checkProfile();
    const pid = cache.pid;
    return Promise.all(SECTIONS[section].files.map((kind) => {
      if (cache.loaded.has(kind)) return null;
      if (!cache.loading[kind]) {
        cache.loading[kind] = A().load(kind).then((r) => {
          if (cache.pid !== pid) return;
          cache.data[kind] = Array.isArray(r.data) ? r.data : [];
          cache.loaded.add(kind);
        }).finally(() => { delete cache.loading[kind]; });
      }
      return cache.loading[kind];
    }));
  }
  const isLoaded = (section) => SECTIONS[section].files.every((k) => cache.loaded.has(k));

  function canWrite() {
    if (A().canWrite()) return true;
    A().toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error');
    return false;
  }
  // salva subito sullo schermo, poi su GitHub; se non riesce torna com'era
  async function commit(kind, mutate, message) {
    const before = list(kind);
    cache.data[kind] = mutate(JSON.parse(JSON.stringify(before)));
    render();
    try {
      cache.data[kind] = await A().save(kind, mutate, message);
      render();
      return true;
    } catch (err) {
      cache.data[kind] = before;
      render();
      A().toast(err.message, 'error');
      return false;
    }
  }
  const update = (kind, id, patch, message) => commit(kind, (l) => l.map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now() } : x)), message);
  const remove = (kind, id, message) => commit(kind, (l) => l.filter((x) => x.id !== id), message);
  const add = (kind, item, message, front = false) => commit(kind, (l) => (l.some((x) => x.id === item.id) ? l : (front ? [item, ...l] : [...l, item])), message);

  // ---------- manga ----------
  function mStats(m) {
    let own = 0; let read = 0;
    for (let v = 1; v <= m.total; v++) { const s = m.vols?.[v]; if (s === 'own' || s === 'read') own++; if (s === 'read') read++; }
    return { own, read, missing: m.total - own, toRead: own - read };
  }
  const missingVols = (m, vols = m.vols || {}) => range(1, m.total).filter((v) => !vols[v]);
  const nextToRead = (m) => range(1, m.total).find((v) => m.vols?.[v] === 'own');
  function volRanges(arr) {
    const out = []; let s = null; let p = null;
    arr.forEach((n) => { if (s === null) { s = n; p = n; } else if (n === p + 1) p = n; else { out.push(s === p ? `${s}` : `${s}–${p}`); s = n; p = n; } });
    if (s !== null) out.push(s === p ? `${s}` : `${s}–${p}`);
    return out.join(', ');
  }
  function parseVols(txt, max) {
    const set = new Set();
    (txt || '').split(/[,;\s]+/).forEach((part) => {
      const m = part.match(/^(\d+)(?:[-–](\d+))?$/);
      if (m) range(+m[1], +(m[2] || m[1])).forEach((n) => { if (n >= 1 && n <= max) set.add(n); });
    });
    return [...set].sort((a, b) => a - b);
  }

  // ---------- serie ----------
  const totalEps = (s) => (s.seasons || []).reduce((a, b) => a + b, 0);
  function seenEps(s) {
    if (s.status === 'Completata') return totalEps(s);
    if (!s.at) return 0;
    return s.seasons.slice(0, s.at.s - 1).reduce((a, b) => a + b, 0) + s.at.e;
  }
  const epLabel = (at) => (at && at.e ? `S${at.s} · E${at.e}` : 'Non iniziata');
  function nextEp(s, at = s.at) {
    const a = at && at.e ? at : { s: 1, e: 0 };
    if (a.e < (s.seasons[a.s - 1] || 0)) return { s: a.s, e: a.e + 1 };
    if (a.s < s.seasons.length) return { s: a.s + 1, e: 1 };
    return null;
  }
  const isLastEp = (s, at) => at && at.s === s.seasons.length && at.e === s.seasons[s.seasons.length - 1];
  const seasonsLabel = (s) => (s.seasons?.length ? `${s.seasons.length} ${s.seasons.length === 1 ? 'stagione' : 'stagioni'} · ${totalEps(s)} episodi` : '');
  function seasonBars(s, at = s.at) {
    return `<div class="m-seasons" aria-hidden="true">${(s.seasons || []).map((n, i) => {
      const seen = s.status === 'Completata' ? n : !at ? 0 : i + 1 < at.s ? n : i + 1 === at.s ? at.e : 0;
      return `<i><b style="width:${Math.round((seen / n) * 100)}%"></b></i>`;
    }).join('')}</div>`;
  }

  // ---------- elementi comuni ----------
  const tag = (t, cls = '') => `<span class="m-tag ${cls}">${t}</span>`;
  const star = (kind, id, on) => `<button type="button" class="star${on ? ' on' : ''}" data-m="fav" data-kind="${kind}" data-mid="${esc(id)}" aria-pressed="${!!on}" title="${on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}" aria-label="${on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${on ? '★' : '☆'}</button>`;
  const scoreBadge = (s) => `<span class="score ${A().scoreClass(s)}">${s ?? '–'}</span>`;
  const hashOf = (section, tab) => `#${SECTIONS[section].hash}${tab && tab !== 'home' ? `/${tab}` : ''}`;
  const stat = (label, value, sub = '') => `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-sub">${sub}</div></div>`;
  const cardHead = (title, tab) => `<div class="card-head"><h2>${title}</h2>${tab ? `<a href="${hashOf(cur.section, tab)}" class="link">Vedi tutti →</a>` : ''}</div>`;

  function row({ kind, id, cov, title, sub = '', tags = [], side = '', rank = null, act = 'edit', extra = '' }) {
    return `<li class="m-item m-click" data-m="${act}" data-kind="${kind}" data-mid="${esc(id)}">
      ${rank != null ? `<span class="m-rank">${rank}</span>` : ''}${cover(cov, title, 'md')}
      <div class="m-main"><span class="m-title">${esc(title)}</span>${sub ? `<span class="m-sub">${esc(sub)}</span>` : ''}
        ${tags.length ? `<div class="m-tags">${tags.join('')}</div>` : ''}${extra}</div>
      ${side ? `<div class="m-side">${side}</div>` : ''}</li>`;
  }
  function mini({ kind, id, cov, title, sub = '', right = '', rank = null, act = 'edit' }) {
    return `<li class="mini-item m-click" data-m="${act}" data-kind="${kind}" data-mid="${esc(id)}">
      ${rank != null ? `<span class="mini-rank">${rank}</span>` : ''}${cover(cov, title, 'xs')}
      <span class="mini-main"><span class="mini-title">${esc(title)}</span><span class="mini-sub">${esc(sub)}</span></span>
      <span class="mini-date">${right}</span></li>`;
  }
  function favShelf(kind, items, act = 'edit') {
    if (!items.length) return '<p class="empty">Tocca ☆ su un titolo per aggiungerlo ai preferiti.</p>';
    return `<div class="m-shelf">${items.slice(0, 12).map((x) => `<button type="button" class="m-shelf-item" data-m="${act}" data-kind="${kind}" data-mid="${esc(x.id)}" title="${esc(x.title)}">${cover(x.cover, x.title, 'fill')}<span>${esc(x.title)}</span></button>`).join('')}</div>`;
  }
  const filters = (key, opts) => `<div class="m-filters">${opts.map(([k, l]) => `<button type="button" class="chip m-chip${(cur.filter[key] || 'all') === k ? ' on' : ''}" data-m="filter" data-key="${key}" data-val="${k}">${l}</button>`).join('')}</div>`;
  const searchBox = (key, ph) => `<div class="toolbar m-toolbar"><input type="search" data-m-search="${key}" placeholder="${ph}" value="${esc(cur.search[key] || '')}" autocomplete="off"></div>`;
  const matches = (key, ...fields) => { const q = norm(cur.search[key]); return !q || fields.some((f) => norm(f).includes(q)); };
  const filterOf = (key) => cur.filter[key] || 'all';
  const byTitle = (a, b) => collator.compare(a.title, b.title);
  const byAdded = (a, b) => (b.addedAt || '').localeCompare(a.addedAt || '');
  function withRanks(items) {
    let rank = 0; let prev = null;
    return items.map((x, i) => { if (x.score !== prev) { rank = i + 1; prev = x.score; } return { x, rank }; });
  }
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, x) => a + x.score, 0) / arr.length) : '–');

  function head(title, sub, addLabel) {
    return `<div class="view-head">
      <div class="m-head"><img class="m-logo" src="assets/sections/${cur.section}.svg" alt="" width="40" height="40"><div><h1>${title}</h1>${sub ? `<p class="muted small m-head-sub">${sub}</p>` : ''}</div></div>
      ${addLabel ? `<button type="button" class="btn primary" data-m="add">+ ${addLabel}</button>` : ''}</div>`;
  }

  // ---------- navigazione ----------
  function renderNav() {
    const s = SECTIONS[cur.section];
    if (!s) return;
    $('#media-tabs').innerHTML = s.tabs.map(([k, l]) => `<a href="${hashOf(cur.section, k)}" class="${document.body.dataset.view === 'media' && cur.tab === k ? 'active' : ''}">${l}</a>`).join('')
      + '<a href="#impostazioni" data-view="impostazioni" title="Impostazioni" aria-label="Impostazioni">⚙</a>';
    const nav = $('#media-nav');
    nav.style.gridTemplateColumns = `repeat(${s.tabs.length}, 1fr)`;
    nav.innerHTML = s.tabs.map(([k, l, ic]) => `<a href="${hashOf(cur.section, k)}" class="${document.body.dataset.view === 'media' && cur.tab === k ? 'active' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[ic]}</svg><span>${l}</span></a>`).join('');
  }

  // chiamata da app.js: #manga, #manga/libreria, #film/classifica…
  function show(hashName, tab) {
    const section = FROM_HASH[hashName];
    if (!section) return;
    if (cur.section !== section) { cur.section = section; }
    cur.tab = SECTIONS[section].tabs.some(([k]) => k === tab) ? tab : 'home';
    renderNav();
    render();
    if (!isLoaded(section)) ensure(section).then(() => { if (cur.section === section) render(); }).catch((err) => A().toast(err.message, 'error'));
  }
  function setSection(section) { cur.section = section; renderNav(); }

  function render() {
    const view = $('#view-media');
    if (!view || view.hidden || !cur.section) return;
    checkProfile();
    if (!isLoaded(cur.section)) { view.innerHTML = `${head(SECTIONS[cur.section].label, '')}<p class="empty">Caricamento…</p>`; return; }
    const focus = document.activeElement?.dataset?.mSearch;
    view.innerHTML = { manga: renderManga, books: renderBooks, movies: renderMovies, series: renderSeries }[cur.section]();
    if (focus) { const inp = $(`[data-m-search="${focus}"]`, view); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
  }

  // ---------- MANGA ----------
  function mangaRow(m) {
    const s = mStats(m);
    const tags = [tag(`${s.own}/${m.total} vol.`), s.missing ? tag(`${s.missing} mancanti`, 'warn') : tag('Completa', 'ok')];
    if (s.toRead) tags.push(tag(`${s.toRead} da leggere`, 'blue')); else if (s.own) tags.push(tag('✓ Letto tutto', 'ok'));
    const extra = `<div class="m-progress" aria-hidden="true"><i style="width:${(s.read / m.total) * 100}%"></i><i class="own" style="width:${((s.own - s.read) / m.total) * 100}%"></i></div>`;
    return row({ kind: 'manga', id: m.id, cov: m.cover, title: m.title, sub: m.author, tags, side: star('manga', m.id, m.favorite), act: 'volumes', extra });
  }
  function renderManga() {
    const all = list('manga');
    const stats = all.map((m) => ({ m, s: mStats(m) }));
    const tot = stats.reduce((a, { s }) => ({ own: a.own + s.own, read: a.read + s.read, missing: a.missing + s.missing }), { own: 0, read: 0, missing: 0 });
    if (cur.tab === 'home') {
      const reading = stats.filter(({ s }) => s.toRead > 0).sort((a, b) => a.s.toRead - b.s.toRead);
      const close = stats.filter(({ s }) => s.missing > 0).sort((a, b) => a.s.missing - b.s.missing);
      return `${head('Manga', `${all.length} ${all.length === 1 ? 'saga' : 'saghe'} in libreria`, 'Aggiungi saga')}
        <div class="stats">${stat('Volumi', fmtInt.format(tot.own), 'posseduti')}${stat('Letti', fmtInt.format(tot.read), `${tot.own ? Math.round((tot.read / tot.own) * 100) : 0}% dei posseduti`)}${stat('Mancanti', fmtInt.format(tot.missing), 'da comprare')}</div>
        <div class="grid-2">
          <div class="card">${cardHead('Prossimo da leggere', 'libreria')}<ol class="mini-list">${reading.slice(0, 5).map(({ m, s }) => mini({ kind: 'manga', id: m.id, cov: m.cover, title: `${m.title} · Vol. ${nextToRead(m)}`, sub: `${s.toRead} ${s.toRead === 1 ? 'volume' : 'volumi'} da leggere`, act: 'volumes' })).join('') || '<li class="empty">Hai letto tutti i volumi che possiedi.</li>'}</ol></div>
          <div class="card">${cardHead('Più vicine al completamento', 'comprare')}<ol class="mini-list">${close.slice(0, 5).map(({ m, s }) => mini({ kind: 'manga', id: m.id, cov: m.cover, title: m.title, sub: `Vol. ${volRanges(missingVols(m))}`, right: `${s.missing} mancanti`, act: 'buy' })).join('') || '<li class="empty">Nessun volume mancante.</li>'}</ol></div>
        </div>
        <div class="card">${cardHead('★ Preferiti')}${favShelf('manga', all.filter((m) => m.favorite).sort(byTitle), 'volumes')}</div>`;
    }
    if (cur.tab === 'libreria') {
      const f = filterOf('manga');
      const items = stats.filter(({ m, s }) => (f === 'all' || (f === 'fav' ? m.favorite : f === 'reading' ? s.toRead > 0 : s.missing > 0)) && matches('manga', m.title, m.author))
        .map(({ m }) => m).sort(byTitle);
      return `${head('Libreria manga', 'Tocca una saga per segnare i volumi posseduti e letti', 'Aggiungi saga')}
        ${searchBox('manga', 'Cerca una saga o un autore…')}
        ${filters('manga', [['all', 'Tutte'], ['fav', '★ Preferite'], ['reading', 'Da leggere'], ['missing', 'Incomplete']])}
        <ul class="m-list">${items.map(mangaRow).join('') || `<li class="empty">${all.length ? 'Nessuna saga con questo filtro.' : 'Nessuna saga: aggiungi la prima con “+”.'}</li>`}</ul>`;
    }
    // da comprare: le saghe con volumi mancanti
    const items = stats.filter(({ m, s }) => s.missing > 0 && matches('manga-buy', m.title, m.author)).sort((a, b) => a.s.missing - b.s.missing || byTitle(a.m, b.m));
    return `${head('Manga da comprare', `${fmtInt.format(tot.missing)} volumi mancanti in ${stats.filter(({ s }) => s.missing).length} saghe`, 'Aggiungi saga')}
      ${searchBox('manga-buy', 'Cerca una saga…')}
      <ul class="m-list">${items.map(({ m, s }) => row({ kind: 'manga', id: m.id, cov: m.cover, title: m.title, sub: `Vol. ${volRanges(missingVols(m))}`,
        tags: [tag(`${s.missing} da comprare`, 'warn'), tag(`${s.own}/${m.total} posseduti`)], side: '<span class="m-chev" aria-hidden="true">›</span>', act: 'buy' })).join('')
        || '<li class="empty">Nessun volume mancante: tutte le saghe sono complete.</li>'}</ul>`;
  }

  // ---------- LIBRI ----------
  function bookRow(b) {
    return row({ kind: 'books', id: b.id, cov: b.cover, title: b.title, sub: b.author,
      tags: [tag(esc(b.format || 'Cartaceo')), b.read ? tag('✓ Letto', 'ok') : tag('Da leggere', 'warn')],
      side: `${star('books', b.id, b.favorite)}<button type="button" class="btn small${b.read ? ' ghost' : ' primary'}" data-m="toggle-read" data-mid="${esc(b.id)}">${b.read ? 'Non letto' : '✓ Letto'}</button>` });
  }
  function wishRow(kind, w, buttons) {
    return row({ kind, id: w.id, cov: w.cover, title: w.title, sub: [w.year, w.author || w.director, w.where].filter(Boolean).join(' · '),
      tags: [kind === 'series-watchlist' && w.seasons?.length ? tag(seasonsLabel(w)) : '', w.notes ? tag(esc(w.notes)) : ''].filter(Boolean), side: buttons });
  }
  function renderBooks() {
    const books = list('books'); const wish = list('books-wishlist');
    const read = books.filter((b) => b.read).length;
    if (cur.tab === 'home') {
      return `${head('Libri', `${books.length} ${books.length === 1 ? 'libro' : 'libri'} in libreria`, 'Aggiungi libro')}
        <div class="stats">${stat('Libri', books.length, 'posseduti')}${stat('Letti', read, `${books.length ? Math.round((read / books.length) * 100) : 0}%`)}${stat('Da comprare', wish.length, 'nella lista')}</div>
        <div class="grid-2">
          <div class="card">${cardHead('Da leggere', 'libreria')}<ol class="mini-list">${books.filter((b) => !b.read).sort(byAdded).slice(0, 5).map((b) => mini({ kind: 'books', id: b.id, cov: b.cover, title: b.title, sub: [b.author, b.format].filter(Boolean).join(' · ') })).join('') || '<li class="empty">Hai letto tutti i tuoi libri.</li>'}</ol></div>
          <div class="card">${cardHead('Da comprare', 'comprare')}<ol class="mini-list">${wish.slice().sort(byAdded).slice(0, 5).map((w) => mini({ kind: 'books-wishlist', id: w.id, cov: w.cover, title: w.title, sub: w.author || '' })).join('') || '<li class="empty">La lista è vuota.</li>'}</ol></div>
        </div>
        <div class="card">${cardHead('★ Preferiti')}${favShelf('books', books.filter((b) => b.favorite).sort(byTitle))}</div>`;
    }
    if (cur.tab === 'libreria') {
      const f = filterOf('books');
      const items = books.filter((b) => (f === 'all' || (f === 'fav' ? b.favorite : f === 'read' ? b.read : !b.read)) && matches('books', b.title, b.author)).sort(byTitle);
      return `${head('Libreria libri', `${read} letti su ${books.length}`, 'Aggiungi libro')}
        ${searchBox('books', 'Cerca un titolo o un autore…')}
        ${filters('books', [['all', 'Tutti'], ['fav', '★ Preferiti'], ['read', 'Letti'], ['unread', 'Da leggere']])}
        <ul class="m-list">${items.map(bookRow).join('') || `<li class="empty">${books.length ? 'Nessun libro con questo filtro.' : 'Nessun libro: aggiungi il primo con “+”.'}</li>`}</ul>`;
    }
    const items = wish.filter((w) => matches('books-buy', w.title, w.author)).sort(byAdded);
    return `${head('Libri da comprare', 'Con “✔ Comprato” il libro passa in libreria', 'Aggiungi')}
      ${searchBox('books-buy', 'Cerca…')}
      <ul class="m-list">${items.map((w) => wishRow('books-wishlist', w, `<button type="button" class="btn small primary" data-m="bought-book" data-mid="${esc(w.id)}">✔ Comprato</button>`)).join('') || '<li class="empty">La lista è vuota: aggiungi un libro con “+”.</li>'}</ul>`;
  }

  // ---------- FILM ----------
  function rankRows(kind, items) {
    return withRanks(items).map(({ x, rank }) => row({ kind, id: x.id, cov: x.cover, title: x.title, rank,
      sub: kind === 'series' ? seasonsLabel(x) : [x.year, x.director].filter(Boolean).join(' · '),
      tags: kind === 'series' ? [tag(x.status === 'Abbandonata' ? `Abbandonata${x.at?.e ? ` a ${epLabel(x.at)}` : ''}` : 'Completata', x.status === 'Abbandonata' ? 'red' : 'ok')] : [],
      side: `${scoreBadge(x.score)}${star(kind, x.id, x.favorite)}` })).join('');
  }
  function renderMovies() {
    const seen = list('movies').filter((m) => m.score != null).sort((a, b) => b.score - a.score || byTitle(a, b));
    const todo = list('movies-watchlist'); const owned = list('movies-owned');
    const scoreOf = new Map(list('movies').map((m) => [norm(m.title), m.score]));
    if (cur.tab === 'home') {
      return `${head('Film', `${seen.length} film visti`, 'Aggiungi film visto')}
        <div class="stats">${stat('Film visti', seen.length, 'in classifica')}${stat('Voto medio', avg(seen), 'su 100')}${stat('In possesso', owned.length, 'fisici')}</div>
        <div class="grid-2">
          <div class="card">${cardHead('Top 5', 'classifica')}<ol class="mini-list">${withRanks(seen).slice(0, 5).map(({ x, rank }) => mini({ kind: 'movies', id: x.id, cov: x.cover, title: x.title, sub: [x.year, x.director].filter(Boolean).join(' · '), right: scoreBadge(x.score), rank })).join('') || '<li class="empty">Nessun film in classifica.</li>'}</ol></div>
          <div class="card">${cardHead('Da vedere', 'vedere')}<ol class="mini-list">${todo.slice().sort(byAdded).slice(0, 5).map((w) => mini({ kind: 'movies-watchlist', id: w.id, cov: w.cover, title: w.title, sub: [w.year, w.director].filter(Boolean).join(' · ') })).join('') || '<li class="empty">Niente da vedere.</li>'}</ol></div>
        </div>
        <div class="card">${cardHead('★ Preferiti')}${favShelf('movies', list('movies').filter((m) => m.favorite).sort((a, b) => (b.score ?? -1) - (a.score ?? -1)))}</div>`;
    }
    if (cur.tab === 'classifica') {
      const f = filterOf('movies');
      const items = seen.filter((m) => (f === 'all' || m.favorite) && matches('movies', m.title, m.director, m.year));
      return `${head('Classifica film', `${seen.length} film · voto medio ${avg(seen)}`, 'Aggiungi film visto')}
        ${searchBox('movies', 'Cerca un film o un regista…')}
        ${filters('movies', [['all', 'Tutti'], ['fav', '★ Preferiti']])}
        <ul class="m-list">${rankRows('movies', items) || `<li class="empty">${seen.length ? 'Nessun film con questo filtro.' : 'Nessun film: aggiungi il primo con “+”.'}</li>`}</ul>`;
    }
    if (cur.tab === 'vedere') {
      const items = todo.filter((w) => matches('movies-todo', w.title, w.director)).sort(byAdded);
      return `${head('Film da vedere', 'Con “✔ Visto” gli dai il voto e il film entra in classifica', 'Aggiungi')}
        ${searchBox('movies-todo', 'Cerca…')}
        <ul class="m-list">${items.map((w) => wishRow('movies-watchlist', w, `<button type="button" class="btn small primary" data-m="seen-movie" data-mid="${esc(w.id)}">✔ Visto</button>`)).join('') || '<li class="empty">La lista è vuota: aggiungi un film con “+”.</li>'}</ul>`;
    }
    const count = (f) => owned.filter((x) => x.format === f).length;
    const items = owned.filter((x) => matches('movies-owned', x.title, x.edition, x.format)).sort(byTitle);
    return `${head('Film in possesso', `${owned.length} film fisici`, 'Aggiungi film')}
      <div class="stats">${stat('4K UHD', count('4K UHD'))}${stat('Blu-ray', count('Blu-ray'))}${stat('DVD', count('DVD'), count('Altro') ? `+ ${count('Altro')} altri` : '')}</div>
      ${searchBox('movies-owned', 'Cerca un film…')}
      <ul class="m-list">${items.map((x) => { const s = scoreOf.get(norm(x.title));
        return row({ kind: 'movies-owned', id: x.id, cov: x.cover, title: x.title, tags: [tag(esc(x.format || 'Altro'), 'blue'), x.edition ? tag(esc(x.edition)) : '', s == null ? tag('Non ancora visto', 'warn') : ''].filter(Boolean),
          side: `${s != null ? scoreBadge(s) : ''}${star('movies-owned', x.id, x.favorite)}` }); }).join('') || '<li class="empty">Nessun film fisico: aggiungi il primo con “+”.</li>'}</ul>`;
  }

  // ---------- SERIE ----------
  function watchingRow(s, compact = false) {
    const nx = nextEp(s);
    const side = `<span class="m-ep">${epLabel(s.at)}</span>${nx ? `<button type="button" class="btn small primary" data-m="plus-ep" data-mid="${esc(s.id)}" title="Segna visto S${nx.s} · E${nx.e}">+1 ep.</button>` : ''}`;
    if (compact) {
      return `<li class="mini-item m-click" data-m="progress" data-kind="series" data-mid="${esc(s.id)}">${cover(s.cover, s.title, 'xs')}
        <span class="mini-main"><span class="mini-title">${esc(s.title)}</span><span class="mini-sub">${seenEps(s)}/${totalEps(s)} episodi</span>${seasonBars(s)}</span>
        <span class="m-side">${side}</span></li>`;
    }
    return row({ kind: 'series', id: s.id, cov: s.cover, title: s.title, sub: `${seenEps(s)}/${totalEps(s)} episodi · ${s.seasons.length} stag.`, side, act: 'progress', extra: seasonBars(s) });
  }
  function renderSeries() {
    const all = list('series'); const todo = list('series-watchlist');
    const ranked = all.filter((s) => s.score != null && s.status !== 'In corso').sort((a, b) => b.score - a.score || byTitle(a, b));
    const watching = all.filter((s) => s.status === 'In corso').sort((a, b) => (b.updatedAt || b.addedAt || '').localeCompare(a.updatedAt || a.addedAt || ''));
    if (cur.tab === 'home') {
      const eps = all.reduce((a, s) => a + seenEps(s), 0);
      return `${head('Serie TV', `${ranked.length} serie viste · ${watching.length} in corso`, 'Aggiungi serie')}
        <div class="stats">${stat('Serie viste', ranked.length, 'in classifica')}${stat('Episodi', fmtInt.format(eps), 'visti')}${stat('Voto medio', avg(ranked), 'su 100')}</div>
        <div class="card">${cardHead('Stai guardando', 'incorso')}<ol class="mini-list">${watching.map((s) => watchingRow(s, true)).join('') || '<li class="empty">Nessuna serie in corso.</li>'}</ol></div>
        <div class="grid-2">
          <div class="card">${cardHead('Top 5', 'classifica')}<ol class="mini-list">${withRanks(ranked).slice(0, 5).map(({ x, rank }) => mini({ kind: 'series', id: x.id, cov: x.cover, title: x.title, sub: seasonsLabel(x), right: scoreBadge(x.score), rank })).join('') || '<li class="empty">Nessuna serie in classifica.</li>'}</ol></div>
          <div class="card">${cardHead('Da vedere', 'vedere')}<ol class="mini-list">${todo.slice().sort(byAdded).slice(0, 5).map((w) => mini({ kind: 'series-watchlist', id: w.id, cov: w.cover, title: w.title, sub: [w.year, seasonsLabel(w)].filter(Boolean).join(' · ') })).join('') || '<li class="empty">Niente da vedere.</li>'}</ol></div>
        </div>
        <div class="card">${cardHead('★ Preferiti')}${favShelf('series', all.filter((s) => s.favorite).sort(byTitle))}</div>`;
    }
    if (cur.tab === 'incorso') {
      return `${head('In corso', 'Tocca una serie per scegliere stagione ed episodio; +1 ep. segna il successivo', 'Aggiungi serie')}
        <ul class="m-list">${watching.map((s) => watchingRow(s)).join('') || '<li class="empty">Nessuna serie in corso. Inizia una serie da “Da vedere” o aggiungila con “+”.</li>'}</ul>
        <p class="muted small">Le serie in corso non hanno voto: lo dai quando le finisci o le abbandoni.</p>`;
    }
    if (cur.tab === 'classifica') {
      const f = filterOf('series');
      const items = ranked.filter((s) => (f === 'all' || (f === 'fav' ? s.favorite : s.status === f)) && matches('series', s.title, s.year));
      return `${head('Classifica serie', `${ranked.length} serie · voto medio ${avg(ranked)}`, 'Aggiungi serie')}
        ${searchBox('series', 'Cerca una serie…')}
        ${filters('series', [['all', 'Tutte'], ['fav', '★ Preferite'], ['Completata', 'Completate'], ['Abbandonata', 'Abbandonate']])}
        <ul class="m-list">${rankRows('series', items) || `<li class="empty">${ranked.length ? 'Nessuna serie con questo filtro.' : 'Nessuna serie in classifica.'}</li>`}</ul>`;
    }
    const items = todo.filter((w) => matches('series-todo', w.title, w.where)).sort(byAdded);
    return `${head('Serie da vedere', '“▶ Inizia” la mette tra quelle in corso, “✔ Vista” ti chiede il voto', 'Aggiungi')}
      ${searchBox('series-todo', 'Cerca…')}
      <ul class="m-list">${items.map((w) => wishRow('series-watchlist', w, `<button type="button" class="btn small primary" data-m="start-series" data-mid="${esc(w.id)}">▶ Inizia</button><button type="button" class="btn small" data-m="seen-series" data-mid="${esc(w.id)}">✔ Vista</button>`)).join('') || '<li class="empty">La lista è vuota: aggiungi una serie con “+”.</li>'}</ul>`;
  }

  // ---------- finestra ----------
  const dlg = () => $('#media-dialog');
  function openDialog(title, body, actions = '') {
    $('#media-dialog').innerHTML = `<div class="dialog-head"><h2>${title}</h2><button type="button" class="icon-btn" data-close aria-label="Chiudi">✕</button></div>
      <div class="m-dialog-body">${body}</div>${actions ? `<div class="form-actions">${actions}</div>` : ''}`;
    if (!dlg().open) dlg().showModal();
    dlg().scrollTop = 0;
  }
  // le modifiche fatte nella finestra (volumi, episodi) si salvano quando si chiude o si passa ad altro
  function flushWork() {
    const w = work; work = null;
    if (!w || !w.dirty) return;
    if (w.type === 'vols') {
      const m = find('manga', w.id); if (!m) return;
      const s0 = mStats(m); const s1 = mStats({ ...m, vols: w.vols });
      const bought = s1.own - s0.own;
      const msg = bought > 0 && s1.read === s0.read ? `Comprati ${bought} volumi: ${m.title}` : `Volumi aggiornati: ${m.title}`;
      update('manga', w.id, { vols: w.vols }, msg);
    }
    if (w.type === 'progress') {
      const s = find('series', w.id); if (!s) return;
      update('series', w.id, { at: w.at }, `Arrivato a ${epLabel(w.at)}: ${s.title}`);
    }
  }

  // --- volumi di una saga
  function openVolumes(id, keepScroll = false) {
    const m = find('manga', id); if (!m) return;
    if (!work || work.type !== 'vols' || work.id !== id) { flushWork(); work = { type: 'vols', id, vols: { ...(m.vols || {}) }, dirty: false }; }
    work.view = 'vols';
    const mm = { ...m, vols: work.vols }; const s = mStats(mm);
    const scroll = dlg().scrollTop;
    openDialog(esc(m.title), `
      <div class="m-dlg-top">${cover(m.cover, m.title, 'md')}<div class="m-main"><span class="m-sub">${esc(m.author || '')}${m.author ? ' · ' : ''}${m.total} volumi nella saga</span>
        <div class="m-tags">${tag(`${s.own} posseduti`)}${tag(`${s.read} letti`, 'blue')}${tag(`${s.missing} mancanti`, 'warn')}</div></div>${star('manga', m.id, m.favorite)}</div>
      <div class="m-vol-grid">${range(1, m.total).map((v) => { const st = work.vols[v]; return `<button type="button" class="m-vol${st === 'read' ? ' read' : st === 'own' ? ' own' : ''}" data-m="vol" data-v="${v}" aria-label="Volume ${v}: ${st === 'read' ? 'letto' : st === 'own' ? 'posseduto' : 'mancante'}">${v}</button>`; }).join('')}</div>
      <div class="m-legend"><span><i></i>Mancante (da comprare)</span><span><i class="own"></i>Posseduto</span><span><i class="read"></i>Letto</span></div>
      <p class="muted small">Tocca un volume: mancante → posseduto → letto → mancante. Le modifiche si salvano quando chiudi.</p>
      <div class="form-actions left"><button type="button" class="btn small" data-m="all-read">✓ Tutti i posseduti letti</button>${s.missing ? `<button type="button" class="btn small" data-m="buy" data-kind="manga" data-mid="${esc(m.id)}">🛒 Volumi mancanti</button>` : ''}<button type="button" class="btn small ghost" data-m="edit" data-kind="manga" data-mid="${esc(m.id)}">Modifica saga</button></div>`,
    '<span class="spacer"></span><button type="button" class="btn primary" data-close>Fatto</button>');
    if (keepScroll) dlg().scrollTop = scroll;
  }
  function cycleVol(v) {
    const st = work.vols[v];
    if (!st) work.vols[v] = 'own'; else if (st === 'own') work.vols[v] = 'read'; else delete work.vols[v];
    work.dirty = true;
    if (work.view === 'buy') openBuy(work.id, true); else openVolumes(work.id, true);
  }
  // --- volumi da comprare di una saga
  function openBuy(id, keepScroll = false) {
    const m = find('manga', id); if (!m) return;
    if (!work || work.type !== 'vols' || work.id !== id) { flushWork(); work = { type: 'vols', id, vols: { ...(m.vols || {}) }, dirty: false }; }
    work.view = 'buy';
    const miss = missingVols(m);
    const scroll = dlg().scrollTop;
    openDialog(`${esc(m.title)}: da comprare`, miss.length ? `
      <p class="muted small">${miss.length} volumi mancanti su ${m.total}. Segna quelli che hai comprato: si salvano quando chiudi.</p>
      <ul class="m-buy-list">${miss.map((v) => { const got = !!work.vols[v]; return `<li class="${got ? 'got' : ''}"><span class="m-vn">Vol. ${v}</span><span class="m-sub">${got ? 'Comprato' : esc(m.title)}</span>
        <button type="button" class="btn small ${got ? 'ghost' : 'primary'}" data-m="buy-vol" data-v="${v}">${got ? 'Annulla' : '✔ Comprato'}</button></li>`; }).join('')}</ul>
      <div class="form-actions left"><button type="button" class="btn small" data-m="buy-all">✔ Comprati tutti</button><button type="button" class="btn small ghost" data-m="volumes" data-kind="manga" data-mid="${esc(m.id)}">Apri la saga</button></div>`
      : '<p class="empty">Hai tutti i volumi di questa saga 🎉</p>',
    '<span class="spacer"></span><button type="button" class="btn primary" data-close>Fatto</button>');
    if (keepScroll) dlg().scrollTop = scroll;
  }

  // --- avanzamento di una serie
  function openProgress(id, season, keepScroll = false) {
    const s = find('series', id); if (!s) return;
    if (!work || work.type !== 'progress' || work.id !== id) { flushWork(); work = { type: 'progress', id, at: s.at ? { ...s.at } : null, dirty: false }; }
    const at = work.at && work.at.e ? work.at : { s: 1, e: 0 };
    const sel = Math.min(season || work.season || at.s || 1, s.seasons.length);
    work.season = sel;
    const scroll = dlg().scrollTop;
    openDialog(esc(s.title), `
      <div class="m-dlg-top">${cover(s.cover, s.title, 'md')}<div class="m-main"><span class="m-sub">${seasonsLabel(s)}</span>
        <span>Arrivato a <strong class="m-ep">${epLabel(work.at)}</strong></span>${seasonBars(s, work.at)}</div>${star('series', s.id, s.favorite)}</div>
      <h3>Stagione</h3>
      <div class="m-filters">${s.seasons.map((n, i) => `<button type="button" class="chip m-chip${i + 1 === sel ? ' on' : ''}" data-m="season" data-v="${i + 1}">S${i + 1} <span class="muted">(${n})</span></button>`).join('')}</div>
      <h3>Tocca l'ultimo episodio che hai visto</h3>
      <div class="m-ep-grid">${range(1, s.seasons[sel - 1]).map((e) => {
        const seen = sel < at.s || (sel === at.s && e <= at.e); const isCur = sel === at.s && e === at.e;
        return `<button type="button" class="m-epb${isCur ? ' cur' : seen ? ' seen' : ''}" data-m="ep" data-v="${e}" aria-label="Stagione ${sel} episodio ${e}">${e}</button>`; }).join('')}</div>
      <p class="muted small">Le modifiche si salvano quando chiudi.</p>
      <div class="form-actions left"><button type="button" class="btn small" data-m="finish" data-v="Completata">✔ Finita</button><button type="button" class="btn small" data-m="finish" data-v="Abbandonata">Abbandonata</button><button type="button" class="btn small ghost" data-m="edit" data-kind="series" data-mid="${esc(s.id)}">Modifica serie</button></div>`,
    '<span class="spacer"></span><button type="button" class="btn primary" data-close>Fatto</button>');
    if (keepScroll) dlg().scrollTop = scroll;
  }
  function setEp(e) {
    const s = find('series', work.id);
    work.at = { s: work.season, e }; work.dirty = true;
    if (isLastEp(s, work.at)) { const id = s.id; flushWork(); openRate({ type: 'finish', id, status: 'Completata' }); return; }
    openProgress(s.id, work.season, true);
  }
  function plusEp(id) {
    const s = find('series', id); const nx = s && nextEp(s);
    if (!nx || !canWrite()) return;
    update('series', id, { at: nx }, `Visto ${epLabel(nx)}: ${s.title}`);
    if (isLastEp(s, nx)) openRate({ type: 'finish', id, status: 'Completata' });
    else A().toast(`${s.title}: visto ${epLabel(nx)}`);
  }

  // ---------- moduli ----------
  const input = (name, label, value = '', opt = {}) => `<label class="${opt.span ? 'span-2' : ''}">${label}
    <input name="${name}" ${opt.type ? `type="${opt.type}"` : ''} value="${esc(value ?? '')}" ${opt.required ? 'required' : ''} ${opt.ph ? `placeholder="${esc(opt.ph)}"` : ''}
      ${opt.type === 'number' ? `inputmode="numeric" min="${opt.min ?? 0}" ${opt.max ? `max="${opt.max}"` : ''}` : 'maxlength="200"'} autocomplete="off">${opt.hint ? `<span class="muted small">${opt.hint}</span>` : ''}</label>`;
  const select = (name, label, options, value, opt = {}) => `<label class="${opt.span ? 'span-2' : ''}">${label}<select name="${name}">${options.map((o) => `<option ${o === value ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  const textarea = (name, label, value = '') => `<label class="span-2">${label}<textarea name="${name}" rows="3" maxlength="5000">${esc(value || '')}</textarea></label>`;
  const scoreField = (value) => `<div class="span-2 m-score"><span class="m-label">Voto * <span class="muted">(0–100)</span></span>
    <div class="m-score-input"><input type="range" name="score_r" min="0" max="100" value="${value ?? 80}" aria-label="Voto con il cursore">
    <input type="number" name="score" min="0" max="100" inputmode="numeric" required value="${value ?? 80}" aria-label="Voto"></div>
    <span class="muted small">Trascina il cursore oppure scrivi il numero.</span></div>`;
  const titleBlock = (item, lookupKind) => `
    <div class="span-2 title-row"><label>Titolo *<input name="title" required maxlength="200" autocomplete="off" value="${esc(item.title || '')}" data-m-title></label>
      <button type="button" class="btn" data-m="lookup">🔍 Cerca dati</button></div>
    <div class="span-2 lookup" id="m-lookup" hidden data-lookup-kind="${lookupKind}"></div>
    <div class="span-2 cover-row"><div class="cover-preview" id="m-cover-preview">${cover(item.cover, item.title, 'md')}</div>
      <label>Copertina <span class="muted">(facoltativa)</span><input name="cover" type="url" placeholder="https://…" autocomplete="off" value="${esc(item.cover || '')}"></label></div>`;
  const epsFields = (seasons) => `<div class="m-eps">${seasons.map((n, i) => `<label>Stag. ${i + 1}<input type="number" min="1" max="999" inputmode="numeric" data-eps="${i}" value="${n}" aria-label="Episodi della stagione ${i + 1}"></label>`).join('')}</div>`;
  const seasonsBlock = (seasons) => `
    ${input('nseasons', 'Stagioni *', seasons.length, { type: 'number', min: 1, max: 99, required: true })}
    <div class="span-2"><span class="m-label">Episodi per stagione</span><div id="m-eps-wrap">${epsFields(seasons)}</div></div>`;

  const FORM_TITLES = {
    manga: ['Aggiungi una saga', 'Modifica saga'], books: ['Aggiungi un libro', 'Modifica libro'], 'books-wishlist': ['Libro da comprare', 'Modifica libro da comprare'],
    movies: ['Aggiungi un film visto', 'Modifica film'], 'movies-watchlist': ['Film da vedere', 'Modifica film da vedere'], 'movies-owned': ['Aggiungi un film fisico', 'Modifica film fisico'],
    series: ['Aggiungi una serie', 'Modifica serie'], 'series-watchlist': ['Serie da vedere', 'Modifica serie da vedere'],
  };
  const LOOKUP_OF = { manga: 'manga', books: 'book', 'books-wishlist': 'book', movies: 'movie', 'movies-watchlist': 'movie', 'movies-owned': 'movie', series: 'series', 'series-watchlist': 'series' };

  function openForm(kind, id = null, prefill = {}) {
    flushWork();
    const item = id ? find(kind, id) : { ...prefill };
    if (id && !item) return;
    work = { type: 'form', kind, id };
    let fields = titleBlock(item, LOOKUP_OF[kind]);
    if (kind === 'manga') {
      fields += input('author', 'Autore', item.author, { span: true })
        + input('total', 'Volumi della saga *', item.total || '', { type: 'number', min: 1, max: 999, required: true, hint: 'Quanti volumi esistono in tutto (anche quelli non ancora usciti in Italia, se vuoi).' })
        + (id ? '<p class="span-2 muted small">I volumi posseduti e letti si segnano toccando la saga nella libreria.</p>'
          : input('own', 'Volumi che possiedi', '', { ph: 'Es. 1-10, 12, 15', hint: 'Gli altri vengono segnati come mancanti e finiscono in “Da comprare”.' }))
        + textarea('notes', 'Note', item.notes);
    }
    if (kind === 'books') fields += input('author', 'Autore', item.author) + select('format', 'Formato', BOOK_FORMATS, item.format || 'Cartaceo')
      + `<label class="span-2 m-check"><input type="checkbox" name="read" ${item.read ? 'checked' : ''}> L'ho già letto</label>` + textarea('notes', 'Note', item.notes);
    if (kind === 'books-wishlist') fields += input('author', 'Autore', item.author, { span: true }) + textarea('notes', 'Note', item.notes);
    if (kind === 'movies') fields += input('year', 'Anno', item.year || '', { type: 'number', min: 1880, max: 2100 }) + input('director', 'Regista', item.director)
      + scoreField(item.score) + textarea('review', 'Commento', item.review);
    if (kind === 'movies-watchlist') fields += input('year', 'Anno', item.year || '', { type: 'number', min: 1880, max: 2100 }) + input('director', 'Regista', item.director)
      + input('notes', 'Nota', item.notes, { span: true, ph: 'Es. su Netflix' });
    if (kind === 'movies-owned') fields += select('format', 'Formato', MOVIE_FORMATS, item.format || 'Blu-ray') + input('edition', 'Edizione', item.edition, { ph: 'Es. Steelbook' })
      + textarea('notes', 'Note', item.notes);
    if (kind === 'series') {
      const status = item.status || 'In corso';
      fields += input('year', 'Anno', item.year || '', { type: 'number', min: 1930, max: 2100 }) + select('status', 'Stato', SERIES_STATUS, status)
        + seasonsBlock(item.seasons?.length ? item.seasons : [10]) + '<div class="span-2" id="m-status-extra"></div>' + textarea('review', 'Commento', item.review);
    }
    if (kind === 'series-watchlist') fields += input('year', 'Anno', item.year || '', { type: 'number', min: 1930, max: 2100 }) + input('where', 'Dove vederla', item.where, { ph: 'Es. Netflix' })
      + seasonsBlock(item.seasons?.length ? item.seasons : [10]) + input('notes', 'Nota', item.notes, { span: true });
    const actions = `${id ? '<button type="button" class="btn danger" data-m="delete">Elimina</button>' : ''}<span class="spacer"></span>
      <button type="button" class="btn ghost" data-close>Annulla</button><button type="submit" class="btn primary" form="m-form">Salva</button>`;
    openDialog(FORM_TITLES[kind][id ? 1 : 0], `<form id="m-form" class="form" novalidate><div class="form-grid">${fields}</div></form>`, actions);
    if (kind === 'series') statusExtra(item);
    if (!id) setTimeout(() => $('#m-form [name=title]')?.focus(), 50);
  }

  const readSeasons = () => $$('#m-form [data-eps]').map((i) => Math.max(1, Math.min(999, parseInt(i.value, 10) || 1)));
  function statusExtra(item = {}) {
    const box = $('#m-status-extra'); if (!box) return;
    const f = $('#m-form').elements; const st = f.status.value; const seasons = readSeasons();
    const at = item.at && item.at.e ? item.at : null;
    const posSelects = (allowZero) => {
      const s = Math.min(at?.s || 1, seasons.length);
      return `<div class="form-grid m-pos"><label>${allowZero ? 'Arrivato alla stagione' : 'Lasciata alla stagione'}<select name="at_s">${seasons.map((_, i) => `<option value="${i + 1}" ${i + 1 === s ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label>
        <label>Episodio<select name="at_e">${epOptions(seasons[s - 1], allowZero, at?.e)}</select></label></div>`;
    };
    if (st === 'In corso') box.innerHTML = `${posSelects(true)}<p class="muted small">Serie in corso: niente voto, lo darai quando la finisci.</p>`;
    else if (st === 'Abbandonata') box.innerHTML = `${posSelects(false)}<div class="form-grid">${scoreField(item.score ?? 60)}</div>`;
    else box.innerHTML = `<div class="form-grid">${scoreField(item.score ?? 85)}</div>`;
  }
  const epOptions = (n, allowZero, selected) => range(allowZero ? 0 : 1, n || 1).map((e) => `<option value="${e}" ${e === selected ? 'selected' : ''}>${e === 0 ? 'Nessuno' : e}</option>`).join('');
  function refreshEpSelect() {
    const f = $('#m-form')?.elements; if (!f?.at_s) return;
    const seasons = readSeasons();
    const prev = f.at_s.value;
    f.at_s.innerHTML = seasons.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
    f.at_s.value = Math.min(+prev || 1, seasons.length);
    const e = +f.at_e.value;
    f.at_e.innerHTML = epOptions(seasons[f.at_s.value - 1], f.status.value === 'In corso', e);
  }

  function readScore(f) {
    const n = parseInt(f.score?.value, 10);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
  }

  async function submitForm(e) {
    e.preventDefault();
    const { kind, id } = work || {};
    const form = $('#m-form'); const f = form.elements;
    const val = (n) => (f[n]?.value || '').trim();
    const numv = (n) => { const x = parseInt(val(n), 10); return Number.isFinite(x) ? x : null; };
    const title = val('title');
    if (!title) { f.title.focus(); A().toast('Scrivi il titolo.', 'error'); return; }
    if (!canWrite()) return;
    const base = { title, cover: val('cover') };
    let data;
    if (kind === 'manga') {
      const total = numv('total');
      if (!total || total < 1) { f.total.focus(); A().toast('Scrivi quanti volumi ha la saga.', 'error'); return; }
      data = { ...base, author: val('author'), total: Math.min(total, 999), notes: val('notes') };
      if (!id) { data.vols = {}; parseVols(val('own'), data.total).forEach((v) => { data.vols[v] = 'own'; }); }
      else { const m = find('manga', id); data.vols = Object.fromEntries(Object.entries(m.vols || {}).filter(([v]) => +v <= data.total)); }
    }
    if (kind === 'books') data = { ...base, author: val('author'), format: val('format'), read: f.read.checked, notes: val('notes') };
    if (kind === 'books-wishlist') data = { ...base, author: val('author'), notes: val('notes') };
    if (kind === 'movies') {
      const score = readScore(f);
      if (score == null) { f.score.focus(); A().toast('Dai un voto da 0 a 100.', 'error'); return; }
      data = { ...base, year: numv('year'), director: val('director'), score, review: val('review') };
    }
    if (kind === 'movies-watchlist') data = { ...base, year: numv('year'), director: val('director'), notes: val('notes') };
    if (kind === 'movies-owned') data = { ...base, format: val('format'), edition: val('edition'), notes: val('notes') };
    if (kind === 'series' || kind === 'series-watchlist') {
      const seasons = readSeasons();
      data = { ...base, year: numv('year'), seasons };
      if (kind === 'series-watchlist') Object.assign(data, { where: val('where'), notes: val('notes') });
      else {
        const status = val('status');
        data.status = status; data.review = val('review');
        if (status === 'In corso') {
          data.score = null;
          const s = numv('at_s') || 1; const ep = numv('at_e') || 0;
          data.at = ep ? { s, e: ep } : (s > 1 ? { s: s - 1, e: seasons[s - 2] } : null);
        } else {
          const score = readScore(f);
          if (score == null) { f.score.focus(); A().toast('Dai un voto da 0 a 100.', 'error'); return; }
          data.score = score;
          data.at = status === 'Completata' ? { s: seasons.length, e: seasons[seasons.length - 1] } : { s: numv('at_s') || 1, e: numv('at_e') || 1 };
        }
      }
    }
    work = null;
    dlg().close();
    if (id) {
      update(kind, id, data, `Modificato: ${title}`);
    } else {
      const item = { id: A().uid(), ...data, addedAt: now() };
      const where = { manga: 'manga', books: 'libreria', 'books-wishlist': 'libri da comprare', movies: 'film visti', 'movies-watchlist': 'film da vedere', 'movies-owned': 'film in possesso', series: 'serie', 'series-watchlist': 'serie da vedere' }[kind];
      const ok = await add(kind, item, `Aggiunto (${where}): ${title}`);
      if (ok) A().toast(`“${title}” aggiunto ✔`);
      if (ok && kind === 'manga') openVolumes(item.id);
      if (ok && kind === 'series') location.hash = hashOf('series', data.status === 'In corso' ? 'incorso' : 'classifica');
    }
  }

  async function deleteItem() {
    const { kind, id } = work || {};
    const item = find(kind, id); if (!item) return;
    if (!confirm(`Eliminare “${item.title}”?`)) return;
    if (!canWrite()) return;
    work = null; dlg().close();
    if (await remove(kind, id, `Eliminato: ${item.title}`)) A().toast(`“${item.title}” eliminato`);
  }

  // --- voto quando un film/una serie esce da "da vedere", o quando una serie finisce
  function openRate(ctx) {
    flushWork();
    const kind = ctx.type === 'movie' ? 'movies-watchlist' : ctx.type === 'series' ? 'series-watchlist' : 'series';
    const item = find(kind, ctx.id); if (!item) return;
    work = { type: 'rate', ctx };
    const text = {
      movie: 'Dagli un voto: il film esce da “Da vedere” ed entra in classifica.',
      series: 'Dagli un voto: la serie esce da “Da vedere” ed entra in classifica.',
      finish: ctx.status === 'Completata' ? 'Hai finito la serie! Dagli un voto: entra in classifica come completata.' : `Abbandonata${item.at?.e ? ` a ${epLabel(item.at)}` : ''}: dagli un voto, entra in classifica come abbandonata.`,
    }[ctx.type];
    openDialog(`“${esc(item.title)}”`, `<p class="muted">${text}</p><form id="m-form" class="form" novalidate><div class="form-grid">${scoreField(80)}
      ${ctx.type === 'series' ? select('status', 'Stato', ['Completata', 'Abbandonata'], 'Completata', { span: true }) : ''}</div></form>`,
    '<span class="spacer"></span><button type="button" class="btn ghost" data-close>Annulla</button><button type="submit" class="btn primary" form="m-form">Salva voto</button>');
  }
  async function submitRate(e) {
    e.preventDefault();
    const ctx = work.ctx; const f = $('#m-form').elements;
    const score = readScore(f);
    if (score == null) { f.score.focus(); A().toast('Dai un voto da 0 a 100.', 'error'); return; }
    if (!canWrite()) return;
    work = null; dlg().close();
    if (ctx.type === 'movie') {
      const w = find('movies-watchlist', ctx.id);
      const ok = await add('movies', { id: A().uid(), title: w.title, cover: w.cover || '', year: w.year || null, director: w.director || '', score, review: '', addedAt: now() }, `Visto (voto ${score}): ${w.title}`);
      if (ok) { await remove('movies-watchlist', w.id, `Tolto dai film da vedere: ${w.title}`); A().toast(`“${w.title}” in classifica con ${score}`); location.hash = hashOf('movies', 'classifica'); }
    }
    if (ctx.type === 'series') {
      const w = find('series-watchlist', ctx.id); const status = f.status.value; const seasons = w.seasons?.length ? w.seasons : [1];
      const ok = await add('series', { id: A().uid(), title: w.title, cover: w.cover || '', year: w.year || null, seasons, status, score, review: '',
        at: status === 'Completata' ? { s: seasons.length, e: seasons[seasons.length - 1] } : null, addedAt: now() }, `Vista (voto ${score}): ${w.title}`);
      if (ok) { await remove('series-watchlist', w.id, `Tolta dalle serie da vedere: ${w.title}`); A().toast(`“${w.title}” in classifica con ${score}`); location.hash = hashOf('series', 'classifica'); }
    }
    if (ctx.type === 'finish') {
      const s = find('series', ctx.id);
      const patch = { status: ctx.status, score };
      if (ctx.status === 'Completata') patch.at = { s: s.seasons.length, e: s.seasons[s.seasons.length - 1] };
      if (await update('series', s.id, patch, `${ctx.status === 'Completata' ? 'Finita' : 'Abbandonata'} (voto ${score}): ${s.title}`)) {
        A().toast(`“${s.title}” in classifica con ${score}`);
        location.hash = hashOf('series', 'classifica');
      }
    }
  }

  async function startSeries(id) {
    const w = find('series-watchlist', id); if (!w || !canWrite()) return;
    const ok = await add('series', { id: A().uid(), title: w.title, cover: w.cover || '', year: w.year || null, seasons: w.seasons?.length ? w.seasons : [10], status: 'In corso', score: null, at: null, review: '', addedAt: now() }, `Iniziata: ${w.title}`);
    if (ok) { await remove('series-watchlist', w.id, `Tolta dalle serie da vedere: ${w.title}`); A().toast(`“${w.title}” è tra le serie in corso`); location.hash = hashOf('series', 'incorso'); }
  }
  async function boughtBook(id) {
    const w = find('books-wishlist', id); if (!w || !canWrite()) return;
    const ok = await add('books', { id: A().uid(), title: w.title, cover: w.cover || '', author: w.author || '', format: 'Cartaceo', read: false, notes: w.notes || '', addedAt: now() }, `Comprato: ${w.title}`, true);
    if (ok) { await remove('books-wishlist', w.id, `Tolto dai libri da comprare: ${w.title}`); A().toast(`“${w.title}” è in libreria`); }
  }
  function toggleFav(kind, id) {
    const it = find(kind, id); if (!it || !canWrite()) return;
    const on = !it.favorite;
    update(kind, id, { favorite: on }, `${on ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti'}: ${it.title}`);
    if (dlg().open && work && (work.type === 'vols' || work.type === 'progress') && work.id === id) {
      if (work.type === 'vols') (work.view === 'buy' ? openBuy : openVolumes)(id, true); else openProgress(id, work.season, true);
    }
  }

  // ---------- ricerca dati ----------
  const look = { seq: 0, timer: null, results: [] };
  async function runLookup() {
    const box = $('#m-lookup'); const f = $('#m-form')?.elements;
    if (!box || !f) return;
    const q = f.title.value.trim();
    if (q.length < 2) { box.hidden = true; return; }
    const kind = box.dataset.lookupKind;
    const seq = ++look.seq;
    box.hidden = false;
    box.innerHTML = `<div class="lookup-msg">Cerco “${esc(q)}”…</div>`;
    try {
      const results = await Lookup.searchMedia(kind, q);
      if (seq !== look.seq || !$('#m-lookup')) return;
      look.results = results;
      box.innerHTML = results.length
        ? `<div class="lookup-msg">Scegli quello giusto per compilare i dati:</div>${results.map((r, i) => `
          <button type="button" class="lookup-item" data-m="pick" data-v="${i}">${cover(r.cover, r.title, 'sm')}
            <span class="lookup-main"><span class="lookup-title">${esc(r.title)}</span>
            <span class="lookup-sub">${esc([r.year, r.director || r.author, r.nSeasons ? `${r.nSeasons} stagioni` : '', r.nEpisodes ? `${r.nEpisodes} episodi` : '', r.volumes ? `${r.volumes} volumi` : ''].filter(Boolean).join(' · '))}</span></span>
          </button>`).join('')}<button type="button" class="btn ghost small" data-m="lookup-close">Nessuno di questi</button>`
        : `<div class="lookup-msg">Nessun risultato per “${esc(q)}”. Prova col titolo originale o inglese, oppure compila a mano.</div>`;
    } catch (err) {
      if (seq !== look.seq) return;
      box.innerHTML = `<div class="lookup-msg">⚠️ Ricerca non disponibile: ${esc(err.message)}. Puoi compilare a mano.</div>`;
    }
  }
  function pick(i) {
    const r = look.results[i]; const form = $('#m-form'); if (!r || !form) return;
    const f = form.elements;
    const fill = (n, v) => { if (f[n] && v != null && v !== '' && !String(f[n].value).trim()) f[n].value = v; };
    f.title.value = r.title;
    if (r.cover) f.cover.value = r.cover;
    fill('year', r.year); fill('director', r.director); fill('author', r.author);
    if (r.volumes) fill('total', r.volumes);
    if (f.nseasons && (r.seasons || r.nSeasons)) {
      const seasons = r.seasons || (() => { const n = r.nSeasons; const per = r.nEpisodes ? Math.max(1, Math.round(r.nEpisodes / n)) : 10; return range(1, n).map(() => per); })();
      f.nseasons.value = seasons.length;
      $('#m-eps-wrap').innerHTML = epsFields(seasons);
      if (!r.seasons) A().toast('Controlla gli episodi di ogni stagione: ho trovato solo il totale.', 'info');
      if (f.status) statusExtra(find('series', work?.id) || {}); else refreshEpSelect();
    }
    look.seq++;
    $('#m-lookup').hidden = true;
    $('#m-cover-preview').innerHTML = cover(f.cover.value.trim(), f.title.value, 'md');
    if (r.seasons || !f.nseasons) A().toast('Dati compilati: controllali e premi Salva', 'info');
  }

  // ---------- eventi ----------
  function openAdd() {
    const k = { manga: 'manga', books: cur.tab === 'comprare' ? 'books-wishlist' : 'books',
      movies: cur.tab === 'vedere' ? 'movies-watchlist' : cur.tab === 'libreria' ? 'movies-owned' : 'movies',
      series: cur.tab === 'vedere' ? 'series-watchlist' : 'series' }[cur.section];
    if (!k) return;
    if (!A().canWrite()) { A().toast('Per aggiungere serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    openForm(k);
  }

  function onClick(e) {
    const el = e.target.closest('[data-m]');
    if (!el) return;
    const m = el.dataset.m; const kind = el.dataset.kind; const id = el.dataset.mid; const v = el.dataset.v;
    if (m === 'fav') { e.stopPropagation(); toggleFav(kind, id); return; }
    if (m === 'add') openAdd();
    if (m === 'edit') openForm(kind, id);
    if (m === 'volumes') openVolumes(id);
    if (m === 'buy') openBuy(id);
    if (m === 'progress') openProgress(id);
    if (m === 'filter') { cur.filter[el.dataset.key] = el.dataset.val; render(); }
    if (m === 'toggle-read') { const b = find('books', id); if (b && canWrite()) update('books', id, { read: !b.read }, `${b.read ? 'Da leggere' : 'Letto'}: ${b.title}`); }
    if (m === 'bought-book') boughtBook(id);
    if (m === 'seen-movie') openRate({ type: 'movie', id });
    if (m === 'seen-series') openRate({ type: 'series', id });
    if (m === 'start-series') startSeries(id);
    if (m === 'plus-ep') plusEp(id);
    // dentro la finestra
    if (m === 'vol') cycleVol(+v);
    if (m === 'all-read') { Object.keys(work.vols).forEach((k) => { work.vols[k] = 'read'; }); work.dirty = true; openVolumes(work.id, true); }
    if (m === 'buy-vol') { if (work.vols[v]) delete work.vols[v]; else work.vols[v] = 'own'; work.dirty = true; openBuy(work.id, true); }
    if (m === 'buy-all') { const mm = find('manga', work.id); missingVols(mm).forEach((n) => { work.vols[n] = 'own'; }); work.dirty = true; openBuy(work.id, true); }
    if (m === 'season') openProgress(work.id, +v, true);
    if (m === 'ep') setEp(+v);
    if (m === 'finish') { const sid = work.id; flushWork(); openRate({ type: 'finish', id: sid, status: v }); }
    if (m === 'delete') deleteItem();
    if (m === 'lookup') { clearTimeout(look.timer); runLookup(); }
    if (m === 'lookup-close') { look.seq++; $('#m-lookup').hidden = true; }
    if (m === 'pick') pick(+v);
  }

  function bind() {
    $('#view-media').addEventListener('click', onClick);
    const d = dlg();
    d.addEventListener('click', onClick);
    // l'evento arriva dopo la chiusura: se nel frattempo la finestra è stata riaperta con altro, non tocca niente
    d.addEventListener('close', () => { if (d.open) return; flushWork(); work = null; look.seq++; });
    d.addEventListener('submit', (e) => { if (work?.type === 'rate') submitRate(e); else if (work?.type === 'form') submitForm(e); });
    d.addEventListener('input', (e) => {
      const t = e.target; const f = $('#m-form')?.elements;
      if (t.name === 'score_r' && f?.score) f.score.value = t.value;
      if (t.name === 'score' && f?.score_r) { const n = parseInt(t.value, 10); if (Number.isFinite(n)) f.score_r.value = Math.max(0, Math.min(100, n)); }
      if (t.name === 'cover' || t.name === 'title') { const p = $('#m-cover-preview'); if (p) p.innerHTML = cover(f.cover.value.trim(), f.title.value, 'md'); }
      if (t.name === 'title' && work?.type === 'form' && !work.id) { clearTimeout(look.timer); look.timer = setTimeout(runLookup, 700); }
      if (t.name === 'nseasons') {
        const k = Math.max(1, Math.min(99, parseInt(t.value, 10) || 0));
        if (!parseInt(t.value, 10)) return;
        const prev = readSeasons();
        $('#m-eps-wrap').innerHTML = epsFields(range(1, k).map((i) => prev[i - 1] || prev[prev.length - 1] || 10));
        refreshEpSelect();
      }
      if (t.dataset.eps != null) refreshEpSelect();
    });
    d.addEventListener('change', (e) => {
      const t = e.target;
      if (t.name === 'status') statusExtra(find('series', work?.id) || {});
      if (t.name === 'at_s') refreshEpSelect();
      if (t.name === 'score') { const n = parseInt(t.value, 10); t.value = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : ''; }
    });
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.name === 'title') { e.preventDefault(); clearTimeout(look.timer); runLookup(); } });
    $('#view-media').addEventListener('input', (e) => {
      const key = e.target.dataset?.mSearch; if (!key) return;
      cur.search[key] = e.target.value; render();
    });
  }

  return { SECTIONS, FROM_HASH, show, render, renderNav, setSection, openAdd, bind, hashOf, reset: () => { cache.pid = null; checkProfile(); } };
})();
