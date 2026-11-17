/* The Game Library — logica dell'interfaccia */
(() => {
  'use strict';

  // Ordine "logico" degli stati, usato anche per l'ordinamento per stato
  const PLAYING = 'In corso';
  const KNOWN_CONSOLES = ['PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'PS Vita', 'PSP', 'Xbox Series X|S', 'Xbox One', 'Xbox 360', 'Switch', 'Switch 2', 'Wii U', 'Wii', '3DS', 'DS', 'Game Boy', 'PC', 'Steam Deck', 'Mobile'];
  // stato di acquisto per uscite e backlog
  const OWNED = {
    no: { icon: '🛒', label: 'Da comprare', cls: 'buy-no' },
    preorder: { icon: '📦', label: 'Preordinato', cls: 'buy-pre' },
    yes: { icon: '✔', label: 'Comprato', cls: 'buy-yes' },
  };
  const OWNED_CYCLE = { upcoming: ['no', 'preorder', 'yes'], backlog: ['no', 'yes'] };
  const STATUSES = ['Platinato', 'Completato', 'Giocato', 'Abbandonato'];
  const STATUS_HINT = {
    [PLAYING]: 'In corso (lo sto giocando)',
    'Giocato senza voto': 'Giocato (senza voto, fuori classifica)',
    Platinato: 'Platinato / 100%',
    Completato: 'Completato',
    Giocato: 'Giocato (senza finale)',
    Abbandonato: 'Abbandonato',
  };

  const USERS_FILE = 'data/users.json';
  const AVATARS = ['cavaliere', 'mago', 'alieno', 'slime', 'fantasma', 'robot', 'ninja', 'teschio',
    'drago', 'gatto', 'rana', 'astronauta', 'vichingo', 'volpe', 'pozione', 'zucca'];
  const avatarUrl = (a) => `assets/avatars/${AVATARS.includes(a) ? a : AVATARS[0]}.svg`;

  // i giochi "in corso" non sono ancora in classifica né nelle statistiche
  const isPlaying = (g) => g.status === PLAYING;
  const finishedGames = () => state.games.filter((g) => !isPlaying(g));
  // "Giocato (senza voto)": conta per ore e anni, ma resta fuori dalla classifica
  const UNRATED = 'Giocato senza voto';
  const isUnrated = (g) => g.status === UNRATED;
  const rankedPool = () => finishedGames().filter((g) => !isUnrated(g));

  const state = {
    statsTab: 'anno',
    recapYear: null,
    compareWith: null,
    compareCache: {},
    users: [],
    profile: null,
    afterProfile: 'home',
    manageProfiles: false,
    editingProfileId: null,
    games: [],
    upcoming: [],
    sortKey: 'score',
    sortDir: 'desc',
    search: '',
    statusFilter: '',
    editingGameId: null,
    editingUpcomingId: null,
    detailId: null,
    pendingUpcomingToRemove: null,
    pendingBacklogToRemove: null,
    backlog: [],
    editingBacklogId: null,
    backlogSort: 'recent',
    favOnly: false,
    backlogOwned: '',
    collection: [],
    hardware: [],
    collSection: 'games',
    editingHwId: null,
    hwDetailId: null,
    hwPhoto: null,
    collFormat: '',
    collConsole: null,
    collView: 'list',
    collSearch: '',
    collSort: 'title',
    editingCollId: null,
    collTab: 'new',
    importSel: new Map(),
    importConsole: '',
    importSearch: '',
    busy: false,
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ---------- utilità ----------
  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);
  }
  function num(v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  const fmtInt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
  const fmt1 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
  const fmtDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const collator = new Intl.Collator('it', { sensitivity: 'base', numeric: true });

  function scoreClass(s) {
    if (s == null) return 'score-none';
    if (s >= 90) return 'score-s';
    if (s >= 75) return 'score-a';
    if (s >= 60) return 'score-b';
    if (s >= 40) return 'score-c';
    return 'score-d';
  }
  function statusChip(status) {
    const cls = { Platinato: 'st-plat', Completato: 'st-done', Giocato: 'st-played', Abbandonato: 'st-drop', [PLAYING]: 'st-playing', [UNRATED]: 'st-unrated' }[status] || '';
    return `<span class="chip ${cls}">${esc(status || '—')}</span>`;
  }

  function initials(title) {
    return (title || '?').replace(/['’]/g, '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
  }
  // copertina del gioco, oppure un riquadro con le iniziali
  function coverHTML(url, title, cls = '') {
    const ph = `<span class="cover ph ${cls}" aria-hidden="true">${esc(initials(title))}</span>`;
    if (!url) return ph;
    return `<img class="cover ${cls}" src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-ph="${esc(initials(title))}">`;
  }

  function starButton(g) {
    const on = Boolean(g.favorite);
    return `<button type="button" class="star${on ? ' on' : ''}" data-fav="${esc(g.id)}" aria-pressed="${on}"
      title="${on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}" aria-label="${on ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}">${on ? '★' : '☆'}</button>`;
  }

  async function toggleFavorite(id) {
    const g = state.games.find((x) => x.id === id);
    if (!g) return;
    if (!Storage.canWrite()) { toast('Per salvare i preferiti serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    const value = !g.favorite;
    const apply = (v) => {
      state.games = state.games.map((x) => (x.id === id ? { ...x, favorite: v } : x));
      renderAll();
      if (state.detailId === id && $('#detail-dialog').open) $('#detail-star').innerHTML = starButton({ id, favorite: v });
    };
    apply(value); // la stella cambia subito, il salvataggio avviene in background
    try {
      state.games = await save('games', (list) => list.map((x) => (x.id === id ? { ...x, favorite: value } : x)),
        `${value ? 'Aggiunto ai preferiti' : 'Tolto dai preferiti'}: ${g.title}`);
      renderAll();
    } catch (err) {
      apply(!value);
      toast(err.message, 'error');
    }
  }

  function toast(msg, type = 'ok') {
    const el = $('#toast');
    el.textContent = msg;
    el.className = `toast ${type}`;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.hidden = true; }, type === 'error' ? 7000 : 3000);
  }

  function setBusy(on, label) {
    state.busy = on;
    $$('button[type=submit], #detail-delete, #upcoming-delete').forEach((b) => { b.disabled = on; });
    if (on && label) toast(label, 'info');
  }

  // ---------- routing ----------
  const VIEWS = ['profili', 'home', 'classifica', 'collezione', 'uscite', 'statistiche', 'impostazioni'];
  function route() {
    const [v, arg] = (location.hash || '#home').slice(1).split('/');
    let view = VIEWS.includes(v) ? v : 'home';
    state.collConsole = view === 'collezione' && arg ? decodeURIComponent(arg) : null;
    if (view !== 'profili' && !state.profile) {
      // nessun profilo scelto: prima la schermata "Chi gioca?"
      state.afterProfile = view;
      view = 'profili';
    }
    if (view === 'profili') { state.manageProfiles = false; renderProfiles(); }
    VIEWS.forEach((name) => { $(`#view-${name}`).hidden = name !== view; });
    $$('a[data-view]').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    document.body.dataset.view = view;
    $$('dialog[open]').forEach((d) => d.close());
    $('#fab-menu').hidden = true;
    if (view === 'impostazioni') fillSettings();
    if (view === 'statistiche' && state.profile) renderStatsView();
    if (view === 'collezione' && state.profile) renderCollection();
    if (view === 'home') renderChart(); // il grafico si adatta alla larghezza visibile
    if (view === 'uscite' && state.scrollTo) { const el = $(`#${state.scrollTo}`); state.scrollTo = null; requestAnimationFrame(() => el.scrollIntoView()); }
    else window.scrollTo(0, 0);
  }

  // ---------- caricamento ----------
  let lastLoad = 0;
  const fileFor = (kind) => `${state.profile.dir}/${kind}.json`;
  function save(kind, mutate, message) {
    return Storage.update(fileFor(kind), mutate, `${message} [${state.profile.name}]`);
  }

  async function loadAll() {
    if (!state.profile) return;
    lastLoad = Date.now();
    const profileId = state.profile.id;
    const [g, u, b, c, hw] = await Promise.all([
      Storage.load(fileFor('games')), Storage.load(fileFor('upcoming')), Storage.load(fileFor('backlog')),
      Storage.load(fileFor('collection')), Storage.load(fileFor('consoles')),
    ]);
    if (!state.profile || state.profile.id !== profileId) return; // nel frattempo è cambiato profilo
    state.games = g.data;
    state.upcoming = u.data;
    state.backlog = b.data;
    state.collection = c.data;
    state.hardware = hw.data;
    updateBanner(g.warning || u.warning, g.source);
    renderAll();
  }

  function updateBanner(warning, source) {
    const b = $('#banner');
    const cfg = Storage.getConfig();
    let html = '';
    if (warning && source !== 'github') {
      html = `⚠️ ${esc(warning)} — sto mostrando ${source === 'cache' ? "l'ultima copia salvata nel browser" : 'i dati pubblicati sul sito'}.`;
    } else if (!Storage.canWrite(cfg)) {
      html = '🔒 Modalità sola lettura. Per aggiungere o modificare giochi inserisci il token GitHub in <a href="#impostazioni">Impostazioni</a>.';
    }
    b.innerHTML = html;
    b.hidden = !html;
  }

  function renderPlaying() {
    const list = state.games.filter(isPlaying).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
    $('#playing-card').hidden = list.length === 0;
    $('#playing-count').textContent = list.length > 1 ? `${list.length} giochi` : '';
    $('#playing-list').innerHTML = list.map((g) => `
      <div class="playing-item">
        <button type="button" class="playing-open clickable" data-id="${esc(g.id)}" aria-label="Apri ${esc(g.title)}">
          ${coverHTML(g.cover, g.title, 'md')}
          <span class="playing-text">
            <span class="playing-title">${esc(g.title)}</span>
            <span class="playing-sub">${esc([g.console, g.hours ? `${fmt1.format(g.hours)} h finora` : ''].filter(Boolean).join(' · '))}</span>
          </span>
        </button>
        <div class="playing-actions">
          <button type="button" class="btn small" data-action="hours-playing" data-id="${esc(g.id)}">⏱ Ore</button>
          <button type="button" class="btn small primary" data-action="finish-playing" data-id="${esc(g.id)}">✔ Finito</button>
        </div>
      </div>`).join('');
  }

  function renderAll() {
    renderPlaying();
    renderStats();
    renderChart();
    renderHomeLists();
    renderRanking();
    renderUpcoming();
    renderBacklog();
    renderCollection();
    renderDatalists();
    if (document.body.dataset.view === 'statistiche' && state.profile) renderStatsView();
  }

  // ---------- HOME ----------
  function renderStats() {
    const g = finishedGames();
    const scored = g.filter((x) => x.score != null);
    const avg = scored.length ? scored.reduce((a, x) => a + x.score, 0) / scored.length : null;
    const hours = g.reduce((a, x) => a + (x.hours || 0), 0);
    $('#stat-avg').textContent = avg == null ? '–' : fmt1.format(avg);
    $('#stat-hours').textContent = fmtInt.format(Math.round(hours));
    $('#stat-count').textContent = fmtInt.format(g.length);
    const plat = g.filter((x) => x.status === 'Platinato').length;
    const done = g.filter((x) => x.status === 'Completato').length;
    const fav = g.filter((x) => x.favorite).length;
    $('#stat-count-sub').textContent = g.length ? `${done} completati · ${plat} platinati${fav ? ` · ${fav} ★` : ''}` : 'in libreria';
  }

  function yearCounts() {
    const counts = new Map();
    finishedGames().forEach((x) => {
      if (x.playedYear) counts.set(x.playedYear, (counts.get(x.playedYear) || 0) + 1);
    });
    if (!counts.size) return [];
    const years = [...counts.keys()];
    const min = Math.min(...years);
    const max = Math.max(...years);
    const out = [];
    for (let y = min; y <= max; y++) out.push({ year: y, count: counts.get(y) || 0 });
    return out;
  }

  function niceMax(v) {
    if (v <= 5) return Math.max(1, v);
    const step = v <= 10 ? 2 : v <= 25 ? 5 : v <= 50 ? 10 : 20;
    return Math.ceil(v / step) * step;
  }

  function renderChart() {
    const all = yearCounts();
    // sul telefono il grafico mostra solo gli ultimi 5 anni (la tabella li ha tutti)
    const MOBILE_YEARS = 5;
    const isPhone = window.matchMedia('(max-width: 640px)').matches;
    const data = isPhone && all.length > MOBILE_YEARS ? all.slice(-MOBILE_YEARS) : all;
    $('#chart-range').textContent = data.length < all.length ? `ultimi ${MOBILE_YEARS} anni` : '';
    const el = $('#chart');
    const tableEl = $('#chart-table');
    if (!data.length) {
      el.innerHTML = '<p class="empty">Aggiungi dei giochi per vedere il grafico.</p>';
      tableEl.innerHTML = '';
      return;
    }
    const W = Math.max(280, Math.round(el.clientWidth || 600));
    const H = W < 480 ? 220 : 260, padL = 28, padR = 6, padT = 22, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxC = Math.max(...data.map((d) => d.count));
    const yMax = niceMax(maxC);
    const ticks = yMax <= 5 ? yMax : 4;
    const band = iw / data.length;
    const bw = Math.max(4, Math.min(48, band * 0.62));
    const r = Math.min(4, bw / 2);
    const labelEvery = Math.ceil(data.length / Math.floor(iw / 36));
    const maxIdx = data.findIndex((d) => d.count === maxC);

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Giochi giocati per anno">`;
    for (let i = 0; i <= ticks; i++) {
      const v = (yMax / ticks) * i;
      const y = padT + ih - (v / yMax) * ih;
      svg += `<line class="grid" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
      svg += `<text class="axis" x="${padL - 6}" y="${y + 4}" text-anchor="end">${fmtInt.format(v)}</text>`;
    }
    data.forEach((d, i) => {
      const cx = padL + band * i + band / 2;
      const h = (d.count / yMax) * ih;
      const x = cx - bw / 2;
      const y = padT + ih - h;
      if (d.count > 0) {
        // barra con angoli superiori arrotondati, ancorata alla base
        const rr = Math.min(r, h);
        svg += `<path class="bar" d="M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + bw - rr} Q${x + bw},${y} ${x + bw},${y + rr} V${y + h} Z"/>`;
      }
      if (i === maxIdx) {
        svg += `<text class="bar-label" x="${cx}" y="${y - 6}" text-anchor="middle">${d.count}</text>`;
      }
      if (i % labelEvery === 0 || i === data.length - 1) {
        svg += `<text class="axis" x="${cx}" y="${H - 8}" text-anchor="middle">${d.year}</text>`;
      }
      // area di hover più grande della barra
      svg += `<rect class="hit" x="${padL + band * i}" y="${padT}" width="${band}" height="${ih}" data-year="${d.year}" data-count="${d.count}"/>`;
    });
    svg += `<line class="baseline" x1="${padL}" x2="${W - padR}" y1="${padT + ih}" y2="${padT + ih}"/>`;
    svg += '</svg>';
    el.innerHTML = svg;

    tableEl.innerHTML = `<table class="simple"><thead><tr><th>Anno</th><th class="num">Giochi</th></tr></thead><tbody>${
      all.slice().reverse().map((d) => `<tr><td>${d.year}</td><td class="num">${d.count}</td></tr>`).join('')
    }</tbody></table>`;
  }

  function setupChartHover() {
    const tip = $('#tooltip');
    const chart = $('#chart');
    const show = (e) => {
      const t = e.target.closest('.hit');
      $$('.hit.on', chart).forEach((h) => h.classList.remove('on'));
      if (!t) { tip.hidden = true; return; }
      t.classList.add('on');
      const c = Number(t.dataset.count);
      tip.innerHTML = `<strong>${t.dataset.year}</strong><br>${c} ${c === 1 ? 'gioco' : 'giochi'}`;
      tip.hidden = false;
      const pt = e.touches ? e.touches[0] : e;
      const x = Math.min(window.innerWidth - tip.offsetWidth - 8, pt.clientX + 12);
      tip.style.left = `${Math.max(8, x)}px`;
      tip.style.top = `${pt.clientY - tip.offsetHeight - 12}px`;
    };
    let lastTouch = 0;
    const fromTouch = () => Date.now() - lastTouch < 1000; // eventi "mouse" finti generati dal tocco
    chart.addEventListener('mousemove', (e) => { if (!fromTouch()) show(e); });
    chart.addEventListener('touchstart', (e) => {
      lastTouch = Date.now();
      show(e);
      clearTimeout(setupChartHover.t);
      setupChartHover.t = setTimeout(() => { tip.hidden = true; $$('.hit.on', chart).forEach((h) => h.classList.remove('on')); }, 2500);
    }, { passive: true });
    let rw;
    let lastW = chart.clientWidth;
    window.addEventListener('resize', () => {
      clearTimeout(rw);
      rw = setTimeout(() => { if (chart.clientWidth !== lastW) { lastW = chart.clientWidth; renderChart(); } }, 150);
    });
    chart.addEventListener('mouseleave', () => { if (fromTouch()) return; tip.hidden = true; $$('.hit.on', chart).forEach((h) => h.classList.remove('on')); });
    $('#chart-toggle').addEventListener('click', (e) => {
      const tbl = $('#chart-table');
      tbl.hidden = !tbl.hidden;
      chart.hidden = !tbl.hidden;
      e.target.textContent = tbl.hidden ? 'Mostra tabella' : 'Mostra grafico';
    });
  }

  function renderHomeLists() {
    const top = rankedGames().slice(0, 5);
    $('#home-top').innerHTML = top.length
      ? top.map(({ g, rank }) => `
        <li class="mini-item clickable" data-id="${esc(g.id)}">
          <span class="mini-rank">${rank}</span>
          ${coverHTML(g.cover, g.title, 'xs')}
          <span class="mini-main"><span class="mini-title">${g.favorite ? '<span class="fav-mark" title="Preferito">★</span> ' : ''}${esc(g.title)}</span><span class="mini-sub">${esc(g.console || '')}${g.playedYear ? ' · ' + g.playedYear : ''}</span></span>
          <span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span>
        </li>`).join('')
      : '<li class="empty">Nessun gioco ancora. Premi “+ Aggiungi gioco”.</li>';

    const up = sortedUpcoming().filter((u) => !isReleased(u)).slice(0, 5);
    $('#home-upcoming').innerHTML = up.length
      ? up.map((u) => `
        <li class="mini-item">
          ${coverHTML(u.cover, u.title, 'xs')}
          <span class="mini-main"><span class="mini-title">${esc(u.title)}</span><span class="mini-sub">${esc(u.console || '')}</span></span>
          <span class="mini-date">${esc(releaseLabel(u, true))}</span>
        </li>`).join('')
      : '<li class="empty">Nessuna uscita in programma.</li>';

    const bl = sortedBacklog('recent').slice(0, 4);
    $('#home-backlog').innerHTML = bl.length
      ? bl.map((b) => `
        <li class="mini-item">
          ${coverHTML(b.cover, b.title, 'xs')}
          <span class="mini-main"><span class="mini-title">${esc(b.title)}</span><span class="mini-sub">${esc(b.console || '')}</span></span>
          <span class="mini-date">${b.time?.main ? `⏱ ${fmtHours(b.time.main)}` : ''}</span>
        </li>`).join('')
      : '<li class="empty">Il backlog è vuoto.</li>';
  }

  // ---------- CLASSIFICA ----------
  // posizione in classifica sempre basata sul voto (a pari voto, stessa posizione)
  function rankedGames() {
    const sorted = rankedPool().sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || collator.compare(a.title, b.title));
    let lastScore = null, lastRank = 0;
    return sorted.map((g, i) => {
      if (g.score !== lastScore) { lastRank = i + 1; lastScore = g.score; }
      return { g, rank: lastRank };
    });
  }

  function compareBy(key) {
    switch (key) {
      case 'title': case 'console':
        return (a, b) => collator.compare(a[key] || '', b[key] || '');
      case 'status':
        return (a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
      default: // numerici: score, hours, playedYear, releaseYear
        return (a, b) => (a[key] ?? -Infinity) - (b[key] ?? -Infinity);
    }
  }

  function renderUnrated() {
    const q = state.search.trim().toLowerCase();
    const list = state.games.filter(isUnrated)
      .filter((g) => !q || [g.title, g.developer, g.franchise, g.genre, g.console].some((f) => (f || '').toLowerCase().includes(q)))
      .sort((a, b) => (b.hours || 0) - (a.hours || 0) || collator.compare(a.title, b.title));
    $('#unrated-card').hidden = list.length === 0;
    const hours = list.reduce((a, g) => a + (g.hours || 0), 0);
    $('#unrated-meta').textContent = `${list.length} ${list.length === 1 ? 'gioco' : 'giochi'}${hours ? ` · ${fmtInt.format(Math.round(hours))} h` : ''}`;
    $('#unrated-list').innerHTML = list.map((g) => `
      <li class="mini-item clickable" data-id="${esc(g.id)}">
        ${coverHTML(g.cover, g.title, 'xs')}
        <span class="mini-main"><span class="mini-title">${esc(g.title)}</span><span class="mini-sub">${esc([g.console, g.playedYear].filter(Boolean).join(' · '))}</span></span>
        <span class="mini-date">${g.hours ? `${fmt1.format(g.hours)} h` : '–'}</span>
      </li>`).join('');
  }

  function renderRanking() {
    const ranks = new Map(rankedGames().map(({ g, rank }) => [g.id, rank]));
    const q = state.search.trim().toLowerCase();
    renderUnrated();
    let list = rankedPool().filter((g) => {
      if (state.statusFilter && g.status !== state.statusFilter) return false;
      if (state.favOnly && !g.favorite) return false;
      if (!q) return true;
      return [g.title, g.developer, g.franchise, g.genre, g.console].some((f) => (f || '').toLowerCase().includes(q));
    });
    const cmp = compareBy(state.sortKey);
    const dir = state.sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => dir * cmp(a, b) || (b.score ?? -1) - (a.score ?? -1) || collator.compare(a.title, b.title));

    $('#ranking-body').innerHTML = list.map((g) => `
      <tr class="clickable" data-id="${esc(g.id)}">
        <td class="c-rank">${ranks.get(g.id)}</td>
        <td class="c-title"><div class="title-cell">${coverHTML(g.cover, g.title, 'sm')}<div class="title-text"><span class="t">${esc(g.title)}${starButton(g)}</span><span class="sub">${esc([g.developer, g.genre].filter(Boolean).join(' · '))}</span></div></div></td>
        <td data-label="Console">${esc(g.console || '—')}</td>
        <td data-label="Stato">${statusChip(g.status)}</td>
        <td class="num" data-label="Ore">${g.hours != null ? fmt1.format(g.hours) : '—'}</td>
        <td class="num" data-label="Giocato">${g.playedYear ?? '—'}</td>
        <td class="num c-score"><span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span></td>
        <td class="c-meta">${statusChip(g.status)}<span>${esc([g.console, g.hours != null ? fmt1.format(g.hours) + ' h' : '', g.playedYear].filter(Boolean).join(' · '))}</span></td>
      </tr>`).join('');

    const empty = $('#ranking-empty');
    empty.hidden = list.length > 0;
    empty.textContent = !rankedPool().length ? 'La classifica è vuota. Aggiungi il tuo primo gioco!'
      : state.favOnly && !state.games.some((g) => g.favorite) ? 'Nessun preferito ancora: tocca la stella ☆ accanto a un gioco.'
        : 'Nessun gioco corrisponde alla ricerca.';
    $('#fav-filter').setAttribute('aria-pressed', String(state.favOnly));
    $('#fav-filter').classList.toggle('on', state.favOnly);
    $('.ranking').hidden = list.length === 0;

    $$('.ranking th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === state.sortKey);
      th.dataset.dir = th.dataset.sort === state.sortKey ? state.sortDir : '';
    });
    $('#sort-key').value = state.sortKey;
    $('#sort-dir').textContent = state.sortDir === 'asc' ? '↑' : '↓';
  }

  function defaultDir(key) {
    return ['title', 'console', 'status'].includes(key) ? 'asc' : 'desc';
  }

  function setSort(key, toggleIfSame = true) {
    if (toggleIfSame && state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
    else { state.sortKey = key; state.sortDir = defaultDir(key); }
    try { localStorage.setItem('tgl-sort', JSON.stringify({ k: state.sortKey, d: state.sortDir })); } catch { /* ignore */ }
    renderRanking();
  }

  // ---------- IN USCITA ----------
  function todayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  // modulo uscite: data esatta / solo anno / TBA
  function setReleaseMode(mode) {
    const f = $('#upcoming-form').elements;
    $$('input[name="releaseMode"]', $('#upcoming-form')).forEach((r) => { r.checked = r.value === mode; });
    $('#release-date-row').hidden = mode !== 'date';
    $('#release-year-row').hidden = mode !== 'year';
    $('#release-tba-note').hidden = mode !== 'tba';
    f.releaseDate.required = mode === 'date';
    f.releaseYear.required = mode === 'year';
  }

  function isReleased(u) {
    if (u.releaseDate) return u.releaseDate <= todayISO();
    return u.releaseYear && u.releaseYear < new Date().getFullYear();
  }
  function sortedUpcoming() {
    // ordine: per data; i giochi con solo l'anno vanno in fondo al loro anno
    const key = (u) => u.releaseDate || `${u.releaseYear || 9999}-99-99`;
    return state.upcoming.slice().sort((a, b) => key(a).localeCompare(key(b)) || collator.compare(a.title, b.title));
  }
  function daysUntil(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }
  function releaseLabel(u, short = false) {
    if (u.releaseDate) {
      const [y, m, d] = u.releaseDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return short ? date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : fmtDate.format(date);
    }
    if (short) return u.releaseYear ? String(u.releaseYear) : 'TBA';
    return u.releaseYear ? `${u.releaseYear} · data da annunciare` : 'TBA · data da annunciare';
  }
  function countdown(u) {
    if (!u.releaseDate) return '';
    const n = daysUntil(u.releaseDate);
    if (n > 1) return `tra ${n} giorni`;
    if (n === 1) return 'domani';
    if (n === 0) return 'esce oggi!';
    return 'uscito';
  }

  function renderUpcoming() {
    const list = sortedUpcoming();
    let lastYear = null;
    $('#upcoming-list').innerHTML = list.map((u) => {
      const year = u.releaseDate ? Number(u.releaseDate.slice(0, 4)) : u.releaseYear;
      const header = year !== lastYear ? `<li class="year-sep">${esc(year || 'Da annunciare')}</li>` : '';
      lastYear = year;
      const released = isReleased(u);
      return `${header}
        <li class="upcoming-item ${released ? 'released' : ''}">
          ${u.cover ? coverHTML(u.cover, u.title, 'md') : `<div class="up-date">
            ${u.releaseDate
              ? `<span class="d">${Number(u.releaseDate.slice(8, 10))}</span><span class="m">${new Date(u.releaseDate + 'T00:00').toLocaleDateString('it-IT', { month: 'short' })}</span>`
              : u.releaseYear ? `<span class="d d-year">${u.releaseYear}</span>` : '<span class="m">TBA</span>'}
          </div>`}
          <div class="up-main">
            <div class="up-title">${esc(u.title)}</div>
            <div class="up-sub">${esc([u.console, releaseLabel(u)].filter(Boolean).join(' · '))}</div>
            <div class="buy-row">${ownedBadge(u, 'upcoming')}</div>
            ${u.notes ? `<div class="up-notes">${esc(u.notes)}</div>` : ''}
          </div>
          <div class="up-side">
            ${countdown(u) ? `<span class="countdown ${released ? 'done' : ''}">${esc(countdown(u))}</span>` : ''}
            <div class="up-actions">
              ${released ? `<button class="btn small" data-action="promote" data-id="${esc(u.id)}" title="Sposta nella libreria">+ Libreria</button>` : ''}
              <button class="btn ghost small" data-action="edit-upcoming" data-id="${esc(u.id)}">Modifica</button>
            </div>
          </div>
        </li>`;
    }).join('');
    $('#upcoming-empty').hidden = list.length > 0;
  }

  function renderDatalists() {
    const fill = (id, field, extra = []) => {
      const vals = [...new Set([...extra, ...state.games.map((g) => g[field]), ...(field === 'console' ? [...state.upcoming, ...state.collection].map((u) => u.console) : [])].filter(Boolean))]
        .sort(collator.compare);
      $(`#dl-${id}`).innerHTML = vals.map((v) => `<option value="${esc(v)}">`).join('');
    };
    fill('developer', 'developer');
    fill('genre', 'genre', ['Action', 'Avventura', 'GDR', 'Sparatutto', 'Platform', 'Picchiaduro', 'Sportivo', 'Corse', 'Strategia', 'Horror', 'Puzzle', 'Simulazione', 'Metroidvania', 'Roguelike', 'Soulslike', 'Open world']);
    fill('franchise', 'franchise');
    fill('console', 'console', KNOWN_CONSOLES);
  }

  // ---------- DIALOG: gioco ----------
  function openGameForm(game = null, prefill = null) {
    state.editingGameId = game ? game.id : null;
    const f = $('#game-form');
    f.reset();
    $('#game-form-title').textContent = game ? 'Modifica gioco' : 'Aggiungi gioco';
    const src = game || prefill || { playedYear: new Date().getFullYear(), status: 'Completato' };
    ['title', 'cover', 'developer', 'genre', 'franchise', 'console', 'score', 'hours', 'status', 'releaseYear', 'playedYear', 'review']
      .forEach((k) => { if (f.elements[k]) f.elements[k].value = src[k] ?? ''; });
    if (!f.elements.status.value) f.elements.status.value = 'Completato';
    updateScoreRequired();
    resetLookup('game');
    $('#game-dialog').showModal();
    // per un gioco nuovo con titolo già noto (es. da "In uscita"), cerca subito i dati
    if (!game && src.title) runLookup('game');
  }

  function updateScoreRequired() {
    const f = $('#game-form').elements;
    const playing = f.status.value === PLAYING || f.status.value === UNRATED;
    f.score.required = !playing;
    f.score.placeholder = f.status.value === UNRATED ? 'non serve: resta fuori classifica' : playing ? 'lo darai quando lo finisci' : '';
    $('#score-label-text').textContent = playing ? 'Voto (0–100)' : 'Voto (0–100) *';
  }

  function readGameForm() {
    const f = $('#game-form').elements;
    const s = (k) => f[k].value.trim();
    return {
      title: s('title'),
      cover: s('cover'),
      developer: s('developer'),
      genre: s('genre'),
      franchise: s('franchise'),
      console: s('console'),
      score: num(f.score.value) == null ? null : Math.max(0, Math.min(100, Math.round(num(f.score.value)))),
      hours: num(f.hours.value) == null ? null : Math.max(0, num(f.hours.value)),
      status: f.status.value,
      releaseYear: num(f.releaseYear.value),
      playedYear: num(f.playedYear.value),
      review: f.review.value.trim(),
    };
  }

  async function submitGame(e) {
    e.preventDefault();
    if (state.busy) return;
    const data = readGameForm();
    const now = new Date().toISOString();
    const editingId = state.editingGameId;
    const removeUpcomingId = state.pendingUpcomingToRemove;
    const removeBacklogId = state.pendingBacklogToRemove;
    if (data.status === PLAYING) data.startedAt = state.games.find((g) => g.id === editingId)?.startedAt || todayISO();
    setBusy(true, 'Salvataggio in corso…');
    try {
      if (editingId) {
        state.games = await save('games', (list) => {
          const i = list.findIndex((g) => g.id === editingId);
          if (i === -1) throw new Error('Il gioco non esiste più (forse è stato eliminato da un altro dispositivo).');
          list[i] = { ...list[i], ...data, updatedAt: now };
          return list;
        }, `Modificato gioco: ${data.title}`);
      } else {
        const game = { id: uid(), ...data, createdAt: now, updatedAt: now };
        state.games = await save('games', (list) => { list.push(game); return list; }, `Aggiunto gioco: ${data.title}`);
      }
      if (removeUpcomingId) {
        state.upcoming = await save('upcoming', (list) => list.filter((u) => u.id !== removeUpcomingId), `Spostato in libreria: ${data.title}`);
      }
      if (removeBacklogId) {
        state.backlog = await save('backlog', (list) => list.filter((b) => b.id !== removeBacklogId), `Dal backlog alla libreria: ${data.title}`);
      }
      state.pendingUpcomingToRemove = null;
      state.pendingBacklogToRemove = null;
      $('#game-dialog').close();
      renderAll();
      toast(editingId ? 'Modifiche salvate ✔' : `“${data.title}” aggiunto alla libreria ✔`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- DIALOG: dettaglio ----------
  function openDetail(id) {
    const g = state.games.find((x) => x.id === id);
    if (!g) return;
    state.detailId = id;
    const rank = rankedGames().find((r) => r.g.id === id)?.rank;
    $('#detail-title').textContent = g.title;
    const row = (label, value) => (value != null && value !== '' ? `<div class="kv"><span>${label}</span><strong>${value}</strong></div>` : '');
    $('#detail-body').innerHTML = `
      <div class="detail-top">
        ${coverHTML(g.cover, g.title, 'lg')}
        <span class="score big ${scoreClass(g.score)}">${g.score ?? '–'}</span>
        <div>
          <div>${statusChip(g.status)}</div>
          <div class="muted">${isPlaying(g) ? (g.startedAt ? `Iniziato il ${fmtDate.format(new Date(g.startedAt + 'T00:00'))}` : 'Non ancora finito') : isUnrated(g) ? 'Fuori classifica (senza voto)' : `#${rank} in classifica`}</div>
          <div id="detail-star" class="detail-star">${starButton(g)}</div>
        </div>
      </div>
      <div class="kv-grid">
        ${row('Sviluppatore', esc(g.developer))}
        ${row('Genere', esc(g.genre))}
        ${row('Franchise', esc(g.franchise))}
        ${row('Console', esc(g.console))}
        ${row('Ore giocate', g.hours != null ? fmt1.format(g.hours) : '')}
        ${row('Anno di uscita', g.releaseYear)}
        ${row('Anno giocato', g.playedYear)}
      </div>
      ${g.review ? `<h3>Recensione</h3><p class="review">${esc(g.review)}</p>` : ''}`;
    $('#detail-dialog').showModal();
  }

  async function deleteGame() {
    const g = state.games.find((x) => x.id === state.detailId);
    if (!g || state.busy) return;
    if (!confirm(`Eliminare definitivamente “${g.title}”?`)) return;
    setBusy(true, 'Eliminazione in corso…');
    try {
      state.games = await save('games', (list) => list.filter((x) => x.id !== g.id), `Eliminato gioco: ${g.title}`);
      $('#detail-dialog').close();
      renderAll();
      toast(`“${g.title}” eliminato`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- DIALOG: uscita ----------
  function openUpcomingForm(u = null) {
    state.editingUpcomingId = u ? u.id : null;
    const f = $('#upcoming-form');
    f.reset();
    $('#upcoming-form-title').textContent = u ? 'Modifica uscita' : 'Aggiungi uscita';
    $('#upcoming-delete').hidden = !u;
    const src = u || {};
    ['title', 'cover', 'console', 'releaseDate', 'notes'].forEach((k) => { f.elements[k].value = src[k] ?? ''; });
    setOwnedRadio(f, u ? u.owned : 'no');
    f.elements.releaseYear.value = u && !u.releaseDate && u.releaseYear ? u.releaseYear : '';
    setReleaseMode(!u || u.releaseDate ? 'date' : u.releaseYear ? 'year' : 'tba');
    resetLookup('upcoming');
    $('#upcoming-dialog').showModal();
  }

  async function submitUpcoming(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#upcoming-form').elements;
    const mode = f.releaseMode.value || 'date';
    const releaseDate = mode === 'date' ? f.releaseDate.value || '' : '';
    const yearOnly = mode === 'year' ? num(f.releaseYear.value) : null;
    const data = {
      title: f.title.value.trim(),
      cover: f.cover.value.trim(),
      console: f.console.value.trim(),
      releaseDate,
      releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : yearOnly,
      notes: f.notes.value.trim(),
      owned: f.owned.value || undefined,
    };
    const editingId = state.editingUpcomingId;
    const prevOwned = editingId ? state.upcoming.find((x) => x.id === editingId)?.owned : undefined;
    setBusy(true, 'Salvataggio in corso…');
    try {
      state.upcoming = await save('upcoming', (list) => {
        if (editingId) {
          const i = list.findIndex((x) => x.id === editingId);
          if (i === -1) throw new Error('Questa uscita non esiste più.');
          list[i] = { ...list[i], ...data };
        } else {
          list.push({ id: uid(), ...data, createdAt: new Date().toISOString() });
        }
        return list;
      }, `${editingId ? 'Modificata' : 'Aggiunta'} uscita: ${data.title}`);
      $('#upcoming-dialog').close();
      renderAll();
      toast('Uscita salvata ✔');
      if (data.owned === 'yes' && prevOwned !== 'yes') setTimeout(() => offerCollection(data), 0);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteUpcoming() {
    const u = state.upcoming.find((x) => x.id === state.editingUpcomingId);
    if (!u || state.busy) return;
    if (!confirm(`Eliminare “${u.title}” dalle uscite?`)) return;
    setBusy(true, 'Eliminazione in corso…');
    try {
      state.upcoming = await save('upcoming', (list) => list.filter((x) => x.id !== u.id), `Eliminata uscita: ${u.title}`);
      $('#upcoming-dialog').close();
      renderAll();
      toast('Uscita eliminata');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- BACKLOG ----------
  const fmtHours = (h) => `${fmt1.format(h)} h`;
  const hltbUrl = (title) => `https://howlongtobeat.com/?q=${encodeURIComponent(title || '')}`;

  function sortedBacklog(mode = state.backlogSort) {
    const list = state.backlog.slice();
    const t = (b) => b.time?.main ?? null;
    if (mode === 'title') return list.sort((a, b) => collator.compare(a.title, b.title));
    if (mode === 'short' || mode === 'long') {
      const dir = mode === 'short' ? 1 : -1;
      return list.sort((a, b) => {
        if (t(a) == null && t(b) == null) return collator.compare(a.title, b.title);
        if (t(a) == null) return 1; // senza tempo in fondo
        if (t(b) == null) return -1;
        return dir * (t(a) - t(b));
      });
    }
    return list.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  }

  function timeChips(b) {
    const t = b.time || {};
    const chips = [['main', 'Storia'], ['extra', 'Storia + extra'], ['complete', 'Completista']]
      .filter(([k]) => t[k] != null)
      .map(([k, label]) => `<span class="time-chip ${k}"><strong>${fmtHours(t[k])}</strong> ${label}</span>`);
    return chips.join('');
  }

  function renderBacklog() {
    const all = sortedBacklog();
    const list = state.backlogOwned ? all.filter((b) => (b.owned || 'unset') === state.backlogOwned) : all;
    $('#backlog-list').innerHTML = list.map((b) => {
      const chips = timeChips(b);
      return `
        <li class="backlog-item">
          ${coverHTML(b.cover, b.title, 'md')}
          <div class="up-main">
            <div class="up-title">${esc(b.title)}</div>
            ${b.console ? `<div class="up-sub">${esc(b.console)}</div>` : ''}
            <div class="time-chips">${ownedBadge(b, 'backlog')}${chips || '<span class="muted small">Tempo non ancora inserito</span>'}</div>
            ${b.notes ? `<div class="up-notes">${esc(b.notes)}</div>` : ''}
          </div>
          <div class="up-side">
            <a class="hltb-link" href="${hltbUrl(b.title)}" target="_blank" rel="noopener" title="Apri su HowLongToBeat">⏱ HLTB ↗</a>
            <div class="up-actions">
              <button class="btn small primary" data-action="play-backlog" data-id="${esc(b.id)}" title="Inizia a giocarlo: va tra i giochi in corso">▶ Inizia</button>
              <button class="btn small" data-action="start-backlog" data-id="${esc(b.id)}" title="L'hai già finito? Spostalo nella libreria">✔ Giocato</button>
              <button class="btn ghost small" data-action="edit-backlog" data-id="${esc(b.id)}">Modifica</button>
            </div>
          </div>
        </li>`;
    }).join('');
    $('#backlog-empty').hidden = list.length > 0;
    $('#backlog-toolbar').hidden = all.length < 2;
    if (!list.length && all.length) {
      $('#backlog-empty').hidden = false;
      $('#backlog-empty').textContent = { no: 'Hai già comprato tutto il backlog 🎉', yes: 'Nessun gioco comprato nel backlog.', unset: 'Hai indicato l\'acquisto per tutti i giochi ✔' }[state.backlogOwned];
    } else {
      $('#backlog-empty').textContent = 'Il backlog è vuoto. Aggiungi i giochi che vuoi giocare!';
    }
    const toBuy = all.filter((b) => b.owned === 'no').length;
    const withTime = list.filter((b) => b.time?.main != null);
    const total = withTime.reduce((a, b) => a + b.time.main, 0);
    const missing = list.length - withTime.length;
    $('#backlog-summary').textContent = list.length
      ? `${list.length} ${list.length === 1 ? 'gioco' : 'giochi'}`
        + (withTime.length ? ` · circa ${fmtHours(Math.round(total))} per finire le storie principali` : '')
        + (missing ? ` · ${missing} senza tempo` : '')
        + (toBuy ? ` · ${toBuy} da comprare` : '')
      : '';
  }

  function updateHltbLink() {
    const f = $('#backlog-form').elements;
    $('#backlog-hltb').href = hltbUrl(f.title.value.trim());
  }

  function openBacklogForm(b = null) {
    state.editingBacklogId = b ? b.id : null;
    const f = $('#backlog-form');
    f.reset();
    $('#backlog-form-title').textContent = b ? 'Modifica backlog' : 'Aggiungi al backlog';
    $('#backlog-delete').hidden = !b;
    const src = b || {};
    ['title', 'cover', 'console', 'notes'].forEach((k) => { f.elements[k].value = src[k] ?? ''; });
    setOwnedRadio(f, b ? b.owned : 'no');
    ['main', 'extra', 'complete'].forEach((k) => { f.elements[`time_${k}`].value = src.time?.[k] ?? ''; });
    resetLookup('backlog');
    updateHltbLink();
    $('#backlog-dialog').showModal();
  }

  async function submitBacklog(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#backlog-form').elements;
    const hours = (k) => { const n = num(f[`time_${k}`].value); return n == null ? null : Math.max(0, n); };
    const time = { main: hours('main'), extra: hours('extra'), complete: hours('complete') };
    const data = {
      title: f.title.value.trim(),
      cover: f.cover.value.trim(),
      console: f.console.value.trim(),
      notes: f.notes.value.trim(),
      owned: f.owned.value || undefined,
      time: Object.values(time).some((v) => v != null) ? time : null,
    };
    const editingId = state.editingBacklogId;
    const prevOwned = editingId ? state.backlog.find((x) => x.id === editingId)?.owned : undefined;
    setBusy(true, 'Salvataggio in corso…');
    try {
      state.backlog = await save('backlog', (list) => {
        if (editingId) {
          const i = list.findIndex((x) => x.id === editingId);
          if (i === -1) throw new Error('Questo gioco non è più nel backlog.');
          list[i] = { ...list[i], ...data };
        } else {
          list.push({ id: uid(), ...data, addedAt: new Date().toISOString() });
        }
        return list;
      }, `${editingId ? 'Modificato backlog' : 'Aggiunto al backlog'}: ${data.title}`);
      $('#backlog-dialog').close();
      renderAll();
      toast(editingId ? 'Backlog aggiornato ✔' : `“${data.title}” aggiunto al backlog ✔`);
      if (data.owned === 'yes' && prevOwned !== 'yes') setTimeout(() => offerCollection(data), 0);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteBacklog() {
    const b = state.backlog.find((x) => x.id === state.editingBacklogId);
    if (!b || state.busy) return;
    if (!confirm(`Togliere “${b.title}” dal backlog?`)) return;
    setBusy(true, 'Eliminazione in corso…');
    try {
      state.backlog = await save('backlog', (list) => list.filter((x) => x.id !== b.id), `Tolto dal backlog: ${b.title}`);
      $('#backlog-dialog').close();
      renderAll();
      toast('Tolto dal backlog');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- ACQUISTO (uscite e backlog) ----------
  function ownedBadge(item, kind) {
    const o = OWNED[item.owned];
    const next = OWNED[OWNED_CYCLE[kind][(OWNED_CYCLE[kind].indexOf(item.owned) + 1) % OWNED_CYCLE[kind].length]];
    const title = `Tocca per cambiare in “${next.label}”`;
    return o
      ? `<button type="button" class="buy-chip ${o.cls}" data-action="cycle-owned" data-kind="${kind}" data-id="${esc(item.id)}" title="${title}">${o.icon} ${o.label}</button>`
      : `<button type="button" class="buy-chip buy-unset" data-action="cycle-owned" data-kind="${kind}" data-id="${esc(item.id)}" title="Indica se l'hai comprato">🛒 Comprato?</button>`;
  }

  function setOwnedRadio(form, value) {
    $$('input[name="owned"]', form).forEach((r) => { r.checked = r.value === value; });
  }

  async function cycleOwned(kind, id) {
    const list = kind === 'upcoming' ? state.upcoming : state.backlog;
    const item = list.find((x) => x.id === id);
    if (!item) return;
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    const cycle = OWNED_CYCLE[kind];
    const value = cycle[(cycle.indexOf(item.owned) + 1) % cycle.length];
    const prev = item.owned;
    const apply = (v) => {
      const upd = (arr) => arr.map((x) => (x.id === id ? { ...x, owned: v } : x));
      if (kind === 'upcoming') state.upcoming = upd(state.upcoming); else state.backlog = upd(state.backlog);
      renderAll();
    };
    apply(value); // il badge cambia subito, il salvataggio avviene in background
    try {
      const saved = await save(kind, (arr) => arr.map((x) => (x.id === id ? { ...x, owned: value } : x)), `${OWNED[value].label}: ${item.title}`);
      if (kind === 'upcoming') state.upcoming = saved; else state.backlog = saved;
      renderAll();
      if (value === 'yes') offerCollection(item);
    } catch (err) {
      apply(prev);
      toast(err.message, 'error');
    }
  }

  // ---------- COLLEZIONE ----------
  const ICON_DISC = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/></svg>';
  const ICON_DIGI = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
  const FORMATS = {
    physical: { label: 'Fisico', plural: 'fisici', icon: ICON_DISC, cls: 'fmt-physical' },
    digital: { label: 'Digitale', plural: 'digitali', icon: ICON_DIGI, cls: 'fmt-digital' },
  };
  const NO_CONSOLE = 'Senza console';
  const consoleOf = (c) => (c.console || '').trim() || NO_CONSOLE;
  // "PS5" e "Ps5" sono la stessa console: si raggruppa senza maiuscole e si mostra la grafia più usata
  const consoleKey = (c) => consoleOf(c).toLowerCase();
  function consoleDisplayNames(list) {
    const variants = new Map();
    list.forEach((x) => {
      const name = consoleOf(x);
      const k = name.toLowerCase();
      if (!variants.has(k)) variants.set(k, new Map());
      variants.get(k).set(name, (variants.get(k).get(name) || 0) + 1);
    });
    const out = new Map();
    const canon = new Map(KNOWN_CONSOLES.map((c) => [c.toLowerCase(), c]));
    variants.forEach((m, k) => {
      if (canon.has(k)) { out.set(k, canon.get(k)); return; }
      const upper = (t) => (t.match(/[A-Z]/g) || []).length;
      out.set(k, [...m.entries()].sort((a, b) => b[1] - a[1] || upper(b[0]) - upper(a[0]))[0][0]);
    });
    return out;
  }
  const consoleHash = (name) => `#collezione/${encodeURIComponent(name)}`;
  const countFormats = (list) => ({
    total: list.length,
    physical: list.filter((x) => x.format === 'physical').length,
    digital: list.filter((x) => x.format === 'digital').length,
  });
  const formatMeta = (c) => `${c.total} ${c.total === 1 ? 'gioco' : 'giochi'} · ${c.physical} fisici · ${c.digital} digitali`;
  const EURO_INT = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const EURO_DEC = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
  // 120 -> "120 €", 39.9 -> "39,90 €"
  const fmtEuro = { format: (v) => (Number.isInteger(Math.round(v * 100) / 100) ? EURO_INT : EURO_DEC).format(v) };
  const hasValue = (x) => typeof x.value === 'number' && Number.isFinite(x.value);
  const totalValue = (list) => list.filter(hasValue).reduce((a, x) => a + x.value, 0);
  // "· 320 €" (solo se almeno un gioco ha un valore)
  const valueMeta = (list) => (list.some(hasValue) ? ` · ${fmtEuro.format(totalValue(list))}` : '');
  function valueSummary(list) {
    const withV = list.filter(hasValue);
    if (!withV.length) return '';
    const phys = totalValue(withV.filter((x) => x.format === 'physical'));
    const dig = totalValue(withV.filter((x) => x.format === 'digital'));
    const missing = list.length - withV.length;
    return `Valore: ${fmtEuro.format(phys + dig)} · fisici ${fmtEuro.format(phys)} · digitali ${fmtEuro.format(dig)}`
      + (missing ? ` · ${missing} senza valore` : '');
  }

  function groupByConsole(list) {
    const names = consoleDisplayNames([...state.collection, ...state.games]);
    const m = new Map();
    list.forEach((it) => {
      const k = consoleKey(it);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(it);
    });
    return [...m.entries()].map(([k, items]) => ({ name: names.get(k) || consoleOf(items[0]), items }))
      .sort((a, b) => (a.name === NO_CONSOLE) - (b.name === NO_CONSOLE) || b.items.length - a.items.length || collator.compare(a.name, b.name));
  }

  // legame con classifica e backlog (per id se importato, altrimenti per titolo)
  function linkedGame(it) {
    return state.games.find((g) => g.id === it.gameId) || state.games.find((g) => sameGameKey(g.title) === sameGameKey(it.title));
  }
  const inBacklog = (it) => state.backlog.find((b) => sameGameKey(b.title) === sameGameKey(it.title));

  function playTag(it) {
    const g = linkedGame(it);
    if (g && !isPlaying(g) && g.score != null) return `<span class="score ${scoreClass(g.score)}" title="Voto in classifica">${g.score}</span>`;
    if (g && isPlaying(g)) return '<span class="play-tag playing">In corso</span>';
    if (g) return '<span class="play-tag">Giocato</span>';
    if (inBacklog(it)) return '<span class="play-tag backlog">Nel backlog</span>';
    return '<span class="play-tag none">Non giocato</span>';
  }

  function collTile(it) {
    const f = FORMATS[it.format] || FORMATS.physical;
    return `<button type="button" class="coll-tile" data-coll-id="${esc(it.id)}" aria-label="${esc(it.title)} (${f.label})">
      ${coverHTML(it.cover, it.title, 'fill')}
      <span class="fmt-badge ${f.cls}" aria-hidden="true">${f.icon}</span>
    </button>`;
  }

  function collRow(it) {
    const f = FORMATS[it.format] || FORMATS.physical;
    return `<button type="button" class="coll-row" data-coll-id="${esc(it.id)}">
      ${coverHTML(it.cover, it.title, 'sm')}
      <span class="coll-row-main">
        <span class="coll-row-title">${esc(it.title)}</span>
        <span class="coll-row-sub"><span class="fmt-text ${f.cls}">${f.label}</span>${it.edition ? ` · ${esc(it.edition)}` : ''}${hasValue(it) ? ` · <span class="coll-value">${fmtEuro.format(it.value)}</span>` : ''}</span>
      </span>
      ${playTag(it)}
    </button>`;
  }

  function formatTabs(counts) {
    const tab = (val, label) => `<button type="button" role="tab" data-coll-format="${val}" aria-selected="${state.collFormat === val}">${label}</button>`;
    return tab('', `Tutti ${counts.total}`) + tab('physical', `${ICON_DISC} Fisici ${counts.physical}`) + tab('digital', `${ICON_DIGI} Digitali ${counts.digital}`);
  }

  function renderCollection() {
    if (!$('#view-collezione')) return;
    const all = state.collection;
    const byFormat = state.collFormat ? all.filter((x) => x.format === state.collFormat) : all;
    const inConsole = state.collConsole != null;
    $('#coll-overview').hidden = inConsole;
    $('#coll-console').hidden = !inConsole;

    if (!inConsole) {
      const hwMode = state.collSection === 'hardware';
      $$('[data-coll-section]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.collSection === state.collSection)));
      $('#coll-games-pane').hidden = hwMode;
      $('#coll-hw-pane').hidden = !hwMode;
      if (hwMode) { renderHardware(); return; }
      $('#coll-summary').textContent = all.length ? formatMeta(countFormats(all)) : '';
      $('#coll-value').textContent = valueSummary(all);
      $('#coll-value').hidden = !all.some(hasValue);
      $$('#coll-overview [data-coll-format]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.collFormat === state.collFormat)));
      $('#coll-empty').hidden = all.length > 0;
      $('#coll-overview .coll-format').hidden = all.length === 0;
      const groups = groupByConsole(byFormat);
      $('#coll-consoles').innerHTML = all.length ? groups.map((gr) => `<a class="chip-link" href="${consoleHash(gr.name)}">${esc(gr.name)} <span>${gr.items.length}</span></a>`).join('') : '';
      $('#coll-sections').innerHTML = groups.length
        ? groups.map((gr) => {
          const items = gr.items.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
          return `<section class="coll-section">
            <div class="coll-section-head">
              <h2>${esc(gr.name)}</h2>
              <span class="muted small">${formatMeta(countFormats(gr.items))}${valueMeta(gr.items)}</span>
              <a class="link" href="${consoleHash(gr.name)}">Vedi tutti</a>
            </div>
            <div class="coll-grid">${items.slice(0, 8).map(collTile).join('')}</div>
          </section>`;
        }).join('')
        : (all.length ? `<p class="empty">Nessun gioco ${FORMATS[state.collFormat]?.plural || ''} in collezione.</p>` : '');
      return;
    }

    // pagina di una console
    const key = state.collConsole.toLowerCase();
    const consoleItems = all.filter((x) => consoleKey(x) === key);
    $('#coll-console-name').textContent = consoleDisplayNames([...all, ...state.games]).get(key) || state.collConsole;
    $('#coll-console-meta').textContent = formatMeta(countFormats(consoleItems)) + valueMeta(consoleItems);
    $('#coll-console-format').innerHTML = formatTabs(countFormats(consoleItems));
    $('#coll-view-grid').setAttribute('aria-pressed', String(state.collView === 'grid'));
    $('#coll-view-list').setAttribute('aria-pressed', String(state.collView === 'list'));
    $('#coll-sort').value = state.collSort;
    const q = state.collSearch.trim().toLowerCase();
    const items = consoleItems
      .filter((x) => !state.collFormat || x.format === state.collFormat)
      .filter((x) => !q || [x.title, x.edition, x.notes].some((v) => (v || '').toLowerCase().includes(q)))
      .sort({
        recent: (a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''),
        value: (a, b) => (hasValue(b) ? b.value : -1) - (hasValue(a) ? a.value : -1) || collator.compare(a.title, b.title),
      }[state.collSort] || ((a, b) => collator.compare(a.title, b.title)));
    $('#coll-items').className = state.collView === 'grid' ? 'coll-grid' : 'coll-list';
    $('#coll-items').innerHTML = items.map(state.collView === 'grid' ? collTile : collRow).join('');
    $('#coll-items-empty').hidden = items.length > 0;
    $('#coll-items-empty').textContent = consoleItems.length ? 'Nessun gioco corrisponde alla ricerca.' : 'Nessun gioco per questa console.';
  }

  // ----- scheda -----
  function openCollDetail(id) {
    const it = state.collection.find((x) => x.id === id);
    if (!it) return;
    state.collDetailId = id;
    const f = FORMATS[it.format] || FORMATS.physical;
    const other = it.format === 'digital' ? 'physical' : 'digital';
    const g = linkedGame(it);
    const b = !g && inBacklog(it);
    const rank = g && !isPlaying(g) ? rankedGames().find((r) => r.g.id === g.id)?.rank : null;
    const added = it.addedAt ? new Date(it.addedAt).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }) : '';
    $('#coll-detail-title').textContent = it.title;
    $('#coll-detail-body').innerHTML = `
      <div class="detail-top">
        ${coverHTML(it.cover, it.title, 'lg')}
        <div class="coll-detail-chips">
          <span class="chip">${esc(consoleOf(it))}</span>
          <span class="chip ${f.cls}">${f.icon} ${f.label}</span>
        </div>
      </div>
      <div class="kv-grid">
        ${it.edition ? `<div class="kv"><span>Edizione</span><strong>${esc(it.edition)}</strong></div>` : ''}
        ${hasValue(it) ? `<div class="kv"><span>Valore attuale</span><strong>${fmtEuro.format(it.value)}</strong></div>` : ''}
        ${added ? `<div class="kv"><span>In collezione dal</span><strong>${esc(added)}</strong></div>` : ''}
      </div>
      ${g ? `<button type="button" class="link-card" id="coll-open-game">
          <span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span>
          <span class="link-card-text"><strong>${rank ? `Nella tua classifica: #${rank}` : 'Nella tua libreria'}</strong>
            <span class="muted small">${esc([g.status, g.hours ? `${fmt1.format(g.hours)} h` : '', g.playedYear ? `giocato nel ${g.playedYear}` : ''].filter(Boolean).join(' · '))}</span></span>
          <span aria-hidden="true">›</span>
        </button>`
        : b ? `<a class="link-card" href="#uscite" data-scroll="backlog"><span class="play-tag backlog">Backlog</span><span class="link-card-text"><strong>È nel tuo backlog</strong><span class="muted small">Non l'hai ancora giocato</span></span><span aria-hidden="true">›</span></a>`
          : '<p class="muted">Non l\'hai ancora giocato.</p>'}
      ${it.notes ? `<h3>Note</h3><p class="review">${esc(it.notes)}</p>` : ''}
      <button type="button" class="btn ghost small" id="coll-add-copy">+ Ce l'hai anche ${other === 'digital' ? 'in digitale' : 'fisico'}? Aggiungi un'altra copia</button>`;
    $('#coll-open-game')?.addEventListener('click', () => { $('#coll-detail-dialog').close(); openDetail(g.id); });
    $('#coll-add-copy').addEventListener('click', () => {
      $('#coll-detail-dialog').close();
      openCollectionForm(null, { title: it.title, cover: it.cover, console: it.console, format: other, gameId: it.gameId });
    });
    $('#coll-detail-dialog').showModal();
  }

  // ----- aggiungi / modifica -----
  function openCollectionForm(item = null, prefill = null, tab = 'new') {
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    state.editingCollId = item ? item.id : null;
    state.collPrefillGameId = prefill?.gameId || null;
    const f = $('#collection-form');
    f.reset();
    const src = item || prefill || {};
    ['title', 'cover', 'console', 'edition', 'notes'].forEach((k) => { f.elements[k].value = src[k] ?? ''; });
    f.elements.worth.value = item && hasValue(item) ? (Number.isInteger(item.value) ? String(item.value) : item.value.toFixed(2).replace('.', ',')) : '';
    $$('input[name="format"]', f).forEach((r) => { r.checked = r.value === (src.format || ''); });
    $('#collection-dialog-title').textContent = item ? 'Modifica' : 'Aggiungi alla collezione';
    $('#coll-tabs').hidden = Boolean(item || prefill);
    $('#collection-delete').hidden = !item;
    $('#coll-also-backlog-row').hidden = Boolean(item);
    resetLookup('collection');
    renderConsoleChips();
    state.importSel = new Map();
    state.importSearch = '';
    $('#import-search').value = '';
    setCollTab(item || prefill ? 'new' : tab);
    $('#collection-dialog').showModal();
  }

  function knownConsoles() {
    const all = [...state.collection, ...state.games].filter((x) => (x.console || '').trim());
    const names = consoleDisplayNames(all);
    const count = new Map();
    all.forEach((x) => count.set(consoleKey(x), (count.get(consoleKey(x)) || 0) + 1));
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => names.get(k));
  }

  // "39,90" o "39.90" -> 39.9; vuoto -> null
  function parseEuro(text) {
    const t = String(text || '').trim().replace(/\s|€/g, '').replace(',', '.');
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }

  function renderConsoleChips() {
    const cur = $('#collection-form').elements.console.value.trim().toLowerCase();
    $('#coll-console-chips').innerHTML = knownConsoles().slice(0, 6)
      .map((c) => `<button type="button" class="chip-btn" data-pick-console="${esc(c)}" aria-pressed="${c.toLowerCase() === cur}">${esc(c)}</button>`).join('');
  }

  function setCollTab(tab) {
    state.collTab = tab;
    $$('[data-coll-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.collTab === tab)));
    $('#collection-form').hidden = tab !== 'new';
    $('#coll-import').hidden = tab !== 'import';
    if (tab === 'import') renderImport();
  }

  const sameCopy = (a, b) => sameGameKey(a.title) === sameGameKey(b.title)
    && consoleOf(a).toLowerCase() === consoleOf(b).toLowerCase() && a.format === b.format;

  async function submitCollection(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#collection-form').elements;
    const data = {
      title: f.title.value.trim(),
      cover: f.cover.value.trim(),
      console: f.console.value.trim(),
      format: f.format.value,
      edition: f.edition.value.trim(),
      value: parseEuro(f.worth.value),
      notes: f.notes.value.trim(),
    };
    const editingId = state.editingCollId;
    const alsoBacklog = !editingId && f.alsoBacklog.checked;
    if (!editingId && state.collection.some((x) => sameCopy(x, data))
      && !confirm(`Hai già “${data.title}” ${FORMATS[data.format].label.toLowerCase()} per ${data.console}. Aggiungere un'altra copia?`)) return;
    setBusy(true, 'Salvataggio in corso…');
    try {
      const game = state.games.find((g) => g.id === state.collPrefillGameId) || state.games.find((g) => sameGameKey(g.title) === sameGameKey(data.title));
      state.collection = await save('collection', (list) => {
        if (editingId) {
          const i = list.findIndex((x) => x.id === editingId);
          if (i === -1) throw new Error('Questo gioco non è più in collezione.');
          list[i] = { ...list[i], ...data };
        } else {
          list.push({ id: uid(), ...data, gameId: game?.id || undefined, addedAt: new Date().toISOString() });
        }
        return list;
      }, `${editingId ? 'Modificato in collezione' : 'Aggiunto alla collezione'}: ${data.title}`);
      if (alsoBacklog && !inBacklog(data)) {
        state.backlog = await save('backlog', (list) => {
          list.push({ id: uid(), title: data.title, cover: data.cover, console: data.console, notes: '', owned: 'yes', time: null, addedAt: new Date().toISOString() });
          return list;
        }, `Aggiunto al backlog: ${data.title}`);
      }
      $('#collection-dialog').close();
      renderAll();
      toast(editingId ? 'Collezione aggiornata ✔' : `“${data.title}” aggiunto alla collezione ✔${alsoBacklog ? ' (e al backlog)' : ''}`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCollectionItem(id, dialogSel) {
    const it = state.collection.find((x) => x.id === id);
    if (!it || state.busy) return;
    if (!confirm(`Togliere “${it.title}” (${FORMATS[it.format]?.label || ''}, ${consoleOf(it)}) dalla collezione?`)) return;
    setBusy(true, 'Eliminazione in corso…');
    try {
      state.collection = await save('collection', (list) => list.filter((x) => x.id !== id), `Tolto dalla collezione: ${it.title}`);
      $(dialogSel).close();
      renderAll();
      toast('Tolto dalla collezione');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ----- importa dalla classifica -----
  function importCandidates() {
    const q = state.importSearch.trim().toLowerCase();
    return state.games
      .filter((g) => !state.importConsole || consoleKey(g) === state.importConsole.toLowerCase())
      .filter((g) => !q || (g.title || '').toLowerCase().includes(q))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || collator.compare(a.title, b.title))
      .map((g) => ({
        g,
        already: state.collection.some((c) => c.gameId === g.id
          || (sameGameKey(c.title) === sameGameKey(g.title) && consoleOf(c).toLowerCase() === consoleOf(g).toLowerCase())),
      }));
  }

  function renderImport() {
    const consoles = knownConsoles().filter((c) => state.games.some((g) => consoleKey(g) === c.toLowerCase()));
    $('#import-consoles').innerHTML = [['', 'Tutte'], ...consoles.map((c) => [c, c])]
      .map(([v, l]) => `<button type="button" class="chip-btn" data-import-console="${esc(v)}" aria-pressed="${state.importConsole.toLowerCase() === v.toLowerCase()}">${esc(l)}</button>`).join('');
    const list = importCandidates();
    $('#import-list').innerHTML = list.map(({ g, already }) => {
      const fmt = state.importSel.get(g.id);
      const on = Boolean(fmt) && !already;
      return `<li class="import-row${on ? ' on' : ''}${already ? ' done' : ''}">
        <label class="import-check">
          <input type="checkbox" data-import-check="${esc(g.id)}" ${on ? 'checked' : ''} ${already ? 'disabled' : ''}>
          ${coverHTML(g.cover, g.title, 'xs')}
          <span class="import-text"><span class="import-title">${esc(g.title)}</span>
            <span class="muted small">${esc([g.console, g.score != null ? `voto ${g.score}` : '', g.status].filter(Boolean).join(' · '))}</span></span>
        </label>
        ${already ? '<span class="import-done">Già presente</span>' : on ? `<span class="fmt-toggle" role="group" aria-label="Formato di ${esc(g.title)}">
          <button type="button" class="fmt-physical" data-import-id="${esc(g.id)}" data-import-fmt="physical" aria-pressed="${fmt === 'physical'}" aria-label="Fisico">${ICON_DISC}</button>
          <button type="button" class="fmt-digital" data-import-id="${esc(g.id)}" data-import-fmt="digital" aria-pressed="${fmt === 'digital'}" aria-label="Digitale">${ICON_DIGI}</button>
        </span>` : ''}
      </li>`;
    }).join('');
    $('#import-empty').hidden = list.length > 0;
    const sel = [...state.importSel.values()];
    const phys = sel.filter((v) => v === 'physical').length;
    $('#import-count').textContent = sel.length ? `${sel.length} selezionati · ${phys} fisici, ${sel.length - phys} digitali` : 'Tocca i giochi da importare';
    $('#import-submit').disabled = sel.length === 0;
    $('#import-submit').textContent = sel.length ? `Importa ${sel.length} ${sel.length === 1 ? 'gioco' : 'giochi'}` : 'Importa';
  }

  async function submitImport() {
    if (state.busy || !state.importSel.size) return;
    const now = new Date().toISOString();
    const items = [...state.importSel.entries()].map(([id, format]) => {
      const g = state.games.find((x) => x.id === id);
      return g && { id: uid(), title: g.title, cover: g.cover || '', console: g.console || '', format, edition: '', notes: '', gameId: g.id, addedAt: now };
    }).filter(Boolean);
    setBusy(true, 'Importazione in corso…');
    try {
      state.collection = await save('collection', (list) => list.concat(items.filter((it) => !list.some((c) => c.gameId === it.gameId && c.format === it.format))),
        `Importati in collezione: ${items.length} giochi`);
      state.importSel = new Map();
      $('#collection-dialog').close();
      renderAll();
      toast(`${items.length} ${items.length === 1 ? 'gioco importato' : 'giochi importati'} nella collezione ✔`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ----- "Comprato" nel backlog o nelle uscite: proponi di aggiungerlo alla collezione -----
  function askFormat(item) {
    return new Promise((resolve) => {
      const d = $('#format-dialog');
      d.dataset.choice = '';
      $('#format-dialog-text').textContent = `Hai comprato “${item.title}”${item.console ? ` per ${item.console}` : ''}. In che formato?`;
      d.addEventListener('close', () => resolve(d.dataset.choice || null), { once: true });
      d.showModal();
    });
  }

  async function offerCollection(item) {
    if (!Storage.canWrite() || !item?.title) return;
    const already = state.collection.some((c) => sameGameKey(c.title) === sameGameKey(item.title)
      && (!item.console || consoleOf(c).toLowerCase() === item.console.trim().toLowerCase()));
    if (already) return;
    const format = await askFormat(item);
    if (!format) return;
    try {
      const entry = { id: uid(), title: item.title, cover: item.cover || '', console: item.console || '', format, edition: '', notes: '', addedAt: new Date().toISOString() };
      state.collection = await save('collection', (list) => { list.push(entry); return list; }, `Aggiunto alla collezione: ${item.title}`);
      renderAll();
      toast(`“${item.title}” aggiunto alla collezione (${FORMATS[format].label.toLowerCase()}) ✔`);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- COLLEZIONE: CONSOLE ----------
  const CONSOLE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="7" width="20" height="11" rx="4"/><path d="M7 11v3M5.5 12.5h3M15.5 12h.01M18 13.5h.01"/></svg>';
  const HW_NAMES = ['PlayStation 5', 'PlayStation 5 Pro', 'PlayStation 4', 'PlayStation 4 Pro', 'PlayStation 3', 'PlayStation 2',
    'PlayStation', 'PlayStation Portal', 'PS Vita', 'PSP', 'Nintendo Switch 2', 'Nintendo Switch', 'Nintendo Switch OLED',
    'Nintendo Switch Lite', 'Wii U', 'Wii', 'GameCube', 'Nintendo 64', 'Super Nintendo', 'NES', 'Nintendo 3DS', 'Nintendo DS',
    'Game Boy Advance', 'Game Boy Color', 'Game Boy', 'Xbox Series X', 'Xbox Series S', 'Xbox One', 'Xbox 360', 'Xbox',
    'Steam Deck', 'Sega Mega Drive', 'Sega Dreamcast', 'Meta Quest 3', 'PlayStation VR2'];

  const hwImg = (it, cls = '') => (it.image
    ? `<img class="hw-img ${cls}" src="${esc(it.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">`
    : `<span class="hw-img ph ${cls}" aria-hidden="true">${CONSOLE_ICON}</span>`);

  function renderHardware() {
    const list = state.hardware.slice().sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    const games = state.collection;
    $('#coll-summary').textContent = list.length ? `${list.length} ${list.length === 1 ? 'console' : 'console'}` : '';
    const hwVal = totalValue(list);
    $('#coll-value').hidden = !list.some(hasValue);
    $('#coll-value').textContent = list.some(hasValue)
      ? `Valore: ${fmtEuro.format(hwVal)}` + (games.some(hasValue) ? ` · con i videogiochi: ${fmtEuro.format(hwVal + totalValue(games))}` : '')
        + (list.length - list.filter(hasValue).length ? ` · ${list.length - list.filter(hasValue).length} senza valore` : '')
      : '';
    $('#hw-empty').hidden = list.length > 0;
    $('#hw-grid').innerHTML = list.map((it) => `
      <button type="button" class="hw-card" data-hw-id="${esc(it.id)}">
        ${hwImg(it)}
        <span class="hw-card-text">
          <span class="hw-name">${esc(it.name)}</span>
          ${it.model ? `<span class="hw-model">${esc(it.model)}</span>` : ''}
          ${hasValue(it) ? `<span class="hw-value">${fmtEuro.format(it.value)}</span>` : ''}
        </span>
      </button>`).join('');
  }

  function openHwDetail(id) {
    const it = state.hardware.find((x) => x.id === id);
    if (!it) return;
    state.hwDetailId = id;
    const added = it.addedAt ? new Date(it.addedAt).toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }) : '';
    $('#hw-detail-title').textContent = it.name;
    $('#hw-detail-body').innerHTML = `
      <div class="hw-detail-img">${hwImg(it, 'big')}</div>
      <div class="kv-grid">
        ${it.model ? `<div class="kv"><span>Modello / edizione</span><strong>${esc(it.model)}</strong></div>` : ''}
        ${hasValue(it) ? `<div class="kv"><span>Valore attuale</span><strong>${fmtEuro.format(it.value)}</strong></div>` : ''}
        ${added ? `<div class="kv"><span>In collezione dal</span><strong>${esc(added)}</strong></div>` : ''}
      </div>
      ${it.notes ? `<h3>Note</h3><p class="review">${esc(it.notes)}</p>` : ''}`;
    $('#hw-detail-dialog').showModal();
  }

  function renderHwPreview(url) {
    $('#hw-preview').innerHTML = hwImg({ image: url });
    $('#hw-image-remove').hidden = !url;
  }

  function setHwImage(url) {
    state.hwPhoto = null;
    $('#hw-form').elements.image.value = url;
    renderHwPreview(url);
  }

  function openHwForm(item = null) {
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    state.editingHwId = item ? item.id : null;
    state.hwPhoto = null;
    const f = $('#hw-form');
    f.reset();
    $('#hw-form-title').textContent = item ? 'Modifica console' : 'Aggiungi console';
    $('#hw-delete').hidden = !item;
    f.elements.name.value = item?.name || '';
    f.elements.model.value = item?.model || '';
    f.elements.notes.value = item?.notes || '';
    f.elements.worth.value = item && hasValue(item) ? (Number.isInteger(item.value) ? String(item.value) : item.value.toFixed(2).replace('.', ',')) : '';
    $('#dl-hw').innerHTML = HW_NAMES.map((n) => `<option value="${esc(n)}">`).join('');
    $('#hw-image-results').hidden = true;
    setHwImage(item?.image || '');
    $('#hw-dialog').showModal();
  }

  // foto dal telefono: ridotta a max 1000 px e salvata come JPEG
  function shrinkImage(file, max = 1000) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non leggibile')); };
      img.src = url;
    });
  }

  async function onHwPhoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await shrinkImage(file);
      state.hwPhoto = dataUrl;
      $('#hw-form').elements.image.value = '';
      renderHwPreview(dataUrl);
      toast('Foto pronta: verrà caricata quando premi Salva', 'info');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function searchHwImages() {
    const f = $('#hw-form').elements;
    const q = [f.name.value.trim(), f.model.value.trim()].filter(Boolean).join(' ');
    const box = $('#hw-image-results');
    if (!q) { toast('Scrivi prima il nome della console', 'error'); return; }
    box.hidden = false;
    box.innerHTML = '<p class="muted small">Cerco immagini…</p>';
    try {
      const res = await Lookup.searchImages(`${q} console`);
      box.innerHTML = res.length
        ? res.map((r) => `<button type="button" class="hw-pick" data-hw-pick="${esc(r.image)}" title="${esc(r.title)}"><img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy" referrerpolicy="no-referrer"></button>`).join('')
        : '<p class="muted small">Nessuna immagine trovata. Prova con una foto o un link.</p>';
    } catch (err) {
      box.innerHTML = `<p class="muted small">⚠️ Ricerca non disponibile: ${esc(err.message)}</p>`;
    }
  }

  async function submitHw(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#hw-form').elements;
    const editingId = state.editingHwId;
    const id = editingId || uid();
    const data = {
      name: f.name.value.trim(),
      model: f.model.value.trim(),
      image: f.image.value.trim(),
      value: parseEuro(f.worth.value),
      notes: f.notes.value.trim(),
    };
    setBusy(true, 'Salvataggio in corso…');
    try {
      if (state.hwPhoto) {
        const path = `${state.profile.dir}/images/console-${id.slice(0, 8)}-${Date.now()}.jpg`;
        data.image = await Storage.uploadFile(path, state.hwPhoto.split(',')[1], `Foto console: ${data.name} [${state.profile.name}]`);
        state.hwPhoto = null;
      }
      state.hardware = await save('consoles', (list) => {
        if (editingId) {
          const i = list.findIndex((x) => x.id === editingId);
          if (i === -1) throw new Error('Questa console non è più in collezione.');
          list[i] = { ...list[i], ...data };
        } else {
          list.push({ id, ...data, addedAt: new Date().toISOString() });
        }
        return list;
      }, `${editingId ? 'Modificata console' : 'Aggiunta console'}: ${data.name}`);
      $('#hw-dialog').close();
      renderAll();
      toast(editingId ? 'Console aggiornata ✔' : `“${data.name}” aggiunta alla collezione ✔`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteHw(id, dialogSel) {
    const it = state.hardware.find((x) => x.id === id);
    if (!it || state.busy) return;
    if (!confirm(`Togliere “${it.name}” dalla collezione?`)) return;
    setBusy(true, 'Eliminazione in corso…');
    try {
      state.hardware = await save('consoles', (list) => list.filter((x) => x.id !== id), `Tolta console: ${it.name}`);
      $(dialogSel).close();
      renderAll();
      toast('Console tolta dalla collezione');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- IN CORSO ----------
  async function startPlayingFromBacklog(id) {
    const b = state.backlog.find((x) => x.id === id);
    if (!b || state.busy) return;
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    setBusy(true, 'Lo sposto tra i giochi in corso…');
    try {
      const now = new Date().toISOString();
      const game = {
        id: uid(), title: b.title, cover: b.cover || '', developer: '', genre: '', franchise: '', console: b.console || '',
        score: null, hours: null, status: PLAYING, releaseYear: null, playedYear: new Date().getFullYear(),
        review: '', startedAt: todayISO(), createdAt: now, updatedAt: now,
      };
      state.games = await save('games', (list) => { list.push(game); return list; }, `Iniziato: ${b.title}`);
      state.backlog = await save('backlog', (list) => list.filter((x) => x.id !== id), `Dal backlog a in corso: ${b.title}`);
      renderAll();
      toast(`“${b.title}” è tra i giochi in corso. Buon divertimento! 🎮`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  function finishPlaying(id) {
    const g = state.games.find((x) => x.id === id);
    if (!g) return;
    openGameForm(g);
    const f = $('#game-form').elements;
    $('#game-form-title').textContent = `Hai finito ${g.title}?`;
    f.status.value = 'Completato';
    f.playedYear.value = new Date().getFullYear();
    updateScoreRequired();
    setTimeout(() => f.score.focus(), 50);
  }

  async function updatePlayingHours(id) {
    const g = state.games.find((x) => x.id === id);
    if (!g || state.busy) return;
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    const answer = prompt(`Quante ore hai giocato finora a “${g.title}”?`, g.hours ?? '');
    if (answer == null) return;
    const hours = num(String(answer).replace(',', '.'));
    if (hours == null || hours < 0) { toast('Scrivi un numero di ore valido.', 'error'); return; }
    setBusy(true);
    try {
      state.games = await save('games', (list) => list.map((x) => (x.id === id ? { ...x, hours, updatedAt: new Date().toISOString() } : x)), `Ore aggiornate: ${g.title}`);
      renderAll();
      toast(`${fmt1.format(hours)} h su “${g.title}” ✔`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- STATISTICHE: helper ----------
  const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16 };
  // chiave per riconoscere lo stesso gioco in due profili: "The Last of Us Parte 1" = "The Last Of Us Part I"
  const sameGameKey = (t) => {
    const base = Lookup.baseTitle(t || '') || t || '';
    const words = base.toLowerCase().replace(/[’']/g, '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
      .map((w) => (w === 'parte' ? 'part' : ROMAN[w] ? String(ROMAN[w]) : w));
    return Lookup.norm(words.join(' '));
  };
  const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
  const avgScore = (arr) => {
    const sc = arr.filter((g) => g.score != null);
    return sc.length ? sum(sc, (g) => g.score) / sc.length : null;
  };
  function topBy(arr, field) {
    const m = new Map();
    arr.forEach((g) => {
      const k = (g[field] || '').trim();
      if (!k) return;
      const e = m.get(k.toLowerCase()) || { name: k, count: 0, hours: 0 };
      e.count += 1; e.hours += g.hours || 0;
      m.set(k.toLowerCase(), e);
    });
    return [...m.values()].sort((a, b) => b.count - a.count || b.hours - a.hours)[0] || null;
  }
  function hbar(label, value, max, extra = '') {
    const pct = max ? Math.max(value ? 4 : 0, Math.round((value / max) * 100)) : 0;
    return `<div class="hbar"><span class="hbar-label">${label}</span><span class="hbar-track"><span class="hbar-fill" style="width:${pct}%"></span></span><span class="hbar-value">${value}${extra}</span></div>`;
  }

  function renderStatsView() {
    $$('[data-stats-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.statsTab === state.statsTab)));
    $('#stats-anno').hidden = state.statsTab !== 'anno';
    $('#stats-confronto').hidden = state.statsTab !== 'confronto';
    if (state.statsTab === 'anno') renderRecap(); else renderCompare();
  }

  // ---------- RIEPILOGO DELL'ANNO ----------
  function recapYears() {
    const ys = new Set(finishedGames().map((g) => g.playedYear).filter(Boolean));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }

  function renderRecap() {
    const years = recapYears();
    if (!state.recapYear || !years.includes(state.recapYear)) {
      const cur = new Date().getFullYear();
      state.recapYear = finishedGames().some((g) => g.playedYear === cur) ? cur : (years.find((y) => finishedGames().some((g) => g.playedYear === y)) || cur);
    }
    const Y = state.recapYear;
    $('#recap-year').innerHTML = years.map((y) => `<option value="${y}" ${y === Y ? 'selected' : ''}>${y}</option>`).join('');
    $('#year-prev').disabled = years.indexOf(Y) === years.length - 1;
    $('#year-next').disabled = years.indexOf(Y) === 0;

    const games = finishedGames().filter((g) => g.playedYear === Y);
    const prev = finishedGames().filter((g) => g.playedYear === Y - 1);
    const el = $('#recap');
    if (!games.length) {
      el.innerHTML = `<div class="card empty-state"><div class="big-emoji">🎮</div><p>Nessun gioco finito nel ${Y}.</p>
        <p class="muted">I giochi contano nell'anno in cui li hai giocati (campo “Anno in cui l'hai giocato”).</p></div>`;
      return;
    }
    const hours = sum(games, (g) => g.hours);
    const avg = avgScore(games);
    const plat = games.filter((g) => g.status === 'Platinato').length;
    const dropped = games.filter((g) => g.status === 'Abbandonato').length;
    const delta = games.length - prev.length;
    const deltaTxt = prev.length ? (delta === 0 ? `come nel ${Y - 1}` : `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} rispetto al ${Y - 1}`) : '';
    const ranked = games.filter((g) => !isUnrated(g)).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) || (b.hours || 0) - (a.hours || 0));
    const goty = ranked[0];
    const longest = games.filter((g) => g.hours).sort((a, b) => b.hours - a.hours)[0];
    // "la delusione" solo se il voto è davvero basso
    const worst = ranked.filter((g) => g.score != null && g.score < 60 && g.id !== goty?.id).slice(-1)[0] || null;
    const cons = topBy(games, 'console');
    const genre = topBy(games, 'genre');
    const dev = topBy(games, 'developer');
    const buckets = [['90–100', 90, 100], ['75–89', 75, 89], ['60–74', 60, 74], ['40–59', 40, 59], ['0–39', 0, 39]]
      .map(([label, lo, hi]) => ({ label, n: games.filter((g) => g.score != null && g.score >= lo && g.score <= hi).length }));
    const maxB = Math.max(...buckets.map((b) => b.n));

    const fact = (icon, label, value, sub = '') => (value ? `
      <div class="fact"><span class="fact-icon" aria-hidden="true">${icon}</span>
        <span class="fact-text"><span class="fact-label">${label}</span><strong>${value}</strong>${sub ? `<span class="fact-sub">${sub}</span>` : ''}</span></div>` : '');

    el.innerHTML = `
      <div class="recap-hero">
        <img src="${avatarUrl(state.profile.avatar)}" alt="" class="recap-avatar">
        <div><div class="muted small">Il ${Y} di ${esc(state.profile.name)}</div><div class="recap-headline">${games.length} ${games.length === 1 ? 'gioco finito' : 'giochi finiti'}</div>${deltaTxt ? `<div class="muted small">${deltaTxt}</div>` : ''}</div>
      </div>

      <div class="recap-tiles">
        <div class="stat"><div class="stat-label">Ore</div><div class="stat-value">${fmtInt.format(Math.round(hours))}</div><div class="stat-sub">≈ ${fmt1.format(hours / 24)} giorni</div></div>
        <div class="stat"><div class="stat-label">Voto medio</div><div class="stat-value">${avg == null ? '–' : fmt1.format(avg)}</div><div class="stat-sub">su 100</div></div>
        <div class="stat"><div class="stat-label">Platinati</div><div class="stat-value">${plat}</div><div class="stat-sub">${dropped ? `${dropped} abbandonati` : 'trofei 🏆'}</div></div>
      </div>

      ${goty ? `      <div class="card goty clickable" data-id="${esc(goty.id)}">
        ${coverHTML(goty.cover, goty.title, 'lg')}
        <div class="goty-text">
          <div class="goty-label">🏆 Il tuo gioco dell'anno</div>
          <div class="goty-title">${esc(goty.title)}</div>
          <div class="muted small">${esc([goty.console, goty.hours ? `${fmt1.format(goty.hours)} h` : ''].filter(Boolean).join(' · '))}</div>
          <span class="score ${scoreClass(goty.score)}">${goty.score ?? '–'}</span>
        </div>
      </div>
` : ''}

      <div class="card">
        <h2>I numeri del ${Y}</h2>
        <div class="facts">
          ${fact('⏳', 'Il più lungo', longest ? esc(longest.title) : '', longest ? `${fmt1.format(longest.hours)} h` : '')}
          ${fact('🎮', 'Console più usata', cons ? esc(cons.name) : '', cons ? `${cons.count} ${cons.count === 1 ? 'gioco' : 'giochi'}${cons.hours ? ` · ${fmtInt.format(Math.round(cons.hours))} h` : ''}` : '')}
          ${fact('🧭', 'Genere preferito', genre ? esc(genre.name) : '', genre ? `${genre.count} ${genre.count === 1 ? 'gioco' : 'giochi'}` : '')}
          ${fact('🏢', 'Sviluppatore più giocato', dev && dev.count > 1 ? esc(dev.name) : '', dev ? `${dev.count} giochi` : '')}
          ${fact('😬', 'La delusione', worst ? esc(worst.title) : '', worst ? `voto ${worst.score}` : '')}
        </div>
      </div>

      <div class="card">
        <h2>Come hai votato</h2>
        <div class="hbars">${buckets.map((b) => hbar(b.label, b.n, maxB)).join('')}</div>
      </div>

      <div class="card">
        <h2>Classifica del ${Y}</h2>
        <ol class="mini-list">${ranked.slice(0, 10).map((g, i) => `
          <li class="mini-item clickable" data-id="${esc(g.id)}">
            <span class="mini-rank">${i + 1}</span>
            ${coverHTML(g.cover, g.title, 'xs')}
            <span class="mini-main"><span class="mini-title">${g.favorite ? '<span class="fav-mark">★</span> ' : ''}${esc(g.title)}</span><span class="mini-sub">${esc([g.console, g.status].filter(Boolean).join(' · '))}</span></span>
            <span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span>
          </li>`).join('')}</ol>
      </div>`;
  }

  // ---------- CONFRONTO TRA PROFILI ----------
  async function loadProfileGames(user) {
    const c = state.compareCache[user.id];
    if (c && Date.now() - c.at < 60000) return c.games;
    const r = await Storage.load(`${user.dir}/games.json`);
    const games = r.data.filter((g) => !isPlaying(g));
    state.compareCache[user.id] = { games, at: Date.now() };
    return games;
  }

  async function renderCompare() {
    const el = $('#compare');
    const others = visibleUsers().filter((u) => u.id !== state.profile.id);
    $('.compare-pick').hidden = others.length === 0;
    if (!others.length) {
      el.innerHTML = `<div class="card empty-state"><div class="big-emoji">👥</div><p>Serve almeno un altro profilo per fare un confronto.</p>
        <p class="muted">Aggiungilo dalla schermata dei profili (tocca il tuo avatar in alto).</p></div>`;
      return;
    }
    if (!others.some((u) => u.id === state.compareWith)) state.compareWith = others[0].id;
    $('#compare-with').innerHTML = others.map((u) => `<option value="${esc(u.id)}" ${u.id === state.compareWith ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
    const other = others.find((u) => u.id === state.compareWith);
    el.innerHTML = '<p class="muted">Caricamento…</p>';
    let theirs;
    try { theirs = await loadProfileGames(other); } catch (err) { el.innerHTML = `<p class="muted">⚠️ ${esc(err.message)}</p>`; return; }
    if (state.statsTab !== 'confronto' || state.compareWith !== other.id) return; // nel frattempo è cambiato qualcosa

    const mine = finishedGames();
    const me = state.profile;
    const theirMap = new Map(theirs.map((g) => [sameGameKey(g.title), g]));
    const common = mine.map((g) => ({ a: g, b: theirMap.get(sameGameKey(g.title)) })).filter((x) => x.b);
    const scored = common.filter((x) => x.a.score != null && x.b.score != null);
    const affinity = scored.length ? Math.max(0, Math.round(100 - sum(scored, (x) => Math.abs(x.a.score - x.b.score)) / scored.length)) : null;
    const affinityTxt = affinity == null ? 'Nessun gioco in comune con un voto, per ora.'
      : affinity >= 90 ? 'Gusti quasi identici 🤝' : affinity >= 80 ? 'Andate molto d\'accordo' : affinity >= 65 ? 'Spesso d\'accordo, a volte no' : 'Gusti piuttosto diversi ⚔️';

    const mineKeys = new Set([...state.games, ...state.backlog].map((g) => sameGameKey(g.title)));
    const tips = theirs.filter((g) => (g.score ?? 0) >= 80 && !mineKeys.has(sameGameKey(g.title)))
      .sort((a, b) => b.score - a.score).slice(0, 8);
    state.compareTips = tips;

    const rows = [
      ['Giochi giocati', mine.length, theirs.length, (v) => fmtInt.format(v)],
      ['Ore totali', sum(mine, (g) => g.hours), sum(theirs, (g) => g.hours), (v) => fmtInt.format(Math.round(v))],
      ['Voto medio', avgScore(mine), avgScore(theirs), (v) => (v == null ? '–' : fmt1.format(v))],
      ['Platinati', mine.filter((g) => g.status === 'Platinato').length, theirs.filter((g) => g.status === 'Platinato').length, (v) => fmtInt.format(v)],
      ['Preferiti ★', mine.filter((g) => g.favorite).length, theirs.filter((g) => g.favorite).length, (v) => fmtInt.format(v)],
    ];
    const vsRow = ([label, a, b, f]) => {
      const total = (a || 0) + (b || 0);
      const pa = total ? Math.round(((a || 0) / total) * 100) : 50;
      return `<div class="vs-row">
        <div class="vs-values"><strong class="${(a || 0) > (b || 0) ? 'win' : ''}">${f(a)}</strong><span class="vs-label">${label}</span><strong class="${(b || 0) > (a || 0) ? 'win' : ''}">${f(b)}</strong></div>
        <div class="vs-bar"><span class="vs-a" style="width:${pa}%"></span><span class="vs-b" style="width:${100 - pa}%"></span></div>
      </div>`;
    };
    common.sort((x, y) => ((y.a.score ?? 0) + (y.b.score ?? 0)) - ((x.a.score ?? 0) + (x.b.score ?? 0)));

    el.innerHTML = `
      <div class="card vs-head">
        <div class="vs-player a"><img src="${avatarUrl(me.avatar)}" alt=""><span>${esc(me.name)}</span></div>
        <div class="vs-affinity">
          <div class="vs-pct">${affinity == null ? '–' : `${affinity}%`}</div>
          <div class="muted small">affinità</div>
        </div>
        <div class="vs-player b"><img src="${avatarUrl(other.avatar)}" alt=""><span>${esc(other.name)}</span></div>
        <div class="vs-caption">${affinityTxt}${scored.length ? `<span class="muted small"> · su ${scored.length} ${scored.length === 1 ? 'gioco' : 'giochi'} in comune</span>` : ''}</div>
      </div>

      <div class="card">${rows.map(vsRow).join('')}</div>

      <div class="card">
        <h2>Giochi in comune <span class="muted">(${common.length})</span></h2>
        ${common.length ? `<div class="common-head"><span></span><span>${esc(me.name)}</span><span>${esc(other.name)}</span></div>
        <ol class="mini-list">${common.map(({ a, b }) => {
          const d = a.score != null && b.score != null ? a.score - b.score : null;
          return `<li class="mini-item common-item">
            ${coverHTML(a.cover || b.cover, a.title, 'xs')}
            <span class="mini-main"><span class="mini-title">${esc(a.title)}</span>${d != null && Math.abs(d) >= 15 ? `<span class="mini-sub disagree">${Math.abs(d)} punti di differenza</span>` : ''}</span>
            <span class="score ${scoreClass(a.score)}">${a.score ?? '–'}</span>
            <span class="score ${scoreClass(b.score)}">${b.score ?? '–'}</span>
          </li>`;
        }).join('')}</ol>` : '<p class="muted">Nessun gioco in comune, per ora.</p>'}
      </div>

      <div class="card">
        <h2>Consigliati da ${esc(other.name)}</h2>
        <p class="muted small">I giochi che ha votato almeno 80 e che non hai né in libreria né nel backlog.</p>
        ${tips.length ? `<ol class="mini-list">${tips.map((g, i) => `
          <li class="mini-item">
            ${coverHTML(g.cover, g.title, 'xs')}
            <span class="mini-main"><span class="mini-title">${esc(g.title)}</span><span class="mini-sub">${esc([g.console, g.genre].filter(Boolean).join(' · '))}</span></span>
            <span class="score ${scoreClass(g.score)}">${g.score}</span>
            <button type="button" class="btn small" data-action="compare-to-backlog" data-id="${i}" title="Aggiungi al tuo backlog">+ Backlog</button>
          </li>`).join('')}</ol>` : '<p class="muted">Nessun consiglio: hai già tutti i suoi giochi migliori!</p>'}
      </div>`;
  }

  async function addToBacklogFromCompare(i) {
    const g = (state.compareTips || [])[Number(i)];
    if (!g || state.busy) return;
    if (!Storage.canWrite()) { toast('Per salvare serve il token GitHub (⚙ Impostazioni).', 'error'); return; }
    setBusy(true);
    try {
      state.backlog = await save('backlog', (list) => {
        list.push({ id: uid(), title: g.title, cover: g.cover || '', console: g.console || '', notes: '', time: null, addedAt: new Date().toISOString() });
        return list;
      }, `Aggiunto al backlog: ${g.title}`);
      renderAll();
      renderCompare();
      toast(`“${g.title}” aggiunto al tuo backlog ✔`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- RICERCA DATI (Wikidata / Wikipedia) ----------
  const lookupState = {
    game: { seq: 0, results: [], timer: null },
    upcoming: { seq: 0, results: [], timer: null },
    backlog: { seq: 0, results: [], timer: null },
    collection: { seq: 0, results: [], timer: null },
  };
  const formOf = (kind) => $(`#${kind}-form`);

  function resetLookup(kind) {
    const st = lookupState[kind];
    st.seq++;
    st.results = [];
    clearTimeout(st.timer);
    const box = $(`#${kind}-lookup`);
    box.hidden = true;
    box.innerHTML = '';
    updateCoverPreview(kind);
  }

  function updateCoverPreview(kind) {
    const f = formOf(kind);
    $(`#${kind}-cover-preview`).innerHTML = coverHTML(f.elements.cover.value.trim(), f.elements.title.value, 'md');
  }

  async function runLookup(kind) {
    const f = formOf(kind);
    const q = f.elements.title.value.trim();
    const box = $(`#${kind}-lookup`);
    const st = lookupState[kind];
    if (q.length < 2) { box.hidden = true; return; }
    const seq = ++st.seq;
    box.hidden = false;
    box.innerHTML = '<div class="lookup-msg">Cerco “' + esc(q) + '”…</div>';
    try {
      const results = await Lookup.search(q);
      if (seq !== st.seq) return; // nel frattempo è partita un'altra ricerca
      st.results = results;
      box.innerHTML = results.length
        ? `<div class="lookup-msg">Scegli il gioco giusto per compilare i dati in automatico:</div>${results.map((r, i) => `
          <button type="button" class="lookup-item" data-pick="${i}" data-kind="${kind}">
            ${coverHTML(r.cover, r.title, 'sm')}
            <span class="lookup-main">
              <span class="lookup-title">${esc(r.title)}</span>
              <span class="lookup-sub">${esc([r.releaseDate ? releaseLabel({ releaseDate: r.releaseDate }, true) : r.releaseYear, r.developer].filter(Boolean).join(' · '))}</span>
              <span class="lookup-sub">${esc([r.franchise, r.genre, r.platforms.slice(0, 4).join(', ')].filter(Boolean).join(' · '))}</span>
            </span>
          </button>`).join('')}<button type="button" class="btn ghost small" data-lookup-close="${kind}">Nessuno di questi</button>`
        : `<div class="lookup-msg">Nessun risultato per “${esc(q)}”. Prova col titolo inglese o compila a mano.</div>`;
    } catch (err) {
      if (seq !== st.seq) return;
      box.innerHTML = `<div class="lookup-msg">⚠️ Ricerca non disponibile: ${esc(err.message)}. Puoi compilare a mano.</div>`;
    }
  }

  function applyLookup(kind, i) {
    const r = lookupState[kind].results[i];
    if (!r) return;
    const f = formOf(kind).elements;
    const fillEmpty = (name, value) => { if (f[name] && value && !f[name].value.trim()) f[name].value = value; };
    f.title.value = r.title;
    if (r.cover) f.cover.value = r.cover;
    if (r.platforms.length === 1) fillEmpty('console', r.platforms[0]);
    if (kind === 'game') {
      fillEmpty('developer', r.developer);
      fillEmpty('franchise', r.franchise);
      fillEmpty('genre', r.genre);
      fillEmpty('releaseYear', r.releaseYear);
    } else if (kind === 'upcoming' && r.releaseDate) {
      f.releaseDate.value = r.releaseDate;
      setReleaseMode('date');
    } else if (kind === 'upcoming' && r.releaseYear && r.releaseYear >= new Date().getFullYear()) {
      f.releaseYear.value = r.releaseYear;
      setReleaseMode('year');
    }
    if (kind === 'backlog') updateHltbLink();
    // le piattaforme del gioco diventano i primi suggerimenti per la console
    if (r.platforms.length) {
      const dl = $('#dl-console');
      const existing = $$('option', dl).map((o) => o.value).filter((v) => !r.platforms.includes(v));
      dl.innerHTML = [...r.platforms, ...existing].map((v) => `<option value="${esc(v)}">`).join('');
    }
    lookupState[kind].seq++;
    $(`#${kind}-lookup`).hidden = true;
    updateCoverPreview(kind);
    toast('Dati compilati: controllali e premi Salva', 'info');
  }

  function scheduleLookup(kind) {
    const st = lookupState[kind];
    clearTimeout(st.timer);
    // ricerca automatica solo quando si aggiunge (non quando si modifica)
    const editing = { game: state.editingGameId, upcoming: state.editingUpcomingId, backlog: state.editingBacklogId, collection: state.editingCollId }[kind];
    if (editing) return;
    st.timer = setTimeout(() => runLookup(kind), 700);
  }

  async function fillMissingCovers() {
    const btn = $('#fill-covers-btn');
    const status = $('#fill-covers-status');
    const todo = state.games.filter((g) => !g.cover);
    const todoUp = state.upcoming.filter((u) => !u.cover);
    if (!todo.length && !todoUp.length) { status.textContent = 'Tutti i giochi hanno già una copertina ✔'; return; }
    if (!Storage.canWrite()) { status.textContent = 'Serve il token GitHub per salvare.'; return; }
    btn.disabled = true;
    const found = {}; const foundUp = {};
    const all = [...todo.map((g) => [g, found]), ...todoUp.map((u) => [u, foundUp])];
    for (let i = 0; i < all.length; i++) {
      const [item, bucket] = all[i];
      status.textContent = `Cerco ${i + 1}/${all.length}: ${item.title}…`;
      try {
        const res = await Lookup.search(item.title, 3);
        const hit = res.find((r) => r.cover);
        if (hit) bucket[item.id] = hit.cover;
      } catch { /* salta questo gioco */ }
    }
    const n = Object.keys(found).length + Object.keys(foundUp).length;
    try {
      if (Object.keys(found).length) {
        state.games = await save('games', (list) => list.map((g) => (found[g.id] && !g.cover ? { ...g, cover: found[g.id] } : g)), `Aggiunte copertine (${Object.keys(found).length})`);
      }
      if (Object.keys(foundUp).length) {
        state.upcoming = await save('upcoming', (list) => list.map((u) => (foundUp[u.id] && !u.cover ? { ...u, cover: foundUp[u.id] } : u)), `Aggiunte copertine uscite (${Object.keys(foundUp).length})`);
      }
      renderAll();
      status.textContent = `Trovate ${n} copertine su ${all.length}.` + (n < all.length ? ' Per le altre usa “Cerca dati” nella modifica del gioco.' : ' ✔');
    } catch (err) {
      status.textContent = `❌ ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- PROFILI ----------
  const visibleUsers = () => state.users.filter((u) => !u.deleted);

  async function loadUsers() {
    const r = await Storage.load(USERS_FILE);
    state.users = r.data;
    state.usersLoaded = true;
    if (r.warning && r.source !== 'github') updateBanner(r.warning, r.source);
    else updateBanner(null, 'github');
  }

  function renderProfiles() {
    if (!state.usersLoaded) {
      $('#profile-grid').innerHTML = '';
      $('#profiles-hint').textContent = 'Caricamento…';
      $('#manage-profiles').hidden = true;
      return;
    }
    const users = visibleUsers();
    const tiles = users.map((u) => `
      <button type="button" class="profile-tile" data-profile="${esc(u.id)}">
        <span class="profile-avatar"><img src="${avatarUrl(u.avatar)}" alt=""><span class="profile-edit" aria-hidden="true">✎</span></span>
        <span class="profile-name">${esc(u.name)}</span>
      </button>`).join('');
    $('#profile-grid').innerHTML = tiles + `
      <button type="button" class="profile-tile add" data-action="add-profile">
        <span class="profile-avatar"><span class="plus">+</span></span>
        <span class="profile-name">Aggiungi profilo</span>
      </button>`;
    $('#view-profili').classList.toggle('managing', state.manageProfiles);
    $('#profiles-title').textContent = state.manageProfiles ? 'Gestisci profili' : (users.length ? 'Chi gioca?' : 'Benvenuto!');
    $('#profiles-hint').textContent = users.length
      ? (state.manageProfiles ? 'Tocca un profilo per cambiare nome o avatar.' : '')
      : 'Crea il primo profilo per iniziare. I giochi già presenti nella libreria verranno assegnati a questo profilo.';
    $('#manage-profiles').hidden = users.length === 0;
    $('#manage-profiles').textContent = state.manageProfiles ? 'Fatto' : 'Gestisci profili';
  }

  function updateProfileChip() {
    const chip = $('#profile-chip');
    if (!state.profile) { chip.hidden = true; return; }
    chip.hidden = false;
    $('img', chip).src = avatarUrl(state.profile.avatar);
    $('.chip-name', chip).textContent = state.profile.name;
    $('#home-title').textContent = `Libreria di ${state.profile.name}`;
  }

  function selectProfile(id) {
    const user = visibleUsers().find((u) => u.id === id);
    if (!user) return;
    const changed = !state.profile || state.profile.id !== user.id;
    state.profile = user;
    try { sessionStorage.setItem('tgl-profile', user.id); } catch { /* ignore */ }
    try { localStorage.setItem('tgl-last-profile', user.id); } catch { /* ignore */ }
    updateProfileChip();
    if (changed) {
      state.games = [];
      state.upcoming = [];
      state.backlog = [];
      state.collection = [];
      state.hardware = [];
      state.importSel = new Map();
      state.search = '';
      state.statusFilter = '';
      $('#search').value = '';
      $('#filter-status').value = '';
      state.favOnly = false;
      state.recapYear = null;
      state.compareWith = null;
      renderAll();
      loadAll();
    }
    const target = state.afterProfile && state.afterProfile !== 'profili' ? state.afterProfile : 'home';
    state.afterProfile = 'home';
    if (location.hash === `#${target}`) route(); else location.hash = target;
  }

  function openProfileForm(user = null) {
    if (!Storage.canWrite()) {
      toast('Per creare o modificare i profili serve il token GitHub (⚙ Impostazioni).', 'error');
      return;
    }
    state.editingProfileId = user ? user.id : null;
    const f = $('#profile-form');
    f.reset();
    $('#profile-form-title').textContent = user ? 'Modifica profilo' : 'Nuovo profilo';
    $('#profile-delete').hidden = !user;
    f.elements.name.value = user ? user.name : '';
    const used = new Set(visibleUsers().map((u) => u.avatar));
    const current = user ? user.avatar : (AVATARS.find((a) => !used.has(a)) || AVATARS[0]);
    $('#avatar-grid').innerHTML = AVATARS.map((a) => `
      <label class="avatar-option" title="${esc(a)}">
        <input type="radio" name="avatar" value="${a}" ${a === current ? 'checked' : ''}>
        <img src="${avatarUrl(a)}" alt="${esc(a)}">
      </label>`).join('');
    updateProfilePreview();
    $('#profile-dialog').showModal();
  }

  function updateProfilePreview() {
    const f = $('#profile-form').elements;
    $('#profile-preview').src = avatarUrl(f.avatar.value);
  }

  async function submitProfile(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = e.target.elements;
    const name = f.name.value.trim();
    const avatar = f.avatar.value;
    const editingId = state.editingProfileId;
    if (visibleUsers().some((u) => u.id !== editingId && u.name.toLowerCase() === name.toLowerCase())) {
      toast('Esiste già un profilo con questo nome.', 'error');
      return;
    }
    setBusy(true, 'Salvataggio profilo…');
    try {
      let createdId = null;
      state.users = await Storage.update(USERS_FILE, (list) => {
        if (editingId) {
          const i = list.findIndex((u) => u.id === editingId);
          if (i === -1) throw new Error('Questo profilo non esiste più.');
          list[i] = { ...list[i], name, avatar };
        } else {
          const id = uid().replace(/-/g, '').slice(0, 10);
          // il primo profilo in assoluto usa i file già esistenti (data/games.json, data/upcoming.json)
          const dir = list.length === 0 ? 'data' : `data/users/${id}`;
          list.push({ id, name, avatar, dir, createdAt: new Date().toISOString() });
          createdId = id;
        }
        return list;
      }, editingId ? `Modificato profilo: ${name}` : `Nuovo profilo: ${name}`);
      $('#profile-dialog').close();
      if (state.profile && state.profile.id === editingId) {
        state.profile = state.users.find((u) => u.id === editingId);
        updateProfileChip();
      }
      if (createdId && !state.manageProfiles) {
        toast(`Profilo “${name}” creato ✔`);
        selectProfile(createdId);
      } else {
        renderProfiles();
        toast('Profilo salvato ✔');
      }
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function deleteProfile() {
    const user = visibleUsers().find((u) => u.id === state.editingProfileId);
    if (!user || state.busy) return;
    if (!confirm(`Eliminare il profilo “${user.name}”?\n\nIl profilo sparirà dal sito. I suoi giochi restano salvati nella repository GitHub e si possono recuperare.`)) return;
    setBusy(true, 'Eliminazione profilo…');
    try {
      // il profilo viene solo nascosto: i suoi file restano nella repository
      state.users = await Storage.update(USERS_FILE, (list) => list.map((u) => (u.id === user.id ? { ...u, deleted: true, deletedAt: new Date().toISOString() } : u)), `Eliminato profilo: ${user.name}`);
      $('#profile-dialog').close();
      if (state.profile && state.profile.id === user.id) {
        state.profile = null;
        try { sessionStorage.removeItem('tgl-profile'); } catch { /* ignore */ }
        updateProfileChip();
      }
      renderProfiles();
      toast(`Profilo “${user.name}” eliminato`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- IMPOSTAZIONI ----------
  function openLegal() {
    // segnalazioni: le "issue" della repository del sito (nessun indirizzo personale)
    const cfg = Storage.getConfig();
    const report = $('#legal-report');
    if (cfg.owner && cfg.repo) report.href = `https://github.com/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/issues/new`;
    else report.removeAttribute('href');
    $$('#legal-dialog details').forEach((d) => { d.open = false; });
    $('#legal-dialog').showModal();
  }

  function fillSettings() {
    const cfg = Storage.getConfig();
    const f = $('#settings-form').elements;
    f.owner.value = cfg.owner || '';
    f.repo.value = cfg.repo || '';
    f.branch.value = cfg.branch || 'main';
    f.token.value = '';
    f.token.placeholder = cfg.token ? '•••••••• (token salvato — lascia vuoto per mantenerlo)' : 'github_pat_…';
  }

  async function saveSettings(e) {
    e.preventDefault();
    const f = e.target.elements;
    const old = Storage.getConfig();
    const cfg = {
      owner: f.owner.value.trim(),
      repo: f.repo.value.trim(),
      branch: f.branch.value.trim() || 'main',
      token: f.token.value.trim() || old.token || '',
    };
    const status = $('#settings-status');
    status.textContent = 'Verifica del collegamento…';
    try {
      const r = await Storage.testConnection(cfg);
      Storage.setConfig(cfg);
      status.textContent = r.note;
      await loadAll();
      fillSettings();
      toast('Impostazioni salvate ✔');
    } catch (err) {
      status.textContent = `❌ ${err.message}`;
    }
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), games: state.games, upcoming: state.upcoming }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const slug = (state.profile?.name || 'profilo').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `game-library-${slug}-${todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importBackup(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const games = Array.isArray(data) ? data : data.games;
      const upcoming = Array.isArray(data) ? null : data.upcoming;
      if (!Array.isArray(games)) throw new Error('File di backup non valido.');
      if (!confirm(`Il backup contiene ${games.length} giochi${upcoming ? ` e ${upcoming.length} uscite` : ''}. Sostituire i dati del profilo “${state.profile.name}”?`)) return;
      setBusy(true, 'Ripristino in corso…');
      const normalized = games.map((g) => ({ id: g.id || uid(), ...g }));
      state.games = await save('games', () => normalized, 'Ripristino backup giochi');
      if (Array.isArray(upcoming)) {
        const nu = upcoming.map((u) => ({ id: u.id || uid(), ...u }));
        state.upcoming = await save('upcoming', () => nu, 'Ripristino backup uscite');
      }
      renderAll();
      toast('Backup ripristinato ✔');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  // ---------- eventi ----------
  function bind() {
    window.addEventListener('hashchange', route);

    // opzioni stato
    const statusOpts = STATUSES.map((s) => `<option value="${s}">${STATUS_HINT[s]}</option>`).join('');
    $('#game-form').elements.status.innerHTML = `<option value="${PLAYING}">${STATUS_HINT[PLAYING]}</option>` + statusOpts
      + `<option value="${UNRATED}">${STATUS_HINT[UNRATED]}</option>`;
    $('#game-form').elements.status.addEventListener('change', updateScoreRequired);
    $$('[data-stats-tab]').forEach((b) => b.addEventListener('click', () => {
      state.statsTab = b.dataset.statsTab;
      try { localStorage.setItem('tgl-stats-tab', state.statsTab); } catch { /* ignore */ }
      renderStatsView();
    }));
    $('#recap-year').addEventListener('change', (e) => { state.recapYear = Number(e.target.value); renderRecap(); });
    const stepYear = (dir) => {
      const ys = recapYears(); const i = ys.indexOf(state.recapYear);
      const next = ys[i - dir];
      if (next) { state.recapYear = next; renderRecap(); }
    };
    $('#year-prev').addEventListener('click', () => stepYear(-1));
    $('#year-next').addEventListener('click', () => stepYear(1));
    $('#compare-with').addEventListener('change', (e) => { state.compareWith = e.target.value; renderCompare(); });
    $('#filter-status').insertAdjacentHTML('beforeend', STATUSES.map((s) => `<option value="${s}">${s}</option>`).join(''));

    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-action]');
      if (act) {
        const { action, id } = act.dataset;
        if (action === 'add-profile') openProfileForm();
        if (action === 'open-legal') openLegal();
        if (action === 'add-game') openGameForm();
        if (action === 'add-upcoming') { closeFabMenu(); openUpcomingForm(); }
        if (action === 'add-backlog') { closeFabMenu(); openBacklogForm(); }
        if (action === 'edit-backlog') openBacklogForm(state.backlog.find((b) => b.id === id));
        if (action === 'play-backlog') startPlayingFromBacklog(id);
        if (action === 'finish-playing') finishPlaying(id);
        if (action === 'hours-playing') updatePlayingHours(id);
        if (action === 'compare-to-backlog') addToBacklogFromCompare(id);
        if (action === 'cycle-owned') cycleOwned(act.dataset.kind, id);
        if (action === 'add-collection') { if (state.collSection === 'hardware') openHwForm(); else openCollectionForm(); }
        if (action === 'start-backlog') {
          const b = state.backlog.find((x) => x.id === id);
          state.pendingBacklogToRemove = id;
          openGameForm(null, { title: b.title, cover: b.cover, console: b.console, playedYear: new Date().getFullYear(), status: 'Completato' });
        }
        if (action === 'edit-upcoming') openUpcomingForm(state.upcoming.find((u) => u.id === id));
        if (action === 'promote') {
          const u = state.upcoming.find((x) => x.id === id);
          state.pendingUpcomingToRemove = id;
          openGameForm(null, { title: u.title, cover: u.cover, console: u.console, releaseYear: u.releaseYear, playedYear: new Date().getFullYear(), status: 'Completato' });
        }
        return;
      }
      const sc = e.target.closest('[data-scroll]');
      if (sc) state.scrollTo = sc.dataset.scroll;
      const pick = e.target.closest('[data-pick]');
      if (pick) { applyLookup(pick.dataset.kind, Number(pick.dataset.pick)); return; }
      const lk = e.target.closest('[data-lookup]');
      if (lk) { runLookup(lk.dataset.lookup); return; }
      const lkClose = e.target.closest('[data-lookup-close]');
      if (lkClose) { lookupState[lkClose.dataset.lookupClose].seq++; $(`#${lkClose.dataset.lookupClose}-lookup`).hidden = true; return; }
      const hwItem = e.target.closest('[data-hw-id]');
      if (hwItem) { openHwDetail(hwItem.dataset.hwId); return; }
      const hwPick = e.target.closest('[data-hw-pick]');
      if (hwPick) { setHwImage(hwPick.dataset.hwPick); $('#hw-image-results').hidden = true; return; }
      const secTab = e.target.closest('[data-coll-section]');
      if (secTab) {
        state.collSection = secTab.dataset.collSection;
        try { localStorage.setItem('tgl-coll-section', state.collSection); } catch { /* ignore */ }
        renderCollection();
        return;
      }
      const collItem = e.target.closest('[data-coll-id]');
      if (collItem) { openCollDetail(collItem.dataset.collId); return; }
      const fmtTab = e.target.closest('[data-coll-format]');
      if (fmtTab) { state.collFormat = fmtTab.dataset.collFormat; renderCollection(); return; }
      const collTab = e.target.closest('[data-coll-tab]');
      if (collTab) { setCollTab(collTab.dataset.collTab); return; }
      const pickConsole = e.target.closest('[data-pick-console]');
      if (pickConsole) { $('#collection-form').elements.console.value = pickConsole.dataset.pickConsole; renderConsoleChips(); return; }
      const impFmt = e.target.closest('[data-import-fmt]');
      if (impFmt) { state.importSel.set(impFmt.dataset.importId, impFmt.dataset.importFmt); renderImport(); return; }
      const impCons = e.target.closest('[data-import-console]');
      if (impCons) { state.importConsole = impCons.dataset.importConsole; renderImport(); return; }
      const favBtn = e.target.closest('[data-fav]');
      if (favBtn) { toggleFavorite(favBtn.dataset.fav); return; }
      const row = e.target.closest('.clickable[data-id]');
      if (row) openDetail(row.dataset.id);
      if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
    });

    // chiudi cliccando fuori dal dialog
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    });
    $('#game-dialog').addEventListener('close', () => {
      if (!state.busy) { state.pendingUpcomingToRemove = null; state.pendingBacklogToRemove = null; }
    });

    ['game', 'upcoming', 'backlog', 'collection'].forEach((kind) => {
      const f = formOf(kind);
      f.elements.title.addEventListener('input', () => scheduleLookup(kind));
      f.elements.title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); clearTimeout(lookupState[kind].timer); runLookup(kind); }
      });
      f.elements.cover.addEventListener('input', () => updateCoverPreview(kind));
    });
    // immagine non raggiungibile -> riquadro con le iniziali
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (img.tagName === 'IMG' && img.classList.contains('hw-img')) {
        const span = document.createElement('span');
        span.className = img.className + ' ph';
        span.innerHTML = CONSOLE_ICON;
        img.replaceWith(span);
        return;
      }
      if (img.tagName === 'IMG' && img.classList.contains('cover')) {
        const span = document.createElement('span');
        span.className = img.className + ' ph';
        span.textContent = img.dataset.ph || '?';
        img.replaceWith(span);
      }
    }, true);
    $('#fill-covers-btn').addEventListener('click', fillMissingCovers);
    $('#profile-grid').addEventListener('click', (e) => {
      const tile = e.target.closest('[data-profile]');
      if (!tile) return;
      if (state.manageProfiles) openProfileForm(visibleUsers().find((u) => u.id === tile.dataset.profile));
      else selectProfile(tile.dataset.profile);
    });
    $('#manage-profiles').addEventListener('click', () => { state.manageProfiles = !state.manageProfiles; renderProfiles(); });
    $('#profile-form').addEventListener('submit', submitProfile);
    $('#profile-form').addEventListener('change', (e) => { if (e.target.name === 'avatar') updateProfilePreview(); });
    $('#profile-delete').addEventListener('click', deleteProfile);
    $('#fab').addEventListener('click', (e) => {
      e.stopPropagation();
      if (document.body.dataset.view === 'uscite') { $('#fab-menu').hidden = !$('#fab-menu').hidden; return; }
      if (document.body.dataset.view === 'collezione') { if (state.collSection === 'hardware' && !state.collConsole) openHwForm(); else openCollectionForm(); return; }
      openGameForm();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#fab-menu')) closeFabMenu(); });
    $$('input[name="releaseMode"]').forEach((r) => r.addEventListener('change', () => {
      setReleaseMode(r.value);
      const f = $('#upcoming-form').elements;
      if (r.value === 'year' && !f.releaseYear.value) f.releaseYear.value = f.releaseDate.value ? f.releaseDate.value.slice(0, 4) : new Date().getFullYear() + 1;
    }));
    $('#backlog-form').addEventListener('submit', submitBacklog);
    $('#collection-form').addEventListener('submit', submitCollection);
    $('#hw-form').addEventListener('submit', submitHw);
    $('#hw-delete').addEventListener('click', () => deleteHw(state.editingHwId, '#hw-dialog'));
    $('#hw-detail-delete').addEventListener('click', () => deleteHw(state.hwDetailId, '#hw-detail-dialog'));
    $('#hw-detail-edit').addEventListener('click', () => {
      const it = state.hardware.find((x) => x.id === state.hwDetailId);
      $('#hw-detail-dialog').close();
      if (it) openHwForm(it);
    });
    $('#hw-photo').addEventListener('change', onHwPhoto);
    $('#hw-image-search').addEventListener('click', searchHwImages);
    $('#hw-image-remove').addEventListener('click', () => setHwImage(''));
    $('#hw-form').elements.image.addEventListener('input', (e) => { state.hwPhoto = null; renderHwPreview(e.target.value.trim()); });
    $('#collection-form').elements.console.addEventListener('input', renderConsoleChips);
    $('#collection-delete').addEventListener('click', () => deleteCollectionItem(state.editingCollId, '#collection-dialog'));
    $('#coll-detail-delete').addEventListener('click', () => deleteCollectionItem(state.collDetailId, '#coll-detail-dialog'));
    $('#coll-detail-edit').addEventListener('click', () => {
      const it = state.collection.find((x) => x.id === state.collDetailId);
      $('#coll-detail-dialog').close();
      if (it) openCollectionForm(it);
    });
    $('#coll-search').addEventListener('input', (e) => { state.collSearch = e.target.value; renderCollection(); });
    $('#coll-sort').addEventListener('change', (e) => { state.collSort = e.target.value; renderCollection(); });
    $('#coll-view-grid').addEventListener('click', () => { state.collView = 'grid'; saveCollView(); renderCollection(); });
    $('#coll-view-list').addEventListener('click', () => { state.collView = 'list'; saveCollView(); renderCollection(); });
    $('#import-search').addEventListener('input', (e) => { state.importSearch = e.target.value; renderImport(); });
    $('#import-list').addEventListener('change', (e) => {
      const cb = e.target.closest('[data-import-check]');
      if (!cb) return;
      if (cb.checked) state.importSel.set(cb.dataset.importCheck, 'physical'); else state.importSel.delete(cb.dataset.importCheck);
      renderImport();
    });
    $('#import-all').addEventListener('click', () => {
      importCandidates().filter((x) => !x.already).forEach((x) => { if (!state.importSel.has(x.g.id)) state.importSel.set(x.g.id, 'physical'); });
      renderImport();
    });
    $('#import-submit').addEventListener('click', submitImport);
    $$('#format-dialog [data-format]').forEach((b) => b.addEventListener('click', () => {
      $('#format-dialog').dataset.choice = b.dataset.format;
      $('#format-dialog').close();
    }));
    $('#backlog-delete').addEventListener('click', deleteBacklog);
    $('#backlog-form').elements.title.addEventListener('input', updateHltbLink);
    $('#backlog-owned').addEventListener('change', (e) => { state.backlogOwned = e.target.value; renderBacklog(); });
    $('#backlog-sort').addEventListener('change', (e) => {
      state.backlogSort = e.target.value;
      try { localStorage.setItem('tgl-backlog-sort', state.backlogSort); } catch { /* ignore */ }
      renderBacklog();
    });
    // quando riapri l'app dal telefono, ricarica i dati (magari li hai cambiati dal PC)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
      if (document.visibilityState === 'visible' && Date.now() - lastLoad > 30000
        && !state.busy && !document.querySelector('dialog[open]')) loadAll();
    });

    $('#game-form').addEventListener('submit', submitGame);
    $('#upcoming-form').addEventListener('submit', submitUpcoming);
    $('#upcoming-delete').addEventListener('click', deleteUpcoming);
    $('#detail-delete').addEventListener('click', deleteGame);
    $('#detail-edit').addEventListener('click', () => {
      const g = state.games.find((x) => x.id === state.detailId);
      $('#detail-dialog').close();
      openGameForm(g);
    });

    $('#search').addEventListener('input', (e) => { state.search = e.target.value; renderRanking(); });
    $('#filter-status').addEventListener('change', (e) => { state.statusFilter = e.target.value; renderRanking(); });
    $('#fav-filter').addEventListener('click', () => { state.favOnly = !state.favOnly; renderRanking(); });
    $('#sort-key').addEventListener('change', (e) => setSort(e.target.value, false));
    $('#sort-dir').addEventListener('click', () => setSort(state.sortKey, true));
    $$('.ranking th[data-sort]').forEach((th) => th.addEventListener('click', () => setSort(th.dataset.sort)));

    $('#settings-form').addEventListener('submit', saveSettings);
    $('#settings-clear-token').addEventListener('click', () => {
      Storage.clearToken();
      fillSettings();
      updateBanner(null, 'github');
      $('#settings-status').textContent = 'Token rimosso da questo browser.';
    });
    $('#export-btn').addEventListener('click', exportBackup);
    $('#import-file').addEventListener('change', importBackup);

    setupChartHover();
  }

  function closeFabMenu() { $('#fab-menu').hidden = true; }
  function saveCollView() { try { localStorage.setItem('tgl-coll-view', state.collView); } catch { /* ignore */ } }

  // ---------- aggiornamenti del sito ----------
  // Se su GitHub è stata pubblicata una versione nuova, ricarica la pagina per scaricare i file nuovi
  // (i browser tengono in memoria i file del sito e altrimenti continuerebbero a usare quelli vecchi).
  const APP_VERSION = document.querySelector('meta[name="app-version"]')?.content || 'dev';
  async function checkForUpdate() {
    if (APP_VERSION === 'dev') return;
    try {
      const res = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const { version } = await res.json();
      if (!version || version === APP_VERSION) return;
      let already = null;
      try { already = sessionStorage.getItem('tgl-reloaded-for'); } catch { /* ignore */ }
      if (already === version) return; // evita ricaricamenti a ripetizione
      if (state.busy || document.querySelector('dialog[open]')) return; // non interrompere un salvataggio o un modulo aperto
      try { sessionStorage.setItem('tgl-reloaded-for', version); } catch { /* ignore */ }
      location.reload();
    } catch { /* offline: riprova più tardi */ }
  }

  // ---------- X per cancellare il testo nei campi ----------
  const CLEARABLE = 'input:not([type]), input[type="text"], input[type="search"], input[type="url"], input[type="number"], textarea';
  function setupClearButtons(root = document) {
    $$(CLEARABLE, root).forEach((el) => {
      if (el.closest('.clear-wrap')) return;
      // il pulsante si nasconde da solo quando il campo è vuoto (:placeholder-shown), anche se il valore cambia via codice
      if (!el.hasAttribute('placeholder')) el.setAttribute('placeholder', ' ');
      const wrap = document.createElement('span');
      wrap.className = `clear-wrap${el.tagName === 'TEXTAREA' ? ' is-area' : ''}`;
      el.parentNode.insertBefore(wrap, el);
      wrap.appendChild(el);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clear-btn';
      btn.tabIndex = -1;
      btn.setAttribute('aria-label', 'Cancella il testo');
      btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>';
      // pointerdown senza perdere il focus: su iPhone la tastiera resta aperta
      btn.addEventListener('pointerdown', (e) => e.preventDefault());
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.focus();
      });
      wrap.appendChild(btn);
    });
  }

  // ---------- tocco in cima: torna all'inizio della pagina ----------
  function setupScrollToTop() {
    const interactive = 'a, button, input, select, textarea, label';
    $('.topbar').addEventListener('click', (e) => {
      if (e.target.closest(interactive)) return;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // nelle finestre (a schermo intero sul telefono) lo fa il titolo in alto
    $$('dialog .dialog-head').forEach((head) => head.addEventListener('click', (e) => {
      if (e.target.closest(interactive)) return;
      head.closest('dialog').scrollTo({ top: 0, behavior: 'smooth' });
    }));
  }

  function init() {
    try {
      const sec = localStorage.getItem('tgl-coll-section');
      if (sec === 'games' || sec === 'hardware') state.collSection = sec;
    } catch { /* ignore */ }
    setupClearButtons();
    setupScrollToTop();
    try {
      const cv = localStorage.getItem('tgl-coll-view');
      if (cv === 'grid' || cv === 'list') state.collView = cv;
    } catch { /* ignore */ }
    try {
      const t = localStorage.getItem('tgl-stats-tab');
      if (t === 'anno' || t === 'confronto') state.statsTab = t;
    } catch { /* ignore */ }
    try {
      const bs = localStorage.getItem('tgl-backlog-sort');
      if (bs) { state.backlogSort = bs; $('#backlog-sort').value = bs; }
    } catch { /* ignore */ }
    try {
      const s = JSON.parse(localStorage.getItem('tgl-sort') || 'null');
      if (s && s.k) { state.sortKey = s.k; state.sortDir = s.d === 'asc' ? 'asc' : 'desc'; }
    } catch { /* ignore */ }
    checkForUpdate();
    bind();
    updateProfileChip();
    route();
    loadUsers().then(() => {
      // nella stessa sessione resta il profilo scelto; a ogni nuova apertura si sceglie chi gioca
      let id = null;
      try { id = sessionStorage.getItem('tgl-profile'); } catch { /* ignore */ }
      if (id && visibleUsers().some((u) => u.id === id)) selectProfile(id);
      else route();
    });
  }

  init();
})();
