// What's Cookin' — personal edition runtime.
// Stands in for the services the app gets inside Claude:
//   db        -> documents stored on this phone (IndexedDB), with live updates
//   sample    -> Claude via the Anthropic API, using YOUR key saved on this phone only
//   downloads -> normal file downloads
//   user      -> a fixed id for this phone
// The app itself is unchanged; it finds these on window.claude.
(() => {
  const KEY_STORE = 'wc:apiKey';
  const MODELS = { quick: 'claude-haiku-5-5', default: 'claude-sonnet-5-5' };

  // ------------------------------------------------------------------ storage
  const DB_NAME = 'whats-cookin', OS = 'docs';
  const docs = new Map();            // path -> data (in memory, mirrored to IndexedDB)
  const listeners = new Set();
  let idb = null;

  const openIdb = () => new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const idbAll = (d) => new Promise((res, rej) => {
    const out = [];
    const c = d.transaction(OS).objectStore(OS).openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push([cur.key, cur.value]); cur.continue(); } else res(out); };
    c.onerror = () => rej(c.error);
  });
  const idbPut = (path, v) => new Promise((res, rej) => {
    const t = idb.transaction(OS, 'readwrite');
    v === undefined ? t.objectStore(OS).delete(path) : t.objectStore(OS).put(v, path);
    t.oncomplete = () => res(); t.onerror = () => rej(t.error);
  });

  const ready = (async () => {
    try {
      idb = await openIdb();
      for (const [k, v] of await idbAll(idb)) docs.set(k, v);
      navigator.storage?.persist?.().catch(() => {}); // ask the browser not to clear it
    } catch (e) { console.warn('Storage unavailable; data will not survive a restart.', e); }
  })();

  let pending = null;
  const notify = () => { if (pending) return; pending = setTimeout(() => { pending = null; listeners.forEach((l) => l()); }, 0); };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const parentOf = (p) => p.split('/').slice(0, -1).join('/');
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const meta = { fromCache: false, hasPendingWrites: false };
  const snapDoc = (path) => ({ id: path.split('/').pop(), exists: docs.has(path), data: () => (docs.has(path) ? clone(docs.get(path)) : undefined), metadata: meta });
  const OPS = { '==': (a, b) => a === b, '!=': (a, b) => a !== b, '<': (a, b) => a < b, '<=': (a, b) => a <= b, '>': (a, b) => a > b, '>=': (a, b) => a >= b };

  function query(path, filters = []) {
    const run = () => {
      const list = [...docs.keys()].filter((k) => parentOf(k) === path).map(snapDoc)
        .filter((d) => filters.every(([f, o, v]) => (OPS[o] || OPS['=='])(d.data()?.[f], v)));
      return { docs: list, size: list.length, empty: !list.length, metadata: meta, docChanges: () => [] };
    };
    return {
      path,
      where: (f, o, v) => query(path, [...filters, [f, o, v]]),
      get: async () => { await ready; return run(); },
      onSnapshot(next) { const l = () => next(run()); listeners.add(l); ready.then(l); return () => listeners.delete(l); },
      doc: (id) => docRef(`${path}/${id || newId()}`),
    };
  }
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => { await ready; return snapDoc(path); },
      onSnapshot(next) { const l = () => next(snapDoc(path)); listeners.add(l); ready.then(l); return () => listeners.delete(l); },
      set: async (d) => { await ready; const v = clone(d); docs.set(path, v); notify(); if (idb) await idbPut(path, v); },
      update: async (d) => { await ready; const v = { ...(docs.get(path) || {}), ...clone(d) }; docs.set(path, v); notify(); if (idb) await idbPut(path, v); },
      delete: async () => { await ready; docs.delete(path); notify(); if (idb) await idbPut(path, undefined); },
    };
  }
  const db = { collection: (p) => query(p), doc: (p) => docRef(p) };

  // ------------------------------------------------------------------ Claude via your API key
  const err = (code, message) => Object.assign(new Error(message || code), { code });
  const toBase64 = (blob) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  const getKey = () => { try { return (localStorage.getItem(KEY_STORE) || '').trim(); } catch { return ''; } };

  // Setup link: https://…/whats-cookin/#key=sk-ant-… saves the key on this phone, then
  // removes it from the address bar and this history entry (the part after # is never sent to GitHub).
  let keyFromLink = false;
  try {
    const m = location.hash.match(/(?:^#|&)key=([^&]+)/);
    if (m) {
      const k = decodeURIComponent(m[1]).trim();
      if (/^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k)) { localStorage.setItem(KEY_STORE, k); keyFromLink = true; }
      history.replaceState(null, '', location.pathname + location.search);
    }
  } catch { /* ignore */ }

  async function ask(prompt, opts = {}) {
    const key = getKey();
    if (!key) throw err('no_key');
    const content = [];
    for (const img of opts.images || []) {
      content.push({ type: 'image', source: { type: 'base64', media_type: img.type || 'image/jpeg', data: await toBase64(img) } });
    }
    content.push({ type: 'text', text: prompt });
    let res;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: opts.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true', // personal app: your key stays on this phone
        },
        body: JSON.stringify({
          model: MODELS[opts.modelTier] || MODELS.default,
          max_tokens: opts.images?.length ? 16000 : 4000,
          messages: [{ role: 'user', content }],
        }),
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw err('cancelled');
      throw err('unavailable', 'No connection.');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const m = body?.error?.message || '';
      if (res.status === 401 || res.status === 403) throw err('bad_key', m);
      if (res.status === 429) throw err('rate_limited', m);
      if (res.status === 400 && /credit|balance|billing/i.test(m)) throw err('no_credit', m);
      if (res.status === 400 && /image/i.test(m)) throw err('image_rejected', m);
      throw err('unavailable', m || `HTTP ${res.status}`);
    }
    const data = await res.json();
    if (data.stop_reason === 'refusal') throw err('refused');
    return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  }

  const sample = async (prompt, opts = {}) => {
    const text = await ask(prompt, opts);
    opts.onText?.({ text, delta: text });
    return text;
  };
  sample.json = async (prompt, opts = {}) => {
    const text = await ask(`${prompt}\n\nReply with only the JSON object. No code fences, no commentary.`, opts);
    opts.onText?.({ text, delta: text });
    const s = text.replace(/```(?:json)?/gi, '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    try { return JSON.parse(s.slice(a, b + 1)); } catch { throw err('invalid_json'); }
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 5e6, mediaTypes: ['image/jpeg', 'image/png', 'image/webp'] } });

  // ------------------------------------------------------------------ downloads, user
  const downloads = {
    save: async ({ filename, data, mimeType }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || (filename.endsWith('.json') ? 'application/json' : 'text/csv') });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: filename });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return { status: 'saved' };
    },
  };
  const me = (() => {
    try { let id = localStorage.getItem('wc:me'); if (!id) { id = 'me-' + newId(); localStorage.setItem('wc:me', id); } return id; }
    catch { return 'me'; }
  })();
  const user = { id: async () => me, can: async () => true };

  const caps = { db, sample, user, downloads };
  window.claude = {
    standalone: true,
    keyFromLink,
    apiKey: {
      get: () => getKey(),
      set: (k) => { try { k ? localStorage.setItem(KEY_STORE, k.trim()) : localStorage.removeItem(KEY_STORE); } catch { /* ignore */ } },
      test: async () => { await ask('Reply with the word OK.', { modelTier: 'quick' }); return true; },
    },
    use: async (name) => { if (name === 'db') await ready; return caps[name] ?? null; },
  };
})();
