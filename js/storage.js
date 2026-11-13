/*
 * Storage: legge e scrive i file JSON della repository tramite la GitHub Contents API.
 *  - Lettura: funziona anche senza token (repo pubblica) o dai file locali del sito.
 *  - Scrittura: richiede un token personale (fine-grained) con permesso "Contents: Read and write".
 *  - Ogni salvataggio rilegge prima il file aggiornato, applica la modifica e poi fa il commit,
 *    così non si sovrascrivono mai dati salvati da un altro dispositivo.
 *  - Una copia di sicurezza viene sempre tenuta anche nel browser (localStorage).
 */
const Storage = (() => {
  const CONFIG_KEY = 'tgl-config';
  const CACHE_PREFIX = 'tgl-cache-';

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch { /* storage non disponibile */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }

  function inferDefaults() {
    // Su GitHub Pages l'indirizzo è <utente>.github.io/<repo>/
    const host = location.hostname;
    if (host.endsWith('.github.io')) {
      const owner = host.replace('.github.io', '');
      const repo = location.pathname.split('/').filter(Boolean)[0] || `${owner}.github.io`;
      return { owner, repo, branch: 'main', token: '' };
    }
    return { owner: '', repo: '', branch: 'main', token: '' };
  }

  function getConfig() {
    const defaults = inferDefaults();
    let saved = {};
    try { saved = JSON.parse(safeGet(CONFIG_KEY) || '{}'); } catch { saved = {}; }
    return { ...defaults, ...Object.fromEntries(Object.entries(saved).filter(([, v]) => v !== '' && v != null)) };
  }

  function setConfig(cfg) {
    safeSet(CONFIG_KEY, JSON.stringify(cfg));
  }

  function hasRepo(cfg = getConfig()) {
    return Boolean(cfg.owner && cfg.repo);
  }

  function canWrite(cfg = getConfig()) {
    return hasRepo(cfg) && Boolean(cfg.token);
  }

  // --- Base64 con supporto UTF-8 (accenti, emoji, ecc.) ---
  function b64encode(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function apiUrl(cfg, path) {
    return `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path}`;
  }

  function headers(cfg) {
    const h = { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (cfg.token) h.Authorization = `Bearer ${cfg.token}`;
    return h;
  }

  async function apiError(res) {
    let msg = `Errore GitHub ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.message) msg += `: ${body.message}`;
    } catch { /* ignore */ }
    if (res.status === 401) msg = 'Token non valido o scaduto (401). Controlla le Impostazioni.';
    if (res.status === 403) msg = 'Accesso negato (403): il token non ha il permesso "Contents: Read and write" su questa repository, oppure hai superato il limite di richieste.';
    if (res.status === 404) msg = 'File o repository non trovati (404). Controlla proprietario, repository e branch nelle Impostazioni.';
    const err = new Error(msg);
    err.status = res.status;
    return err;
  }

  // Legge un file dalla repo via API. Restituisce { data, sha } (sha = null se il file non esiste).
  async function readRemote(cfg, path) {
    const url = `${apiUrl(cfg, path)}?ref=${encodeURIComponent(cfg.branch || 'main')}`;
    const res = await fetch(url, { headers: headers(cfg), cache: 'no-store' });
    if (res.status === 404) return { data: [], sha: null, missing: true };
    if (!res.ok) throw await apiError(res);
    const body = await res.json();
    let text;
    if (body.content) {
      text = b64decode(body.content);
    } else if (body.download_url) {
      // file > 1MB: la API non include il contenuto, lo scarichiamo a parte
      const raw = await fetch(body.download_url, { cache: 'no-store' });
      text = await raw.text();
    } else {
      text = '[]';
    }
    const data = text.trim() ? JSON.parse(text) : [];
    return { data: Array.isArray(data) ? data : [], sha: body.sha };
  }

  async function readLocalFile(path) {
    const res = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404) return { data: [], missing: true };
    if (!res.ok) throw new Error(`Impossibile leggere ${path}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }

  function readCache(path) {
    try {
      const v = JSON.parse(safeGet(CACHE_PREFIX + path) || 'null');
      return Array.isArray(v) ? v : null;
    } catch { return null; }
  }
  function writeCache(path, data) {
    safeSet(CACHE_PREFIX + path, JSON.stringify(data));
  }

  /**
   * Carica i dati. Ordine di tentativo: GitHub API -> file del sito -> copia nel browser.
   * Restituisce { data, source, warning }.
   */
  async function load(path) {
    const cfg = getConfig();
    let warning = null;
    if (hasRepo(cfg)) {
      try {
        const { data, missing } = await readRemote(cfg, path);
        writeCache(path, data);
        return { data, source: 'github', missing: Boolean(missing) };
      } catch (e) {
        warning = e.message;
      }
    }
    try {
      const r = await readLocalFile(path);
      const data = Array.isArray(r) ? r : r.data;
      writeCache(path, data);
      return { data, source: 'site', warning, missing: !Array.isArray(r) && r.missing };
    } catch (e) {
      const cached = readCache(path);
      if (cached) return { data: cached, source: 'cache', warning: warning || e.message };
      return { data: [], source: 'empty', warning: warning || e.message };
    }
  }

  /**
   * Salva in modo sicuro: rilegge la versione più recente, applica `mutate(list)` e fa il commit.
   * Riprova automaticamente in caso di conflitto (modifica concorrente da un altro dispositivo).
   */
  async function update(path, mutate, message) {
    const cfg = getConfig();
    if (!canWrite(cfg)) {
      throw new Error('Per salvare serve il token GitHub: aprilo da Impostazioni (⚙).');
    }
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, sha } = await readRemote(cfg, path);
      const next = mutate(structuredClone(data));
      const body = {
        message,
        content: b64encode(JSON.stringify(next, null, 2) + '\n'),
        branch: cfg.branch || 'main',
      };
      if (sha) body.sha = sha;
      const res = await fetch(apiUrl(cfg, path), {
        method: 'PUT',
        headers: { ...headers(cfg), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        writeCache(path, next);
        return next;
      }
      lastErr = await apiError(res);
      if (res.status !== 409 && res.status !== 422) break; // non è un conflitto: inutile riprovare
    }
    throw lastErr;
  }

  async function testConnection(cfg) {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`, {
      headers: headers(cfg), cache: 'no-store',
    });
    if (!res.ok) throw await apiError(res);
    const repo = await res.json();
    if (cfg.token && !(repo.permissions && repo.permissions.push)) {
      // i token fine-grained non sempre espongono "permissions": non blocchiamo, avvisiamo soltanto
      return { ok: true, note: 'Connesso. Se il salvataggio fallisce, verifica che il token abbia il permesso "Contents: Read and write".' };
    }
    return { ok: true, note: cfg.token ? 'Connesso con permesso di scrittura ✔' : 'Connesso in sola lettura (nessun token).' };
  }

  return {
    getConfig, setConfig, hasRepo, canWrite, load, update, testConnection,
    clearToken() {
      const cfg = getConfig();
      cfg.token = '';
      setConfig(cfg);
    },
    _forget() { safeRemove(CONFIG_KEY); },
  };
})();
