/* ASTROMATE user application screens: welcome, sign in, birth profile, natal horoscope, 100 questions, event details,
   analysis progress, prediction, detailed analysis, history and profile. */
(function (g) {
  'use strict';
  const AM = g.AM; const U = AM.ui;
  const { html, raw, esc, S, on, forms, inputs, changes, route, go, toast, fail, modal, closeModal, confirmBox, verdictTag, meter, kv, table, deltaSpan, sgn, download, val } = U;
  const ord = AM.fmt.ordinal;
  const doc = g.document;
  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const OUTCOME = { YES: 'It went my way', NO: 'It did not', MAYBE: 'Partly / mixed' };

  /* ---------------------------------------------------------------- common bits */
  function planetChip(p) { return html`<span class="pill" style="color:${AM.charts.PCOL[p]}">${AM.PLANET[p].abbr}</span> ${p}`; }
  function flagsOf(b) { const f = []; if (b.retro && b.name !== 'Rahu' && b.name !== 'Ketu') f.push('R'); if (b.combust) f.push('Combust'); if (b.vargottama) f.push('Vargottama'); if (b.digbala) f.push('Digbala'); if (b.nb && b.nb.count) f.push('Neecha Bhanga'); return f.join(', ') || '-'; }
  function hourFmt() { return S.prefs.h24 !== false; }
  function offsetHint(place, y, mo, d, h, mi) {
    if (!place || (!place.tz && place.offsetMin == null)) return '';
    try {
      const utc = AM.time.localToUtcMs(place, y || 2000, mo || 1, d || 1, h == null ? 12 : h, mi || 0);
      return (place.tz ? place.tz + ' - ' : '') + AM.fmt.offsetText(AM.time.zoneOffsetMs(place, utc)) + (y ? ' on that date' : '');
    } catch (e) { return ''; }
  }
  /* searchable city selector with time-zone resolution (built-in list + optional online lookup) */
  function cityField(prefix, place, label, hintDate) {
    const p = place || {};
    return html`<div class="field combo" data-city="${prefix}">
      <label for="${prefix}_q">${label}</label>
      <input id="${prefix}_q" name="${prefix}_q" type="text" autocomplete="off" placeholder="Type a city, for example Pune" value="${p.name || ''}" data-input="city">
      <input type="hidden" name="${prefix}_lat" value="${p.lat == null ? '' : p.lat}"><input type="hidden" name="${prefix}_lon" value="${p.lon == null ? '' : p.lon}"><input type="hidden" name="${prefix}_tz" value="${p.tz || ''}"><input type="hidden" name="${prefix}_name" value="${p.name || ''}">
      <div class="list" hidden></div>
      <div class="hint" data-tzinfo>${p.tz ? 'Time zone: ' + offsetHint(p, hintDate && hintDate.y, hintDate && hintDate.mo, hintDate && hintDate.d) : 'Pick a city from the list; the time zone is resolved automatically.'}</div>
    </div>`;
  }
  function cityListHtml(items, q, online) {
    const rows = items.map((c, i) => html`<button type="button" data-act="pick-city" data-i="${i}"><b>${c.name}</b><small>${[c.region, c.country].filter(Boolean).join(', ')} - ${c.tz}${c.online ? ' (online)' : ''}</small></button>`);
    const more = online ? '' : html`<button type="button" data-act="city-online"><b>Search online for "${q}"</b><small>Sends only the typed place name to open-meteo.com</small></button>`;
    return html`${rows}${items.length ? '' : html`<div class="small muted" style="padding:10px 12px">No match in the built-in list.</div>`}${more}`;
  }
  const cityCache = new WeakMap();
  inputs.city = (el) => {
    const root = el.closest('[data-city]'); const list = root.querySelector('.list'); const q = el.value.trim();
    for (const k of ['lat', 'lon', 'tz', 'name']) root.querySelector('input[name$="_' + k + '"]').value = '';
    root.querySelector('[data-tzinfo]').textContent = 'Pick a city from the list; the time zone is resolved automatically.';
    if (q.length < 2) { list.hidden = true; return; }
    const items = AM.cities.search(q, 8); cityCache.set(root, { items, q });
    list.innerHTML = U.toHtml(cityListHtml(items, q, false)); list.hidden = false;
  };
  function applyCity(root, c) {
    const set = (k, v) => { root.querySelector('input[name$="_' + k + '"]').value = v; };
    set('lat', c.lat); set('lon', c.lon); set('tz', c.tz); set('name', c.name);
    root.querySelector('input[type=text]').value = c.name + (c.region ? ', ' + c.region : '');
    root.querySelector('.list').hidden = true;
    const form = root.closest('form'); let hd = null;
    if (form && form.dataset.form === 'birth') hd = { y: +form.elements.year.value || null, mo: +form.elements.month.value || null, d: +form.elements.day.value || null };
    root.querySelector('[data-tzinfo]').textContent = 'Time zone: ' + offsetHint(c, hd && hd.y, hd && hd.mo, hd && hd.d);
  }
  on('pick-city', (el) => { const root = el.closest('[data-city]'); const cc = cityCache.get(root); applyCity(root, cc.items[+el.dataset.i]); });
  on('city-online', async (el) => {
    const root = el.closest('[data-city]'); const cc = cityCache.get(root); const list = root.querySelector('.list');
    list.innerHTML = '<div class="small muted" style="padding:10px 12px"><span class="spinner"></span> Searching online...</div>';
    try { const items = await AM.cities.searchOnline(cc.q); cityCache.set(root, { items, q: cc.q }); list.innerHTML = U.toHtml(cityListHtml(items, cc.q, true)); if (!items.length) list.innerHTML = '<div class="small muted" style="padding:10px 12px">Nothing found online either. Use manual coordinates.</div>'; } catch (e) { list.innerHTML = '<div class="small neg-t" style="padding:10px 12px">Online lookup is not available right now (offline?). Use the built-in list or enter coordinates manually.</div>'; }
  });
  doc.addEventListener('click', (e) => { if (!e.target.closest('[data-city]')) doc.querySelectorAll('[data-city] .list').forEach((l) => { l.hidden = true; }); });
  function placeFromForm(f, prefix) {
    const lat = parseFloat(f.get(prefix + '_lat')); const lon = parseFloat(f.get(prefix + '_lon')); const tz = val(f, prefix + '_tz');
    if (isNaN(lat) || isNaN(lon) || !tz) return null;
    return { name: val(f, prefix + '_name') || val(f, prefix + '_q'), lat, lon, tz };
  }

  /* ---------------------------------------------------------------- welcome & home */
  function hero(signedIn) {
    const brand = AM.store.getSettings().brand;
    return html`<section class="hero">${U.logo()}<h1>ASTROMATE</h1><div class="sub">100 QUERY MASTER</div>
      <p class="lead">Your Personal Daily Professional Astrology Companion</p>
      <p class="tagline">${brand.tagline}</p>
      <div class="row" style="justify-content:center;margin-top:20px"><button class="btn primary" data-act="start" style="min-width:240px;min-height:52px">START CONSULTATION</button>${signedIn ? '' : html`<a class="btn ghost" href="#/auth">Sign in</a>`}</div></section>
      <div class="steps"><div class="step"><b>1 Birth profile</b>${AM.store.mode === 'server' ? 'Enter your birth details once; they are encrypted in your browser before they are stored.' : 'Enter your birth details once; they stay encrypted on this device.'}</div><div class="step"><b>2 Natal horoscope</b>An Indian-style Vedic chart: Lahiri ayanamsha, whole-sign houses.</div><div class="step"><b>3 Pick a question</b>100 daily professional questions in 10 categories.</div><div class="step"><b>4 Prediction</b>Natal promise, transit Moon trigger and other transits give YES, NO or MAYBE.</div></div>`;
  }
  on('start', () => { if (!S.user) go('/auth'); else go('/birth'); });
  route('welcome', { public: true, bare: true, title: 'Welcome', view: () => html`<div class="main" style="padding-top:28px">${hero(false)}<p class="footer-note">Astrology is a traditional interpretive system; results are indications, not guarantees.</p></div>` });
  route('home', {
    title: 'Home', nav: 'home',
    async view() {
      const p = U.activeProfile(); const idx = (await AM.store.listPredictions()).slice(0, 3); const q = AM.store.quota();
      return html`${hero(true)}
      <div class="grid g3">
        <div class="card flat"><h4>Active birth profile</h4>${p ? html`<p><b>${p.name}</b><br><span class="muted small">${p.d} ${MONTH_NAMES[p.mo - 1]} ${p.y}, ${p.accuracy === 'unknown' ? 'time unknown' : String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0')} - ${p.place.name}</span></p><a class="btn small" href="#/horoscope">View horoscope</a>` : html`<p class="muted">No profile yet.</p><a class="btn small primary" href="#/birth">Create birth profile</a>`}</div>
        <div class="card flat"><h4>Today's consultations</h4><p><b>${q.used}</b> of ${q.limit} on the ${q.plan} plan</p>${meter((q.used / q.limit) * 100)}</div>
        <div class="card flat"><h4>Recent predictions</h4>${idx.length ? html`<ul class="list-plain">${idx.map((r) => html`<li><a href="#/result/${r.id}">${verdictTag(r.verdict)} ${r.short}</a><br><span class="faint small">${AM.fmt.isoDateText(r.date)}</span></li>`)}</ul>` : html`<p class="muted">Nothing yet. Ask your first question.</p>`}</div>
      </div>`;
    },
  });

  /* ---------------------------------------------------------------- authentication */
  let authTab = 'login';
  async function afterSignIn() {
    S.user = AM.store.current(); S.profiles = await AM.store.listProfiles();
    try { const last = g.localStorage.getItem('am1:lastProfile'); S.profileId = S.profiles.some((p) => p.id === last) ? last : S.profiles[0] && S.profiles[0].id; } catch (e) { S.profileId = S.profiles[0] && S.profiles[0].id; }
    AM.applySettings();
  }
  AM.afterSignIn = afterSignIn;
  function authView() {
    const first = !AM.store.hasUsers();
    if (first) authTab = 'register';
    const regOpen = first || AM.store.registrationOpen();
    if (!regOpen && authTab === 'register') authTab = 'login';
    const tabs = html`<div class="seg" style="width:100%;margin-bottom:14px">${[['login', 'Sign in'], ['register', 'Create account'], ['recover', 'Forgot password']].filter(([k]) => k !== 'register' || regOpen).map(([k, l]) => html`<button type="button" class="${authTab === k ? 'on' : ''}" data-act="auth-tab" data-tab="${k}" style="flex:1">${l}</button>`)}</div>`;
    let body;
    if (authTab === 'login') body = html`<form data-form="login"><div class="field"><label for="le">Email</label><input id="le" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="lp">Password</label><input id="lp" name="password" type="password" autocomplete="current-password" required></div><label class="check" style="margin-bottom:14px"><input type="checkbox" name="remember"> Keep me signed in on this device</label><button class="btn primary block" type="submit">SIGN IN</button></form>`;
    else if (authTab === 'register') body = html`${first ? html`<div class="banner">${AM.store.mode === 'server' ? 'This server has no accounts yet.' : 'This device has no accounts yet.'} <b>The first account becomes the administrator</b> and can later promote other accounts to Astrologer or Administrator.</div>` : ''}<form data-form="register"><div class="field"><label for="rn">Your name</label><input id="rn" name="name" autocomplete="name" required></div><div class="field"><label for="re">Email</label><input id="re" name="email" type="email" autocomplete="username" required></div><div class="field"><label for="rp">Password</label><input id="rp" name="password" type="password" autocomplete="new-password" minlength="8" required><span class="hint">At least 8 characters. It protects your birth data: it cannot be reset by anyone, so keep the recovery code you will be shown.</span></div><button class="btn primary block" type="submit">CREATE ACCOUNT</button></form>`;
    else body = html`<p class="muted small">Enter the email and the 20-character recovery code shown when you created the account.</p><form data-form="recover"><div class="field"><label for="ce">Email</label><input id="ce" name="email" type="email" required></div><div class="field"><label for="cc">Recovery code</label><input id="cc" name="code" placeholder="XXXXX-XXXXX-XXXXX-XXXXX" required></div><div class="field"><label for="cp">New password</label><input id="cp" name="password" type="password" minlength="8" autocomplete="new-password" required></div><button class="btn primary block" type="submit">SET NEW PASSWORD</button></form>`;
    const warn = AM.store.problem ? html`<div class="banner bad">${AM.store.problem}</div>` : !AM.store.cryptoOK ? html`<div class="banner bad">This page is not in a secure context, so encrypted storage is unavailable. Open the app from its https:// address (or localhost).</div>` : !AM.store.persistent ? html`<div class="banner warn">Your browser is blocking local storage (private mode?). Accounts will be lost when this tab closes.</div>` : '';
    return html`<div class="main" style="padding-top:24px"><div class="authbox"><div class="center" style="margin-bottom:14px">${U.logo('')}<div style="margin-top:8px"><b style="letter-spacing:.24em;color:var(--ivory)">ASTROMATE</b><br><span style="letter-spacing:.4em;font-size:.65rem;color:var(--gold)">100 QUERY MASTER</span></div></div>${warn}<div class="card">${tabs}${body}</div><p class="footer-note">${AM.store.mode === 'server' ? 'Your birth data is encrypted in your browser with a key derived from your password before it is sent: the server stores only ciphertext it cannot read.' : 'Your birth data never leaves this device. It is stored encrypted with a key derived from your password.'}${regOpen ? '' : ' New registrations are closed on this server.'}</p></div></div>`;
  }
  route('auth', { public: true, bare: true, title: 'Sign in', view: authView });
  on('auth-tab', (el) => { authTab = el.dataset.tab; U.render(); });
  forms.login = async (f, d) => { await AM.store.login(val(d, 'email'), String(d.get('password')), d.get('remember') === 'on'); await afterSignIn(); toast('Welcome back, ' + S.user.name.split(' ')[0] + '.'); go('/home'); };
  forms.register = async (f, d) => {
    const r = await AM.store.register({ name: val(d, 'name'), email: val(d, 'email'), password: String(d.get('password')) });
    await afterSignIn();
    const m = modal(html`<h3>Save your recovery code</h3><p class="muted">If you forget your password this code is the only way to get your encrypted data back. Write it down or save it somewhere safe. It is shown once.</p><div class="code center" style="font-size:1.2rem;letter-spacing:.12em;color:var(--gold2)">${r.recoveryCode}</div>${r.firstAccount ? html`<div class="banner" style="margin-top:12px">You are the <b>administrator</b> of this installation.</div>` : ''}<div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-act="copy-code" data-code="${r.recoveryCode}">Copy</button><button class="btn primary" data-act="code-saved">I have saved it</button></div>`);
    m.dataset.sticky = '1';
  };
  on('copy-code', async (el) => { try { await g.navigator.clipboard.writeText(el.dataset.code); toast('Recovery code copied.'); } catch (e) { toast('Copy failed: please write the code down.'); } });
  on('code-saved', () => { closeModal(); go('/home'); });
  on('code-saved-stay', () => closeModal());
  /** The server edition renews the recovery code whenever it is used or the password changes: show the new one (the old one no longer works). */
  function renewedCodeModal(code, why) {
    const m = modal(html`<h3>Save your new recovery code</h3><p class="muted">${why} The previous code no longer works. Write the new one down or save it somewhere safe. It is shown once.</p><div class="code center" style="font-size:1.2rem;letter-spacing:.12em;color:var(--gold2)">${code}</div><div class="row" style="margin-top:14px;justify-content:flex-end"><button class="btn ghost" data-act="copy-code" data-code="${code}">Copy</button><button class="btn primary" data-act="code-saved-stay">I have saved it</button></div>`);
    m.dataset.sticky = '1';
  }
  forms.recover = async (f, d) => {
    const r = await AM.store.resetWithRecovery(val(d, 'email'), val(d, 'code'), String(d.get('password')));
    authTab = 'login'; await U.render();
    if (r && r.recoveryCode) renewedCodeModal(r.recoveryCode, 'Your password was reset, and the recovery code you just used was replaced by this one.'); else toast('Password updated. You can sign in now.');
  };

  /* ---------------------------------------------------------------- screen 2: birth profile */
  async function birthView(id) {
    const edit = id ? U.profileById(id) : null; const c = U.calcDefaults();
    const saved = S.profiles.length ? html`<div class="card"><h3>Saved birth profiles</h3><ul class="list-plain">${S.profiles.map((p) => html`<li class="row between"><span><b>${p.name}</b>${p.id === S.profileId ? html` <span class="tag">active</span>` : ''}<br><span class="muted small">${p.d} ${MONTH_NAMES[p.mo - 1]} ${p.y}${p.accuracy === 'unknown' ? ', time unknown' : ', ' + String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0')} - ${p.place.name}</span></span><span class="row tight"><button class="btn small primary" data-act="use-profile" data-id="${p.id}">Use</button><a class="btn small" href="#/birth/${p.id}">Edit</a><button class="btn small danger" data-act="del-profile" data-id="${p.id}">Delete</button></span></li>`)}</ul></div>` : '';
    const v = edit || {};
    const t = edit && edit.accuracy !== 'unknown' ? String(edit.h).padStart(2, '0') + ':' + String(edit.mi).padStart(2, '0') : '';
    return html`<h2>${edit ? 'Edit birth profile' : 'Your birth profile'}</h2>${saved}
    <div class="card"><h3>${edit ? 'Edit ' + edit.name : S.profiles.length ? 'Add another person' : 'Enter your birth details'}</h3>
    <form data-form="birth" data-id="${edit ? edit.id : ''}" autocomplete="off" novalidate>
      <div class="field"><label for="bn">Name</label><input id="bn" name="name" value="${v.name || ''}" required></div>
      <div class="fgrid c3"><div class="field"><label for="bd">Date of birth (day)</label><input id="bd" name="day" type="number" min="1" max="31" inputmode="numeric" value="${v.d || ''}" required></div>
      <div class="field"><label for="bm">Birth month</label><select id="bm" name="month" required><option value="">Month</option>${MONTH_NAMES.map((m, i) => html`<option value="${i + 1}" ${v.mo === i + 1 ? 'selected' : ''}>${m}</option>`)}</select></div>
      <div class="field"><label for="by">Birth year</label><input id="by" name="year" type="number" min="1800" max="2200" inputmode="numeric" value="${v.y || ''}" required></div></div>
      <div class="fgrid"><div class="field"><label for="bt">Birth time</label><input id="bt" name="time" type="time" value="${t}" ${v.accuracy === 'unknown' ? 'disabled' : ''}><span class="hint">Local clock time as recorded at birth.</span></div>
      <div class="field"><label for="ba">Birth time accuracy</label><select id="ba" name="accuracy" data-change="accuracy"><option value="exact" ${(v.accuracy || 'exact') === 'exact' ? 'selected' : ''}>Exact (from a certificate or record)</option><option value="approx" ${v.accuracy === 'approx' ? 'selected' : ''}>Approximate (within about 30 minutes)</option><option value="unknown" ${v.accuracy === 'unknown' ? 'selected' : ''}>Unknown (Moon-sign chart)</option></select></div></div>
      ${cityField('bp', v.place, 'Birthplace', v.y ? { y: v.y, mo: v.mo, d: v.d } : null)}
      <details class="fold"><summary>Advanced: manual coordinates, time zone and calculation options</summary><div class="body">
        <p class="small muted">Use these only if your place is not in the list. A manual UTC offset overrides the time zone (for example historical local mean time).</p>
        <div class="fgrid c4"><div class="field"><label for="ml">Latitude</label><input id="ml" name="mlat" type="number" step="0.0001" placeholder="19.0760"></div><div class="field"><label for="mo">Longitude</label><input id="mo" name="mlon" type="number" step="0.0001" placeholder="72.8777"></div><div class="field"><label for="mt">IANA time zone</label><input id="mt" name="mtz" placeholder="Asia/Kolkata"></div><div class="field"><label for="mf">UTC offset (minutes)</label><input id="mf" name="moff" type="number" step="1" placeholder="330"></div></div>
        <div class="fgrid"><div class="field"><label for="bay">Ayanamsha</label><select id="bay" name="ayanamsa">${Object.keys(AM.eph.AYAN).map((k) => html`<option value="${k}" ${(v.ayanamsa || c.ayanamsa) === k ? 'selected' : ''}>${AM.eph.AYAN[k].name}</option>`)}</select></div>
        <div class="field"><label for="bnd">Rahu / Ketu</label><select id="bnd" name="node"><option value="mean" ${(v.node || c.node) === 'mean' ? 'selected' : ''}>Mean node (default)</option><option value="true" ${(v.node || c.node) === 'true' ? 'selected' : ''}>True node (approximate)</option></select></div></div></div></details>
      <div id="birth-msg"></div>
      <button class="btn primary block" type="submit" style="margin-top:8px">GENERATE MY NATAL HOROSCOPE</button>
    </form></div>`;
  }
  route('birth', { title: 'Birth profile', nav: 'horoscope', view: birthView });
  changes.accuracy = (el) => { const t = el.form.elements.time; t.disabled = el.value === 'unknown'; };
  on('use-profile', (el) => { S.profileId = el.dataset.id; try { g.localStorage.setItem('am1:lastProfile', S.profileId); } catch (e) { /* ignore */ } go('/horoscope'); });
  on('del-profile', async (el) => {
    const p = U.profileById(el.dataset.id);
    if (!(await confirmBox('Delete the birth profile of ' + p.name + '? Saved predictions stay in your history.', 'Delete', true))) return;
    await AM.store.deleteProfile(p.id); S.profiles = await AM.store.listProfiles();
    if (S.profileId === p.id) S.profileId = S.profiles[0] && S.profiles[0].id;
    toast('Profile deleted.'); U.render();
  });
  forms.birth = async (f, d) => {
    const msg = doc.getElementById('birth-msg'); const bad = (t) => { msg.innerHTML = '<div class="banner bad">' + esc(t) + '</div>'; throw new Error(t); };
    const name = val(d, 'name'); if (name.length < 2) bad('Please enter a name.');
    const y = +d.get('year'); const mo = +d.get('month'); const dd = +d.get('day');
    if (!AM.time.validIso(y + '-' + String(mo).padStart(2, '0') + '-' + String(dd).padStart(2, '0'))) bad('That date of birth is not valid.');
    const accuracy = val(d, 'accuracy') || 'exact'; let h = 12; let mi = 0;
    if (accuracy !== 'unknown') { const tm = /^(\d{1,2}):(\d{2})/.exec(val(d, 'time')); if (!tm || +tm[1] > 23 || +tm[2] > 59) bad('Please enter the birth time (or choose "Unknown").'); h = +tm[1]; mi = +tm[2]; }
    let place = placeFromForm(d, 'bp');
    const mlat = parseFloat(d.get('mlat')); const mlon = parseFloat(d.get('mlon'));
    if (!isNaN(mlat) && !isNaN(mlon)) {
      const tz = val(d, 'mtz') || (place && place.tz) || ''; const off = d.get('moff') === '' ? null : +d.get('moff');
      if (!tz && off == null) bad('For manual coordinates also give an IANA time zone or a UTC offset.');
      if (tz && !AM.cities.validTz(tz)) bad('"' + tz + '" is not a valid IANA time zone (example: Asia/Kolkata).');
      place = { name: (place && place.name) || (mlat.toFixed(3) + ', ' + mlon.toFixed(3)), lat: mlat, lon: mlon, tz: tz || undefined };
      if (off != null && !isNaN(off)) place.offsetMin = off;
    } else if (!place) bad('Please pick your birthplace from the list, or enter manual coordinates.');
    else if (d.get('moff') !== '' && d.get('moff') != null) place.offsetMin = +d.get('moff');
    if (Math.abs(place.lat) > 90 || Math.abs(place.lon) > 180) bad('Latitude must be within +/-90 and longitude within +/-180.');
    const input = { name, y, mo, d: dd, h, mi, accuracy, place, ayanamsa: val(d, 'ayanamsa') || 'lahiri', node: val(d, 'node') || 'mean' };
    const chart = AM.vedic.buildChart(input);
    const id = f.dataset.id || undefined;
    const rec = await AM.store.saveProfile(Object.assign({}, input, { id, chartVersion: AM.ENGINE_VERSION, lagna: chart.lagna.signName, moonSign: chart.planets.Moon.signName }));
    S.profiles = await AM.store.listProfiles(); S.profileId = rec.id; S._ck = null;
    try { g.localStorage.setItem('am1:lastProfile', rec.id); } catch (e) { /* ignore */ }
    toast('Horoscope generated.'); go('/horoscope');
  };

  /* ---------------------------------------------------------------- screen 3: natal horoscope */
  function chartCard(chart, o) {
    const opts = o || {}; const varga = S._varga || 'D1';
    const style = S.prefs.chartStyle;
    const svg = style === 'south' ? AM.charts.south(chart, { varga, showHouseNo: opts.showHouseNo, overlay: opts.overlay, highlight: opts.highlight }) : AM.charts.north(chart, { varga, showHouseNo: opts.showHouseNo, overlay: opts.overlay, highlight: opts.highlight });
    return html`<div class="card"><div class="row between" style="margin-bottom:10px"><h3 style="margin:0">${varga === 'D9' ? 'Navamsha (D9)' : 'Birth chart (Rashi D1)'}</h3><div class="row tight"><div class="seg"><button class="${style === 'north' ? 'on' : ''}" data-act="chart-style" data-v="north">North Indian</button><button class="${style === 'south' ? 'on' : ''}" data-act="chart-style" data-v="south">South Indian</button></div><div class="seg"><button class="${varga === 'D1' ? 'on' : ''}" data-act="chart-varga" data-v="D1">D1</button><button class="${varga === 'D9' ? 'on' : ''}" data-act="chart-varga" data-v="D9">D9</button></div></div></div><div class="chartbox">${raw(svg)}</div><p class="small muted center" style="margin-top:8px">R retrograde, an up arrow marks an exalted and a down arrow a debilitated planet. ${style === 'north' ? 'The number in each house is the zodiac sign (1 Aries ... 12 Pisces).' : 'Signs are fixed; Asc marks the Lagna sign.'}</p></div>`;
  }
  on('chart-style', (el) => { S.prefs.chartStyle = el.dataset.v; U.savePrefs(); U.render(); });
  on('chart-varga', (el) => { S._varga = el.dataset.v; U.render(); });
  function planetTable(chart) {
    const rows = AM.BODIES.map((b) => { const p = chart.planets[b]; return [planetChip(b), AM.fmt.signPos(p.lon), p.nak + ' (' + p.pada + ')', ord(p.house), p.dignity ? p.dignity.label : 'Node', flagsOf(p), Math.round(chart.strength[b].pct) + '%']; });
    return table(['Planet', 'Sign & degree', 'Nakshatra (pada)', 'House', 'Dignity', 'Status', 'Strength'], rows, { num: ['Strength'], nowrap: ['Sign & degree'] });
  }
  function houseTable(chart) {
    const rows = chart.houses.slice(1).map((h) => [ord(h.n), h.signName, h.lord, ord(chart.planets[h.lord].house) + ' in ' + chart.planets[h.lord].signName, h.occupants.length ? h.occupants.map((o) => AM.PLANET[o].abbr).join(' ') : '-', h.aspectedBy.length ? h.aspectedBy.map((o) => AM.PLANET[o].abbr).join(' ') : '-']);
    return table(['House', 'Sign', 'Lord', 'Lord placed', 'Occupants', 'Aspected by'], rows);
  }
  function ownershipTable(chart) {
    const rows = AM.SEVEN.map((p) => { const f = chart.planets[p].func; return [planetChip(p), f.owns.length ? f.owns.map(ord).join(' & ') : '-', f.label + (f.dual ? ' (double-edged)' : '')]; });
    return table(['Planet', 'Owns houses', 'Functional nature for this Lagna'], rows);
  }
  route('horoscope', {
    title: 'My Horoscope', nav: 'horoscope',
    async view() {
      const p = U.activeProfile();
      if (!p) return html`<div class="card center"><h3>No birth profile yet</h3><p class="muted">Enter your birth details to generate your Vedic horoscope.</p><a class="btn primary" href="#/birth">Create birth profile</a></div>`;
      const c = U.chartOf(p); const P = c.planets;
      const when = p.accuracy === 'unknown' ? 'time unknown' : String(p.h).padStart(2, '0') + ':' + String(p.mi).padStart(2, '0');
      return html`${c.warnings.map((w) => html`<div class="banner warn">${w}</div>`)}
      <div class="card"><div class="row between"><div><h2 style="margin:0">${p.name}</h2><div class="muted small">${p.d} ${MONTH_NAMES[p.mo - 1]} ${p.y}, ${when} - ${p.place.name}</div></div><a class="btn small" href="#/birth/${p.id}">Edit</a></div>
        <div class="hr"></div>${kv([['Time zone', offsetHint(p.place, p.y, p.mo, p.d, p.h, p.mi) || '-'], ['Coordinates', p.place.lat.toFixed(4) + ', ' + p.place.lon.toFixed(4)], ['Ayanamsha', c.ayanamsaName + ' ' + AM.fmt.dms(c.ayanamsa)], ['Houses', 'Whole sign'], ['Rahu / Ketu', c.nodeType === 'true' ? 'True node (approximate)' : 'Mean node'], ['Chart mode', c.mode === 'moon' ? 'Moon-sign chart (Chandra Lagna)' : 'Ascendant chart']])}</div>
      <div class="grid g3"><div class="card"><h4>${c.mode === 'moon' ? 'Lagna (Moon sign)' : 'Ascendant (Lagna)'}</h4><div style="font-size:1.4rem;font-weight:800;color:var(--gold2)">${c.lagna.signName}</div><div class="muted small">${AM.fmt.dm(c.lagna.deg)} - ${c.lagna.nak} pada ${c.lagna.pada}</div></div>
      <div class="card"><h4>Moon sign (Rashi)</h4><div style="font-size:1.4rem;font-weight:800;color:var(--ivory)">${P.Moon.signName}</div><div class="muted small">${AM.fmt.dm(P.Moon.deg)} - ${P.Moon.nak} pada ${P.Moon.pada}</div></div>
      <div class="card"><h4>Sun sign</h4><div style="font-size:1.4rem;font-weight:800;color:var(--ivory)">${P.Sun.signName}</div><div class="muted small">${AM.fmt.dm(P.Sun.deg)} - ${P.Sun.nak} pada ${P.Sun.pada}</div></div></div>
      ${chartCard(c)}
      <div class="card"><h3>Planetary positions</h3>${planetTable(c)}</div>
      <div class="card"><h3>House ownership</h3>${houseTable(c)}<div style="margin-top:12px">${ownershipTable(c)}</div></div>
      <button class="btn primary block" data-act="to-questions">CONTINUE TO QUESTIONS</button>`;
    },
  });
  on('to-questions', () => go('/questions'));

  /* ---------------------------------------------------------------- screen 4: select your question */
  const qState = { cat: 0, q: '' };
  function qListHtml() {
    const items = AM.bank.search(qState.q, qState.cat || 0);
    if (!items.length) return html`<div class="card center muted">No question matches "${qState.q}". Try a word like meeting, payment, interview or travel.</div>`;
    const card = (s) => html`<button class="qcard" data-act="pick-q" data-id="${s.id}"><span class="n">${s.id}.</span> ${s.text}<div class="meta"><span class="tag dim">${AM.bank.CATEGORIES[s.cat - 1].short}</span>${s.distinct ? html`<span class="tag blue">occurrence + success</span>` : ''}</div></button>`;
    if (qState.cat || qState.q) return html`<p class="small muted">${items.length} question${items.length === 1 ? '' : 's'}</p>${items.map(card)}`;
    return AM.bank.CATEGORIES.map((c) => { const inCat = items.filter((s) => s.cat === c.id); return inCat.length ? html`<h3 style="margin-top:18px;color:var(--gold2)">${c.id}. ${c.name} <span class="tag">${inCat.length}</span></h3>${inCat.map(card)}` : ''; });
  }
  route('questions', {
    title: '100 Questions', nav: 'questions',
    view() {
      const counts = AM.bank.counts(); const total = Object.values(counts).reduce((a, b) => a + b, 0);
      return html`<h2>Select your question</h2>
      ${U.activeProfile() ? '' : html`<div class="banner warn">You have not created a birth profile yet. <a href="#/birth">Create it first</a> to analyse a question.</div>`}
      <div class="field"><input type="search" id="qsearch" placeholder="Search by keyword: meeting, payment, interview, travel..." value="${qState.q}" data-input="qsearch" aria-label="Search questions"></div>
      <div class="chips"><button class="chip ${!qState.cat ? 'on' : ''}" data-act="q-cat" data-cat="0">All<b>${total}</b></button>${AM.bank.CATEGORIES.map((c) => html`<button class="chip ${qState.cat === c.id ? 'on' : ''}" data-act="q-cat" data-cat="${c.id}">${c.id}. ${c.short}<b>${counts[c.id] || 0}</b></button>`)}</div>
      ${qState.cat ? html`<p class="gold"><b>${AM.bank.CATEGORIES[qState.cat - 1].name}</b></p>` : ''}
      <div id="qlist">${qListHtml()}</div>`;
    },
  });
  inputs.qsearch = U.debounce((el) => { qState.q = el.value; doc.getElementById('qlist').innerHTML = U.toHtml(qListHtml()); }, 120);
  on('q-cat', (el) => { qState.cat = +el.dataset.cat; U.render(); });
  on('pick-q', (el) => { if (!U.activeProfile()) { toast('Create your birth profile first.'); go('/birth'); return; } S.question = +el.dataset.id; go('/event/' + el.dataset.id); });

  /* ---------------------------------------------------------------- screen 5: event details */
  route('event', {
    title: 'Event details', nav: 'questions',
    view(id) {
      const s = AM.bank.get(id); if (!s) return html`<div class="card">That question does not exist.</div>`;
      const p = U.activeProfile(); if (!p) return html`<div class="card"><a class="btn primary" href="#/birth">Create your birth profile first</a></div>`;
      const place = (S.event && S.event.place) || (function () { try { return JSON.parse(g.localStorage.getItem('am1:eventPlace')); } catch (e) { return null; } }()) || p.place;
      const today = AM.time.todayAt(place); const w = AM.rules.active.window;
      const [ty, tm, td] = today.split('-').map(Number);
      return html`<div class="card" style="border-color:var(--gold);border-width:2px"><div class="row between"><span class="tag">Question ${s.id} - ${AM.bank.CATEGORIES[s.cat - 1].short}</span>${s.distinct ? html`<span class="tag blue">occurrence + success</span>` : ''}</div>
        <p style="font-size:1.2rem;font-weight:700;color:var(--ivory);margin:12px 0 4px">${s.text}</p>
        <details class="fold" style="margin-top:12px"><summary>What this question examines</summary><div class="body"><div class="grid g2"><div><h4>Houses</h4><ul class="bul">${s.primary.map((x) => html`<li><b>${ord(x.h)}</b> ${x.r}</li>`)}${s.secondary.map((x) => html`<li><span class="muted"><b>${ord(x.h)}</b> ${x.r} (supporting)</span></li>`)}</ul></div><div><h4>Planets</h4><ul class="bul">${s.planets.map((x) => html`<li><b>${x.p}</b> ${x.r}</li>`)}</ul></div></div></div></details></div>
      <form class="card" data-form="event" data-id="${s.id}" novalidate><h3>Event details</h3>
        <div class="fgrid"><div class="field"><label for="ed">Event date</label><input id="ed" name="date" type="date" value="${S.event && S.event.date ? S.event.date : today}" required></div>
        <div class="field"><label for="et">Expected event time (optional)</label><input id="et" name="time" type="time" value="${S.event && S.event.time ? S.event.time : ''}"><span class="hint">Leave empty to analyse ${String(w.startHour).padStart(2, '0')}:00-${String(w.endHour).padStart(2, '0')}:00 local time and see when the Moon changes sign.</span></div></div>
        ${cityField('ep', place, 'Event location', { y: ty, mo: tm, d: td })}
        <div class="field"><label for="en">Additional details (optional)</label><textarea id="en" name="notes" maxlength="600" placeholder="Anything you want to remember about this event. Stored encrypted with the prediction.">${S.event && S.event.notes ? S.event.notes : ''}</textarea></div>
        <div id="event-msg"></div><button class="btn primary block" type="submit">ANALYSE MY QUESTION</button></form>`;
    },
  });
  forms.event = async (f, d) => {
    const msg = doc.getElementById('event-msg'); const bad = (t) => { msg.innerHTML = '<div class="banner bad">' + esc(t) + '</div>'; throw new Error(t); };
    const date = val(d, 'date'); if (!AM.time.validIso(date)) bad('Please choose a valid event date.');
    const time = val(d, 'time'); if (time && !/^\d{1,2}:\d{2}$/.test(time)) bad('The event time is not valid.');
    const place = placeFromForm(d, 'ep'); if (!place) bad('Please pick the event location from the list.');
    const q = AM.store.quota(); if (q.used >= q.limit) bad('Your ' + q.plan + ' plan allows ' + q.limit + ' consultations per day and you have used them today. An administrator can change the plan.');
    S.event = { date, time, place, notes: val(d, 'notes') }; S.question = +f.dataset.id;
    try { g.localStorage.setItem('am1:eventPlace', JSON.stringify(place)); } catch (e) { /* ignore */ }
    go('/analysis');
  };

  /* ---------------------------------------------------------------- screen 6: astrological analysis */
  let runToken = 0;
  route('analysis', {
    title: 'Analysis', nav: 'questions',
    view() {
      const s = AM.bank.get(S.question); if (!s || !S.event) return html`<div class="card"><a class="btn primary" href="#/questions">Choose a question</a></div>`;
      return html`<div class="card"><span class="tag">Question ${s.id}</span><p style="font-size:1.1rem;font-weight:700;color:var(--ivory);margin:10px 0 0">${s.text}</p></div>
      <div class="card"><h3>Astrological analysis <span class="tag" id="st-count">0 / 10</span></h3><ul class="stagelist" id="stagelist">${AM.predict.STAGE_NAMES.map((n, i) => html`<li id="st-${i + 1}"><span class="dot">${i + 1}</span><div><div class="nm">${n}</div><div class="sm"></div></div></li>`)}</ul><div id="analysis-err"></div></div>
      <p class="small muted center">Every stage below is a real calculation; a stage is ticked only when the engine has finished it.</p>`;
    },
    after() { if (AM.bank.get(S.question) && S.event) runAnalysis(); },
  });
  async function runAnalysis() {
    const token = (runToken += 1);
    const profile = U.activeProfile(); const chart = U.chartOf(profile); const sheet = AM.bank.get(S.question);
    let done = 0;
    try {
      const result = await AM.predict.analyzeStaged(chart, sheet, S.event, AM.rules.active, (st) => {
        if (token !== runToken) return;
        const li = doc.getElementById('st-' + st.id); if (!li) return;
        li.className = st.state;
        if (st.state === 'done') { li.querySelector('.sm').textContent = st.summary; li.querySelector('.dot').textContent = '✓'; done += 1; const c = doc.getElementById('st-count'); if (c) c.textContent = done + ' / 10'; }
      });
      if (token !== runToken) return;
      const rec = await AM.store.savePrediction(result, { profileId: profile.id, profileName: profile.name, notes: S.event.notes });
      S.result = rec;
      await new Promise((r) => setTimeout(r, 350));
      if (token === runToken) go('/result/' + rec.id);
    } catch (err) {
      console.error(err);
      const box = doc.getElementById('analysis-err');
      if (box) box.innerHTML = '<div class="banner bad">The analysis could not be completed: ' + esc(err.message) + '</div><a class="btn" href="#/questions">Back to questions</a>';
    }
  }

  /* ---------------------------------------------------------------- screen 7: final prediction */
  function toneOf(d) { return d > 0 ? 'pos-t' : d < 0 ? 'neg-t' : 'neu-t'; }
  function reasonList(items, cls) { return items.length ? html`<ul class="bul ${cls}">${items.map((f) => html`<li><span class="delta ${toneOf(f.delta)}">${f.delta > 0 ? '+' : ''}${f.delta.toFixed(1)}</span> ${f.text}</li>`)}</ul>` : html`<p class="muted small">None of significance.</p>`; }
  function outcomeBox(r) {
    const o = r.outcome;
    return html`<div class="card flat"><h4>What actually happened?</h4>${o ? html`<p>You recorded: <b>${OUTCOME[o.result]}</b> ${o.result === r.verdict ? html`<span class="tag yes">matches the prediction</span>` : html`<span class="tag dim">differs from the prediction</span>`}${o.note ? html`<br><span class="muted small">${o.note}</span>` : ''}</p>` : html`<p class="small muted">Recording the real outcome helps you judge how well the method works for you.</p>`}
      <div class="row tight">${Object.keys(OUTCOME).map((k) => html`<button class="btn small" data-act="set-outcome" data-id="${r.id}" data-v="${k}">${OUTCOME[k]}</button>`)}</div></div>`;
  }
  route('result', {
    title: 'Prediction', nav: 'questions',
    async view(id) {
      const r = await AM.store.getPrediction(id); if (!r) return html`<div class="card"><h3>Prediction not found</h3><a class="btn" href="#/history">My predictions</a></div>`;
      const mf = r.moon.factors; const natPos = r.positives.filter((x) => x.cat === 'natal'); const natNeg = r.negatives.filter((x) => x.cat === 'natal');
      const moonPos = r.positives.filter((x) => x.cat === 'moon'); const moonNeg = r.negatives.filter((x) => x.cat === 'moon');
      const links = r.natal.combos.filter((c) => c.combo.t === 'link');
      const disp = mf.find((x) => x.id === 'disp');
      return html`<div class="verdict ${r.verdict}"><div class="faint small" style="letter-spacing:.2em">THE INDICATIONS SAY</div><div class="word">${r.verdict}</div>
        <div class="q">${r.question.text}</div>
        <div class="sub-verdicts">${r.occurrence ? html`<span class="tag ${r.occurrence.verdict.toLowerCase()}">Will it happen? ${r.occurrence.verdict}</span>` : ''}<span class="tag ${r.success.verdict.toLowerCase()}">${r.occurrence ? 'Will it succeed? ' : 'Outcome: '}${r.success.verdict}</span><span class="tag dim">${r.confidence} confidence</span></div></div>
      ${r.research && r.research.override ? html`<div class="banner warn"><b>Astrologer's note:</b> ${r.research.by || 'an astrologer'} marked this as <b>${r.research.override.verdict}</b>: ${r.research.override.reason}</div>` : ''}
      ${r.warnings.map((w) => html`<div class="banner warn">${w}</div>`)}${r.confidenceNotes.map((w) => html`<div class="banner">${w}</div>`)}
      <div class="card"><h3>Brief prediction</h3><p style="font-size:1.05rem">${r.headline}</p><p class="muted small">${r.natalSentence} ${r.moonSentence} ${r.confSentence}</p></div>
      <div class="grid g2">
        <div class="card"><h3>Natal potential <span class="tag">${r.natal.band}</span></h3>${meter(r.natal.N)}<p class="small muted">${Math.round(r.natal.N)} / 100 - how well your chart supports this matter by itself.</p>${reasonList(natPos.concat(natNeg).slice(0, 4), '')}</div>
        <div class="card"><h3>Transit Moon influence <span class="tag ${r.moon.score >= 8 ? 'yes' : r.moon.score <= -8 ? 'no' : 'maybe'}">${sgn(r.moon.score)}</span></h3><p>Moon in <b>${r.moon.sign} ${AM.fmt.dm(r.moon.deg)}</b> (${r.moon.nak}), your <b>${ord(r.moon.house)} house</b>. Dispositor: ${r.moon.dispositor}.</p>${reasonList(moonPos.concat(moonNeg).slice(0, 4), '')}</div></div>
      <div class="card"><h3>Relevant planetary relationships</h3><ul class="bul">${links.map((c) => html`<li><span class="delta ${toneOf(c.effect)}">${c.effect > 0 ? '+' : ''}${c.effect.toFixed(1)}</span> ${c.text}</li>`)}${disp ? html`<li><span class="delta ${toneOf(disp.delta)}">${disp.delta > 0 ? '+' : ''}${disp.delta.toFixed(1)}</span> ${disp.text}</li>` : ''}</ul></div>
      <div class="grid g2"><div class="card"><h3>Positive indications</h3>${reasonList(r.positives, 'pos')}</div><div class="card"><h3>Challenging indications</h3>${reasonList(r.negatives, 'neg')}</div></div>
      <div class="card"><h3>Suggested action</h3><p>${r.action}</p></div>
      <div class="card"><h3>Timing</h3><p>${r.timing.text}</p>${r.timing.segments && r.timing.segments.length > 1 ? table(['From', 'To', 'Moon', 'House', 'Indication'], r.timing.segments.map((s) => [AM.fmt.clock(r.event.place, s.startMs, hourFmt()), AM.fmt.clock(r.event.place, s.endMs, hourFmt()), s.moonSign, ord(s.moonHouse), verdictTag(s.verdict)])) : ''}</div>
      ${outcomeBox(r)}
      <div class="row noprint" style="margin:16px 0"><a class="btn primary" href="#/detail/${r.id}">VIEW DETAILED ANALYSIS</a><button class="btn" data-act="save-report" data-id="${r.id}">SAVE REPORT</button><a class="btn" href="#/questions">NEW QUESTION</a><a class="btn" href="#/history">VIEW MY HISTORY</a></div>
      <p class="small faint">Rule set ${r.ruleset.version} (${r.ruleset.fingerprint}) - engine ${r.engine} - computed in ${r.elapsedMs} ms. This prediction is stored exactly as shown; later rule changes never alter it.</p>`;
    },
  });
  on('set-outcome', async (el) => {
    const note = ''; await AM.store.updatePrediction(el.dataset.id, { outcome: { result: el.dataset.v, note, at: Date.now() } });
    toast('Outcome recorded.'); U.render();
  });

  /* ---------------------------------------------------------------- reports */
  function reportHtml(r) {
    const li = (arr) => arr.map((f) => '<li>' + esc((f.delta > 0 ? '+' : '') + f.delta.toFixed(1) + '  ' + f.text) + '</li>').join('');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>ASTROMATE report</title><style>body{font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}h1{letter-spacing:.2em;margin:0}h2{border-bottom:2px solid #d6a84a;padding-bottom:4px;margin-top:26px;color:#5a4000}.v{font-size:44px;font-weight:800;letter-spacing:.1em;margin:10px 0}.YES{color:#157a4d}.NO{color:#b32d2d}.MAYBE{color:#a8700a}li{margin:4px 0}small{color:#555}</style></head><body><h1>ASTROMATE</h1><small>100 QUERY MASTER - consultation report</small>' +
      '<h2>Question ' + r.question.id + '</h2><p><b>' + esc(r.question.text) + '</b></p><p><small>Profile: ' + esc(r.profileName || '') + ' - event ' + esc(r.event.date) + (r.event.time ? ' ' + esc(r.event.time) : '') + ' - ' + esc(r.event.place.name) + '</small></p>' +
      '<div class="v ' + r.verdict + '">' + r.verdict + '</div><p>' + esc(r.confidence) + ' confidence' + (r.occurrence ? ' - occurrence: ' + r.occurrence.verdict + ', success: ' + r.success.verdict : '') + '</p><p>' + esc(r.headline) + '</p><p><small>' + esc(r.natalSentence + ' ' + r.moonSentence + ' ' + r.confSentence) + '</small></p>' +
      '<h2>Positive indications</h2><ul>' + li(r.positives) + '</ul><h2>Challenging indications</h2><ul>' + li(r.negatives) + '</ul><h2>Suggested action</h2><p>' + esc(r.action) + '</p><h2>Timing</h2><p>' + esc(r.timing.text) + '</p>' +
      '<h2>Transit Moon</h2><p>' + esc(r.moon.sign + ' ' + AM.fmt.dm(r.moon.deg) + ', ' + r.moon.nak + ', house ' + r.moon.house + ', dispositor ' + r.moon.dispositor) + '</p><ul>' + li(r.moon.factors) + '</ul>' +
      '<h2>Confirming transits</h2><ul>' + li(r.confirm.factors) + '</ul><p><small>Rule set ' + esc(r.ruleset.version) + ' (' + esc(r.ruleset.fingerprint) + '), engine ' + esc(r.engine) + '. Astrology is a traditional interpretive system; this report shows indications, not guarantees, and is not medical, legal or financial advice.</small></p></body></html>';
  }
  on('save-report', async (el) => { const r = await AM.store.getPrediction(el.dataset.id); download('astromate-q' + r.question.id + '-' + r.event.date + '.html', 'text/html', reportHtml(r)); toast('Report saved. Open it and use Print to make a PDF.'); });

  /* ---------------------------------------------------------------- detailed analysis (shared with the astrologer dashboard) */
  function factorTable(fs) {
    return table(['Stage', 'Points', 'Finding'], fs.map((f) => [AM.predict.STAGE_NAMES[f.stage - 1].split(' ')[0] + ' ' + f.stage, deltaSpan(f.delta), f.text]), { num: ['Points'] });
  }
  function reasoning(r) {
    const d = r.decision; const W = d.weights;
    const comp = (name, v, w) => html`<tr><td>${name}</td><td class="num">${v.toFixed(1)}</td><td class="num">${w}</td><td class="num">${(v * w).toFixed(1)}</td></tr>`;
    return html`
    <details class="fold" open><summary>1-2. Natal horoscope and query houses</summary><div class="body"><p class="muted small">${r.stages[0].summary}</p>${table(['House', 'Role in this question', 'Weight', 'Sign', 'Lord', 'Lord in', 'Readiness'], r.natal.houses.map((h) => [ord(h.h), h.role, h.primary ? 'primary' : 'secondary', r.queryHouses.S.find((x) => x.h === h.h).sign, h.lord, ord(r.queryHouses.S.find((x) => x.h === h.h).lordHouse), Math.round(h.score) + '%']))}</div></details>
    <details class="fold"><summary>3-4. Significators, dignity and strength</summary><div class="body">${table(['Planet', 'Roles in this question', 'House', 'Functional nature', 'Dignity', 'Strength', 'Flags'], r.significators.map((s) => [planetChip(s.planet), s.roles.join('; ') || '-', ord(s.house) + ' ' + s.sign, s.func, r.capacity[s.planet].dignity, Math.round(r.capacity[s.planet].pct) + '% ' + r.capacity[s.planet].band, [r.capacity[s.planet].retro ? 'R' : '', r.capacity[s.planet].combust ? 'Combust' : ''].filter(Boolean).join(', ') || '-']))}</div></details>
    <details class="fold"><summary>5. Sambandha and natal combinations - natal potential ${Math.round(r.natal.N)} / 100 (${r.natal.band})</summary><div class="body">${table(['Part', 'Score', 'Weight'], [['Query houses', Math.round(r.natal.parts.houses), AM.rules.active.weights.natalHouses], ['Natural significators', Math.round(r.natal.parts.planets), AM.rules.active.weights.natalPlanets], ['Lagna and its lord', Math.round(r.natal.parts.lagna), AM.rules.active.weights.natalLagna], ['Combinations', Math.round(r.natal.parts.combos), AM.rules.active.weights.natalCombos]])}
      <h4 style="margin-top:12px">Combinations from the rule sheet</h4>${table(['Effect', 'Status', 'Finding'], r.natal.combos.map((c) => [deltaSpan(c.effect), c.status, c.text]))}</div></details>
    <details class="fold"><summary>6-8. Transit Moon, dispositor and natal aspects - Moon score ${sgn(r.moon.score)}</summary><div class="body">${factorTable(r.moon.factors)}</div></details>
    <details class="fold"><summary>9. Other planetary transits - confirmation score ${sgn(r.confirm.score)}</summary><div class="body">${factorTable(r.confirm.factors)}</div></details>
    <details class="fold" open><summary>10. Decision</summary><div class="body"><div class="tablewrap"><table><thead><tr><th>Component</th><th class="num">Score (-100..100)</th><th class="num">Weight</th><th class="num">Contribution</th></tr></thead><tbody>${comp('Natal potential (scaled)', d.Ns, W.natal)}${comp('Transit Moon', d.M, W.moon)}${comp('Other transits', d.C, W.confirm)}<tr><td><b>Final score</b></td><td></td><td></td><td class="num"><b>${d.S.toFixed(1)}</b></td></tr></tbody></table></div>
      <p class="small muted" style="margin-top:8px">YES needs a final score of at least ${d.yesAt}, natal potential of at least ${AM.rules.active.thresholds.minNatalForYes} and a Moon score of at least ${AM.rules.active.thresholds.moonFloorForYes}. NO is a final score of ${d.noAt} or lower, or a Moon veto. Everything in between is MAYBE.</p>
      ${r.occurrence ? html`<p><b>Occurrence:</b> ${r.occurrence.q} - ${verdictTag(r.occurrence.verdict)} (score ${r.occurrence.score}). <b>Success:</b> ${r.success.q} - ${verdictTag(r.success.verdict)} (score ${r.success.score}).</p>` : ''}
      <p><b>Criteria for this question.</b> YES: ${r.criteria.yes}<br>MAYBE: ${r.criteria.maybe}<br>NO: ${r.criteria.no}</p></div></details>
    ${r.natalOcc ? html`<details class="fold"><summary>Occurrence judgement - natal ${Math.round(r.natalOcc.N)} / 100, Moon ${sgn(r.moonOcc.score)}, transits ${sgn(r.confirmOcc.score)}</summary><div class="body"><h4>Occurrence combinations</h4>${table(['Effect', 'Status', 'Finding'], r.natalOcc.combos.map((c) => [deltaSpan(c.effect), c.status, c.text]))}<h4 style="margin-top:12px">Occurrence Moon factors</h4>${factorTable(r.moonOcc.factors)}</div></details>` : ''}`;
  }
  U.reasoning = reasoning; U.factorTable = factorTable; U.chartCard = chartCard; U.planetTable = planetTable; U.houseTable = houseTable; U.planetChip = planetChip; U.cityField = cityField; U.placeFromForm = placeFromForm; U.reportHtml = reportHtml; U.offsetHint = offsetHint; U.flagsOf = flagsOf;
  route('detail', {
    title: 'Detailed analysis', nav: 'questions',
    async view(id) {
      const r = await AM.store.getPrediction(id); if (!r) return html`<div class="card">Prediction not found.</div>`;
      return html`<div class="card"><div class="row between"><span class="tag">Question ${r.question.id}</span>${verdictTag(r.verdict)}</div><p style="font-weight:700;color:var(--ivory)">${r.question.text}</p><p class="muted small">Event ${AM.fmt.isoDateText(r.event.date)}${r.event.time ? ' ' + r.event.time : ''} - ${r.event.place.name}</p></div>
      ${reasoning(r)}<div class="row noprint"><a class="btn primary" href="#/result/${r.id}">Back to prediction</a><button class="btn" data-act="save-report" data-id="${r.id}">SAVE REPORT</button></div>`;
    },
  });

  /* ---------------------------------------------------------------- history */
  const hState = { q: '', v: '' };
  async function historyList() {
    let list = await AM.store.listPredictions();
    if (hState.v) list = list.filter((r) => r.verdict === hState.v);
    if (hState.q) { const t = hState.q.toLowerCase(); list = list.filter((r) => (r.text + ' ' + r.profileName + ' ' + r.date).toLowerCase().includes(t)); }
    if (!list.length) return html`<div class="card center muted">No predictions found.</div>`;
    return list.map((r) => html`<div class="card"><div class="row between"><span class="row tight">${verdictTag(r.verdict)}<span class="tag dim">${r.confidence}</span>${r.outcome ? html`<span class="tag ${r.outcome.result === r.verdict ? 'yes' : 'dim'}">actual: ${r.outcome.result}</span>` : ''}</span><span class="faint small">${AM.fmt.isoDateText(r.date)}</span></div>
      <p style="margin:8px 0 4px"><a href="#/result/${r.id}" style="color:var(--ivory);font-weight:700;text-decoration:none">${r.qid}. ${r.text}</a></p><div class="row between"><span class="muted small">${r.profileName || ''}</span><span class="row tight"><a class="btn small" href="#/result/${r.id}">Open</a><button class="btn small danger" data-act="del-pred" data-id="${r.id}">Delete</button></span></div></div>`);
  }
  route('history', {
    title: 'My Predictions', nav: 'history',
    async view() {
      return html`<div class="row between"><h2>My predictions</h2><span class="row tight noprint"><button class="btn small" data-act="export-csv">Export CSV</button><button class="btn small danger" data-act="clear-hist">Clear all</button></span></div>
      <div class="field"><input type="search" placeholder="Search your predictions" value="${hState.q}" data-input="hsearch"></div>
      <div class="chips">${[['', 'All'], ['YES', 'YES'], ['MAYBE', 'MAYBE'], ['NO', 'NO']].map(([k, l]) => html`<button class="chip ${hState.v === k ? 'on' : ''}" data-act="h-filter" data-v="${k}">${l}</button>`)}</div>
      <div id="hlist">${await historyList()}</div>`;
    },
  });
  inputs.hsearch = U.debounce(async (el) => { hState.q = el.value; doc.getElementById('hlist').innerHTML = U.toHtml(await historyList()); }, 150);
  on('h-filter', (el) => { hState.v = el.dataset.v; U.render(); });
  on('del-pred', async (el) => { if (await confirmBox('Delete this saved prediction?', 'Delete', true)) { await AM.store.deletePrediction(el.dataset.id); U.render(); } });
  on('clear-hist', async () => { if (await confirmBox('Delete ALL your saved predictions? This cannot be undone.', 'Delete all', true)) { await AM.store.clearPredictions(); toast('History cleared.'); U.render(); } });
  on('export-csv', async () => {
    const list = await AM.store.listPredictions(); const q = U.csvCell;
    const rows = [['id', 'question_id', 'question', 'event_date', 'verdict', 'confidence', 'score', 'profile', 'actual_outcome']].concat(list.map((r) => [r.id, r.qid, r.text, r.date, r.verdict, r.confidence, r.score, r.profileName, r.outcome ? r.outcome.result : '']));
    download('astromate-predictions.csv', 'text/csv', rows.map((r) => r.map(q).join(',')).join('\r\n'));
  });

  /* ---------------------------------------------------------------- profile */
  route('profile', {
    title: 'Profile', nav: 'profile',
    async view() {
      const u = S.user; const q = AM.store.quota(); const rs = AM.rules.ref();
      return html`<div class="card"><div class="row between"><div><h2 style="margin:0">${u.name}</h2><div class="muted small">${u.email}</div></div><span class="tag">${u.role}</span></div>
        <div class="hr"></div>${kv([['Plan', q.plan + ' - ' + q.used + ' of ' + q.limit + ' consultations used today'], ['Member since', new Date(u.createdAt).toLocaleDateString()]])}</div>
      ${(u.role === 'astrologer' || u.role === 'admin') ? html`<div class="grid g2"><a class="card" href="#/astro" style="text-decoration:none"><h3>${U.icon('astro')} Astrologer dashboard</h3><p class="muted small">Inspect every calculation: houses, capacity, transits, Moon analysis, reasoning, historical testing.</p></a>${u.role === 'admin' ? html`<a class="card" href="#/admin" style="text-decoration:none"><h3>${U.icon('admin')} Administrator</h3><p class="muted small">Users, question bank, rules, calculation settings, reports.</p></a>` : ''}</div>` : ''}
      <div class="card"><h3>Birth profiles</h3>${S.profiles.length ? html`<ul class="list-plain">${S.profiles.map((p) => html`<li class="row between"><span><b>${p.name}</b> ${p.id === S.profileId ? html`<span class="tag">active</span>` : ''}<br><span class="muted small">${p.lagna || ''} Lagna, Moon in ${p.moonSign || ''}</span></span><a class="btn small" href="#/birth/${p.id}">Edit</a></li>`)}</ul>` : html`<p class="muted">No profiles yet.</p>`}<a class="btn small primary" href="#/birth">Add a birth profile</a></div>
      <div class="card"><h3>Preferences</h3><div class="row"><span class="lbl">Default chart</span><div class="seg"><button class="${S.prefs.chartStyle === 'north' ? 'on' : ''}" data-act="chart-style" data-v="north">North Indian</button><button class="${S.prefs.chartStyle === 'south' ? 'on' : ''}" data-act="chart-style" data-v="south">South Indian</button></div></div>
        <div class="row" style="margin-top:10px"><span class="lbl">Clock</span><div class="seg"><button class="${S.prefs.h24 !== false ? 'on' : ''}" data-act="set-clock" data-v="24">24-hour</button><button class="${S.prefs.h24 === false ? 'on' : ''}" data-act="set-clock" data-v="12">12-hour</button></div></div></div>
      <div class="card"><h3>Security and privacy</h3><p class="small muted">${AM.store.mode === 'server' ? 'Your birth data, charts, notes and predictions are encrypted in your browser, with a key derived from your password, before they are sent to the server. The server stores only ciphertext it cannot read, and no one else (including the administrator) can read it. If you forget your password, only your recovery code can unlock your data.' : 'Your birth data, charts, notes and predictions are encrypted on this device with a key derived from your password. Nothing is sent to any server, and no one else (including the administrator) can read it.'}</p>
        <div class="row"><button class="btn small" data-act="chg-pw">Change password</button>${AM.store.mode === 'server' ? '' : html`<button class="btn small" data-act="export-backup">Export encrypted backup</button><label class="btn small" style="cursor:pointer">Import backup<input type="file" accept="application/json,.json" data-change="import-backup" hidden></label>`}<button class="btn small danger" data-act="del-account">Delete my account</button></div></div>
      <div class="card"><h3>About</h3>${kv([['App', 'ASTROMATE 100 Query Master ' + AM.APP_VERSION], ['Calculation engine', AM.ENGINE_VERSION], ['Rule set', rs.version + ' (' + rs.fingerprint + ')'], ['Storage', AM.store.mode === 'server' ? 'ASTROMATE server (end-to-end encrypted)' : AM.store.persistent ? 'Local device storage (encrypted)' : 'Temporary memory only']])}</div>
      <button class="btn block" data-act="sign-out">Sign out</button>`;
    },
  });
  on('set-clock', (el) => { S.prefs.h24 = el.dataset.v === '24'; U.savePrefs(); U.render(); });
  on('sign-out', async () => { await AM.store.logout(); authTab = 'login'; S.user = null; S.profiles = []; S.profileId = null; S._ck = null; go('/welcome'); });
  on('chg-pw', () => {
    modal(html`<h3>Change password</h3><form data-form="chgpw"><div class="field"><label>Current password</label><input name="old" type="password" autocomplete="current-password" required></div><div class="field"><label>New password</label><input name="new" type="password" minlength="8" autocomplete="new-password" required></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button><button class="btn primary" type="submit">Change</button></div></form>`);
  });
  on('close-modal', () => closeModal());
  forms.chgpw = async (f, d) => {
    const r = await AM.store.changePassword(String(d.get('old')), String(d.get('new'))); closeModal();
    if (r && r.recoveryCode) renewedCodeModal(r.recoveryCode, 'Your password was changed, and your recovery code was renewed with it.'); else toast('Password changed.');
  };
  on('export-backup', async () => { const b = await AM.store.exportBackup(); download('astromate-backup-' + new Date().toISOString().slice(0, 10) + '.json', 'application/json', JSON.stringify(b)); toast('Encrypted backup saved. Keep it private.'); });
  changes['import-backup'] = async (el) => {
    const file = el.files[0]; if (!file) return;
    const obj = JSON.parse(await file.text()); const u = await AM.store.importBackup(obj); toast('Imported the account of ' + u.name + '. Sign out and sign in with that account.');
  };
  on('del-account', () => {
    modal(html`<h3>Delete my account</h3><p class="muted">${AM.store.mode === 'server' ? 'This permanently deletes your account, birth profiles and predictions from the server. It cannot be undone.' : 'This permanently deletes your account, birth profiles and predictions from this device. Export a backup first if you may want them later.'}</p><form data-form="delacct"><div class="field"><label>Type your password to confirm</label><input name="pw" type="password" required></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn ghost" data-act="close-modal">Cancel</button><button class="btn danger" type="submit">Delete everything</button></div></form>`);
  });
  forms.delacct = async (f, d) => { await AM.store.deleteMyAccount(String(d.get('pw'))); closeModal(); S.user = null; S.profiles = []; S.profileId = null; toast('Your account and data were deleted.'); go('/welcome'); };

  route('notfound', { public: true, bare: true, view: () => html`<div class="main"><div class="card center"><h3>Page not found</h3><a class="btn primary" href="#/home">Go home</a></div></div>` });
})(typeof window !== 'undefined' ? window : globalThis);
