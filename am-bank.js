/* ASTROMATE question bank: the 100 rule sheets plus administrator overrides, custom questions and active/inactive switches. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const CATEGORIES = [
    { id: 1, name: 'Morning Planning & Daily Work Management', short: 'Morning & Daily Work' },
    { id: 2, name: 'Meetings & Professional Discussions', short: 'Meetings' },
    { id: 3, name: 'Telephone Calls, Emails & Communication', short: 'Calls & Emails' },
    { id: 4, name: 'Business Deals, Sales & Negotiations', short: 'Deals & Sales' },
    { id: 5, name: 'Job Interviews, Recruitment & Employment', short: 'Interviews & Jobs' },
    { id: 6, name: 'Money, Payments, Banking & Financial Transactions', short: 'Money & Banking' },
    { id: 7, name: 'Presentations, Proposals & Approvals', short: 'Presentations' },
    { id: 8, name: 'Workplace Relationships, Teamwork & Conflicts', short: 'Workplace People' },
    { id: 9, name: 'Travel, External Visits & Client Appointments', short: 'Travel & Visits' },
    { id: 10, name: 'Important Decisions, Deadlines & Unexpected Events', short: 'Decisions & Deadlines' },
  ];
  const ROLE_RE = /^(Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu|L([1-9]|1[0-2]))$/;
  const COMBO_TYPES = ['link', 'place', 'strong', 'dignity', 'occupant', 'aspect', 'free', 'yoga'];

  function settings() { return AM.store ? AM.store.getSettings().questions : { overrides: {}, custom: [], inactive: [] }; }
  function all(includeInactive) {
    const q = settings();
    const base = (AM.SHEETS || []).map((s) => (q.overrides[s.id] ? Object.assign({}, s, q.overrides[s.id]) : s));
    const list = base.concat(q.custom || []);
    return includeInactive ? list : list.filter((s) => !(q.inactive || []).includes(s.id));
  }
  const get = (id) => all(true).find((s) => s.id === +id) || null;
  const isActive = (id) => !(settings().inactive || []).includes(+id);
  const isCustom = (id) => (settings().custom || []).some((s) => s.id === +id);
  const isModified = (id) => !!settings().overrides[id];
  function counts() { const c = {}; for (const s of all()) c[s.cat] = (c[s.cat] || 0) + 1; return c; }
  function search(query, cat) {
    const toks = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    const out = [];
    for (const s of all()) {
      if (cat && s.cat !== cat) continue;
      if (!toks.length) { out.push([0, s]); continue; }
      const hay = (s.text + ' ' + s.short + ' ' + (s.kw || []).join(' ') + ' ' + s.theme).toLowerCase();
      let sc = 0; let ok = true;
      for (const t of toks) {
        if ((s.kw || []).some((k) => k.toLowerCase() === t)) sc += 5; else if (s.short.toLowerCase().indexOf(t) >= 0) sc += 4; else if (hay.indexOf(t) >= 0) sc += 2; else if (/^\d+$/.test(t) && +t === s.id) sc += 10; else { ok = false; break; }
      }
      if (ok) out.push([sc, s]);
    }
    out.sort((a, b) => b[0] - a[0] || a[1].id - b[1].id);
    return out.map((x) => x[1]);
  }
  /** Validate a sheet object (used by the administrator editor). Returns an array of problems (empty = valid). */
  function validate(s) {
    const e = [];
    const isRole = (r) => ROLE_RE.test(String(r));
    const hs = (a, name, min, max) => { if (!Array.isArray(a) || a.length < min || a.length > max) { e.push(name + ' needs ' + min + ' to ' + max + ' entries'); return []; } return a; };
    if (!s || typeof s !== 'object') return ['Not an object'];
    if (!Number.isInteger(s.id) || s.id < 1) e.push('id must be a positive integer');
    if (!Number.isInteger(s.cat) || s.cat < 1 || s.cat > 10) e.push('cat must be 1 to 10');
    if (!s.text || String(s.text).length < 10) e.push('text is required');
    if (!s.short) e.push('short is required');
    const houseList = (arr, name, min, max) => hs(arr, name, min, max).forEach((x) => { if (!x || !(x.h >= 1 && x.h <= 12) || !x.r) e.push(name + ' entries need h (1-12) and r'); });
    houseList(s.primary, 'primary', 1, 6); houseList(s.secondary, 'secondary', 0, 6);
    const hl = (arr, name) => { if (!Array.isArray(arr) || arr.some((h) => !(h >= 1 && h <= 12))) e.push(name + ' must be a list of house numbers 1 to 12'); };
    if (s.moon) { hl(s.moon.good, 'moon.good'); hl(s.moon.bad, 'moon.bad'); }
    if (s.disp) { hl(s.disp.good, 'disp.good'); hl(s.disp.bad, 'disp.bad'); }
    for (const [k, v] of [['moon.want', s.moon && s.moon.want], ['moon.avoid', s.moon && s.moon.avoid], ['disp.want', s.disp && s.disp.want], ['asp.want', s.asp && s.asp.want], ['asp.avoid', s.asp && s.asp.avoid]]) if (v && v.some((r) => !ROLE_RE.test(String(r)))) e.push(k + ' has an invalid role (use a planet name or L1 to L12)');
    hs(s.planets, 'planets', 1, 9).forEach((x) => { if (!x || !AM.BODIES.includes(x.p) || !x.r) e.push('planets entries need p and r'); });
    hs(s.combos, 'combos', 0, 12).forEach((c) => {
      if (!c || !COMBO_TYPES.includes(c.t)) { e.push('a combo has an unknown type'); return; }
      for (const k of ['a', 'b']) if (c[k] != null && !isRole(c[k])) e.push('combo role ' + c[k] + ' is invalid');
    });
    for (const k of ['moon', 'disp', 'asp']) if (!s[k] || typeof s[k] !== 'object') e.push(k + ' is required');
    if (s.moon) { if (!Array.isArray(s.moon.good) || !Array.isArray(s.moon.bad)) e.push('moon.good and moon.bad are required lists'); }
    if (s.disp && (!Array.isArray(s.disp.good) || !Array.isArray(s.disp.bad))) e.push('disp.good and disp.bad are required lists');
    for (const k of ['yesText', 'maybeText', 'noText']) if (!s[k]) e.push(k + ' is required');
    if (!s.action || !s.action.yes || !s.action.maybe || !s.action.no) e.push('action.yes, action.maybe and action.no are required');
    if (!s.criteria || !s.criteria.yes || !s.criteria.maybe || !s.criteria.no) e.push('criteria.yes, criteria.maybe and criteria.no are required');
    if (s.distinct) { if (!s.occ || !s.occ.q || !s.occ.moon) e.push('distinct questions need occ with q and moon'); if (!s.suc) e.push('distinct questions need suc'); }
    return e;
  }
  AM.bank = { CATEGORIES, all, get, isActive, isCustom, isModified, counts, search, validate, COMBO_TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
