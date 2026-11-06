/* ASTROMATE local-first data layer: accounts, roles, encrypted birth data, predictions, settings, backup.
   Security model (browser edition): password -> PBKDF2-SHA256 key -> unwraps a random AES-256-GCM data key; birth profiles, charts, predictions,
   notes and historical tests are stored only as AES-GCM ciphertext. Only non-identifying prediction metadata is kept in the clear (for reports).
   Nothing is sent to any server. Every public method is async so the same interface can later be backed by a REST API. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const PFX = 'am1:';
  const KDF_ITER = 600000; /* PBKDF2-SHA256 iterations for new passwords (current OWASP guidance); accounts made earlier keep the count stored with them (300,000) until their password is next changed */
  const enc = new TextEncoder(); const dec = new TextDecoder();

  /* ---------------------------------------------------------------- raw storage */
  const mem = {};
  let ls = null;
  try { ls = g.localStorage; ls.setItem(PFX + 'probe', '1'); ls.removeItem(PFX + 'probe'); } catch (e) { ls = null; }
  const raw = {
    get(k) { try { return ls ? ls.getItem(PFX + k) : (k in mem ? mem[k] : null); } catch (e) { return k in mem ? mem[k] : null; } },
    set(k, v) { if (ls) { try { ls.setItem(PFX + k, v); return; } catch (e) { throw new Error('Device storage is full or blocked. Free some space or export and delete old predictions.'); } } mem[k] = v; },
    del(k) { try { if (ls) ls.removeItem(PFX + k); } catch (e) { /* ignore */ } delete mem[k]; },
  };
  const jget = (k, d) => { const s = raw.get(k); if (!s) return d; try { return JSON.parse(s); } catch (e) { return d; } };
  const jset = (k, v) => raw.set(k, JSON.stringify(v));

  /* large encrypted blobs live in IndexedDB (falls back to localStorage / memory) */
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const req = g.indexedDB.open('astromate', 1);
        req.onupgradeneeded = () => { req.result.createObjectStore('blobs'); req.result.createObjectStore('device'); };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  async function idb(op, storeName, key, val) {
    const db = await openDb();
    if (!db) {
      if (storeName === 'device') return undefined;
      if (op === 'get') return jget('b:' + key, undefined);
      if (op === 'put') return jset('b:' + key, val);
      if (op === 'del') return raw.del('b:' + key);
      return undefined;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, op === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore(storeName);
      const rq = op === 'get' ? st.get(key) : op === 'put' ? st.put(val, key) : st.delete(key);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = () => reject(rq.error || new Error('Storage error'));
    });
  }

  /* ---------------------------------------------------------------- crypto */
  const subtle = g.crypto && g.crypto.subtle;
  const b64 = (buf) => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const rnd = (n) => g.crypto.getRandomValues(new Uint8Array(n));
  function needCrypto() { if (!subtle) throw new Error('Secure storage needs a secure browser context (https:// or localhost). Open the app from its https address.'); }
  async function kdf(secret, saltB64, iter) {
    needCrypto();
    const base = await subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /* `aad` (optional, bytes) is authenticated but not encrypted: it binds a ciphertext to the record it belongs to, so it cannot be moved to another record unnoticed.
     The browser edition passes none (its stored data stays readable); the server edition always does. */
  async function sealBytes(key, bytes, aad) { const iv = rnd(12); const p = { name: 'AES-GCM', iv }; if (aad) p.additionalData = aad; const ct = await subtle.encrypt(p, key, bytes); return { iv: b64(iv), ct: b64(ct) }; }
  async function openBytes(key, box, aad) { const p = { name: 'AES-GCM', iv: unb64(box.iv) }; if (aad) p.additionalData = aad; return new Uint8Array(await subtle.decrypt(p, key, unb64(box.ct))); }
  const sealJSON = (key, obj, aad) => sealBytes(key, enc.encode(JSON.stringify(obj)), aad);
  async function openJSON(key, box, aad) { return JSON.parse(dec.decode(await openBytes(key, box, aad))); }
  const importDk = (rawBytes) => subtle.importKey('raw', rawBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);

  /* ---------------------------------------------------------------- state */
  const S = { user: null, dk: null, cache: {} };
  const uidKey = (name) => 'blob:' + S.user.id + ':' + name;
  function needUser() { if (!S.user || !S.dk) throw new Error('Please sign in first.'); return S.user; }
  function needRole(roles) { const u = needUser(); if (!roles.includes(u.role)) throw new Error('You do not have permission for this action.'); return u; }

  async function readBlob(name, def) {
    needUser();
    if (name in S.cache) return S.cache[name];
    const box = await idb('get', 'blobs', uidKey(name));
    const val = box ? await openJSON(S.dk, box) : def;
    S.cache[name] = val;
    return val;
  }
  async function writeBlob(name, val) {
    needUser();
    S.cache[name] = val;
    await idb('put', 'blobs', uidKey(name), await sealJSON(S.dk, val));
  }

  /* ---------------------------------------------------------------- settings (clear text, no personal data) */
  const DEFAULT_SETTINGS = {
    calc: { ayanamsa: 'lahiri', node: 'mean', houseSystem: 'whole' },
    ruleset: { overrides: {}, history: [] },
    questions: { overrides: {}, custom: [], inactive: [] },
    plans: [
      { id: 'free', name: 'Free', dailyLimit: 5, price: '0', note: 'Placeholder plan: no payment gateway is connected in this edition.' },
      { id: 'pro', name: 'Pro', dailyLimit: 50, price: 'set by publisher', note: 'Placeholder plan.' },
      { id: 'astrologer', name: 'Astrologer', dailyLimit: 500, price: 'set by publisher', note: 'Placeholder plan for researchers and professional astrologers.' },
    ],
    brand: { name: 'ASTROMATE', sub: '100 QUERY MASTER', tagline: 'Ask Your Question. Understand the Planetary Indications. Explore the Likely Outcome.' },
  };
  /* always a private deep copy, so callers can edit it freely without touching the defaults */
  function getSettings() { return AM.util.clone(AM.rules.deepMerge(DEFAULT_SETTINGS, jget('settings', {}))); }
  function saveSettings(s) { jset('settings', s); }

  /* ---------------------------------------------------------------- users */
  const getUsers = () => jget('users', []);
  const putUsers = (u) => jset('users', u);
  const normEmail = (e) => String(e || '').trim().toLowerCase();
  const pubUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });
  const genRecovery = () => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r = rnd(20); let s = ''; for (let i = 0; i < 20; i += 1) { s += a[r[i] % a.length]; if (i % 5 === 4 && i < 19) s += '-'; } return s; };

  async function startSession(u, rawDk, remember) {
    S.user = pubUser(u); S.dk = await importDk(rawDk); S.cache = {};
    try { g.sessionStorage.setItem(PFX + 'sess', JSON.stringify({ id: u.id, k: b64(rawDk) })); } catch (e) { /* ignore */ }
    if (remember) await rememberDevice(u.id, rawDk);
    jset('lastUser', u.id);
  }
  async function deviceKey() {
    let k = await idb('get', 'device', 'key');
    if (!k) { k = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await idb('put', 'device', 'key', k); }
    return k;
  }
  async function rememberDevice(uid, rawDk) {
    try { const k = await deviceKey(); jset('remember:' + uid, await sealBytes(k, rawDk)); } catch (e) { /* remember is optional */ }
  }

  const store = {
    mode: 'local',
    persistent: !!ls,
    cryptoOK: !!subtle,
    problem: null,
    /** The browser edition has nothing to load at start-up; the server edition (am-store-remote.js) fetches its public information here. */
    async init() { /* nothing to do */ },
    registrationOpen: () => true,

    /** Restore a signed-in session after a page reload (tab session, or "keep me signed in" on this device). */
    async restore() {
      try {
        if (!subtle) return null;
        let uid = null; let rawDk = null;
        try { const s = JSON.parse(g.sessionStorage.getItem(PFX + 'sess') || 'null'); if (s) { uid = s.id; rawDk = unb64(s.k); } } catch (e) { /* ignore */ }
        if (!rawDk) {
          const last = jget('lastUser', null); const box = last && jget('remember:' + last, null);
          if (box) { const k = await idb('get', 'device', 'key'); if (k) { rawDk = await openBytes(k, box); uid = last; } }
        }
        if (!rawDk) return null;
        const u = getUsers().find((x) => x.id === uid);
        if (!u || u.status !== 'active') return null;
        await startSession(u, rawDk, false);
        return S.user;
      } catch (e) { return null; }
    },
    current: () => S.user,
    hasUsers: () => getUsers().length > 0,

    async register({ name, email, password }) {
      needCrypto();
      email = normEmail(email); name = String(name || '').trim();
      if (name.length < 2) throw new Error('Please enter your name.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (String(password || '').length < 8) throw new Error('Choose a password of at least 8 characters.');
      const users = getUsers();
      if (users.some((u) => u.email === email)) throw new Error('An account with this email already exists on this device.');
      const rawDk = rnd(32);
      const salt = b64(rnd(16)); const kek = await kdf(password, salt, KDF_ITER);
      const recovery = genRecovery(); const rsalt = b64(rnd(16)); const rkek = await kdf(recovery.replace(/-/g, ''), rsalt, 100000);
      const first = users.length === 0;
      const u = {
        id: AM.util.uid('u'), name, email, role: first ? 'admin' : 'user', status: 'active', plan: first ? 'astrologer' : 'free', createdAt: Date.now(), lastLoginAt: Date.now(),
        kdf: { salt, iter: KDF_ITER }, wrapped: await sealBytes(kek, rawDk), recovery: Object.assign({ salt: rsalt, iter: 100000 }, await sealBytes(rkek, rawDk)),
      };
      users.push(u); putUsers(users);
      await startSession(u, rawDk, false);
      return { user: S.user, recoveryCode: recovery, firstAccount: first };
    },
    async login(email, password, remember) {
      needCrypto();
      const u = getUsers().find((x) => x.email === normEmail(email));
      const bad = new Error('The email or password is not correct.');
      if (!u) throw bad;
      if (u.status !== 'active') throw new Error('This account has been disabled by the administrator.');
      let rawDk;
      try { rawDk = await openBytes(await kdf(password, u.kdf.salt, u.kdf.iter), u.wrapped); } catch (e) { throw bad; }
      u.lastLoginAt = Date.now();
      const all = getUsers(); const i = all.findIndex((x) => x.id === u.id); all[i] = u; putUsers(all);
      await startSession(u, rawDk, !!remember);
      return S.user;
    },
    async logout() {
      if (S.user) raw.del('remember:' + S.user.id);
      S.user = null; S.dk = null; S.cache = {};
      try { g.sessionStorage.removeItem(PFX + 'sess'); } catch (e) { /* ignore */ }
    },
    async changePassword(oldPw, newPw) {
      const u0 = needUser();
      if (String(newPw || '').length < 8) throw new Error('Choose a new password of at least 8 characters.');
      const all = getUsers(); const u = all.find((x) => x.id === u0.id);
      let rawDk;
      try { rawDk = await openBytes(await kdf(oldPw, u.kdf.salt, u.kdf.iter), u.wrapped); } catch (e) { throw new Error('The current password is not correct.'); }
      const salt = b64(rnd(16)); u.kdf = { salt, iter: KDF_ITER }; u.wrapped = await sealBytes(await kdf(newPw, salt, KDF_ITER), rawDk);
      putUsers(all);
    },
    async resetWithRecovery(email, code, newPw) {
      needCrypto();
      if (String(newPw || '').length < 8) throw new Error('Choose a new password of at least 8 characters.');
      const all = getUsers(); const u = all.find((x) => x.email === normEmail(email));
      const bad = new Error('The email or recovery code is not correct.');
      if (!u) throw bad;
      let rawDk;
      try { rawDk = await openBytes(await kdf(String(code).toUpperCase().replace(/[^A-Z0-9]/g, ''), u.recovery.salt, u.recovery.iter), u.recovery); } catch (e) { throw bad; }
      const salt = b64(rnd(16)); u.kdf = { salt, iter: KDF_ITER }; u.wrapped = await sealBytes(await kdf(newPw, salt, KDF_ITER), rawDk);
      putUsers(all);
    },
    /** Delete the signed-in account and every byte of its data from this device. */
    async deleteMyAccount(password) {
      const u0 = needUser();
      const u = getUsers().find((x) => x.id === u0.id);
      try { await openBytes(await kdf(password, u.kdf.salt, u.kdf.iter), u.wrapped); } catch (e) { throw new Error('The password is not correct.'); }
      const others = getUsers().filter((x) => x.id !== u.id);
      if (u.role === 'admin' && others.length && !others.some((x) => x.role === 'admin' && x.status === 'active')) throw new Error('You are the only administrator. Make another account an administrator before deleting this one.');
      await store._purge(u0.id);
      await store.logout();
    },
    async _purge(uid) {
      for (const name of ['profiles', 'pidx', 'tests']) await idb('del', 'blobs', 'blob:' + uid + ':' + name);
      const idx = jget('plist:' + uid, []);
      for (const id of idx) await idb('del', 'blobs', 'blob:' + uid + ':pred:' + id);
      raw.del('plist:' + uid); raw.del('remember:' + uid);
      jset('pmeta', jget('pmeta', []).filter((m) => m.uid !== uid));
      putUsers(getUsers().filter((x) => x.id !== uid));
    },

    /* ------------------------------------------------------------ birth profiles */
    async listProfiles() { return (await readBlob('profiles', [])).slice(); },
    async getProfile(id) { return (await readBlob('profiles', [])).find((p) => p.id === id) || null; },
    async saveProfile(p) {
      const list = (await readBlob('profiles', [])).slice();
      const rec = Object.assign({}, p, { id: p.id || AM.util.uid('p'), updatedAt: Date.now() });
      if (!rec.createdAt) rec.createdAt = Date.now();
      const i = list.findIndex((x) => x.id === rec.id);
      if (i >= 0) list[i] = rec; else list.push(rec);
      await writeBlob('profiles', list);
      return rec;
    },
    async deleteProfile(id) { await writeBlob('profiles', (await readBlob('profiles', [])).filter((p) => p.id !== id)); },

    /* ------------------------------------------------------------ predictions */
    async listPredictions() { return (await readBlob('pidx', [])).slice(); },
    async getPrediction(id) {
      needUser();
      const box = await idb('get', 'blobs', uidKey('pred:' + id));
      return box ? openJSON(S.dk, box) : null;
    },
    async savePrediction(result, extra) {
      const u = needUser();
      const id = AM.util.uid('r');
      const rec = Object.assign({}, result, { id, userId: u.id, savedAt: Date.now() }, extra || {});
      await idb('put', 'blobs', uidKey('pred:' + id), await sealJSON(S.dk, rec));
      const idxList = await readBlob('pidx', []);
      const item = { id, qid: result.question.id, cat: result.question.cat, text: result.question.text, short: result.question.short, date: result.event.date, time: result.event.time, verdict: result.verdict, confidence: result.confidence, score: result.score, profileId: rec.profileId || null, profileName: rec.profileName || '', savedAt: rec.savedAt, outcome: null };
      await writeBlob('pidx', [item].concat(idxList));
      const plist = jget('plist:' + u.id, []); plist.unshift(id); jset('plist:' + u.id, plist);
      const meta = jget('pmeta', []);
      meta.push({ id, uid: u.id, qid: result.question.id, cat: result.question.cat, date: result.event.date, verdict: result.verdict, occ: result.occurrence ? result.occurrence.verdict : null, conf: result.confidence, score: result.score, rv: result.ruleset.version, at: rec.savedAt, outcome: null });
      jset('pmeta', meta);
      return rec;
    },
    async updatePrediction(id, patch) {
      const u = needUser();
      const rec = await store.getPrediction(id); if (!rec) throw new Error('Prediction not found.');
      Object.assign(rec, patch);
      await idb('put', 'blobs', uidKey('pred:' + id), await sealJSON(S.dk, rec));
      const idxList = (await readBlob('pidx', [])).map((x) => (x.id === id ? Object.assign({}, x, patch.outcome !== undefined ? { outcome: patch.outcome } : {}) : x));
      await writeBlob('pidx', idxList);
      if (patch.outcome !== undefined) {
        const meta = jget('pmeta', []).map((m) => (m.id === id && m.uid === u.id ? Object.assign({}, m, { outcome: patch.outcome ? patch.outcome.result : null }) : m));
        jset('pmeta', meta);
      }
      return rec;
    },
    async deletePrediction(id) {
      const u = needUser();
      await idb('del', 'blobs', uidKey('pred:' + id));
      await writeBlob('pidx', (await readBlob('pidx', [])).filter((x) => x.id !== id));
      jset('plist:' + u.id, jget('plist:' + u.id, []).filter((x) => x !== id));
      jset('pmeta', jget('pmeta', []).filter((m) => !(m.id === id && m.uid === u.id)));
    },
    async clearPredictions() {
      const u = needUser();
      for (const id of jget('plist:' + u.id, [])) await idb('del', 'blobs', uidKey('pred:' + id));
      await writeBlob('pidx', []); jset('plist:' + u.id, []);
      jset('pmeta', jget('pmeta', []).filter((m) => m.uid !== u.id));
    },
    /** Consultations made today by the signed-in user (for plan limits). */
    todayCount() {
      const u = needUser(); const d0 = new Date(); d0.setHours(0, 0, 0, 0);
      return jget('pmeta', []).filter((m) => m.uid === u.id && m.at >= d0.getTime()).length;
    },
    quota() {
      const u = needUser(); const plan = getSettings().plans.find((p) => p.id === u.plan) || getSettings().plans[0];
      return { plan: plan.name, limit: plan.dailyLimit, used: store.todayCount() };
    },

    /* ------------------------------------------------------------ historical tests (astrologer) */
    async listTests() { return (await readBlob('tests', [])).slice(); },
    async saveTests(list) { await writeBlob('tests', list); },

    /* ------------------------------------------------------------ settings & administration */
    getSettings,
    async saveSettings(s) { needRole(['admin']); saveSettings(s); },
    async listUsers() { needRole(['admin']); return getUsers().map(pubUser); },
    async setUserRole(id, role) {
      needRole(['admin']);
      if (!['user', 'astrologer', 'admin'].includes(role)) throw new Error('Unknown role.');
      const all = getUsers(); const u = all.find((x) => x.id === id); if (!u) throw new Error('User not found.');
      if (u.role === 'admin' && role !== 'admin' && all.filter((x) => x.role === 'admin' && x.status === 'active').length <= 1) throw new Error('There must be at least one active administrator.');
      u.role = role; putUsers(all);
      if (S.user && S.user.id === id) S.user.role = role;
    },
    async setUserStatus(id, status) {
      needRole(['admin']);
      const all = getUsers(); const u = all.find((x) => x.id === id); if (!u) throw new Error('User not found.');
      if (status !== 'active' && u.role === 'admin' && all.filter((x) => x.role === 'admin' && x.status === 'active').length <= 1) throw new Error('There must be at least one active administrator.');
      u.status = status; putUsers(all);
    },
    async setUserPlan(id, plan) { needRole(['admin']); const all = getUsers(); const u = all.find((x) => x.id === id); if (u) { u.plan = plan; putUsers(all); } },
    async deleteUser(id) {
      const me = needRole(['admin']);
      if (id === me.id) throw new Error('Use "Delete my account" in your profile to remove your own account.');
      await store._purge(id);
    },
    /** Non-identifying prediction metadata for reports (no names, birth data or notes). */
    async predictionMeta() { needRole(['admin', 'astrologer']); return jget('pmeta', []); },

    /* ------------------------------------------------------------ encrypted backup */
    async exportBackup() {
      const u0 = needUser(); const u = getUsers().find((x) => x.id === u0.id);
      const blobs = {};
      for (const name of ['profiles', 'pidx', 'tests']) { const b = await idb('get', 'blobs', uidKey(name)); if (b) blobs[name] = b; }
      for (const id of jget('plist:' + u0.id, [])) { const b = await idb('get', 'blobs', uidKey('pred:' + id)); if (b) blobs['pred:' + id] = b; }
      return { format: 'astromate-backup', version: 1, createdAt: Date.now(), user: u, plist: jget('plist:' + u0.id, []), meta: jget('pmeta', []).filter((m) => m.uid === u0.id), blobs };
    },
    async importBackup(obj) {
      if (!obj || obj.format !== 'astromate-backup' || !obj.user) throw new Error('This is not an ASTROMATE backup file.');
      const users = getUsers();
      if (users.some((x) => x.email === obj.user.email)) throw new Error('An account with this email already exists here. Sign in to it, or delete it first.');
      if (users.some((x) => x.id === obj.user.id)) throw new Error('This backup belongs to an account that already exists here.');
      if (users.length === 0) obj.user.role = 'admin'; else if (obj.user.role === 'admin') obj.user.role = 'user';
      users.push(obj.user); putUsers(users);
      for (const k of Object.keys(obj.blobs || {})) await idb('put', 'blobs', 'blob:' + obj.user.id + ':' + k, obj.blobs[k]);
      jset('plist:' + obj.user.id, obj.plist || []);
      jset('pmeta', jget('pmeta', []).concat(obj.meta || []));
      return pubUser(obj.user);
    },
    wipeEverything() { for (let i = (ls ? ls.length : 0) - 1; i >= 0; i -= 1) { const k = ls.key(i); if (k && k.indexOf(PFX) === 0) ls.removeItem(k); } },
  };
  AM.store = store;
  /* shared with the server edition (am-store-remote.js), which uses the same encryption primitives and the same default settings */
  AM.storeCrypto = { b64, unb64, rnd, sealBytes, openBytes, sealJSON, openJSON, importDk, genRecovery, subtle };
  AM.defaultSettings = DEFAULT_SETTINGS;
})(typeof window !== 'undefined' ? window : globalThis);
