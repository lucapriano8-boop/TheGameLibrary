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

  const state = {
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
  const VIEWS = ['home', 'classifica', 'uscite', 'impostazioni'];
  function route() {
    const v = (location.hash || '#home').slice(1);
    const view = VIEWS.includes(v) ? v : 'home';
    VIEWS.forEach((name) => { $(`#view-${name}`).hidden = name !== view; });
    $$('#tabs a').forEach((a) => a.classList.toggle('active', a.dataset.view === view));
    if (view === 'impostazioni') fillSettings();
    window.scrollTo(0, 0);
  }

  // ---------- caricamento ----------
  async function loadAll() {
    const [g, u] = await Promise.all([Storage.load('games'), Storage.load('upcoming')]);
    state.games = g.data;
    state.upcoming = u.data;
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
    $('#stat-count-sub').textContent = g.length ? `${done} completati · ${plat} platinati` : 'in libreria';
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
    const W = 600, H = 260, padL = 32, padR = 8, padT = 22, padB = 28;
    const iw = W - padL - padR, ih = H - padT - padB;
    const maxC = Math.max(...data.map((d) => d.count));
    const yMax = niceMax(maxC);
    const ticks = yMax <= 5 ? yMax : 4;
    const band = iw / data.length;
    const bw = Math.max(4, Math.min(48, band * 0.62));
    const r = Math.min(4, bw / 2);
    const labelEvery = Math.ceil(data.length / Math.floor(iw / 36));
    const maxIdx = data.findIndex((d) => d.count === maxC);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Giochi giocati per anno">`;
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
    chart.addEventListener('mousemove', show);
    chart.addEventListener('touchstart', show, { passive: true });
    chart.addEventListener('mouseleave', () => { tip.hidden = true; $$('.hit.on', chart).forEach((h) => h.classList.remove('on')); });
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
          <span class="mini-main"><span class="mini-title">${esc(g.title)}</span><span class="mini-sub">${esc(g.console || '')}${g.playedYear ? ' · ' + g.playedYear : ''}</span></span>
          <span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span>
        </li>`).join('')
      : '<li class="empty">Nessun gioco ancora. Premi “+ Aggiungi gioco”.</li>';

    const up = sortedUpcoming().filter((u) => !isReleased(u)).slice(0, 5);
    $('#home-upcoming').innerHTML = up.length
      ? up.map((u) => `
        <li class="mini-item">
          <span class="mini-main"><span class="mini-title">${esc(u.title)}</span><span class="mini-sub">${esc(u.console || '')}</span></span>
          <span class="mini-date">${esc(releaseLabel(u, true))}</span>
        </li>`).join('')
      : '<li class="empty">Nessuna uscita in programma.</li>';
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
      if (!q) return true;
      return [g.title, g.developer, g.franchise, g.genre, g.console].some((f) => (f || '').toLowerCase().includes(q));
    });
    const cmp = compareBy(state.sortKey);
    const dir = state.sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => dir * cmp(a, b) || (b.score ?? -1) - (a.score ?? -1) || collator.compare(a.title, b.title));

    $('#ranking-body').innerHTML = list.map((g) => `
      <tr class="clickable" data-id="${esc(g.id)}">
        <td class="c-rank">${ranks.get(g.id)}</td>
        <td class="c-title"><span class="t">${esc(g.title)}</span><span class="sub">${esc([g.developer, g.genre].filter(Boolean).join(' · '))}</span></td>
        <td data-label="Console">${esc(g.console || '—')}</td>
        <td data-label="Stato">${statusChip(g.status)}</td>
        <td class="num" data-label="Ore">${g.hours != null ? fmt1.format(g.hours) : '—'}</td>
        <td class="num" data-label="Giocato">${g.playedYear ?? '—'}</td>
        <td class="num c-score"><span class="score ${scoreClass(g.score)}">${g.score ?? '–'}</span></td>
        <td class="c-meta">${statusChip(g.status)}<span>${esc([g.console, g.hours != null ? fmt1.format(g.hours) + ' h' : '', g.playedYear].filter(Boolean).join(' · '))}</span></td>
      </tr>`).join('');

    const empty = $('#ranking-empty');
    empty.hidden = list.length > 0;
    empty.textContent = state.games.length ? 'Nessun gioco corrisponde alla ricerca.' : 'La classifica è vuota. Aggiungi il tuo primo gioco!';
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
          <div class="up-date">
            ${u.releaseDate
              ? `<span class="d">${Number(u.releaseDate.slice(8, 10))}</span><span class="m">${new Date(u.releaseDate + 'T00:00').toLocaleDateString('it-IT', { month: 'short' })}</span>`
              : '<span class="m">TBA</span>'}
          </div>
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
    ['title', 'developer', 'genre', 'franchise', 'console', 'score', 'hours', 'status', 'releaseYear', 'playedYear', 'review']
      .forEach((k) => { if (f.elements[k]) f.elements[k].value = src[k] ?? ''; });
    if (!f.elements.status.value) f.elements.status.value = 'Completato';
    $('#game-dialog').showModal();
  }

  function readGameForm() {
    const f = $('#game-form').elements;
    const s = (k) => f[k].value.trim();
    return {
      title: s('title'),
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
    setBusy(true, 'Salvataggio in corso…');
    try {
      if (editingId) {
        state.games = await Storage.update('games', (list) => {
          const i = list.findIndex((g) => g.id === editingId);
          if (i === -1) throw new Error('Il gioco non esiste più (forse è stato eliminato da un altro dispositivo).');
          list[i] = { ...list[i], ...data, updatedAt: now };
          return list;
        }, `Modificato gioco: ${data.title}`);
      } else {
        const game = { id: uid(), ...data, createdAt: now, updatedAt: now };
        state.games = await Storage.update('games', (list) => { list.push(game); return list; }, `Aggiunto gioco: ${data.title}`);
      }
      if (removeUpcomingId) {
        state.upcoming = await Storage.update('upcoming', (list) => list.filter((u) => u.id !== removeUpcomingId), `Spostato in libreria: ${data.title}`);
      }
      state.pendingUpcomingToRemove = null;
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
        <span class="score big ${scoreClass(g.score)}">${g.score ?? '–'}</span>
        <div>
          <div>${statusChip(g.status)}</div>
          <div class="muted">#${rank} in classifica</div>
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
      state.games = await Storage.update('games', (list) => list.filter((x) => x.id !== g.id), `Eliminato gioco: ${g.title}`);
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
    const src = u || { releaseYear: new Date().getFullYear() };
    ['title', 'console', 'releaseYear', 'releaseDate', 'notes'].forEach((k) => { f.elements[k].value = src[k] ?? ''; });
    $('#upcoming-dialog').showModal();
  }

  async function submitUpcoming(e) {
    e.preventDefault();
    if (state.busy) return;
    const f = $('#upcoming-form').elements;
    const releaseDate = f.releaseDate.value || '';
    const data = {
      title: f.title.value.trim(),
      console: f.console.value.trim(),
      releaseDate,
      releaseYear: releaseDate ? Number(releaseDate.slice(0, 4)) : num(f.releaseYear.value),
      notes: f.notes.value.trim(),
    };
    const editingId = state.editingUpcomingId;
    setBusy(true, 'Salvataggio in corso…');
    try {
      state.upcoming = await Storage.update('upcoming', (list) => {
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
      state.upcoming = await Storage.update('upcoming', (list) => list.filter((x) => x.id !== u.id), `Eliminata uscita: ${u.title}`);
      $('#upcoming-dialog').close();
      renderAll();
      toast('Uscita eliminata');
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
    a.download = `game-library-backup-${todayISO()}.json`;
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
      if (!confirm(`Il backup contiene ${games.length} giochi${upcoming ? ` e ${upcoming.length} uscite` : ''}. Sostituire i dati attuali?`)) return;
      setBusy(true, 'Ripristino in corso…');
      const normalized = games.map((g) => ({ id: g.id || uid(), ...g }));
      state.games = await Storage.update('games', () => normalized, 'Ripristino backup giochi');
      if (Array.isArray(upcoming)) {
        const nu = upcoming.map((u) => ({ id: u.id || uid(), ...u }));
        state.upcoming = await Storage.update('upcoming', () => nu, 'Ripristino backup uscite');
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
        if (action === 'add-game') openGameForm();
        if (action === 'add-upcoming') openUpcomingForm();
        if (action === 'edit-upcoming') openUpcomingForm(state.upcoming.find((u) => u.id === id));
        if (action === 'promote') {
          const u = state.upcoming.find((x) => x.id === id);
          state.pendingUpcomingToRemove = id;
          openGameForm(null, { title: u.title, console: u.console, releaseYear: u.releaseYear, playedYear: new Date().getFullYear(), status: 'Completato' });
        }
        return;
      }
      const row = e.target.closest('.clickable[data-id]');
      if (row) openDetail(row.dataset.id);
      if (e.target.closest('[data-close]')) e.target.closest('dialog').close();
    });

    // chiudi cliccando fuori dal dialog
    $$('dialog').forEach((d) => {
      d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    });
    $('#game-dialog').addEventListener('close', () => { if (!state.busy) state.pendingUpcomingToRemove = null; });

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

  function init() {
    try {
      const s = JSON.parse(localStorage.getItem('tgl-sort') || 'null');
      if (s && s.k) { state.sortKey = s.k; state.sortDir = s.d === 'asc' ? 'asc' : 'desc'; }
    } catch { /* ignore */ }
    bind();
    route();
    loadAll();
  }

  init();
})();
