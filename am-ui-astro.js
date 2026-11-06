/* ASTROMATE astrologer / researcher dashboard: every calculation is inspectable.
   Tabs: 1 Natal chart, 2 House analysis, 3 Planetary capacity, 4 Query mapping, 5 Transit chart, 6 Moon analysis, 7 Prediction reasoning, 8 Historical testing. */
(function (g) {
  'use strict';
  const AM = g.AM; const U = AM.ui; const V = AM.vedic;
  const { html, raw, esc, S, on, forms, changes, route, go, toast, confirmBox, verdictTag, meter, kv, table, deltaSpan, sgn, download, val } = U;
  const ord = AM.fmt.ordinal;
  const doc = g.document;
  const TABS = [['natal', '1 Natal chart'], ['houses', '2 House analysis'], ['capacity', '3 Planetary capacity'], ['query', '4 Query mapping'], ['transit', '5 Transit chart'], ['moon', '6 Moon analysis'], ['reason', '7 Prediction reasoning'], ['tests', '8 Historical testing']];
  const A = { pid: null, qid: 1, date: '', time: '', place: null, tab: 'natal', result: null, chart: null, sheet: null, event: null, savedId: null, ephemeral: null };
  const PANCHA = { 2: 'Great friend', 1: 'Friend', 0: 'Neutral', '-1': 'Enemy', '-2': 'Great enemy' };

  function activeChart() {
    if (A.ephemeral) return A.ephemeral.chart;
    const p = U.profileById(A.pid) || U.activeProfile();
    if (p && A.pid !== p.id) A.pid = p.id;
    return p ? U.chartOf(p) : null;
  }
  function classOf(h) { const o = []; if (AM.HOUSE_CLASS.kendra.includes(h)) o.push('Kendra'); if (AM.HOUSE_CLASS.trikona.includes(h)) o.push('Trikona'); if (AM.HOUSE_CLASS.dusthana.includes(h)) o.push('Dusthana'); if (AM.HOUSE_CLASS.upachaya.includes(h)) o.push('Upachaya'); if (AM.HOUSE_CLASS.maraka.includes(h)) o.push('Maraka'); return o.join(', ') || '-'; }
  const signOfMap = (c) => { const m = {}; for (const b of AM.BODIES) m[b] = c.planets[b].sign; return m; };
  const pl = U.planetChip;

  /* ---------------------------------------------------------------- tab builders */
  function tabNatal(c) {
    const sm = signOfMap(c);
    const rows = AM.BODIES.map((b) => {
      const p = c.planets[b]; const lord = AM.SIGNS[p.sign].lord;
      const pan = b === 'Rahu' || b === 'Ketu' ? '-' : lord === b ? 'Own sign' : PANCHA[V.compoundRelation(b, lord, sm)];
      return [pl(b), AM.fmt.dms(p.lon), p.signName, p.nak + ' (' + p.nakLord + ', pada ' + p.pada + ')', ord(p.house), (p.speed == null ? '-' : p.speed.toFixed(3) + '°/d') + (p.retro && b !== 'Rahu' && b !== 'Ketu' ? ' R' : ''), AM.SIGNS[p.nav].name, p.dignity ? p.dignity.label : 'Node', pan, p.sunSep == null ? '-' : p.sunSep.toFixed(1) + '°' + (p.combust ? ' combust' : '')];
    });
    return html`<div class="grid g2"><div class="card"><h3>North Indian chart (D1)</h3><div class="chartbox">${raw(AM.charts.north(c, { showHouseNo: true }))}</div></div><div class="card"><h3>South Indian chart (D1)</h3><div class="chartbox">${raw(AM.charts.south(c, { showHouseNo: true }))}</div></div>
      <div class="card"><h3>Navamsha D9 (North Indian)</h3><div class="chartbox">${raw(AM.charts.north(c, { varga: 'D9', showHouseNo: true }))}</div></div><div class="card"><h3>Navamsha D9 (South Indian)</h3><div class="chartbox">${raw(AM.charts.south(c, { varga: 'D9' }))}</div></div></div>
      <div class="card"><h3>Planetary positions in detail</h3><p class="small muted">Lagna ${AM.fmt.dms(c.lagna.lon)} ${c.lagna.signName} (${c.lagna.nak} pada ${c.lagna.pada}). Ayanamsha ${c.ayanamsaName} ${AM.fmt.dms(c.ayanamsa)}. Julian day (UT) ${c.jd.toFixed(5)}, Delta-T ${c.deltaT.toFixed(1)} s, engine ${c.engine}.</p>
      ${table(['Planet', 'Longitude', 'Sign', 'Nakshatra (lord, pada)', 'House', 'Motion', 'Navamsha', 'Dignity', 'Compound relation', 'From Sun'], rows, { nowrap: ['Longitude'] })}</div>`;
  }
  function tabHouses(c) {
    const rows = c.houses.slice(1).map((h) => {
      const lp = c.planets[h.lord];
      return [ord(h.n), h.signName, pl(h.lord) , ord(lp.house) + ' in ' + lp.signName + (lp.dignity ? ' (' + lp.dignity.label.toLowerCase() + ')' : ''), h.occupants.length ? h.occupants.join(', ') : '-', h.aspectedBy.length ? h.aspectedBy.join(', ') : '-', h.kartari === 'shubha' ? 'Shubhakartari' : h.kartari === 'papa' ? 'Papakartari' : '-', classOf(h.n), AM.HOUSE[h.n].kw];
    });
    return html`<div class="card"><h3>Houses (whole sign from ${c.lagna.signName})</h3>${table(['House', 'Sign', 'Lord', 'Lord placed', 'Occupants', 'Aspected by', 'Kartari', 'Class', 'Significations (daily professional life)'], rows)}
      <p class="small muted" style="margin-top:10px">Badhaka house: ${ord(c.badhakaHouse)} (lord ${c.badhakesh}). Yogakaraka: ${c.yogakaraka.length ? c.yogakaraka.join(', ') : 'none'}.</p></div>`;
  }
  const SAMB_CODE = (r) => { if (!r || !r.types.length) return ['', 0]; const t = r.types[0].label; return [/Parivartana/.test(t) ? 'P' : /Yuti/.test(t) ? 'Y' : /Mutual Drishti/.test(t) ? 'D' : /aspects/.test(t) ? 'd' : /nakshatra/.test(t) ? 'N' : 'S', r.score]; };
  function tabCapacity(c) {
    const cards = AM.BODIES.map((b) => {
      const p = c.planets[b]; const st = c.strength[b]; const f = p.func;
      return html`<details class="fold"><summary>${pl(b)} in ${p.signName} (${ord(p.house)}) <span class="tag" style="margin-left:auto">${Math.round(st.pct)}% ${st.band}</span></summary><div class="body">${meter(st.pct)}
        <div class="grid g2" style="margin-top:10px"><div>${table(['Strength component', 'Points'], st.parts.map((x) => [x.label, x.pts]).concat([['Total', st.raw == null ? '-' : st.raw.toFixed(1)]]), { num: ['Points'] })}</div>
        <div>${kv([['Natural nature', V.naturalNature(c, b)], ['Functional nature', f.label + (f.dual ? ' (double-edged)' : '')], ['Quality factor', f.q.toFixed(2)], ['Owns houses', f.owns.length ? f.owns.map((h) => ord(h) + ' (' + AM.HOUSE[h].short + ')').join(', ') : 'none'], ['Natural significations', AM.PLANET[b].sig], ['Aspects (houses)', p.aspHouses.map(ord).join(', ')], ['Conjunct', p.conj.length ? p.conj.join(', ') : 'none'], ['Dignity', p.dignity ? p.dignity.label : 'Node'], ['Flags', U.flagsOf(p)], ['Neecha Bhanga', p.nb && p.nb.count ? p.nb.items.join('; ') : '-']])}<ul class="bul" style="margin-top:8px">${f.reasons.map((r) => html`<li>${r}</li>`)}</ul></div></div></div></details>`;
    });
    const mat = V.sambandhaMatrix(c);
    const head = html`<tr><th></th>${AM.BODIES.map((b) => html`<th>${AM.PLANET[b].abbr}</th>`)}</tr>`;
    const body = AM.BODIES.map((a) => html`<tr><th>${AM.PLANET[a].abbr}</th>${AM.BODIES.map((b) => { if (a === b) return html`<td style="opacity:.3">-</td>`; const r = mat[a][b]; const [code, sc] = SAMB_CODE(r); return html`<td title="${r.text}" style="text-align:center;font-weight:800;background:rgba(214,168,74,${(sc / 5.5 * 0.45).toFixed(2)})">${code}</td>`; })}</tr>`);
    return html`<div class="card"><h3>Planetary capacity: dignity, strength, nature, aspects</h3><p class="small muted">Strength is a transparent point system (dignity, house, Digbala, Vargottama, combustion, company and aspects). Open each planet for its components.</p>${cards}</div>
      <div class="card"><h3>Sambandha matrix</h3><p class="small muted">P Parivartana (exchange), Y Yuti (conjunction), D mutual Drishti, d one-sided Drishti, N nakshatra link, S sign-lord link. Hover a cell for the full relationship. Darker = stronger.</p><div class="tablewrap"><table><thead>${head}</thead><tbody>${body}</tbody></table></div></div>`;
  }
  function roleNames(c, roles) { return (roles || []).map((r) => { const p = V.resolveRole(c, r); return /^L/.test(r) ? r.replace('L', '') + 'th lord (' + p + ')' : p; }).join(', '); }
  function tabQuery(c) {
    const sh = A.sheet; if (!sh) return html`<div class="banner">Choose a question above and press <b>Run analysis</b> to see the query mapping.</div>`;
    const cfg = AM.predict.cfgOf(sh, 'S'); const nat = A.result ? A.result.natal : AM.predict.natalPotential(c, cfg, AM.rules.active);
    const H = AM.predict.helpers(c, cfg);
    const hrows = nat.houses.map((h) => [ord(h.h), h.role, h.primary ? 'primary' : 'secondary', c.houses[h.h].signName, h.lord, ord(c.planets[h.lord].house) + ' ' + c.planets[h.lord].signName, Math.round(h.score) + '%']);
    const allp = Array.from(new Set(H.primaryLords.concat(H.secondaryLords, H.sheetPlanets, [H.lagnaLord])));
    const prow = allp.map((p) => [pl(p), H.roles(p).join('; ') || '-', c.planets[p].func.label, Math.round(c.strength[p].pct) + '% ' + c.strength[p].band, ord(c.planets[p].house) + ' ' + c.planets[p].signName]);
    const crow = nat.combos.map((x) => [x.combo.t + (x.combo.neg ? ' (obstacle)' : ''), JSON.stringify(Object.assign({}, x.combo, { t: undefined, w: undefined })).replace(/[{}"]/g, '').replace(/,/g, ', '), x.status, deltaSpan(x.effect), x.text]);
    const occ = sh.distinct && sh.occ ? html`<h4 style="margin-top:14px">Occurrence configuration: ${sh.occ.q}</h4>${kv([['Primary', sh.occ.primary.map((x) => ord(x.h) + ' ' + x.r).join('; ')], ['Secondary', sh.occ.secondary.map((x) => ord(x.h) + ' ' + x.r).join('; ')], ['Planets', sh.occ.planets.map((x) => x.p + ': ' + x.r).join('; ')], ['Moon good houses', sh.occ.moon.good.map(ord).join(', ')], ['Moon bad houses', sh.occ.moon.bad.map(ord).join(', ')]])}` : '';
    const edit = S.user.role === 'admin' ? html`<a class="btn small" href="#/admin/questions/${sh.id}">Edit this rule sheet</a>` : '';
    return html`<div class="card"><div class="row between"><h3 style="margin:0">Question ${sh.id}: ${sh.short}</h3>${edit}</div><p>${sh.text}</p>${kv([['Category', AM.bank.CATEGORIES[sh.cat - 1].name], ['Theme', sh.theme], ['Judgements', sh.distinct ? 'Occurrence and success (distinct)' : 'Single outcome'], ['Strictness shift', (sh.strict > 0 ? '+' : '') + sh.strict + ' (raises the YES threshold by ' + 2 * sh.strict + ')']])}</div>
      <div class="card"><h3>1-2. Primary and secondary houses (with the chart's lords)</h3>${table(['House', 'Role in this question', 'Weight', 'Sign', 'Lord', 'Lord placed', 'Readiness'], hrows)}</div>
      <div class="card"><h3>3-5. House lords, natural and functional significators</h3>${table(['Planet', 'Roles', 'Functional nature (this Lagna)', 'Strength', 'Placed'], prow)}</div>
      <div class="card"><h3>6. Relevant natal combinations (evaluated)</h3>${table(['Type', 'Parameters', 'Status', 'Effect', 'Finding'], crow)}</div>
      <div class="card"><h3>7-9. Transit Moon, dispositor and aspect rules (resolved for this chart)</h3>${kv([['Moon: good houses', sh.moon.good.map(ord).join(', ')], ['Moon: bad houses', sh.moon.bad.map(ord).join(', ')], ['Moon: wanted contacts', roleNames(c, sh.moon.want)], ['Moon: unwanted contacts', roleNames(c, sh.moon.avoid)], ['Moon rule', sh.moon.note], ['Dispositor: good houses', sh.disp.good.map(ord).join(', ')], ['Dispositor: bad houses', sh.disp.bad.map(ord).join(', ')], ['Dispositor: wanted roles', roleNames(c, sh.disp.want)], ['Dispositor rule', sh.disp.note], ['Aspects: wanted', roleNames(c, sh.asp.want)], ['Aspects: unwanted', roleNames(c, sh.asp.avoid)], ['Aspect rule', sh.asp.note]])}${occ}</div>
      <div class="card"><h3>10. Final YES / NO / MAYBE criteria</h3>${kv([['YES', sh.criteria.yes], ['MAYBE', sh.criteria.maybe], ['NO', sh.criteria.no]])}</div>`;
  }
  function tabTransit(c) {
    const r = A.result; if (!r) return html`<div class="banner">Run an analysis to see the transit chart.</div>`;
    const tr = r.transit;
    const rows = AM.BODIES.map((b) => { const p = tr.planets[b]; return [pl(b), AM.fmt.signPos(p.lon), p.nak + ' (' + p.pada + ')', ord(p.house), ord(p.houseFromMoon), (p.speed == null ? '-' : p.speed.toFixed(3) + '°/d') + (p.retro && b !== 'Rahu' && b !== 'Ketu' ? ' R' : ''), p.dignity || 'Node', V.GOCHARA_FAV[b].includes(p.houseFromMoon) ? html`<span class="pos-t">favourable</span>` : html`<span class="neg-t">not favourable</span>`]; });
    const overlay = { planets: tr.planets };
    const style = S.prefs.chartStyle;
    const svg = style === 'south' ? AM.charts.south(c, { overlay, highlight: { [r.moon.house]: 'moon' } }) : AM.charts.north(c, { overlay, highlight: { [r.moon.house]: 'moon' }, showHouseNo: true });
    return html`<div class="card"><div class="row between"><h3 style="margin:0">Transit chart over the natal chart</h3><div class="seg"><button class="${style === 'north' ? 'on' : ''}" data-act="chart-style" data-v="north">North</button><button class="${style === 'south' ? 'on' : ''}" data-act="chart-style" data-v="south">South</button></div></div>
      <p class="small muted">Event: ${AM.fmt.dateText(r.event.place, tr.utcMs, true)} ${AM.fmt.clock(r.event.place, tr.utcMs)} (${r.event.place.name}). Natal planets are plain, transit planets are gold, underlined and italic; the transit Moon's house is outlined in blue.</p><div class="chartbox">${raw(svg)}</div></div>
      <div class="card"><h3>Transit positions</h3>${table(['Planet', 'Position', 'Nakshatra (pada)', 'Natal house', 'From natal Moon', 'Motion', 'Dignity', 'Gochara'], rows, { nowrap: ['Position'] })}
      ${kv([['Tithi', r.moon.tithi.paksha + ' ' + r.moon.tithi.name + ' (' + r.moon.tithi.index + ')'], ['Moon phase strength', r.moon.strong ? 'Bright half (strong)' : 'Waning crescent half (weaker)'], ['Chandra Bala', ord(r.moon.chandraBala.house) + ' from natal Moon: ' + (r.moon.chandraBala.ok ? 'favourable' : 'unfavourable')], ['Tara Bala', r.moon.tara.name + ' (' + r.moon.tara.index + ')' + (r.moon.tara.ok ? ' favourable' : ' unfavourable')], ['Vimshottari period (MD-AD-PD)', tr.dasha || 'not available (birth time unknown)']])}</div>`;
  }
  function tabMoon(c) {
    const r = A.result; if (!r) return html`<div class="banner">Run an analysis to see the Moon analysis.</div>`;
    const m = r.moon; const D = m.dispositor; const dp = c.planets[D];
    const inHouse = c.houses[m.house].occupants; const asp = c.houses[m.house].aspectedBy;
    const lords = Array.from(new Set(r.queryHouses.S.filter((x) => x.primary).map((x) => x.lord).concat([c.houseLord[1]])));
    const rel = (a, b) => V.sambandha(c, a, b);
    const srows = lords.filter((l) => l !== D).map((l) => [l, rel(D, l).text, rel('Moon', l).text]);
    const frows = m.factors.map((f) => [f.stage, deltaSpan(f.delta), f.text]);
    return html`<div class="card"><h3>Transit Moon at the event</h3>${kv([['Transit Moon sign', m.sign], ['Degree', AM.fmt.dms(m.lon % 30)], ['Nakshatra', m.nak + ' pada ' + m.pada], ['Natal house occupied', ord(m.house) + ' (' + AM.HOUSE[m.house].short + ')'], ['Natal planets in that house', inHouse.length ? inHouse.join(', ') : 'none'], ['Moon\'s dispositor', D], ['Dispositor\'s natal house', ord(dp.house) + ' in ' + dp.signName + ', ' + (dp.dignity ? dp.dignity.label.toLowerCase() : '') + ', ' + Math.round(c.strength[D].pct) + '% strength, ' + dp.func.label.toLowerCase()], ['Natal aspects upon the transit Moon', asp.length ? asp.join(', ') : 'none'], ['Moon score', sgn(m.score) + ' (raw ' + m.raw + ')']])}</div>
      <div class="card"><h3>Relevant Sambandha</h3><p class="small muted">Relationships between the Moon's dispositor and the lords of the primary query houses (and the Lagna lord) in the natal chart.</p>${table(['Query lord', 'Dispositor ' + D + ' with the lord', 'Natal Moon with the lord'], srows)}</div>
      <div class="card"><h3>Every Moon factor</h3>${table(['Stage', 'Points', 'Finding'], frows, { num: ['Points'] })}</div>
      <div class="card"><h3>Moon through the analysed window</h3>${table(['From', 'To', 'Moon', 'House', 'Indication'], r.timing.segments.map((s) => [AM.fmt.clock(r.event.place, s.startMs), AM.fmt.clock(r.event.place, s.endMs), s.moonSign, ord(s.moonHouse), verdictTag(s.verdict)]))}<p class="small muted" style="margin-top:8px">${r.timing.text}</p></div>`;
  }
  function tabReason() {
    const r = A.result; if (!r) return html`<div class="banner">Run an analysis to see the full chain of judgement.</div>`;
    const ov = r.research && r.research.override;
    return html`<div class="card"><div class="row between"><div><span class="tag">Question ${r.question.id}</span> ${verdictTag(r.verdict)} <span class="tag dim">${r.confidence}</span></div><div class="row tight"><button class="btn small primary" data-act="astro-save">${A.savedId ? 'Saved to history' : 'Save as consultation'}</button></div></div><p>${r.headline}</p>${ov ? html`<div class="banner warn"><b>Manual override:</b> ${ov.verdict} - ${ov.reason}</div>` : ''}</div>
      ${U.reasoning(r)}
      <div class="card"><h3>Manual override and research notes</h3><p class="small muted">Stored with the saved consultation (save it first). The engine's own verdict is never changed; the override is shown beside it.</p>
      <form data-form="astro-notes"><div class="fgrid"><div class="field"><label>Manual verdict (optional)</label><select name="verdict"><option value="">No override</option>${['YES', 'MAYBE', 'NO'].map((v) => html`<option ${ov && ov.verdict === v ? 'selected' : ''}>${v}</option>`)}</select></div><div class="field"><label>Reason for the override</label><input name="reason" value="${ov ? ov.reason : ''}"></div></div><div class="field"><label>Research notes</label><textarea name="note" placeholder="Observations, other techniques consulted, follow-up...">${r.research ? r.research.note || '' : ''}</textarea></div><button class="btn" type="submit">Save notes</button></form></div>`;
  }

  /* ---------------------------------------------------------------- historical testing (tab 8) */
  function parseCsv(text) {
    const rows = []; let row = []; let cur = ''; let q = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i += 1; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; } else if (ch !== '\r') cur += ch;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    /* undo the spreadsheet-injection guard that csvCell adds on export */
    return rows.filter((r) => r.some((x) => x.trim() !== '')).map((r) => r.map((c) => c.replace(/^'(?=[=+\-@\t\r])/, '')));
  }
  function resolvePlace(s) {
    const t = String(s || '').trim(); const m = /^(-?\d+(?:\.\d+)?)\s*;\s*(-?\d+(?:\.\d+)?)\s*;\s*(\S+)$/.exec(t);
    if (m) return { name: m[1] + ', ' + m[2], lat: +m[1], lon: +m[2], tz: m[3] };
    const c = AM.cities.search(t.split(',')[0], 1)[0]; return c ? { name: c.name, lat: c.lat, lon: c.lon, tz: c.tz } : null;
  }
  function caseChart(c) { return V.buildChart({ y: c.y, mo: c.mo, d: c.d, h: c.h, mi: c.mi, accuracy: c.accuracy, place: c.place, ayanamsa: AM.store.getSettings().calc.ayanamsa, node: AM.store.getSettings().calc.node }); }
  function runCase(c) {
    const sheet = AM.bank.get(c.qid); if (!sheet) throw new Error('Question ' + c.qid + ' does not exist.');
    const r = AM.predict.analyze(caseChart(c), sheet, { date: c.date, time: c.time || '', place: c.eplace || c.place });
    c.last = { verdict: r.verdict, occ: r.occurrence ? r.occurrence.verdict : null, score: r.score, N: r.natal.N, M: r.decision.M, C: r.decision.C, conf: r.confidence, rv: r.ruleset.version, fp: r.ruleset.fingerprint, at: Date.now() };
    return r;
  }
  function statsHtml(list) {
    const done = list.filter((c) => c.actual && c.last);
    if (!done.length) return html`<p class="muted">No test cases with both a prediction and an actual outcome yet.</p>`;
    const V3 = ['YES', 'MAYBE', 'NO']; const cm = {}; V3.forEach((a) => { cm[a] = { YES: 0, MAYBE: 0, NO: 0 }; });
    let exact = 0; let opposite = 0;
    done.forEach((c) => { cm[c.actual][c.last.verdict] += 1; if (c.actual === c.last.verdict) exact += 1; if ((c.actual === 'YES' && c.last.verdict === 'NO') || (c.actual === 'NO' && c.last.verdict === 'YES')) opposite += 1; });
    const byCat = {}; done.forEach((c) => { const k = (AM.bank.get(c.qid) || {}).cat || 0; byCat[k] = byCat[k] || [0, 0]; byCat[k][1] += 1; if (c.actual === c.last.verdict) byCat[k][0] += 1; });
    return html`<div class="grid g3"><div class="card flat"><h4>Exact agreement</h4><div style="font-size:1.8rem;font-weight:800;color:var(--gold2)">${Math.round(100 * exact / done.length)}%</div><span class="muted small">${exact} of ${done.length} cases</span></div><div class="card flat"><h4>Opposite results (YES vs NO)</h4><div style="font-size:1.8rem;font-weight:800;color:${opposite ? 'var(--no)' : 'var(--yes)'}">${opposite}</div><span class="muted small">${Math.round(100 * opposite / done.length)}% of cases</span></div><div class="card flat"><h4>Cases tested</h4><div style="font-size:1.8rem;font-weight:800">${done.length}</div><span class="muted small">of ${list.length} stored</span></div></div>
      <h4 style="margin-top:12px">Confusion matrix (rows: actual, columns: predicted)</h4>${table(['Actual \\ Predicted', 'YES', 'MAYBE', 'NO'], V3.map((a) => [a, cm[a].YES, cm[a].MAYBE, cm[a].NO]), { num: ['YES', 'MAYBE', 'NO'] })}
      <h4 style="margin-top:12px">Agreement by category</h4>${table(['Category', 'Agreement', 'Cases'], Object.keys(byCat).map((k) => [AM.bank.CATEGORIES[k - 1] ? AM.bank.CATEGORIES[k - 1].short : k, Math.round(100 * byCat[k][0] / byCat[k][1]) + '%', byCat[k][1]]), { num: ['Cases'] })}
      <p class="small muted" style="margin-top:8px">Small samples prove nothing: use these figures to look for patterns worth refining in the rule sheets, not as a measure of truth.</p>`;
  }
  async function tabTests() {
    const tests = await AM.store.listTests(); const preds = await AM.store.listPredictions();
    const pending = preds.filter((p) => !p.outcome).slice(0, 8); const answered = preds.filter((p) => p.outcome);
    const asList = answered.map((p) => ({ actual: p.outcome.result, last: { verdict: p.verdict }, qid: p.qid }));
    const qopts = AM.bank.all().map((s) => html`<option value="${s.id}">${s.id}. ${s.short}</option>`);
    const cityF = (p, label) => U.cityField(p, null, label);
    return html`<div class="card"><h3>Agreement of saved consultations with real outcomes</h3>${statsHtml(asList)}</div>
      ${pending.length ? html`<div class="card"><h3>Consultations waiting for an outcome</h3><ul class="list-plain">${pending.map((p) => html`<li><div class="row between"><span>${verdictTag(p.verdict)} ${p.qid}. ${p.short} <span class="faint small">${AM.fmt.isoDateText(p.date)}</span></span><span class="row tight">${['YES', 'MAYBE', 'NO'].map((v) => html`<button class="btn small" data-act="set-outcome" data-id="${p.id}" data-v="${v}">${v}</button>`)}</span></div></li>`)}</ul><p class="small muted">Record what actually happened (YES: it went the user's way, NO: it did not, MAYBE: mixed).</p></div>` : ''}
      <div class="card"><div class="row between"><h3 style="margin:0">Historical test cases (${tests.length})</h3><span class="row tight"><button class="btn small primary" data-act="test-run-all">Run all under the current rules</button><button class="btn small" data-act="test-export">Export CSV</button><label class="btn small" style="cursor:pointer">Import CSV<input type="file" accept=".csv,text/csv" data-change="test-import" hidden></label></span></div>
      <p class="small muted">A test case is a past event with a known outcome: birth data, a question, the event date and what actually happened. The engine recomputes the transits for that past date, so you can test the method on history. CSV columns: name, birth_date (YYYY-MM-DD), birth_time (HH:MM), birth_place (city or lat;lon;tz), question_id, event_date, event_time, actual (YES/MAYBE/NO), notes.</p>
      ${tests.length ? table(['Name', 'Question', 'Event', 'Predicted', 'Actual', 'Match', 'Score', 'Rules', ''], tests.map((c) => [c.name, c.qid + '. ' + ((AM.bank.get(c.qid) || {}).short || ''), AM.fmt.isoDateText(c.date) + (c.time ? ' ' + c.time : ''), c.last ? verdictTag(c.last.verdict) : '-', c.actual ? verdictTag(c.actual) : '-', c.last && c.actual ? (c.last.verdict === c.actual ? html`<span class="pos-t">yes</span>` : html`<span class="neg-t">no</span>`) : '-', c.last ? c.last.score : '-', c.last ? c.last.rv + (c.last.fp !== AM.rules.ref().fingerprint ? ' (older)' : '') : '-', html`<button class="btn small" data-act="test-open" data-id="${c.id}">Open</button> <button class="btn small danger" data-act="test-del" data-id="${c.id}">Delete</button>`])) : html`<p class="muted">No test cases yet.</p>`}
      <div style="margin-top:14px">${statsHtml(tests)}</div></div>
      <details class="fold"><summary>Add a historical test case</summary><div class="body"><form data-form="test-add" novalidate>
        <div class="fgrid"><div class="field"><label>Name or reference</label><input name="name" required></div><div class="field"><label>Question</label><select name="qid">${qopts}</select></div></div>
        <div class="fgrid c3"><div class="field"><label>Birth date</label><input type="date" name="bdate" required></div><div class="field"><label>Birth time</label><input type="time" name="btime"></div><div class="field"><label>Time accuracy</label><select name="acc"><option value="exact">Exact</option><option value="approx">Approximate</option><option value="unknown">Unknown</option></select></div></div>
        ${cityF('tb', 'Birthplace')}
        <div class="fgrid c3"><div class="field"><label>Event date</label><input type="date" name="edate" required></div><div class="field"><label>Event time (optional)</label><input type="time" name="etime"></div><div class="field"><label>Actual outcome</label><select name="actual"><option value="">Not known yet</option><option>YES</option><option>MAYBE</option><option>NO</option></select></div></div>
        ${cityF('te', 'Event location (leave empty to use the birthplace)')}
        <div class="field"><label>Notes</label><input name="notes"></div><div id="test-msg"></div><button class="btn primary" type="submit">Add and run</button></form></div></details>`;
  }

  /* ---------------------------------------------------------------- main view */
  async function view(tab) {
    if (tab && TABS.some((t) => t[0] === tab)) A.tab = tab;
    const p = U.profileById(A.pid) || U.activeProfile();
    const c = activeChart();
    if (!c && A.tab !== 'tests') return html`<div class="card center"><h3>No birth profile</h3><p class="muted">The dashboard analyses saved birth profiles (for yourself or your clients).</p><a class="btn primary" href="#/birth">Create a birth profile</a></div>`;
    if (!A.date) { const pl0 = (p && p.place) || { tz: 'Asia/Kolkata' }; A.date = AM.time.todayAt(pl0); A.place = A.place || (p && p.place); }
    const qopts = AM.bank.CATEGORIES.map((cat) => html`<optgroup label="${cat.id}. ${cat.short}">${AM.bank.all().filter((s) => s.cat === cat.id).map((s) => html`<option value="${s.id}" ${A.qid === s.id ? 'selected' : ''}>${s.id}. ${s.short}</option>`)}</optgroup>`);
    let body;
    if (A.tab === 'natal') body = tabNatal(c); else if (A.tab === 'houses') body = tabHouses(c); else if (A.tab === 'capacity') body = tabCapacity(c);
    else if (A.tab === 'query') body = tabQuery(c); else if (A.tab === 'transit') body = tabTransit(c); else if (A.tab === 'moon') body = tabMoon(c); else if (A.tab === 'reason') body = tabReason(); else body = await tabTests();
    return html`<h2>Astrologer dashboard</h2><p class="muted small">Inspect the reasoning instead of trusting a conclusion: every house, planet, relationship, transit and point is shown.</p>
      <form class="card" data-form="astro-run" novalidate><div class="fgrid c3">
        <div class="field"><label>Birth profile</label><select name="pid" data-change="astro-pid">${S.profiles.map((x) => html`<option value="${x.id}" ${x.id === (p && p.id) ? 'selected' : ''}>${x.name}</option>`)}</select></div>
        <div class="field"><label>Question</label><select name="qid">${qopts}</select></div>
        <div class="field"><label>Event date</label><input type="date" name="date" value="${A.date}"></div></div>
        <div class="fgrid"><div class="field"><label>Event time (optional)</label><input type="time" name="time" value="${A.time}"></div>${U.cityField('ap', A.place || (p && p.place), 'Event location')}</div>
        <div class="row"><button class="btn primary" type="submit">Run analysis</button>${A.result ? html`<span class="tag">${A.result.question.id}: ${A.result.verdict}</span>` : ''}</div></form>
      <div class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button class="${A.tab === k ? 'on' : ''}" data-act="astro-tab" data-tab="${k}">${l}</button>`)}</div>${body}`;
  }
  route('astro', { roles: ['astrologer', 'admin'], title: 'Astrologer dashboard', nav: 'astro', view });
  /* the tab lives in the address (#/astro/<tab>), so tab changes must go through the router */
  const goTab = (t) => { A.tab = t; go('/astro/' + t); };
  on('astro-tab', (el) => goTab(el.dataset.tab));
  changes['astro-pid'] = (el) => { A.pid = el.value; A.result = null; A.sheet = null; A.savedId = null; A.ephemeral = null; U.render(); };
  forms['astro-run'] = async (f, d) => {
    const p = U.profileById(val(d, 'pid')) || U.activeProfile(); if (!p) throw new Error('Create a birth profile first.');
    A.pid = p.id; A.qid = +val(d, 'qid'); A.date = val(d, 'date'); A.time = val(d, 'time'); A.ephemeral = null;
    const place = U.placeFromForm(d, 'ap') || A.place || p.place; A.place = place;
    if (!AM.time.validIso(A.date)) throw new Error('Please choose a valid event date.');
    const chart = U.chartOf(p); const sheet = AM.bank.get(A.qid);
    A.event = { date: A.date, time: A.time, place, notes: '' };
    A.result = AM.predict.analyze(chart, sheet, A.event); A.chart = chart; A.sheet = sheet; A.savedId = null;
    toast('Analysis complete: ' + A.result.verdict + '.');
    goTab(['natal', 'houses', 'capacity', 'tests'].includes(A.tab) ? 'reason' : A.tab);
  };
  on('astro-save', async () => {
    if (!A.result || A.savedId) return;
    const p = U.profileById(A.pid) || U.activeProfile();
    const rec = await AM.store.savePrediction(A.result, { profileId: p && p.id, profileName: p && p.name, notes: '' });
    A.savedId = rec.id; toast('Saved to the history of this account.'); U.render();
  });
  forms['astro-notes'] = async (f, d) => {
    if (!A.savedId) { const p = U.profileById(A.pid) || U.activeProfile(); const rec = await AM.store.savePrediction(A.result, { profileId: p && p.id, profileName: p && p.name }); A.savedId = rec.id; }
    const ov = val(d, 'verdict') ? { verdict: val(d, 'verdict'), reason: val(d, 'reason') || 'astrologer judgement', by: S.user.name, at: Date.now() } : null;
    const research = { note: val(d, 'note'), override: ov };
    await AM.store.updatePrediction(A.savedId, { research }); A.result.research = research; toast('Research notes saved.'); U.render();
  };
  /* test cases */
  async function saveTests(list) { await AM.store.saveTests(list); }
  forms['test-add'] = async (f, d) => {
    const msg = doc.getElementById('test-msg'); const bad = (t) => { msg.innerHTML = '<div class="banner bad">' + esc(t) + '</div>'; throw new Error(t); };
    const bd = val(d, 'bdate'); if (!AM.time.validIso(bd)) bad('Please enter the birth date.'); const ed = val(d, 'edate'); if (!AM.time.validIso(ed)) bad('Please enter the event date.');
    const place = U.placeFromForm(d, 'tb'); if (!place) bad('Pick the birthplace from the list.');
    const [y, mo, dd] = bd.split('-').map(Number); const acc = val(d, 'acc'); const tm = /^(\d{1,2}):(\d{2})/.exec(val(d, 'btime'));
    if (acc !== 'unknown' && !tm) bad('Enter the birth time or choose "Unknown".');
    const c = { id: AM.util.uid('t'), name: val(d, 'name') || 'case', y, mo, d: dd, h: tm ? +tm[1] : 12, mi: tm ? +tm[2] : 0, accuracy: acc, place, qid: +val(d, 'qid'), date: ed, time: val(d, 'etime'), eplace: U.placeFromForm(d, 'te') || null, actual: val(d, 'actual') || null, notes: val(d, 'notes') };
    runCase(c);
    const list = await AM.store.listTests(); list.push(c); await saveTests(list); toast('Test case added: predicted ' + c.last.verdict + '.'); U.render();
  };
  on('test-del', async (el) => { const list = (await AM.store.listTests()).filter((c) => c.id !== el.dataset.id); await saveTests(list); U.render(); });
  on('test-run-all', async () => {
    const list = await AM.store.listTests(); let changed = 0;
    for (const c of list) { const before = c.last && c.last.verdict; try { runCase(c); } catch (e) { continue; } if (before && before !== c.last.verdict) changed += 1; }
    await saveTests(list); toast('Re-ran ' + list.length + ' cases under rule set ' + AM.rules.active.version + (changed ? ' (' + changed + ' verdicts changed)' : ' (no verdict changed)') + '.'); U.render();
  });
  on('test-open', async (el) => {
    const c = (await AM.store.listTests()).find((x) => x.id === el.dataset.id); if (!c) return;
    const chart = caseChart(c); const sheet = AM.bank.get(c.qid);
    A.ephemeral = { chart, name: c.name }; A.qid = c.qid; A.date = c.date; A.time = c.time || ''; A.place = c.eplace || c.place; A.sheet = sheet;
    A.event = { date: c.date, time: c.time || '', place: A.place, notes: '' };
    A.result = AM.predict.analyze(chart, sheet, A.event); A.chart = chart; A.savedId = null; toast('Opened the test case "' + c.name + '".'); goTab('reason');
  });
  on('test-export', async () => {
    const list = await AM.store.listTests(); const q = U.csvCell;
    const rows = [['name', 'birth_date', 'birth_time', 'birth_place', 'question_id', 'event_date', 'event_time', 'actual', 'notes', 'predicted', 'score', 'rule_set']].concat(list.map((c) => [c.name, c.y + '-' + String(c.mo).padStart(2, '0') + '-' + String(c.d).padStart(2, '0'), c.accuracy === 'unknown' ? '' : String(c.h).padStart(2, '0') + ':' + String(c.mi).padStart(2, '0'), c.place.lat + ';' + c.place.lon + ';' + (c.place.tz || ''), c.qid, c.date, c.time || '', c.actual || '', c.notes || '', c.last ? c.last.verdict : '', c.last ? c.last.score : '', c.last ? c.last.rv : '']));
    download('astromate-test-cases.csv', 'text/csv', rows.map((r) => r.map(q).join(',')).join('\r\n'));
  });
  changes['test-import'] = async (el) => {
    const file = el.files[0]; if (!file) return;
    const rows = parseCsv(await file.text()); const head = rows.shift().map((h) => h.trim().toLowerCase());
    const col = (n) => head.indexOf(n); const list = await AM.store.listTests(); let ok = 0; const skipped = [];
    rows.forEach((r, i) => {
      try {
        const bd = (r[col('birth_date')] || '').trim(); const [y, mo, dd] = bd.split('-').map(Number); const tm = /^(\d{1,2}):(\d{2})/.exec((r[col('birth_time')] || '').trim());
        const place = resolvePlace(r[col('birth_place')]); if (!place || !AM.time.validIso(bd)) throw new Error('birth data');
        const c = { id: AM.util.uid('t'), name: (r[col('name')] || 'case ' + (i + 1)).trim(), y, mo, d: dd, h: tm ? +tm[1] : 12, mi: tm ? +tm[2] : 0, accuracy: tm ? 'exact' : 'unknown', place, qid: +r[col('question_id')], date: (r[col('event_date')] || '').trim(), time: (r[col('event_time')] || '').trim(), eplace: null, actual: ((r[col('actual')] || '').trim().toUpperCase()) || null, notes: (r[col('notes')] || '').trim() };
        if (!AM.time.validIso(c.date)) throw new Error('event date');
        runCase(c); list.push(c); ok += 1;
      } catch (e) { skipped.push(i + 2); }
    });
    await saveTests(list); toast('Imported ' + ok + ' cases' + (skipped.length ? '; skipped rows ' + skipped.join(', ') : '') + '.'); U.render();
  };
})(typeof window !== 'undefined' ? window : globalThis);
