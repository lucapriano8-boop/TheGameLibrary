/* The Game Library — logica dell'interfaccia */
(() => {
  'use strict';

  // Ordine "logico" degli stati, usato anche per l'ordinamento per stato
  const STATUSES = ['Platinato', 'Completato', 'Giocato', 'Abbandonato'];
  const STATUS_HINT = {
    Platinato: 'Platinato / 100%',
    Completato: 'Completato',
    Giocato: 'Giocato (senza finale)',
    Abbandonato: 'Abbandonato',
  };

  const USERS_FILE = 'data/users.json';
  const AVATARS = ['cavaliere', 'mago', 'alieno', 'slime', 'fantasma', 'robot', 'ninja', 'teschio',
    'drago', 'gatto', 'rana', 'astronauta', 'vichingo', 'volpe', 'pozione', 'zucca'];
  const avatarUrl = (a) => `assets/avatars/${AVATARS.includes(a) ? a : AVATARS[0]}.svg`;

  const state = {
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
    const cls = { Platinato: 'st-plat', Completato: 'st-done', Giocato: 'st-played', Abbandonato: 'st-drop' }[status] || '';
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
  const VIEWS = ['profili', 'home', 'classifica', 'uscite', 'impostazioni'];
  function route() {
    const v = (location.hash || '#home').slice(1);
    let view = VIEWS.includes(v) ? v : 'home';
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
    const [g, u, b] = await Promise.all([
      Storage.load(fileFor('games')), Storage.load(fileFor('upcoming')), Storage.load(fileFor('backlog')),
    ]);
    if (!state.profile || state.profile.id !== profileId) return; // nel frattempo è cambiato profilo
    state.games = g.data;
    state.upcoming = u.data;
    state.backlog = b.data;
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

  function renderAll() {
    renderStats();
    renderChart();
    renderHomeLists();
    renderRanking();
    renderUpcoming();
    renderBacklog();
    renderDatalists();
  }

  // ---------- HOME ----------
  function renderStats() {
    const g = state.games;
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
    state.games.forEach((x) => {
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
    const data = yearCounts();
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
      data.slice().reverse().map((d) => `<tr><td>${d.year}</td><td class="num">${d.count}</td></tr>`).join('')
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
    const sorted = state.games.slice().sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || collator.compare(a.title, b.title));
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

  function renderRanking() {
    const ranks = new Map(rankedGames().map(({ g, rank }) => [g.id, rank]));
    const q = state.search.trim().toLowerCase();
    let list = state.games.filter((g) => {
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
    empty.textContent = !state.games.length ? 'La classifica è vuota. Aggiungi il tuo primo gioco!'
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
    return u.releaseYear ? `${u.releaseYear} (data da annunciare)` : 'Data da annunciare';
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
              : '<span class="m">TBA</span>'}
          </div>`}
          <div class="up-main">
            <div class="up-title">${esc(u.title)}</div>
            <div class="up-sub">${esc([u.console, releaseLabel(u)].filter(Boolean).join(' · '))}</div>
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
      const vals = [...new Set([...extra, ...state.games.map((g) => g[field]), ...(field === 'console' ? state.upcoming.map((u) => u.console) : [])].filter(Boolean))]
        .sort(collator.compare);
      $(`#dl-${id}`).innerHTML = vals.map((v) => `<option value="${esc(v)}">`).join('');
    };
    fill('developer', 'developer');
    fill('genre', 'genre', ['Action', 'Avventura', 'GDR', 'Sparatutto', 'Platform', 'Picchiaduro', 'Sportivo', 'Corse', 'Strategia', 'Horror', 'Puzzle', 'Simulazione', 'Metroidvania', 'Roguelike', 'Soulslike', 'Open world']);
    fill('franchise', 'franchise');
    fill('console', 'console', ['PS5', 'PS4', 'PS3', 'PS2', 'PS1', 'PS Vita', 'PSP', 'Xbox Series X|S', 'Xbox One', 'Xbox 360', 'Switch', 'Switch 2', 'Wii U', 'Wii', '3DS', 'DS', 'Game Boy', 'PC', 'Steam Deck', 'Mobile']);
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
    resetLookup('game');
    $('#game-dialog').showModal();
    // per un gioco nuovo con titolo già noto (es. da "In uscita"), cerca subito i dati
    if (!game && src.title) runLookup('game');
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
          <div class="muted">#${rank} in classifica</div>
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
    resetLookup('upcoming');
    $('#upcoming-dialog').showModal();
  }

  async function submitUpcoming(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#upcoming-form').elements;
    const releaseDate = f.releaseDate.value || '';
    const data = {
      title: f.title.value.trim(),
      cover: f.cover.value.trim(),
      console: f.console.value.trim(),
      releaseDate,
      releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
      notes: f.notes.value.trim(),
    };
    const editingId = state.editingUpcomingId;
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
    const list = sortedBacklog();
    $('#backlog-list').innerHTML = list.map((b) => {
      const chips = timeChips(b);
      return `
        <li class="backlog-item">
          ${coverHTML(b.cover, b.title, 'md')}
          <div class="up-main">
            <div class="up-title">${esc(b.title)}</div>
            ${b.console ? `<div class="up-sub">${esc(b.console)}</div>` : ''}
            <div class="time-chips">${chips || '<span class="muted small">Tempo non ancora inserito</span>'}</div>
            ${b.notes ? `<div class="up-notes">${esc(b.notes)}</div>` : ''}
          </div>
          <div class="up-side">
            <a class="hltb-link" href="${hltbUrl(b.title)}" target="_blank" rel="noopener" title="Apri su HowLongToBeat">⏱ HLTB ↗</a>
            <div class="up-actions">
              <button class="btn small" data-action="start-backlog" data-id="${esc(b.id)}" title="L'hai giocato? Spostalo nella libreria">✔ Giocato</button>
              <button class="btn ghost small" data-action="edit-backlog" data-id="${esc(b.id)}">Modifica</button>
            </div>
          </div>
        </li>`;
    }).join('');
    $('#backlog-empty').hidden = list.length > 0;
    $('#backlog-toolbar').hidden = list.length < 2;
    const withTime = list.filter((b) => b.time?.main != null);
    const total = withTime.reduce((a, b) => a + b.time.main, 0);
    const missing = list.length - withTime.length;
    $('#backlog-summary').textContent = list.length
      ? `${list.length} ${list.length === 1 ? 'gioco' : 'giochi'}`
        + (withTime.length ? ` · circa ${fmtHours(Math.round(total))} per finire le storie principali` : '')
        + (missing ? ` · ${missing} senza tempo` : '')
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
      time: Object.values(time).some((v) => v != null) ? time : null,
    };
    const editingId = state.editingBacklogId;
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

  // ---------- RICERCA DATI (Wikidata / Wikipedia) ----------
  const lookupState = {
    game: { seq: 0, results: [], timer: null },
    upcoming: { seq: 0, results: [], timer: null },
    backlog: { seq: 0, results: [], timer: null },
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
    const editing = { game: state.editingGameId, upcoming: state.editingUpcomingId, backlog: state.editingBacklogId }[kind];
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
      state.search = '';
      state.statusFilter = '';
      $('#search').value = '';
      $('#filter-status').value = '';
      state.favOnly = false;
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
    $('#game-form').elements.status.innerHTML = statusOpts;
    $('#filter-status').insertAdjacentHTML('beforeend', STATUSES.map((s) => `<option value="${s}">${s}</option>`).join(''));

    document.addEventListener('click', (e) => {
      const act = e.target.closest('[data-action]');
      if (act) {
        const { action, id } = act.dataset;
        if (action === 'add-profile') openProfileForm();
        if (action === 'add-game') openGameForm();
        if (action === 'add-upcoming') { closeFabMenu(); openUpcomingForm(); }
        if (action === 'add-backlog') { closeFabMenu(); openBacklogForm(); }
        if (action === 'edit-backlog') openBacklogForm(state.backlog.find((b) => b.id === id));
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

    ['game', 'upcoming', 'backlog'].forEach((kind) => {
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
      openGameForm();
    });
    document.addEventListener('click', (e) => { if (!e.target.closest('#fab-menu')) closeFabMenu(); });
    $('#backlog-form').addEventListener('submit', submitBacklog);
    $('#backlog-delete').addEventListener('click', deleteBacklog);
    $('#backlog-form').elements.title.addEventListener('input', updateHltbLink);
    $('#backlog-sort').addEventListener('change', (e) => {
      state.backlogSort = e.target.value;
      try { localStorage.setItem('tgl-backlog-sort', state.backlogSort); } catch { /* ignore */ }
      renderBacklog();
    });
    // quando riapri l'app dal telefono, ricarica i dati (magari li hai cambiati dal PC)
    document.addEventListener('visibilitychange', () => {
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

  function init() {
    try {
      const bs = localStorage.getItem('tgl-backlog-sort');
      if (bs) { state.backlogSort = bs; $('#backlog-sort').value = bs; }
    } catch { /* ignore */ }
    try {
      const s = JSON.parse(localStorage.getItem('tgl-sort') || 'null');
      if (s && s.k) { state.sortKey = s.k; state.sortDir = s.d === 'asc' ? 'asc' : 'desc'; }
    } catch { /* ignore */ }
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
