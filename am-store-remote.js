/* ASTROMATE server-edition data layer (used only when config.js says mode: 'server').
   It offers exactly the interface of the browser edition (am-store.js), but accounts, roles, settings and the encrypted data live on the ASTROMATE server.
   Security model: the password never leaves the browser. From it (PBKDF2-SHA256, then HKDF) two independent secrets are derived: a key-encryption key that
   unwraps a random AES-256-GCM data key, and an authentication secret that proves identity to the server (which keeps only an Argon2id hash of it).
   Birth profiles, charts, predictions, notes and test cases are encrypted here, in the browser, with the data key: the server stores ciphertext it cannot read.
   Only non-identifying prediction metadata (question, date, verdict, score) is readable by the server, for plan limits and administrator reports. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const cfg = g.AM_CONFIG || {};
  if (cfg.mode !== 'server') return; /* the browser edition keeps its own store */
  const C = AM.storeCrypto;
  const subtle = C.subtle;
  const PFX = 'am1:';
  const SESS = PFX + 'srv-sess'; /* sessionStorage: this tab only */
  const REM = PFX + 'srv-remember'; /* localStorage: "keep me signed in", encrypted with a key that never leaves this browser */
  const KDF_ITER = 600000; const RECOVERY_ITER = 100000; /* PBKDF2-SHA256 iterations: 600,000 for passwords (current OWASP guidance); recovery codes are 100-bit random, so 100,000 is ample */
  const enc = new TextEncoder(); const dec = new TextDecoder();
  const SALT_SHAPE = /^[A-Za-z0-9+/]{22}==$/; /* Base64 of exactly 16 bytes */

  /** Before sign-in the server tells the browser which salt and iteration count to derive the login secret with. A compromised or curious API
      must not be able to make that cheap (for example one iteration), so anything below the protocol's counts is refused here. */
  function checkKdf(p, minIter) {
    if (!p || typeof p.salt !== 'string' || !SALT_SHAPE.test(p.salt) || !Number.isInteger(p.iter) || p.iter < minIter || p.iter > 5000000) {
      throw new Error('The server sent sign-in settings that are not safe, so the request was stopped. Please tell the administrator.');
    }
    return p;
  }

  /* ---------------------------------------------------------------- small helpers */
  function lget(k) { try { return g.localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { g.localStorage.setItem(k, v); } catch (e) { /* optional */ } }
  function ldel(k) { try { g.localStorage.removeItem(k); } catch (e) { /* optional */ } }
  const uuid = () => {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    const b = C.rnd(16); b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  };
  const normEmail = (e) => String(e || '').trim().toLowerCase();
  const normRecovery = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function needCrypto() { if (!subtle) throw new Error('Secure storage needs a secure browser context (https:// or localhost). Open the app from its https address.'); }

  /* ---------------------------------------------------------------- state */
  const S = {
    user: null, dk: null, rawDk: null, tokens: null, remember: false, refreshing: null,
    info: { hasUsers: true, registrationOpen: true, brand: null, serverVersion: '' },
    settings: null, settingsVersion: 0, quota: { plan: 'Free', limit: 5, used: 0 }, pver: {}, testsVersion: null, cfgAt: 0,
  };
  /* Every ciphertext is bound to its owner, its kind and its record id (AES-GCM additional data), so the server, or anyone who can write to the
     database, cannot move one record's data into another record unnoticed: it would fail to decrypt. (Replacing a record by an older copy of itself is not detectable.) */
  const aad = (kind, id) => enc.encode('astromate/1|' + S.user.id + '|' + kind + '|' + id);
  function needUser() { if (!S.user || !S.dk) throw new Error('Please sign in first.'); return S.user; }
  function needRole(roles) { const u = needUser(); if (!roles.includes(u.role)) throw new Error('You do not have permission for this action.'); return u; }
  const pub = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, plan: u.plan, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt });

  /* ---------------------------------------------------------------- password -> key-encryption key + authentication secret */
  async function derive(secret, saltB64, iter) {
    needCrypto();
    const base = await subtle.importKey('raw', enc.encode(secret), 'PBKDF2', false, ['deriveBits']);
    const master = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: C.unb64(saltB64), iterations: iter }, base, 256);
    const hk = await subtle.importKey('raw', master, 'HKDF', false, ['deriveBits']);
    const part = (label) => subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: enc.encode('astromate/' + label + '/v1') }, hk, 256);
    const kekBits = await part('kek'); const authBits = await part('auth');
    return { kek: await subtle.importKey('raw', kekBits, 'AES-GCM', false, ['encrypt', 'decrypt']), auth: C.b64(authBits) };
  }

  /** A new recovery code and what the server keeps for it: a login secret for the code, its salt, and the data key wrapped by the code. */
  async function makeRecovery(rawDk) {
    const code = C.genRecovery(); const salt = C.b64(C.rnd(16)); const cred = await derive(normRecovery(code), salt, RECOVERY_ITER);
    return { code, material: Object.assign({ auth_secret: cred.auth, salt, iter: RECOVERY_ITER }, await C.sealBytes(cred.kek, rawDk)) };
  }

  /* ---------------------------------------------------------------- device key ("keep me signed in") */
  let dbp = null;
  function openDb() {
    if (dbp) return dbp;
    dbp = new Promise((resolve) => {
      try {
        const req = g.indexedDB.open('astromate', 1);
        req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); if (!d.objectStoreNames.contains('device')) d.createObjectStore('device'); };
        req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(null); req.onblocked = () => resolve(null);
      } catch (e) { resolve(null); }
    });
    return dbp;
  }
  async function deviceOp(op, key, val) {
    const db = await openDb(); if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('device', op === 'get' ? 'readonly' : 'readwrite'); const st = tx.objectStore('device');
      const rq = op === 'get' ? st.get(key) : st.put(val, key);
      rq.onsuccess = () => resolve(rq.result); rq.onerror = () => reject(rq.error || new Error('Storage error'));
    });
  }
  async function deviceKey(create) {
    let k = await deviceOp('get', 'key');
    if (!k && create) { k = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); await deviceOp('put', 'key', k); }
    return k || null;
  }
  async function readRemembered() {
    const s = lget(REM); if (!s) return null;
    try { const o = JSON.parse(s); const k = await deviceKey(false); if (!k) return null; const inner = JSON.parse(dec.decode(await C.openBytes(k, o.box))); return { id: o.id, k: inner.k, rt: inner.rt }; } catch (e) { return null; }
  }
  const rememberedFor = (uid) => { try { const o = JSON.parse(lget(REM) || 'null'); return !!o && o.id === uid; } catch (e) { return false; } };
  async function persistSession() {
    if (!S.user || !S.rawDk || !S.tokens) return;
    const blob = { id: S.user.id, k: C.b64(S.rawDk), rt: S.tokens.refresh };
    try { g.sessionStorage.setItem(SESS, JSON.stringify(blob)); } catch (e) { /* optional */ }
    if (!S.remember) return;
    try { const k = await deviceKey(true); if (!k) return; lset(REM, JSON.stringify({ id: S.user.id, box: await C.sealBytes(k, enc.encode(JSON.stringify({ k: blob.k, rt: blob.rt }))) })); } catch (e) { /* remembering is optional */ }
  }
  function clearSession() { try { g.sessionStorage.removeItem(SESS); } catch (e) { /* ignore */ } ldel(REM); }

  /* ---------------------------------------------------------------- HTTP */
  const urlOf = (path) => (cfg.apiBase ? String(cfg.apiBase).replace(/\/+$/, '') + '/' : '') + path.replace(/^\//, '');
  async function send(method, path, body, token) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = 'Bearer ' + token;
    let res;
    try { res = await g.fetch(urlOf(path), { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store', credentials: 'omit' }); } catch (e) {
      const err = new Error('Cannot reach the ASTROMATE server. Check your connection and try again.'); err.network = true; throw err;
    }
    let data = null; const text = await res.text();
    if (text) { try { data = JSON.parse(text); } catch (e) { data = text; } }
    return { ok: res.ok, status: res.status, data };
  }
  function httpError(res) {
    const d = res.data; const err = new Error(d && typeof d === 'object' && typeof d.detail === 'string' ? d.detail : res.status === 404 ? 'Not found.' : 'The server answered with an error (' + res.status + ').');
    err.status = res.status; return err;
  }
  const withLock = (fn) => { const L = g.navigator && g.navigator.locks; return L && L.request ? L.request('astromate-refresh', fn) : fn(); };
  function setTokens(t) { S.tokens = { access: t.access_token, refresh: t.refresh_token, exp: Date.now() + (t.expires_in || 900) * 1000 }; }
  function dropSession(message) {
    const had = !!S.user;
    S.user = null; S.dk = null; S.rawDk = null; S.tokens = null; S.pver = {}; S.testsVersion = null; S.settings = null; S.settingsVersion = 0; S.remember = false;
    clearSession();
    if (had && AM.ui) { AM.ui.S.user = null; AM.ui.S.profiles = []; AM.ui.S.profileId = null; if (message) AM.ui.toast(message); AM.ui.go('/auth'); }
  }
  const sessionEnded = () => { const e = new Error('Your session has ended. Please sign in again.'); e.status = 401; return e; };

  /** Rotates the refresh token. In a "keep me signed in" session the newest token may have been stored by another tab, so it is adopted under a lock. */
  async function rotate() {
    let rt = S.tokens && S.tokens.refresh;
    if (S.remember && S.user) { const sh = await readRemembered(); if (sh && sh.id === S.user.id && sh.rt) rt = sh.rt; }
    if (!rt) return false;
    let res = await send('POST', 'api/auth/refresh', { refresh_token: rt });
    if (!res.ok && res.status === 401 && S.remember) { const sh = await readRemembered(); if (sh && sh.rt && sh.rt !== rt) res = await send('POST', 'api/auth/refresh', { refresh_token: sh.rt }); }
    if (!res.ok) return false;
    setTokens(res.data.tokens); if (res.data.user) S.user = pub(res.data.user);
    await persistSession();
    return true;
  }
  function refreshTokens() {
    if (!S.refreshing) {
      S.refreshing = (async () => { try { return await withLock(rotate); } finally { S.refreshing = null; } })();
    }
    return S.refreshing;
  }
  async function api(method, path, body, opts) {
    opts = opts || {};
    if (!opts.anon) {
      if (!S.tokens) throw new Error('Please sign in first.');
      if (Date.now() > S.tokens.exp - 30000 && !(await refreshTokens())) { dropSession('Your session has ended. Please sign in again.'); throw sessionEnded(); }
    }
    const used = opts.anon ? null : S.tokens.access;
    let res = await send(method, path, body, used);
    if (res.status === 401 && !opts.anon) {
      /* an access token ends with its session, so a request sent just before another request renewed the tokens fails with 401: repeat it with the new token */
      if (S.tokens && S.tokens.access !== used) res = await send(method, path, body, S.tokens.access);
      else if (await refreshTokens()) res = await send(method, path, body, S.tokens.access);
      if (res.status === 401) { dropSession('Your session has ended. Please sign in again.'); throw sessionEnded(); }
    }
    if (!res.ok) throw httpError(res);
    return res.data;
  }

  /* ---------------------------------------------------------------- settings, plan allowance */
  async function loadConfig() {
    const r = await api('GET', 'api/config');
    const changed = r.version !== S.settingsVersion;
    S.settings = r.settings || {}; S.settingsVersion = r.version; S.quota = r.quota; if (r.user) S.user = pub(r.user); S.cfgAt = Date.now();
    if (changed && AM.applySettings) AM.applySettings();
  }
  async function refreshQuota() { const r = await api('GET', 'api/me'); S.quota = r.quota; S.user = pub(r.user); }
  if (g.document) {
    g.document.addEventListener('visibilitychange', () => {
      if (!g.document.hidden && S.user && Date.now() - S.cfgAt > 30000) loadConfig().catch(() => null); /* pick up rule-set / plan changes made by an administrator */
    });
  }

  async function startSession(user, tokens, rawDk, remember) {
    S.user = pub(user); S.rawDk = rawDk; S.dk = await C.importDk(rawDk); setTokens(tokens); S.remember = !!remember; S.pver = {}; S.testsVersion = null;
    await persistSession();
    try { await loadConfig(); } catch (e) { if (e.network) throw e; /* otherwise keep the defaults */ }
  }

  /* ---------------------------------------------------------------- the store */
  const store = {
    mode: 'server',
    persistent: true,
    cryptoOK: !!subtle,
    problem: null,

    /** Fetches what the sign-in screen needs (whether any account exists, whether registration is open, the brand). */
    async init() {
      try {
        const info = await api('GET', 'api/public/info', undefined, { anon: true });
        S.info = Object.assign(S.info, info); store.problem = null;
      } catch (e) { store.problem = e.message; }
    },
    registrationOpen: () => S.info.registrationOpen !== false,
    current: () => S.user,
    hasUsers: () => !!S.info.hasUsers,

    /** Restore a signed-in session after a page reload (tab session, or "keep me signed in" on this device). */
    async restore() {
      try {
        if (!subtle) return null;
        let blob = null; let remembered = false;
        try { const s = JSON.parse(g.sessionStorage.getItem(SESS) || 'null'); if (s && s.id && s.k && s.rt) blob = s; } catch (e) { /* ignore */ }
        if (!blob) { blob = await readRemembered(); remembered = !!blob; }
        if (!blob) return null;
        const rawDk = C.unb64(blob.k);
        const res = await withLock(async () => {
          let rt = blob.rt;
          if (remembered || rememberedFor(blob.id)) { const sh = await readRemembered(); if (sh && sh.id === blob.id && sh.rt) rt = sh.rt; }
          return send('POST', 'api/auth/refresh', { refresh_token: rt });
        });
        if (!res.ok) { if (res.status === 401) clearSession(); return null; } /* a network problem keeps the stored session for next time */
        S.user = pub(res.data.user); S.rawDk = rawDk; S.dk = await C.importDk(rawDk); setTokens(res.data.tokens);
        S.remember = remembered || rememberedFor(blob.id); S.pver = {}; S.testsVersion = null;
        await persistSession();
        try { await loadConfig(); } catch (e) { /* defaults */ }
        return S.user;
      } catch (e) { return null; }
    },

    async register({ name, email, password }) {
      needCrypto();
      email = normEmail(email); name = String(name || '').trim();
      if (name.length < 2) throw new Error('Please enter your name.');
      if (name.length > 80) throw new Error('Please use a shorter name (80 characters at most).');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Please enter a valid email address.');
      if (String(password || '').length < 8) throw new Error('Choose a password of at least 8 characters.');
      const rawDk = C.rnd(32);
      const salt = C.b64(C.rnd(16)); const cred = await derive(password, salt, KDF_ITER);
      const rec = await makeRecovery(rawDk);
      const r = await api('POST', 'api/auth/register', {
        name, email, auth_secret: cred.auth, kdf: { salt, iter: KDF_ITER }, wrapped_dk: await C.sealBytes(cred.kek, rawDk), recovery: rec.material,
      }, { anon: true });
      await startSession(r.user, r.tokens, rawDk, false);
      S.info.hasUsers = true;
      return { user: S.user, recoveryCode: rec.code, firstAccount: !!r.first_account };
    },
    async login(email, password, remember) {
      needCrypto(); email = normEmail(email);
      const bad = new Error('The email or password is not correct.');
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const p = checkKdf(await api('POST', 'api/auth/kdf', { email }, { anon: true }), KDF_ITER);
        const cred = await derive(password, p.salt, p.iter);
        const r = await api('POST', 'api/auth/login', { email, auth_secret: cred.auth }, { anon: true });
        if (r.kdf.salt !== p.salt || r.kdf.iter !== p.iter) continue; /* the password was changed a moment ago: derive again with the new settings */
        let rawDk;
        try { rawDk = await C.openBytes(cred.kek, r.wrapped_dk); } catch (e) { send('POST', 'api/auth/logout', { refresh_token: r.tokens.refresh_token }).catch(() => null); throw bad; }
        await startSession(r.user, r.tokens, rawDk, !!remember);
        return S.user;
      }
      throw bad;
    },
    async logout() {
      const tokens = new Set();
      if (S.tokens) tokens.add(S.tokens.refresh);
      if (S.remember) { const sh = await readRemembered(); if (sh && sh.rt) tokens.add(sh.rt); }
      S.user = null; S.dk = null; S.rawDk = null; S.tokens = null; S.pver = {}; S.testsVersion = null; S.settings = null; S.settingsVersion = 0; S.remember = false;
      clearSession();
      for (const rt of tokens) { try { await send('POST', 'api/auth/logout', { refresh_token: rt }); } catch (e) { /* the server also expires sessions on its own */ } }
    },
    /** Changes the password and, at the same time, renews the recovery code (the old code stops working). Returns { recoveryCode }: show it to the user. */
    async changePassword(oldPw, newPw) {
      const u = needUser();
      if (String(newPw || '').length < 8) throw new Error('Choose a new password of at least 8 characters.');
      const p = checkKdf(await api('POST', 'api/auth/kdf', { email: u.email }, { anon: true }), KDF_ITER);
      const oldCred = await derive(oldPw, p.salt, p.iter);
      const salt = C.b64(C.rnd(16)); const nc = await derive(newPw, salt, KDF_ITER);
      const rec = await makeRecovery(S.rawDk);
      const r = await api('POST', 'api/auth/change-password', { old_auth_secret: oldCred.auth, new_auth_secret: nc.auth, kdf: { salt, iter: KDF_ITER }, wrapped_dk: await C.sealBytes(nc.kek, S.rawDk), recovery: rec.material });
      setTokens(r.tokens); await persistSession();
      return { recoveryCode: rec.code };
    },
    /** Sets a new password with the recovery code. The code is single-use: it is replaced by a new one at once. Returns { recoveryCode }: show it to the user. */
    async resetWithRecovery(email, code, newPw) {
      needCrypto(); email = normEmail(email);
      if (String(newPw || '').length < 8) throw new Error('Choose a new password of at least 8 characters.');
      const bad = new Error('The email or recovery code is not correct.');
      const p = checkKdf(await api('POST', 'api/auth/recover/kdf', { email }, { anon: true }), RECOVERY_ITER);
      const rc = await derive(normRecovery(code), p.salt, p.iter);
      const r = await api('POST', 'api/auth/recover/start', { email, recovery_auth_secret: rc.auth }, { anon: true });
      let rawDk;
      try { rawDk = await C.openBytes(rc.kek, { iv: r.recovery.iv, ct: r.recovery.ct }); } catch (e) { throw bad; }
      const salt = C.b64(C.rnd(16)); const nc = await derive(newPw, salt, KDF_ITER);
      const rec = await makeRecovery(rawDk);
      await api('POST', 'api/auth/recover/finish', { ticket: r.ticket, new_auth_secret: nc.auth, kdf: { salt, iter: KDF_ITER }, wrapped_dk: await C.sealBytes(nc.kek, rawDk), recovery: rec.material }, { anon: true });
      return { recoveryCode: rec.code };
    },
    /** Deletes the signed-in account and every byte of its data from the server. */
    async deleteMyAccount(password) {
      const u = needUser();
      const p = checkKdf(await api('POST', 'api/auth/kdf', { email: u.email }, { anon: true }), KDF_ITER);
      const cred = await derive(password, p.salt, p.iter);
      await api('POST', 'api/auth/delete-account', { auth_secret: cred.auth });
      await store.logout();
    },

    /* ------------------------------------------------------------ birth profiles (one encrypted record each) */
    async listProfiles() {
      needUser();
      const rows = await api('GET', 'api/profiles'); const out = []; S.pver = {};
      for (const r of rows) {
        try { const p = await C.openJSON(S.dk, { iv: r.iv, ct: r.ct }, aad('profile', r.id)); p.id = r.id; out.push(p); S.pver[r.id] = r.version; } catch (e) { console.error('A profile could not be decrypted and was skipped.', e); }
      }
      return out;
    },
    async getProfile(id) { return (await store.listProfiles()).find((p) => p.id === id) || null; },
    async saveProfile(p) {
      needUser();
      const rec = Object.assign({}, p, { updatedAt: Date.now() });
      if (!rec.createdAt) rec.createdAt = Date.now();
      if (rec.id && !(rec.id in S.pver)) await store.listProfiles(); /* learn the current version before updating */
      if (rec.id && rec.id in S.pver) {
        const box = await C.sealJSON(S.dk, rec, aad('profile', rec.id));
        const r = await api('PUT', 'api/profiles/' + encodeURIComponent(rec.id), { iv: box.iv, ct: box.ct, expected_version: S.pver[rec.id] });
        S.pver[rec.id] = r.version;
      } else {
        rec.id = rec.id || uuid();
        const box = await C.sealJSON(S.dk, rec, aad('profile', rec.id));
        const r = await api('POST', 'api/profiles', { id: rec.id, iv: box.iv, ct: box.ct });
        S.pver[rec.id] = r.version;
      }
      return rec;
    },
    async deleteProfile(id) { needUser(); await api('DELETE', 'api/profiles/' + encodeURIComponent(id)); delete S.pver[id]; },

    /* ------------------------------------------------------------ predictions */
    async listPredictions() {
      needUser();
      const [rows] = await Promise.all([api('GET', 'api/predictions'), refreshQuota().catch(() => null)]);
      const out = [];
      for (const r of rows) {
        try { const item = await C.openJSON(S.dk, r.summary, aad('pred-summary', r.id)); item.id = r.id; out.push(item); } catch (e) { console.error('A history entry could not be decrypted and was skipped.', e); }
      }
      return out;
    },
    async getPrediction(id) {
      needUser();
      let r;
      try { r = await api('GET', 'api/predictions/' + encodeURIComponent(id)); } catch (e) { if (e.status === 404 || e.status === 422) return null; throw e; }
      const rec = await C.openJSON(S.dk, r.data, aad('pred', r.id)); rec.id = r.id; return rec;
    },
    async savePrediction(result, extra) {
      const u = needUser();
      const id = uuid();
      const rec = Object.assign({}, result, { id, userId: u.id, savedAt: Date.now() }, extra || {});
      const item = { id, qid: result.question.id, cat: result.question.cat, text: result.question.text, short: result.question.short, date: result.event.date, time: result.event.time, verdict: result.verdict, confidence: result.confidence, score: result.score, profileId: rec.profileId || null, profileName: rec.profileName || '', savedAt: rec.savedAt, outcome: null };
      await api('POST', 'api/predictions', {
        id, data: await C.sealJSON(S.dk, rec, aad('pred', id)), summary: await C.sealJSON(S.dk, item, aad('pred-summary', id)),
        meta: { qid: result.question.id, cat: result.question.cat, event_date: result.event.date, verdict: result.verdict, occ: result.occurrence ? result.occurrence.verdict : null, conf: result.confidence, score: result.score, rule_version: String(result.ruleset.version).slice(0, 32), outcome: null },
      });
      S.quota = Object.assign({}, S.quota, { used: S.quota.used + 1 });
      return rec;
    },
    async updatePrediction(id, patch) {
      needUser();
      const r = await api('GET', 'api/predictions/' + encodeURIComponent(id));
      const rec = await C.openJSON(S.dk, r.data, aad('pred', r.id)); rec.id = r.id;
      Object.assign(rec, patch);
      const body = { data: await C.sealJSON(S.dk, rec, aad('pred', r.id)) };
      if (patch.outcome !== undefined) {
        const item = await C.openJSON(S.dk, r.summary, aad('pred-summary', r.id)); item.outcome = patch.outcome;
        body.summary = await C.sealJSON(S.dk, item, aad('pred-summary', r.id)); body.outcome_set = true; body.outcome = patch.outcome ? patch.outcome.result : null;
      }
      await api('PUT', 'api/predictions/' + encodeURIComponent(id), body);
      return rec;
    },
    async deletePrediction(id) { needUser(); await api('DELETE', 'api/predictions/' + encodeURIComponent(id)); },
    async clearPredictions() { needUser(); await api('DELETE', 'api/predictions'); },
    /** Consultations made today by the signed-in user (as last reported by the server). */
    todayCount() { needUser(); return S.quota.used; },
    quota() { needUser(); return { plan: S.quota.plan, limit: S.quota.limit, used: S.quota.used }; },

    /* ------------------------------------------------------------ historical tests (astrologer) */
    async listTests() {
      needUser();
      const r = await api('GET', 'api/blobs/tests'); S.testsVersion = r.version;
      return r.ct ? C.openJSON(S.dk, { iv: r.iv, ct: r.ct }, aad('tests', 'tests')) : [];
    },
    async saveTests(list) {
      needUser();
      if (S.testsVersion == null) await store.listTests();
      const box = await C.sealJSON(S.dk, list, aad('tests', 'tests'));
      const r = await api('PUT', 'api/blobs/tests', { iv: box.iv, ct: box.ct, expected_version: S.testsVersion });
      S.testsVersion = r.version;
    },

    /* ------------------------------------------------------------ settings & administration (central) */
    getSettings() { return AM.util.clone(AM.rules.deepMerge(AM.defaultSettings, S.settings || (S.info.brand ? { brand: S.info.brand } : {}))); },
    async saveSettings(s) {
      needRole(['admin']);
      const r = await api('PUT', 'api/admin/settings', { value: s, expected_version: S.settingsVersion });
      S.settings = AM.util.clone(s); S.settingsVersion = r.version;
    },
    async listUsers() { needRole(['admin']); return api('GET', 'api/admin/users'); },
    async setUserRole(id, role) {
      needRole(['admin']);
      if (!['user', 'astrologer', 'admin'].includes(role)) throw new Error('Unknown role.');
      await api('PATCH', 'api/admin/users/' + encodeURIComponent(id), { role });
      if (S.user && S.user.id === id) S.user.role = role;
    },
    async setUserStatus(id, status) { needRole(['admin']); await api('PATCH', 'api/admin/users/' + encodeURIComponent(id), { status }); },
    async setUserPlan(id, plan) { needRole(['admin']); await api('PATCH', 'api/admin/users/' + encodeURIComponent(id), { plan }); },
    async deleteUser(id) {
      const me = needRole(['admin']);
      if (id === me.id) throw new Error('Use "Delete my account" in your profile to remove your own account.');
      await api('DELETE', 'api/admin/users/' + encodeURIComponent(id));
    },
    /** Non-identifying prediction metadata for reports (no names, birth data or notes). */
    async predictionMeta() { needRole(['admin', 'astrologer']); return api('GET', 'api/meta'); },
    async auditLog() { needRole(['admin']); return api('GET', 'api/admin/audit?limit=200'); },

    /* ------------------------------------------------------------ backup: the server holds the data, so there is nothing to export here */
    async exportBackup() { throw new Error('In the server edition your data is stored on the server; the administrator backs up the server database.'); },
    async importBackup() { throw new Error('In the server edition your data is stored on the server; there is no backup file to import.'); },
    wipeEverything() {
      try { for (let i = g.localStorage.length - 1; i >= 0; i -= 1) { const k = g.localStorage.key(i); if (k && k.indexOf(PFX) === 0) g.localStorage.removeItem(k); } } catch (e) { /* ignore */ }
      try { g.sessionStorage.removeItem(SESS); } catch (e) { /* ignore */ }
    },
    /* for the server test page: the pieces of state it needs to inspect */
    _debug: () => ({ tokens: S.tokens, pver: S.pver, settingsVersion: S.settingsVersion, remember: S.remember }),
    _derive: derive,
    _setTestsVersion: (v) => { S.testsVersion = v; },
    _forceExpire: () => { if (S.tokens) S.tokens.exp = 0; },
    _breakAccess: () => { if (S.tokens) S.tokens.access = 'invalid.token.value'; },
    _refresh: () => refreshTokens(),
  };
  AM.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
