/* ASTROMATE UI kernel: safe HTML templates, hash router, event delegation, shell (top bar, sidebar, bottom navigation), shared components. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const doc = g.document;

  /* ------------------------------------------------------------- safe html */
  class Safe { constructor(s) { this.s = s; } toString() { return this.s; } }
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const raw = (s) => new Safe(String(s == null ? '' : s));
  function toHtml(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Safe) return v.s;
    if (Array.isArray(v)) return v.map(toHtml).join('');
    return esc(v);
  }
  function html(strings, ...vals) { let out = strings[0]; for (let i = 0; i < vals.length; i += 1) out += toHtml(vals[i]) + strings[i + 1]; return new Safe(out); }

  /* ------------------------------------------------------------- state */
  const S = { user: null, profiles: [], profileId: null, chart: null, question: null, event: null, result: null, prefs: loadPrefs() };
  function loadPrefs() { try { return Object.assign({ chartStyle: 'north', h24: true }, JSON.parse(g.localStorage.getItem('am1:prefs') || '{}')); } catch (e) { return { chartStyle: 'north', h24: true }; } }
  function savePrefs() { try { g.localStorage.setItem('am1:prefs', JSON.stringify(S.prefs)); } catch (e) { /* ignore */ } }

  /* ------------------------------------------------------------- icons & logo */
  const ICON = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    horoscope: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4"/>',
    questions: '<circle cx="12" cy="12" r="10"/><path d="M9.2 9.2a3 3 0 1 1 4.6 2.5c-1 .6-1.8 1.2-1.8 2.5"/><circle cx="12" cy="17.6" r=".6"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
    astro: '<circle cx="12" cy="12" r="2.2"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)"/><circle cx="19" cy="7" r="1.2"/>',
    admin: '<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
  };
  const icon = (name) => raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>');
  function logo(cls) {
    let ticks = '';
    for (let i = 0; i < 12; i += 1) { const a = (i * 30 * Math.PI) / 180; ticks += '<line x1="' + (32 + 24.5 * Math.sin(a)).toFixed(2) + '" y1="' + (32 - 24.5 * Math.cos(a)).toFixed(2) + '" x2="' + (32 + 28 * Math.sin(a)).toFixed(2) + '" y2="' + (32 - 28 * Math.cos(a)).toFixed(2) + '"/>'; }
    return raw('<svg class="logo ' + (cls || '') + '" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" fill="#0b1636" stroke="url(#amgold)" stroke-width="2.2"/><g stroke="url(#amgold)" stroke-width="1.3">' + ticks + '</g><ellipse cx="32" cy="32" rx="21" ry="8.5" transform="rotate(-28 32 32)" fill="none" stroke="url(#amgold)" stroke-width="1.7"/><circle cx="32" cy="32" r="4.4" fill="url(#amgold)"/><circle cx="49.6" cy="24" r="2.7" fill="#f1d28a"/></svg>');
  }
  const wordmark = () => html`<span class="wordmark"><b>ASTROMATE</b><span>100 QUERY MASTER</span></span>`;

  /* ------------------------------------------------------------- feedback */
  let toastTimer = null;
  function toast(msg, ms) {
    let el = doc.getElementById('am-toast');
    if (!el) { el = doc.createElement('div'); el.id = 'am-toast'; el.className = 'toast'; el.setAttribute('role', 'status'); doc.body.appendChild(el); }
    el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, ms || 3600);
  }
  const fail = (err) => { console.error(err); toast((err && err.message) || String(err), 5200); };
  function modal(view) {
    closeModal();
    const d = doc.createElement('div'); d.className = 'modal-back'; d.id = 'am-modal';
    d.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + toHtml(view) + '</div>';
    d.addEventListener('mousedown', (e) => { if (e.target === d && !d.dataset.sticky) closeModal(); });
    doc.body.appendChild(d);
    return d;
  }
  function closeModal() { const m = doc.getElementById('am-modal'); if (m) m.remove(); }
  function confirmBox(message, okLabel, danger) {
    return new Promise((resolve) => {
      modal(html`<h3>Please confirm</h3><p class="muted">${message}</p><div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="cfm-no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-act="cfm-yes">${okLabel || 'Confirm'}</button></div>`);
      acts['cfm-yes'] = () => { closeModal(); resolve(true); };
      acts['cfm-no'] = () => { closeModal(); resolve(false); };
    });
  }

  /* ------------------------------------------------------------- events */
  const acts = {}; const forms = {}; const inputs = {}; const changes = {};
  const on = (name, fn) => { acts[name] = fn; };
  doc.addEventListener('click', async (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = acts[el.dataset.act];
    if (!fn) return;
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    try { await fn(el, e); } catch (err) { fail(err); }
  });
  doc.addEventListener('submit', async (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = forms[f.dataset.form];
    if (!fn) return;
    const btn = f.querySelector('button[type=submit]'); if (btn) btn.disabled = true;
    try { await fn(f, new FormData(f), e); } catch (err) { fail(err); } finally { if (btn) btn.disabled = false; }
  });
  doc.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el && inputs[el.dataset.input]) { try { inputs[el.dataset.input](el, e); } catch (err) { fail(err); } } });
  doc.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el && changes[el.dataset.change]) { try { changes[el.dataset.change](el, e); } catch (err) { fail(err); } } });

  /* ------------------------------------------------------------- router */
  const routes = {};
  let current = { name: 'welcome', params: [] };
  function route(name, def) { routes[name] = def; }
  const go = (path) => { if (g.location.hash === '#' + path) render(); else g.location.hash = '#' + path; };
  function parseHash() {
    const h = (g.location.hash || '#/').slice(1);
    const parts = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || (S.user ? 'home' : 'welcome'), params: parts.slice(1) };
  }
  let renderSeq = 0;
  async function render() {
    const seq = (renderSeq += 1);
    current = parseHash();
    const def = routes[current.name] || routes.notfound;
    closeModal();
    if (!def.public && !S.user) { g.location.replace('#/auth'); return; }
    if (def.roles && S.user && !def.roles.includes(S.user.role)) { toast('That area is for ' + def.roles.join(' or ') + ' accounts.'); g.location.replace('#/home'); return; }
    const app = doc.getElementById('app');
    let view;
    try { view = await def.view.apply(null, current.params); } catch (err) { console.error(err); view = html`<div class="card"><h3>Something went wrong</h3><p class="muted">${err.message || err}</p><a class="btn" href="#/home">Back to home</a></div>`; }
    if (seq !== renderSeq) return;
    app.innerHTML = toHtml(def.bare ? view : shell(view, def));
    g.scrollTo(0, 0);
    if (def.after) { try { def.after.apply(null, current.params); } catch (err) { console.error(err); } }
    doc.title = (def.title ? def.title + ' - ' : '') + 'ASTROMATE 100 Query Master';
  }
  g.addEventListener('hashchange', render);

  /* ------------------------------------------------------------- shell */
  const NAV = [['home', 'Home', 'home'], ['horoscope', 'My Horoscope', 'horoscope'], ['questions', '100 Questions', 'questions'], ['history', 'My Predictions', 'history'], ['profile', 'Profile', 'profile']];
  function shell(content, def) {
    const u = S.user; const active = def.nav || current.name;
    const link = (k, label, ic) => html`<a class="nav ${k === active ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${label}</span></a>`;
    const roleLinks = [];
    if (u && (u.role === 'astrologer' || u.role === 'admin')) roleLinks.push(link('astro', 'Astrologer Dashboard', 'astro'));
    if (u && u.role === 'admin') roleLinks.push(link('admin', 'Administrator', 'admin'));
    return html`<div class="app">
      <aside class="sidebar"><a class="brand" href="#/home">${logo()}${wordmark()}</a>
        ${NAV.map(([k, l, ic]) => link(k, l, ic))}
        ${roleLinks.length ? html`<div class="sep"></div>${roleLinks}` : ''}
        <div class="foot">${u ? html`Signed in as <b>${u.name}</b><br>${u.role}` : ''}<br>v${AM.APP_VERSION} - engine ${AM.ENGINE_VERSION}</div></aside>
      <div class="col">
        <header class="topbar"><a class="brand" href="#/home">${logo()}${wordmark()}</a><div class="title">${def.title || ''}</div>${u ? html`<a class="tag" href="#/profile" title="Your profile">${u.name.split(' ')[0]}</a>` : ''}</header>
        <main class="main">${content}<p class="footer-note">Astrology is a traditional interpretive system. ASTROMATE reports planetary indications, not guarantees, and is not medical, legal or financial advice.</p></main>
      </div>
      <nav class="bottomnav" aria-label="Main">${NAV.map(([k, l, ic]) => html`<a class="${k === active ? 'on' : ''}" href="#/${k}">${icon(ic)}<span>${l}</span></a>`)}</nav>
    </div>`;
  }

  /* ------------------------------------------------------------- components */
  const verdictTag = (v) => html`<span class="tag ${String(v).toLowerCase()}">${v}</span>`;
  const meter = (pct, cls) => html`<div class="meter ${cls || ''}"><i style="width:${Math.max(2, Math.min(100, pct)).toFixed(0)}%"></i></div>`;
  const kv = (pairs) => html`<dl class="kv">${pairs.filter(Boolean).map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
  function table(head, rows, opts) {
    const o = opts || {};
    return html`<div class="tablewrap"><table><thead><tr>${head.map((h) => html`<th class="${o.num && o.num.includes(h) ? 'num' : ''}">${h}</th>`)}</tr></thead><tbody>${rows.map((r) => html`<tr>${r.map((c, i) => html`<td class="${o.num && o.num.includes(head[i]) ? 'num' : ''} ${o.nowrap && o.nowrap.includes(head[i]) ? 'nowrap' : ''}">${c}</td>`)}</tr>`)}</tbody></table></div>`;
  }
  const deltaSpan = (d) => html`<span class="delta ${d > 0.05 ? 'pos-t' : d < -0.05 ? 'neg-t' : 'neu-t'}">${d > 0 ? '+' : ''}${d.toFixed(1)}</span>`;
  const sgn = (d) => (d > 0 ? '+' : '') + Math.round(d);
  function download(filename, mime, text) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const a = doc.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; doc.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  /* CSV cell: quoted, and neutralised against spreadsheet formula injection (a leading = + - @ would otherwise run as a formula) */
  const csvCell = (s) => { let t = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const val = (f, k) => String(f.get(k) == null ? '' : f.get(k)).trim();

  /* chart used by the screens: recomputed from the active profile so it always uses the current engine */
  function profileById(id) { return S.profiles.find((p) => p.id === id) || null; }
  function activeProfile() { return profileById(S.profileId) || S.profiles[0] || null; }
  function chartOf(profile) {
    if (!profile) return null;
    const key = profile.id + ':' + (profile.updatedAt || 0) + ':' + AM.ENGINE_VERSION;
    if (S._ck !== key) { S._chart = AM.vedic.buildChart(profile); S._ck = key; }
    return S._chart;
  }
  const calcDefaults = () => AM.store.getSettings().calc;

  AM.ui = {
    S, html, raw, esc, toHtml, icon, logo, wordmark, toast, fail, modal, closeModal, confirmBox, on, forms, inputs, changes, route, go, render, shell,
    verdictTag, meter, kv, table, deltaSpan, sgn, download, csvCell, debounce, val, profileById, activeProfile, chartOf, savePrefs, calcDefaults, current: () => current,
    acts,
  };
})(typeof window !== 'undefined' ? window : globalThis);
