/*
 * Lookup: cerca giochi, film, serie, libri e manga su Wikidata e prende la copertina da Wikipedia.
 * Nessuna chiave API né registrazione: sono servizi pubblici e gratuiti che supportano CORS.
 *  - Wikidata  -> sviluppatore, serie/franchise, genere, data di uscita, piattaforme
 *  - Wikipedia -> immagine di copertina della voce del gioco
 */
const Lookup = (() => {
  const WIKIDATA = 'https://www.wikidata.org/w/api.php';
  const VIDEO_GAME = 'Q7889';

  // Nomi brevi per le piattaforme (etichetta inglese di Wikidata -> nome usato nel sito)
  const PLATFORM_NAMES = {
    'PlayStation 5': 'PS5', 'PlayStation 4': 'PS4', 'PlayStation 3': 'PS3', 'PlayStation 2': 'PS2',
    PlayStation: 'PS1', 'PlayStation Vita': 'PS Vita', 'PlayStation Portable': 'PSP',
    'Xbox Series X and Series S': 'Xbox Series X|S', 'Xbox Series X/S': 'Xbox Series X|S', 'Xbox One': 'Xbox One',
    'Xbox 360': 'Xbox 360', Xbox: 'Xbox', 'Nintendo Switch': 'Switch', 'Nintendo Switch 2': 'Switch 2',
    'Wii U': 'Wii U', Wii: 'Wii', 'Nintendo 3DS': '3DS', 'Nintendo DS': 'DS', 'Nintendo GameCube': 'GameCube',
    'Nintendo 64': 'N64', 'Game Boy Advance': 'GBA', 'Game Boy': 'Game Boy', 'Microsoft Windows': 'PC',
    macOS: 'Mac', Linux: 'Linux', Android: 'Mobile', iOS: 'Mobile', 'Steam Deck': 'Steam Deck', Stadia: 'Stadia',
  };

  // "action role-playing video game" -> "Action RPG", "platform game" -> "Platform"
  function prettyGenre(s) {
    if (!s) return '';
    const t = s.replace(/\s*(video\s*)?games?$/i, '').replace(/role-playing/i, 'RPG').trim();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  async function getJSON(base, params) {
    const url = new URL(base);
    Object.entries({ ...params, format: 'json', origin: '*' }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Ricerca non riuscita (${res.status})`);
    return res.json();
  }

  async function getEntities(ids, props, extra = {}) {
    const out = {};
    for (let i = 0; i < ids.length; i += 50) {
      const r = await getJSON(WIKIDATA, {
        action: 'wbgetentities', ids: ids.slice(i, i + 50).join('|'), props, languages: 'it|en', ...extra,
      });
      Object.assign(out, r.entities || {});
    }
    return out;
  }

  const label = (ent) => ent?.labels?.it?.value || ent?.labels?.en?.value || '';
  const claimIds = (ent, prop) => (ent.claims?.[prop] || [])
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue?.value?.id)
    .map((c) => c.mainsnak.datavalue.value.id);

  // Data di uscita più vecchia (i giochi hanno spesso date diverse per regione)
  function releaseInfo(ent) {
    const times = (ent.claims?.P577 || [])
      .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue?.value?.time)
      .map((c) => c.mainsnak.datavalue.value)
      .map((v) => ({ m: /^\+?(-?\d{1,4})-(\d{2})-(\d{2})/.exec(v.time), p: v.precision }))
      .filter((x) => x.m)
      .map(({ m, p }) => ({ year: Number(m[1]), date: p >= 11 && m[2] !== '00' && m[3] !== '00' ? `${m[1]}-${m[2]}-${m[3]}` : '' }))
      .sort((a, b) => (a.date || `${a.year}-99`).localeCompare(b.date || `${b.year}-99`));
    return times[0] || { year: null, date: '' };
  }

  async function wikipediaCovers(titlesByLang) {
    const covers = {};
    for (const [lang, titles] of Object.entries(titlesByLang)) {
      if (!titles.length) continue;
      const r = await getJSON(`https://${lang}.wikipedia.org/w/api.php`, {
        action: 'query', prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any',
        titles: titles.join('|'), redirects: '1',
      });
      // mappa titolo richiesto -> titolo finale (normalizzazioni e redirect)
      const map = {};
      [...(r.query?.normalized || []), ...(r.query?.redirects || [])].forEach((n) => { map[n.from] = n.to; });
      const pages = Object.values(r.query?.pages || {});
      titles.forEach((t) => {
        let final = t;
        for (let i = 0; i < 3 && map[final]; i++) final = map[final];
        const page = pages.find((p) => p.title === final);
        if (page?.thumbnail?.source) covers[`${lang}:${t}`] = page.thumbnail.source;
      });
    }
    return covers;
  }

  const isGame = (ent) => claimIds(ent, 'P31').includes(VIDEO_GAME)
    || (claimIds(ent, 'P400').length > 0 && claimIds(ent, 'P178').length > 0);

  // Cerca su Wikidata. strict = solo elementi marcati come "videogioco"
  async function wikidataSearch(q, limit, strict) {
    const s = await getJSON(WIKIDATA, {
      action: 'query', list: 'search', srsearch: strict ? `${q} haswbstatement:P31=${VIDEO_GAME}` : q,
      srlimit: String(strict ? limit : limit * 2), srnamespace: '0',
    });
    const ids = (s.query?.search || []).map((x) => x.title).filter((t) => /^Q\d+$/.test(t));
    if (!ids.length) return [];

    const ents = await getEntities(ids, 'labels|claims|sitelinks', { sitefilter: 'enwiki|itwiki' });
    const games = ids.map((id) => ents[id]).filter(Boolean).filter((g) => strict || isGame(g)).slice(0, limit);
    if (!games.length) return [];

    // etichette di sviluppatori, serie, generi e piattaforme
    const refIds = new Set();
    games.forEach((g) => ['P178', 'P179', 'P8345', 'P136', 'P400'].forEach((p) => claimIds(g, p).forEach((x) => refIds.add(x))));
    const refs = refIds.size ? await getEntities([...refIds], 'labels') : {};
    const enLabel = (id) => refs[id]?.labels?.en?.value || label(refs[id]);

    // copertine da Wikipedia (inglese, poi italiana)
    const titles = { en: [], it: [] };
    games.forEach((g) => {
      if (g.sitelinks?.enwiki) titles.en.push(g.sitelinks.enwiki.title);
      if (g.sitelinks?.itwiki) titles.it.push(g.sitelinks.itwiki.title);
    });
    let covers = {};
    try { covers = await wikipediaCovers(titles); } catch { /* le copertine sono facoltative */ }

    return games.map((g) => {
      const rel = releaseInfo(g);
      const series = claimIds(g, 'P179')[0] || claimIds(g, 'P8345')[0];
      let cover = (g.sitelinks?.enwiki && covers[`en:${g.sitelinks.enwiki.title}`])
        || (g.sitelinks?.itwiki && covers[`it:${g.sitelinks.itwiki.title}`]) || '';
      const p18 = g.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!cover && p18) cover = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=500`;
      const platforms = [...new Set(claimIds(g, 'P400').map((id) => PLATFORM_NAMES[enLabel(id)] || enLabel(id)).filter(Boolean))];
      return {
        id: g.id,
        title: label(g),
        developer: claimIds(g, 'P178').map((id) => label(refs[id])).filter(Boolean).slice(0, 2).join(', '),
        franchise: series ? label(refs[series]) : '',
        genre: claimIds(g, 'P136').map((id) => prettyGenre(enLabel(id))).filter(Boolean)[0] || '',
        releaseYear: rel.year,
        releaseDate: rel.date,
        platforms,
        cover,
      };
    }).filter((g) => g.title);
  }

  // Ricerca di riserva direttamente su Wikipedia: voci descritte come "video game"
  async function wikipediaSearch(q, limit) {
    const out = [];
    for (const lang of ['en', 'it']) {
      const r = await getJSON(`https://${lang}.wikipedia.org/w/api.php`, {
        action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '8', gsrnamespace: '0',
        prop: 'pageimages|description', piprop: 'thumbnail', pithumbsize: '500', pilicense: 'any',
      });
      Object.values(r.query?.pages || {})
        .filter((p) => /video ?game|videogioco/i.test(p.description || ''))
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .forEach((p) => {
          const year = /\b(19[5-9]\d|20\d\d)\b/.exec(p.description || '');
          out.push({
            id: `wp-${lang}:${p.title}`,
            title: p.title.replace(/\s*\((\d{4} )?(video ?game|videogioco)\)$/i, ''),
            developer: '', franchise: '', genre: '',
            releaseYear: year ? Number(year[1]) : null,
            releaseDate: '',
            platforms: [],
            cover: p.thumbnail?.source || '',
          });
        });
      if (out.length) break;
    }
    return out.slice(0, limit);
  }

  const norm = (t) => (t || '').toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

  // "Mortal Shell: Enhanced Edition" -> "Mortal Shell"
  function baseTitle(q) {
    return q.replace(/\s*[:\-–—]?\s*\(?\b(enhanced|definitive|complete|deluxe|ultimate|gold|legendary|anniversary|game of the year|goty|director'?s cut|remastered|remaster|hd|edition)\b.*$/i, '').trim();
  }

  /**
   * Cerca videogiochi per titolo. Restituisce fino a `limit` risultati:
   * { id, title, developer, franchise, genre, releaseYear, releaseDate, platforms[], cover }
   * Prova in ordine: Wikidata (solo videogiochi) -> Wikidata (filtro più largo)
   * -> titolo senza "Edition/Remastered…" -> Wikipedia. Le copertine mancanti vengono
   * cercate anche su Wikipedia.
   */
  async function search(query, limit = 6) {
    const q = query.trim().replace(/[’‘]/g, "'");
    if (q.length < 2) return [];
    const queries = [...new Set([q, baseTitle(q)])].filter((x) => x.length >= 2);

    let results = [];
    let lastErr = null;
    for (const qq of queries) {
      for (const strict of [true, false]) {
        try { results = await wikidataSearch(qq, limit, strict); } catch (e) { lastErr = e; results = []; }
        if (results.length) break;
      }
      if (results.length) break;
    }

    // copertine mancanti (o nessun risultato): prova la ricerca su Wikipedia
    if (!results.length || results.some((r) => !r.cover)) {
      let wp = [];
      for (const qq of queries) {
        try { wp = await wikipediaSearch(qq, limit); } catch (e) { lastErr = lastErr || e; }
        if (wp.length) break;
      }
      if (!results.length) {
        results = wp;
      } else {
        results.forEach((r) => {
          if (r.cover) return;
          const match = wp.find((w) => w.cover && norm(w.title) === norm(r.title));
          if (match) r.cover = match.cover;
        });
      }
    }
    if (!results.length && lastErr) throw lastErr;
    return results;
  }

  // Immagini (es. di una console) dalle voci di Wikipedia che corrispondono alla ricerca
  async function searchImages(query, limit = 8) {
    const q = query.trim();
    if (q.length < 2) return [];
    const out = [];
    for (const lang of ['en', 'it']) {
      const r = await getJSON(`https://${lang}.wikipedia.org/w/api.php`, {
        action: 'query', generator: 'search', gsrsearch: q, gsrlimit: '10', gsrnamespace: '0',
        prop: 'pageimages', piprop: 'thumbnail', pithumbsize: '600', pilicense: 'any',
      });
      Object.values(r.query?.pages || {})
        .filter((p) => p.thumbnail?.source && !out.some((o) => o.image === p.thumbnail.source))
        .sort((a, b) => (a.index || 0) - (b.index || 0))
        .forEach((p) => out.push({ title: p.title, image: p.thumbnail.source }));
      if (out.length >= limit) break;
    }
    return out.slice(0, limit);
  }

  // ---------- film, serie TV, libri, manga ----------
  // Classi Wikidata accettate per ogni tipo (P31 = "istanza di")
  const MEDIA_CLASSES = {
    movie: ['Q11424', 'Q24869', 'Q202866', 'Q29168811', 'Q506240', 'Q93204'],
    series: ['Q5398426', 'Q581714', 'Q1259759', 'Q63952888', 'Q117467246', 'Q15416', 'Q526877'],
    book: ['Q7725634', 'Q47461344', 'Q8261', 'Q571', 'Q1667921', 'Q49084', 'Q277759', 'Q725377'],
    manga: ['Q21198342', 'Q1004', 'Q74262765', 'Q8274', 'Q562214', 'Q725377'],
  };
  const SEASON_CLASS = 'Q3464665'; // stagione di una serie televisiva
  const quantity = (ent, prop) => {
    const v = (ent.claims?.[prop] || []).find((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue?.value?.amount)?.mainsnak.datavalue.value.amount;
    const n = v != null ? Number(v) : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const startYear = (ent) => {
    const t = (ent.claims?.P580 || []).find((c) => c.mainsnak?.datavalue?.value?.time)?.mainsnak.datavalue.value.time;
    const m = t && /^\+?(-?\d{1,4})-/.exec(t);
    return m ? Number(m[1]) : null;
  };

  // episodi di ogni stagione: dalle stagioni collegate alla serie (P527 "ha parte"), in ordine
  async function seasonEpisodes(ent) {
    const parts = (ent.claims?.P527 || []).filter((c) => c.rank !== 'deprecated' && c.mainsnak?.datavalue?.value?.id)
      .map((c, i) => ({ id: c.mainsnak.datavalue.value.id, ord: Number(c.qualifiers?.P1545?.[0]?.datavalue?.value) || i + 1 }));
    if (!parts.length || parts.length > 60) return null;
    const ents = await getEntities(parts.map((p) => p.id), 'claims');
    const seasons = parts
      .map((p) => ({ ...p, ent: ents[p.id] }))
      .filter((p) => p.ent && claimIds(p.ent, 'P31').includes(SEASON_CLASS))
      .map((p) => {
        const own = Number((p.ent.claims?.P179 || [])[0]?.qualifiers?.P1545?.[0]?.datavalue?.value);
        return { ord: Number.isFinite(own) && own > 0 ? own : p.ord, eps: quantity(p.ent, 'P1113') };
      })
      .sort((a, b) => a.ord - b.ord);
    if (!seasons.length || seasons.some((s) => !s.eps)) return null;
    return seasons.map((s) => s.eps);
  }

  /**
   * Cerca film ('movie'), serie TV ('series'), libri ('book') o manga ('manga') per titolo.
   * Risultato: { id, title, year, cover, director, author, seasons[] | null, nSeasons, nEpisodes, volumes }
   */
  async function searchMedia(kind, query, limit = 6) {
    const classes = MEDIA_CLASSES[kind];
    const q = (query || '').trim().replace(/[’‘]/g, "'");
    if (!classes || q.length < 2) return [];
    const isKind = (ent) => claimIds(ent, 'P31').some((c) => classes.includes(c));

    let ents = [];
    let ids = [];
    for (const strict of [true, false]) {
      const s = await getJSON(WIKIDATA, {
        action: 'query', list: 'search', srnamespace: '0', srlimit: String(strict ? limit : limit * 3),
        srsearch: strict ? `${q} haswbstatement:${classes.map((c) => `P31=${c}`).join('|')}` : q,
      });
      ids = (s.query?.search || []).map((x) => x.title).filter((t) => /^Q\d+$/.test(t));
      if (!ids.length) continue;
      const all = await getEntities(ids, 'labels|claims|sitelinks', { sitefilter: 'enwiki|itwiki' });
      ents = ids.map((id) => all[id]).filter(Boolean).filter(isKind).slice(0, limit);
      if (ents.length) break;
    }
    if (!ents.length) return [];

    // nomi di registi e autori
    const refIds = new Set();
    ents.forEach((e) => ['P57', 'P50'].forEach((p) => claimIds(e, p).slice(0, 2).forEach((x) => refIds.add(x))));
    const refs = refIds.size ? await getEntities([...refIds], 'labels') : {};
    const names = (e, p) => claimIds(e, p).slice(0, 2).map((id) => label(refs[id])).filter(Boolean).join(', ');

    // copertine / locandine da Wikipedia
    const titles = { en: [], it: [] };
    ents.forEach((e) => {
      if (e.sitelinks?.itwiki) titles.it.push(e.sitelinks.itwiki.title);
      if (e.sitelinks?.enwiki) titles.en.push(e.sitelinks.enwiki.title);
    });
    let covers = {};
    try { covers = await wikipediaCovers(titles); } catch { /* facoltative */ }

    const out = [];
    for (const e of ents) {
      let cover = (e.sitelinks?.enwiki && covers[`en:${e.sitelinks.enwiki.title}`])
        || (e.sitelinks?.itwiki && covers[`it:${e.sitelinks.itwiki.title}`]) || '';
      const p18 = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!cover && p18 && kind !== 'series') cover = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(p18)}?width=500`;
      let seasons = null;
      if (kind === 'series') { try { seasons = await seasonEpisodes(e); } catch { seasons = null; } }
      out.push({
        id: e.id,
        title: label(e),
        year: releaseInfo(e).year || startYear(e),
        cover,
        director: kind === 'movie' ? names(e, 'P57') : '',
        author: kind === 'book' || kind === 'manga' ? names(e, 'P50') : '',
        seasons,
        nSeasons: seasons ? seasons.length : quantity(e, 'P2437'),
        nEpisodes: seasons ? seasons.reduce((a, b) => a + b, 0) : quantity(e, 'P1113'),
        volumes: kind === 'manga' ? quantity(e, 'P2635') : null,
      });
    }
    return out.filter((r) => r.title);
  }

  return { search, norm, baseTitle, searchImages, searchMedia };
})();
