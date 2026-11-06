/* ASTROMATE prediction engine: query mapping, natal potential, transit-Moon trigger, dispositor, aspects, confirming transits,
   YES / MAYBE / NO decision, occurrence-versus-success judgement and timing windows.
   The engine produces facts and signed scores; the wording of every factor is generated from those facts (no free-form invention). */
(function (g) {
  'use strict';
  const AM = g.AM;
  const V = AM.vedic;
  const { clamp, norm360 } = AM.m;
  const ord = AM.fmt.ordinal;
  const r1 = (x) => Math.round(x * 10) / 10;
  const SEVEN = AM.SEVEN; const BODIES = AM.BODIES;
  const upachaya = (h) => h === 3 || h === 6 || h === 10 || h === 11;
  const GENERIC_MOON_HOUSE = { 1: 6, 2: 3, 3: 3, 4: 4, 5: 6, 6: -5, 7: 4, 8: -8, 9: 6, 10: 6, 11: 6, 12: -6 };
  const REL_POS = { 1: 4, 2: -0.5, 3: 1, 4: 2.5, 5: 3, 6: -3.5, 7: 2.5, 8: -3.5, 9: 3, 10: 2.5, 11: 1.5, 12: -1.5 };
  const BASE_NAT = { Jupiter: 4, Venus: 3, Mercury: 2, Sun: 0, Mars: -2, Saturn: -2, Rahu: -3, Ketu: -3 };
  const ASP_QUERY = { Jupiter: 2, Venus: 0.8, Mercury: 0.5, Sun: -0.3, Mars: -1.5, Saturn: -1.5, Rahu: -1, Ketu: -1 };
  const CONJ_MOON = { Jupiter: 6, Venus: 4, Mercury: 2, Sun: -3, Mars: -5, Saturn: -6, Rahu: -6, Ketu: -4 };
  const ASP_MOON = { Jupiter: 4, Venus: 2, Mercury: 1.5, Sun: -1, Mars: -3, Saturn: -4, Rahu: -3, Ketu: -3 };
  const CONTACT_SIG = { Jupiter: 2, Venus: 1, Mercury: 0.5, Saturn: -2, Mars: -1.5, Rahu: -2, Ketu: -1.5, Sun: 0 };
  const GOCHARA_WT = { Sun: 1, Mars: 1.2, Mercury: 1, Jupiter: 1.5, Venus: 1, Saturn: 1.5, Rahu: 1, Ketu: 1 };

  /* ------------------------------------------------------------------ sheet configuration */
  /** Turn a sheet into a judgement configuration: 'S' = success (main sheet), 'O' = occurrence (sheet.occ). */
  function cfgOf(sheet, kind) {
    if (kind === 'O' && sheet.occ) {
      const o = sheet.occ;
      return {
        kind: 'O', label: 'Occurrence', q: o.q, primary: o.primary, secondary: o.secondary, planets: o.planets, combos: o.combos,
        moon: o.moon, disp: sheet.disp, asp: sheet.asp, texts: { yes: o.yesText, maybe: o.maybeText, no: o.noText }, strict: sheet.strict || 0,
      };
    }
    return {
      kind: 'S', label: sheet.distinct ? 'Success' : 'Outcome', q: sheet.suc || sheet.text, primary: sheet.primary, secondary: sheet.secondary,
      planets: sheet.planets, combos: sheet.combos, moon: sheet.moon, disp: sheet.disp, asp: sheet.asp,
      texts: { yes: sheet.yesText, maybe: sheet.maybeText, no: sheet.noText }, strict: sheet.strict || 0,
    };
  }

  /** Helpers bound to one chart and one configuration. */
  function helpers(natal, cfg) {
    const planetsIn = (arr) => Array.from(new Set((arr || []).map((r) => V.resolveRole(natal, r)).filter(Boolean)));
    const primaryH = cfg.primary.map((x) => x.h); const secondaryH = cfg.secondary.map((x) => x.h);
    const primaryLords = Array.from(new Set(primaryH.map((h) => natal.houseLord[h])));
    const secondaryLords = Array.from(new Set(secondaryH.map((h) => natal.houseLord[h])));
    const sheetPlanets = cfg.planets.map((x) => x.p);
    const lagnaLord = natal.houseLord[1];
    const H = {
      natal, cfg, primaryH, secondaryH, primaryLords, secondaryLords, sheetPlanets, lagnaLord, planetsIn,
      moonWant: planetsIn(cfg.moon.want), moonAvoid: planetsIn(cfg.moon.avoid),
      dispWant: planetsIn(cfg.disp.want), aspWant: planetsIn(cfg.asp.want), aspAvoid: planetsIn(cfg.asp.avoid),
      roleOfHouse: (h) => { const f = cfg.primary.concat(cfg.secondary).find((x) => x.h === h); return f ? f.r : null; },
      sf: (p) => 0.35 + (0.65 * natal.strength[p].pct) / 100,
      /** relevance of planet p to this question (>= 1) */
      rel(p, extra) {
        let r = 1;
        if (primaryLords.includes(p)) r += 0.5;
        if (secondaryLords.includes(p)) r += 0.25;
        if (p === lagnaLord) r += 0.2;
        if (sheetPlanets.includes(p)) r += 0.35;
        if (extra && extra.includes(p)) r += 0.4;
        return Math.min(2.2, r);
      },
      /** effective quality of planet p in [-1,1]; want/avoid lists shift it */
      qual(p, want, avoid) {
        let q = natal.planets[p].func.q;
        if (want && want.includes(p)) q += 0.3;
        if (avoid && avoid.includes(p)) q -= 0.3;
        return clamp(q, -1, 1);
      },
      roles(p) {
        const out = [];
        for (const x of cfg.primary.concat(cfg.secondary)) if (natal.houseLord[x.h] === p) out.push('lord of the ' + ord(x.h) + ' (' + x.r + ')');
        if (p === lagnaLord && !out.some((s) => s.indexOf('1st') >= 0)) out.push('Lagna lord');
        const sp = cfg.planets.find((x) => x.p === p);
        if (sp) out.push('natural significator: ' + sp.r);
        return out;
      },
      readiness(p, karaka) {
        let q = natal.planets[p].func.q;
        if (karaka) q = Math.max(q, -0.1);
        return natal.strength[p].pct * (0.55 + 0.45 * q);
      },
      nm(role) { const p = V.resolveRole(natal, role); const mt = /^L(\d+)$/.exec(role); return mt ? ord(+mt[1]) + ' lord (' + p + ')' : p || role; },
    };
    return H;
  }

  /* ------------------------------------------------------------------ natal potential (stages 2 to 5) */
  function houseReadiness(natal, H, h) {
    const lord = natal.houseLord[h];
    const lordR = H.readiness(lord, false);
    let score = 50 + (lordR - 50) * 0.8;
    const detail = [AM.fmt.ordinal(h) + ' lord ' + lord + ' readiness ' + Math.round(lordR) + '%'];
    const house = natal.houses[h];
    for (const o of house.occupants) {
      if (o === lord) continue;
      const c = V.classify(natal, o);
      let e = 0;
      if (c.ben && !c.mal) e = 7; else if (c.mal && !c.ben) e = upachaya(h) ? 1 : -7;
      e *= 0.5 + (0.5 * natal.strength[o].pct) / 100;
      if (e) { score += e; detail.push((e > 0 ? '+' : '') + r1(e) + ' occupant ' + o); }
    }
    for (const a of house.aspectedBy) {
      const c = V.classify(natal, a);
      let e = 0;
      if (c.ben && !c.mal) e = 4; else if (c.mal && !c.ben) e = -4;
      e *= 0.5 + (0.5 * natal.strength[a].pct) / 100;
      if (e) { score += e; detail.push((e > 0 ? '+' : '') + r1(e) + ' aspect of ' + a); }
    }
    if (house.kartari === 'shubha') { score += 4; detail.push('+4 hemmed by benefics (Shubhakartari)'); }
    if (house.kartari === 'papa') { score -= 4; detail.push('-4 hemmed by malefics (Papakartari)'); }
    return { h, lord, score: clamp(score, 0, 100), detail };
  }

  function strengthBandOK(pct) { return pct >= 55; }

  function evalCombo(natal, H, c) {
    const w = c.w || 5;
    const out = { combo: c, effect: 0, status: 'neutral', text: '' };
    const P = (role) => V.resolveRole(natal, role);
    const afflict = (p) => {
      const b = natal.planets[p]; const list = [];
      if (b.combust) list.push('combust');
      if (b.dignity && b.dignity.key === 'debilitated' && !(b.nb && b.nb.count)) list.push('debilitated');
      if (V.isDusthana(b.house)) list.push('in a dusthana (' + ord(b.house) + ')');
      if (['Mars', 'Saturn', 'Rahu', 'Ketu'].some((x) => x !== p && b.conj.includes(x))) list.push('with a malefic');
      return list;
    };
    switch (c.t) {
      case 'link': {
        const a = P(c.a); const b = P(c.b);
        if (!a || !b) { out.text = 'Link not evaluated'; break; }
        const rel = V.sambandha(natal, a, b);
        const frac = clamp(rel.score / 4, 0, 1);
        const qa = H.qual(a); const qb = H.qual(b);
        const pairF = 0.6 + 0.4 * clamp((qa + qb) / 2 + 0.2, 0, 1);
        if (c.neg) {
          out.effect = frac > 0 ? -w * frac * (0.6 + (0.4 * natal.strength[b].pct) / 100) : 0.15 * w;
          out.status = frac > 0 ? 'fail' : 'pass';
          out.text = H.nm(c.a) + ' and ' + H.nm(c.b) + (frac > 0 ? ' are linked (' + rel.text + '): an obstructive link' : ' have no link: free of that obstruction');
        } else {
          out.effect = frac > 0 ? w * frac * pairF : -0.3 * w;
          out.status = frac >= 0.5 ? 'pass' : frac > 0 ? 'partial' : 'fail';
          out.text = H.nm(c.a) + ' and ' + H.nm(c.b) + (frac > 0 ? ': ' + rel.text : ' are not linked');
        }
        out.rel = rel;
        break;
      }
      case 'place': {
        const a = P(c.a); if (!a) break;
        const hh = natal.planets[a].house; const inside = c.in.includes(hh);
        if (c.neg) { out.effect = inside ? -w : 0.15 * w; out.status = inside ? 'fail' : 'pass'; }
        else { out.effect = inside ? w : V.isDusthana(hh) ? -0.6 * w : -0.2 * w; out.status = inside ? 'pass' : 'fail'; }
        out.text = H.nm(c.a) + ' is in the ' + ord(hh) + ' house' + (c.neg ? (inside ? ': an obstructive placement' : ': away from the obstructive houses') : inside ? ': a supportive placement' : ': outside the supportive houses');
        break;
      }
      case 'strong': {
        const a = P(c.a); if (!a) break;
        const pct = natal.strength[a].pct;
        out.effect = pct >= 55 ? w : pct >= 40 ? 0.3 * w : pct >= 25 ? -0.3 * w : -w;
        out.status = pct >= 55 ? 'pass' : pct >= 40 ? 'partial' : 'fail';
        out.text = H.nm(c.a) + ' strength ' + Math.round(pct) + '% (' + natal.strength[a].band + ')';
        break;
      }
      case 'dignity': {
        const a = P(c.a); if (!a) break;
        const k = natal.planets[a].dignity ? natal.planets[a].dignity.key : 'neutral';
        const rank = { exalted: 4, moolatrikona: 3.5, own: 3, friend: 2, neutral: 1, enemy: 0, debilitated: -1 }[k];
        if (c.min === 'exalted') out.effect = k === 'exalted' ? w : rank >= 3 ? 0.5 * w : -0.1 * w;
        else if (c.min === 'own') out.effect = rank >= 3 ? w : rank === 2 ? 0.2 * w : rank === 1 ? -0.2 * w : -0.7 * w;
        else out.effect = rank >= 2 ? w : rank === 1 ? -0.2 * w : -w;
        out.status = out.effect >= 0.5 * w ? 'pass' : out.effect > 0 ? 'partial' : 'fail';
        out.text = H.nm(c.a) + ' is in ' + (natal.planets[a].dignity ? natal.planets[a].dignity.label.toLowerCase() : 'a neutral sign');
        break;
      }
      case 'occupant':
      case 'aspect': {
        const house = natal.houses[c.h];
        const list = c.t === 'occupant' ? house.occupants : house.aspectedBy;
        const want = c.t === 'occupant' ? c.kind : c.by;
        const hits = list.filter((p) => { const k = V.classify(natal, p); return want === 'benefic' ? k.ben && !k.mal : k.mal && !k.ben; });
        const sfSum = hits.reduce((s, p) => s + (0.5 + (0.5 * natal.strength[p].pct) / 100), 0);
        if (want === 'benefic') { out.effect = hits.length ? w * Math.min(1, 0.7 * sfSum) : 0; out.status = hits.length ? 'pass' : 'neutral'; }
        else { out.effect = hits.length ? -w * Math.min(1, 0.7 * sfSum) : 0.2 * w; out.status = hits.length ? 'fail' : 'pass'; }
        out.text = 'The ' + ord(c.h) + ' house ' + (c.t === 'occupant' ? 'is occupied by ' : 'is aspected by ') + (hits.length ? hits.join(', ') + ' (' + want + ')' : 'no ' + want + ' planet');
        break;
      }
      case 'free': {
        const a = P(c.a); if (!a) break;
        const present = afflict(a).filter((s) => c.of.some((k) => s.indexOf(k === 'dusthana' ? 'dusthana' : k === 'malefic' ? 'malefic' : k) >= 0));
        out.effect = present.length === 0 ? w : -w * Math.min(1, (present.length / c.of.length) * 1.2);
        out.status = present.length === 0 ? 'pass' : 'fail';
        out.text = H.nm(c.a) + (present.length ? ' is ' + present.join(', ') : ' is free of ' + AM.fmt.joinAnd(c.of));
        break;
      }
      case 'yoga': {
        const p = natal.planets; let on = false;
        if (c.id === 'budhaditya') on = p.Sun.sign === p.Mercury.sign;
        else if (c.id === 'gajakesari') on = V.isKendra(V.houseFrom(p.Moon.sign, p.Jupiter.sign));
        else if (c.id === 'chandra-mangala') on = p.Moon.sign === p.Mars.sign;
        out.effect = on ? w : 0; out.status = on ? 'pass' : 'neutral';
        out.text = { budhaditya: 'Budha-Aditya (Sun with Mercury)', gajakesari: 'Gajakesari (Jupiter in a Kendra from the Moon)', 'chandra-mangala': 'Chandra-Mangala (Moon with Mars)' }[c.id] + (on ? ' is present' : ' is not present');
        break;
      }
      default: break;
    }
    out.effect = r1(out.effect);
    return out;
  }

  function natalPotential(natal, cfg, rules) {
    const H = helpers(natal, cfg);
    const W = rules.weights;
    const houses = [];
    for (const x of cfg.primary) houses.push(Object.assign({ role: x.r, weight: W.primaryHouse, primary: true }, houseReadiness(natal, H, x.h)));
    for (const x of cfg.secondary) houses.push(Object.assign({ role: x.r, weight: W.secondaryHouse, primary: false }, houseReadiness(natal, H, x.h)));
    const wsum = houses.reduce((s, h) => s + h.weight, 0);
    const houseAvg = houses.reduce((s, h) => s + h.weight * h.score, 0) / wsum;
    const planets = cfg.planets.map((x) => {
      const R = H.readiness(x.p, true);
      return { p: x.p, role: x.r, R, pct: natal.strength[x.p].pct, band: natal.strength[x.p].band, house: natal.planets[x.p].house, dignity: natal.planets[x.p].dignity ? natal.planets[x.p].dignity.label : '-', func: natal.planets[x.p].func.label };
    });
    const planetAvg = planets.reduce((s, p) => s + p.R, 0) / planets.length;
    const lagnaH = houseReadiness(natal, H, 1);
    const lagnaR = (H.readiness(H.lagnaLord, false) + lagnaH.score) / 2;
    const combos = cfg.combos.map((c) => evalCombo(natal, H, c));
    const comboScore = clamp(50 + combos.reduce((s, c) => s + c.effect, 0), 0, 100);
    const wTot = W.natalHouses + W.natalPlanets + W.natalLagna + W.natalCombos;
    const base = (W.natalHouses * houseAvg + W.natalPlanets * planetAvg + W.natalLagna * lagnaR + W.natalCombos * comboScore) / (wTot || 1);
    const Nn = clamp(50 + (base - rules.calibration.natalCenter) * rules.calibration.natalGain, 0, 100);
    const th = rules.thresholds;
    return {
      N: Nn, base, band: Nn >= th.natalStrong ? 'Strong' : Nn >= th.natalModerate ? 'Moderate' : 'Weak',
      houses, planets, lagna: { score: lagnaR, lord: H.lagnaLord, house: lagnaH }, combos,
      parts: { houses: houseAvg, planets: planetAvg, lagna: lagnaR, combos: comboScore },
    };
  }

  /* ------------------------------------------------------------------ transit Moon (stages 6 to 8) */
  function moonFacts(natal, tr, cfg, rules, H) {
    const R = rules.moon; const mb = tr.planets.Moon; const hm = mb.house;
    const f = []; /* factors */
    const inPrimary = H.primaryH.includes(hm); const inSecondary = H.secondaryH.includes(hm);
    const mult = inPrimary ? R.activationPrimary : inSecondary ? R.activationSecondary : 1;
    const placeTxt = 'the transit Moon is in ' + AM.fmt.signPos(mb.lon) + ' (' + mb.nak + ' pada ' + mb.pada + '), your ' + ord(hm) + ' house';
    /* A. house valence */
    let v; let why;
    if (cfg.moon.good.includes(hm)) { v = V.isDusthana(hm) ? R.goodDusthana : R.goodHouse; why = 'a house that supports this matter' + (H.roleOfHouse(hm) ? ' (' + H.roleOfHouse(hm) + ')' : ''); }
    else if (cfg.moon.bad.includes(hm)) { v = hm === 8 ? R.badEighth : R.badHouse; why = 'a house that tends to obstruct this matter'; }
    else { v = GENERIC_MOON_HOUSE[hm] * R.genericScale; why = 'a house with no special bearing on this matter (general quality of the ' + ord(hm) + ' house)'; }
    f.push({ id: 'moon.house', stage: 6, cat: 'moon', delta: r1(v), text: 'Activation: ' + placeTxt + ', ' + why + '.' });
    /* B. Moon's own condition */
    let cond = 0; const cn = [];
    if (tr.moonStrong) { cond += R.strongPaksha; cn.push('bright half of the cycle'); } else { cond += R.weakPaksha; cn.push('waning crescent half of the cycle (weaker Moon)'); }
    if (tr.moonElong < 18 || tr.moonElong > 342) { cond += R.newMoonExtra; cn.push('close to the New Moon'); }
    const dk = mb.dignity ? mb.dignity.key : 'neutral';
    if (dk === 'own' || dk === 'exalted') { cond += R.ownOrExalted; cn.push(dk === 'own' ? 'in its own sign' : 'exalted'); }
    if (dk === 'debilitated') { cond += R.debilitated; cn.push('debilitated'); }
    const gand = ((mb.sign === 3 || mb.sign === 7 || mb.sign === 11) && mb.deg >= 26 + 2 / 3) || ((mb.sign === 4 || mb.sign === 8 || mb.sign === 0) && mb.deg < 3 + 1 / 3);
    if (gand) { cond += R.gandanta; cn.push('in a Gandanta (sign-junction) zone'); }
    f.push({ id: 'moon.condition', stage: 6, cat: 'moon', delta: r1(cond), text: 'Condition of the Moon: ' + cn.join('; ') + ' (' + tr.tithi.paksha + ' ' + tr.tithi.name + ').' });
    /* C. contacts with natal planets in the same sign */
    const contacts = BODIES.filter((p) => natal.planets[p].sign === mb.sign);
    for (const p of contacts) {
      const rel = H.rel(p, H.moonWant); const q = H.qual(p, H.moonWant, H.moonAvoid); const sf = H.sf(p);
      const d = R.contactScale * rel * q * sf * mult;
      const roles = H.roles(p);
      f.push({ id: 'moon.contact.' + p, stage: 6, cat: 'moon', planet: p, delta: r1(d), text: 'The Moon joins natal ' + p + ' (' + natal.planets[p].func.label.toLowerCase() + ', ' + natal.strength[p].band.toLowerCase() + ' ' + Math.round(natal.strength[p].pct) + '%' + (roles.length ? '; ' + roles.join(', ') : '') + ').' });
    }
    if (!contacts.length) f.push({ id: 'moon.empty', stage: 6, cat: 'moon', delta: 0, text: 'No natal planet occupies the Moon\'s sign, so the Moon acts through its dispositor and the aspects it receives.' });
    /* D. relation of the Moon to the query houses */
    let sw = 0; let sv = 0;
    for (const x of cfg.primary) { sv += REL_POS[V.houseFrom(x.h, hm)]; sw += 1; }
    for (const x of cfg.secondary) { sv += 0.5 * REL_POS[V.houseFrom(x.h, hm)]; sw += 0.5; }
    const relD = (sv / sw) * R.relationScale * mult;
    f.push({ id: 'moon.relation', stage: 6, cat: 'moon', delta: r1(relD), text: 'The Moon stands ' + AM.fmt.joinAnd(cfg.primary.map((x) => ord(V.houseFrom(x.h, hm)) + ' from the ' + ord(x.h))) + ' (kendra, trikona and 11th relations help; 6th/8th relations cause friction).' });
    /* E. dispositor (stage 7) */
    const D = AM.SIGNS[mb.sign].lord; const Db = natal.planets[D];
    let place = 0; let ptxt = 'a house with no special bearing';
    if (cfg.disp.good.includes(Db.house)) { place = R.dispositorGood; ptxt = 'a house that supports this matter'; }
    else if (cfg.disp.bad.includes(Db.house)) { place = R.dispositorBad; ptxt = 'a house that obstructs this matter'; }
    else place = GENERIC_MOON_HOUSE[Db.house] * 0.5 * R.genericScale;
    place *= place > 0 ? 0.5 + (0.5 * natal.strength[D].pct) / 100 : 1; /* a weak dispositor delivers less of the credit for a good house */
    const relD2 = H.rel(D, H.dispWant); const qD = H.qual(D, H.dispWant, null); const sfD = H.sf(D);
    const dq = R.dispositorScale * relD2 * qD * sfD * mult;
    let link = 0; const linkTxt = [];
    for (const L of H.primaryLords) {
      if (L === D) continue;
      const rs = V.sambandha(natal, D, L);
      if (rs.score >= 1.5) { link += R.dispositorLinkScale * clamp(rs.score / 4, 0, 1) * clamp(qD + 0.3, -1, 1); linkTxt.push(L + ' (' + rs.types[0].label + ')'); }
    }
    link = clamp(link, -4, 4);
    const droles = H.roles(D);
    f.push({
      id: 'disp', stage: 7, cat: 'moon', planet: D, delta: r1(place + dq + link),
      text: 'The Moon\'s dispositor is ' + D + ' (lord of ' + AM.SIGNS[mb.sign].name + '). Natally it sits in your ' + ord(Db.house) + ' house in ' + Db.signName + ' (' + (Db.dignity ? Db.dignity.label.toLowerCase() : '') + ', ' + natal.strength[D].band.toLowerCase() + ' ' + Math.round(natal.strength[D].pct) + '%, ' + Db.func.label.toLowerCase() + '), ' + ptxt + (droles.length ? '; ' + droles.join(', ') : '') + (linkTxt.length ? '. Linked with ' + linkTxt.join(', ') : '') + '.',
    });
    /* nakshatra link */
    const Nl = mb.nakLord;
    if (Nl !== 'Moon') {
      const relN = H.rel(Nl, H.dispWant); const qN = H.qual(Nl, H.dispWant, null);
      let dn = R.nakshatraScale * relN * qN * H.sf(Nl) * mult;
      if (Nl === D) dn *= 0.5;
      f.push({ id: 'nak', stage: 7, cat: 'moon', planet: Nl, delta: r1(dn), text: 'The Moon is in ' + mb.nak + ', a nakshatra of ' + Nl + ' (natally in your ' + ord(natal.planets[Nl].house) + ' house, ' + natal.strength[Nl].band.toLowerCase() + '): the Moon carries its agenda.' });
    }
    /* F. natal planets aspecting the Moon's sign (stage 8) */
    const aspecting = BODIES.filter((a) => natal.planets[a].house !== hm && natal.planets[a].aspHouses.includes(hm));
    for (const a of aspecting) {
      const rel = H.rel(a, H.aspWant); const q = H.qual(a, H.aspWant, H.aspAvoid); const sf = H.sf(a);
      const d = R.aspectScale * rel * q * sf * mult;
      const roles = H.roles(a);
      f.push({ id: 'asp.' + a, stage: 8, cat: 'moon', planet: a, delta: r1(d), text: 'Natal ' + a + ' (your ' + ord(natal.planets[a].house) + ' house, ' + natal.planets[a].func.label.toLowerCase() + ', ' + Math.round(natal.strength[a].pct) + '%) aspects the Moon\'s sign' + (roles.length ? '; ' + roles.join(', ') : '') + '.' });
    }
    if (!aspecting.length) f.push({ id: 'asp.none', stage: 8, cat: 'moon', delta: 0, text: 'No natal planet aspects the Moon\'s sign.' });
    const raw = f.reduce((s, x) => s + x.delta, 0);
    return { factors: f, raw, score: clamp((raw - R.center) * R.scaleOut, -100, 100), house: hm, dispositor: D, contacts, aspecting, mult };
  }

  /* ------------------------------------------------------------------ confirming transits (stage 9) */
  function confirmFacts(natal, tr, cfg, rules, H) {
    const R = rules.confirm; const T = rules.toggles; const f = [];
    const hm = tr.planets.Moon.house;
    if (T.chandraBala) {
      const ok = tr.chandraBala.ok;
      f.push({ id: 'c.chandra', stage: 9, cat: 'confirm', delta: ok ? R.chandraBala : -R.chandraBala, text: 'Chandra Bala: the Moon is in the ' + ord(tr.chandraBala.house) + ' house from your natal Moon, ' + (ok ? 'a favourable position (1, 3, 6, 7, 10, 11).' : 'not one of the favourable positions (1, 3, 6, 7, 10, 11).') });
    }
    if (T.taraBala) {
      const t = tr.tara; const d = t.ok ? R.taraBala : t.mixed ? R.taraJanma : -R.taraBala;
      f.push({ id: 'c.tara', stage: 9, cat: 'confirm', delta: d, text: 'Tara Bala: the Moon\'s nakshatra is your ' + t.name + ' tara (' + t.index + ' from your birth nakshatra), ' + (t.ok ? 'a favourable tara.' : t.mixed ? 'the birth tara itself (mixed).' : 'an unfavourable tara.') });
    }
    if (T.gochara) {
      let sum = 0; const lines = [];
      for (const X of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
        const b = tr.planets[X]; const e = (b.gocharaOk ? 1 : -1) * R.gochara * GOCHARA_WT[X];
        sum += e; lines.push(X + ' ' + ord(b.houseFromMoon) + ' from the Moon ' + (b.gocharaOk ? '(+)' : '(-)'));
      }
      f.push({ id: 'c.gochara', stage: 9, cat: 'confirm', delta: r1(sum * R.gocharaScale), text: 'Classical Gochara from your natal Moon: ' + lines.join('; ') + '.' });
    }
    if (T.queryHouseTransits) {
      for (const X of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
        const b = tr.planets[X];
        const wHouse = H.primaryH.includes(b.house) ? 1 : H.secondaryH.includes(b.house) ? 0.5 : 0;
        if (wHouse) {
          let base = BASE_NAT[X];
          if (X === 'Sun' && H.sheetPlanets.includes('Sun')) base = 1.5;
          if (X === 'Mercury' && (b.retro || b.combust)) base *= 0.5;
          if (base < 0 && upachaya(b.house)) base = 0.5;
          const e = (base + 1.5 * natal.planets[X].func.q) * wHouse * R.queryHouseScale;
          if (Math.abs(e) >= 0.3) f.push({ id: 'c.in.' + X, stage: 9, cat: 'confirm', planet: X, delta: r1(e), text: 'Transit ' + X + ' is in your ' + ord(b.house) + ' house (' + (H.roleOfHouse(b.house) || AM.HOUSE[b.house].short) + ')' + (b.retro ? ', retrograde' : '') + '.' });
        }
        for (const h of b.aspHouses) {
          if (h === b.house) continue;
          const wA = H.primaryH.includes(h) ? 1 : H.secondaryH.includes(h) ? 0.5 : 0;
          if (!wA || ASP_QUERY[X] == null) continue;
          const e = ASP_QUERY[X] * wA * R.queryAspectScale;
          if (Math.abs(e) >= 0.3) f.push({ id: 'c.asp.' + X + '.' + h, stage: 9, cat: 'confirm', planet: X, delta: r1(e), text: 'Transit ' + X + ' (in your ' + ord(b.house) + ' house) aspects your ' + ord(h) + ' house (' + (H.roleOfHouse(h) || AM.HOUSE[h].short) + ').' });
        }
      }
    }
    if (T.moonContacts) {
      const mb = tr.planets.Moon;
      for (const X of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
        const b = tr.planets[X];
        if (b.sign === mb.sign) {
          let e = CONJ_MOON[X]; if (X === 'Mercury' && (b.retro || b.combust)) e *= 0.5;
          f.push({ id: 'c.conjmoon.' + X, stage: 9, cat: 'confirm', planet: X, delta: r1(e * R.moonContactScale), text: 'Transit ' + X + ' is with the transit Moon in ' + mb.signName + (X === 'Sun' ? ' (close to the New Moon)' : X === 'Saturn' ? ' (a heavy, slowing influence on the Moon)' : '') + '.' });
        } else if (b.aspHouses.includes(mb.house) && ASP_MOON[X] != null) {
          f.push({ id: 'c.aspmoon.' + X, stage: 9, cat: 'confirm', planet: X, delta: r1(ASP_MOON[X] * R.moonContactScale), text: 'Transit ' + X + ' (in ' + b.signName + ') aspects the transit Moon.' });
        }
      }
    }
    if (T.significatorContacts) {
      const keys = Array.from(new Set(H.primaryLords.concat(H.sheetPlanets, [H.lagnaLord])));
      let tot = 0; const lines = [];
      for (const X of ['Jupiter', 'Saturn', 'Mars', 'Rahu', 'Ketu']) {
        for (const Y of keys) {
          if (Y === X || Y === 'Moon') continue;
          if (tr.planets[X].sign === natal.planets[Y].sign) { tot += CONTACT_SIG[X]; lines.push('transit ' + X + ' over natal ' + Y); }
        }
      }
      tot = clamp(tot, -6, 6);
      if (lines.length) f.push({ id: 'c.sig', stage: 9, cat: 'confirm', delta: r1(tot), text: 'Transit contacts with natal significators: ' + lines.join('; ') + '.' });
    }
    if (T.mercuryRetro && H.sheetPlanets.includes('Mercury')) {
      const mm = tr.planets.Mercury; let e = 0; const t = [];
      if (mm.retro) { e += R.mercuryRetro; t.push('retrograde (delays and revisions in communication)'); }
      if (mm.combust) { e += R.mercuryCombust; t.push('combust'); }
      if (e) f.push({ id: 'c.merc', stage: 9, cat: 'confirm', planet: 'Mercury', delta: e, text: 'Transit Mercury, the communication planet for this question, is ' + t.join(' and ') + '.' });
    }
    const raw = f.reduce((s, x) => s + x.delta, 0);
    return { factors: f, raw, score: clamp((raw - R.center) * R.scaleOut, -100, 100) };
  }

  /* ------------------------------------------------------------------ decision */
  function decide(natalRes, moonRes, confRes, cfg, rules, caps) {
    const W = rules.weights; const th = rules.thresholds;
    const Ns = (natalRes.N - 50) * 2;
    const wSum = W.finalNatal + W.finalMoon + W.finalConfirm;
    const S = (W.finalNatal * Ns + W.finalMoon * moonRes.score + W.finalConfirm * confRes.score) / (wSum || 1);
    const occ = cfg.kind === 'O';
    const yesAt = occ ? th.occYes : th.yes + 2 * (cfg.strict || 0);
    const noAt = occ ? th.occNo : th.no;
    let verdict = 'MAYBE';
    if (S >= yesAt && natalRes.N >= th.minNatalForYes && moonRes.score >= th.moonFloorForYes) verdict = 'YES';
    else if (S <= noAt || (moonRes.score <= th.moonVetoNo && natalRes.N < th.moonVetoMaxNatal)) verdict = 'NO';
    const comps = [Ns, moonRes.score, confRes.score];
    const sgn = Math.sign(S);
    let agree = 0;
    if (verdict === 'MAYBE') {
      const pos = comps.some((c) => c >= 10); const neg = comps.some((c) => c <= -10);
      agree = pos && neg ? 3 : 1;
    } else {
      agree = comps.filter((c) => Math.sign(c) === sgn && Math.abs(c) >= 10).length + (Math.abs(S) >= 45 ? 2 : Math.abs(S) >= 28 ? 1 : 0);
    }
    let conf = agree >= rules.confidence.highAt ? 'High' : agree >= rules.confidence.moderateAt ? 'Moderate' : 'Low';
    const notes = [];
    const order = { Low: 0, Moderate: 1, High: 2 };
    const cap = (c, why) => { if (order[conf] > order[c]) { conf = c; notes.push(why); } };
    if (caps && caps.unknownTime) cap('Low', 'Birth time unknown: Chandra Lagna used.');
    if (caps && caps.lagnaUncertain) cap('Moderate', 'Birth time approximate and the Lagna may change sign.');
    if (caps && caps.timeVaries) cap('Moderate', 'The verdict changes during the day as the Moon changes sign.');
    return { S, Ns, verdict, confidence: conf, confNotes: notes, yesAt, noAt };
  }

  const HEAD = (occ, suc) => (occ === 'NO' ? 'NO' : occ === 'MAYBE' && suc === 'YES' ? 'MAYBE' : suc);

  /* ------------------------------------------------------------------ the staged pipeline */
  const STAGE_NAMES = [
    'Natal horoscope analysis', 'Query house identification', 'Planetary significator analysis', 'Planetary dignity and strength',
    'Sambandha analysis', 'Transit Moon analysis', 'Dispositor analysis', 'Natal planets aspecting transit Moon', 'Other planetary transit confirmation', 'Final prediction',
  ];

  function createContext(natal, sheet, event, rulesIn) {
    const rules = rulesIn || AM.rules.active;
    const ctx = { natal, sheet, event, rules, cfgS: cfgOf(sheet, 'S'), cfgO: sheet.distinct && sheet.occ ? cfgOf(sheet, 'O') : null, stages: [], seg: [], t0: Date.now() };
    ctx.HS = helpers(natal, ctx.cfgS); ctx.HO = ctx.cfgO ? helpers(natal, ctx.cfgO) : null;
    /* timing frame */
    const place = event.place;
    const [y, mo, d] = event.date.split('-').map(Number);
    if (event.time) {
      const [hh, mi] = event.time.split(':').map(Number);
      const utc = AM.time.localToUtcMs(place, y, mo, d, hh, mi);
      ctx.frame = { mode: 'instant', startMs: utc, endMs: utc };
      ctx.segs = [{ startMs: utc, endMs: utc, utcMs: utc }];
    } else {
      const w = rules.window;
      const startMs = AM.time.localToUtcMs(place, y, mo, d, w.startHour, 0); const endMs = AM.time.localToUtcMs(place, y, mo, d, w.endHour, 0);
      const opts = { ayanamsa: natal.input.ayanamsa, node: natal.input.node };
      const ing = AM.eph.moonIngresses(AM.m.jdFromMs(startMs), AM.m.jdFromMs(endMs), opts);
      const cuts = [startMs].concat(ing.map((i) => i.utcMs), [endMs]);
      ctx.segs = [];
      for (let i = 0; i + 1 < cuts.length; i += 1) ctx.segs.push({ startMs: cuts[i], endMs: cuts[i + 1], utcMs: (cuts[i] + cuts[i + 1]) / 2 });
      ctx.frame = { mode: 'window', startMs, endMs, ingresses: ing };
    }
    return ctx;
  }

  const STAGES = [
    /* 1 */ (ctx) => {
      const n = ctx.natal; const P = n.planets;
      ctx.s1 = { lagna: n.lagna.signName, moon: P.Moon.signName, sun: P.Sun.signName };
      return n.lagna.signName + ' Lagna' + (n.mode === 'moon' ? ' (Moon sign used: birth time unknown)' : '') + ', Moon in ' + P.Moon.signName + ' (' + P.Moon.nak + '), Sun in ' + P.Sun.signName + '; ' + BODIES.length + ' bodies placed in ' + ctx.natal.ayanamsaName + ' sidereal longitudes.';
    },
    /* 2 */ (ctx) => {
      const n = ctx.natal;
      const row = (x, primary) => ({ h: x.h, role: x.r, primary, sign: n.houses[x.h].signName, lord: n.houseLord[x.h], lordHouse: n.planets[n.houseLord[x.h]].house });
      ctx.qh = { S: ctx.cfgS.primary.map((x) => row(x, true)).concat(ctx.cfgS.secondary.map((x) => row(x, false))) };
      if (ctx.cfgO) ctx.qh.O = ctx.cfgO.primary.map((x) => row(x, true)).concat(ctx.cfgO.secondary.map((x) => row(x, false)));
      return 'Primary: ' + ctx.cfgS.primary.map((x) => ord(x.h) + ' ' + n.houses[x.h].signName + ' (lord ' + n.houseLord[x.h] + ')').join(', ') + '. Secondary: ' + ctx.cfgS.secondary.map((x) => ord(x.h)).join(', ') + '.';
    },
    /* 3 */ (ctx) => {
      const H = ctx.HS; const n = ctx.natal;
      const set = Array.from(new Set(H.primaryLords.concat(H.secondaryLords, H.sheetPlanets, [H.lagnaLord])));
      ctx.sig = set.map((p) => ({ planet: p, roles: H.roles(p), house: n.planets[p].house, sign: n.planets[p].signName, owns: n.planets[p].func.owns, func: n.planets[p].func.label, funcKind: n.planets[p].func.kind }));
      return ctx.sig.map((s) => s.planet + ' (' + (s.roles[0] || 'significator') + ')').slice(0, 7).join('; ') + (ctx.sig.length > 7 ? '; +' + (ctx.sig.length - 7) + ' more' : '') + '.';
    },
    /* 4 */ (ctx) => {
      const n = ctx.natal;
      ctx.cap = {};
      for (const s of ctx.sig) ctx.cap[s.planet] = { pct: n.strength[s.planet].pct, band: n.strength[s.planet].band, dignity: n.planets[s.planet].dignity ? n.planets[s.planet].dignity.label : '-', retro: n.planets[s.planet].retro, combust: n.planets[s.planet].combust };
      return ctx.sig.map((s) => s.planet + ' ' + Math.round(ctx.cap[s.planet].pct) + '% ' + ctx.cap[s.planet].dignity.toLowerCase()).slice(0, 6).join('; ') + '.';
    },
    /* 5 */ (ctx) => {
      ctx.natalS = natalPotential(ctx.natal, ctx.cfgS, ctx.rules);
      if (ctx.cfgO) ctx.natalO = natalPotential(ctx.natal, ctx.cfgO, ctx.rules);
      const links = ctx.natalS.combos.filter((c) => c.combo.t === 'link');
      const ok = links.filter((c) => !c.combo.neg && c.status !== 'fail').length;
      return ok + ' of ' + links.filter((c) => !c.combo.neg).length + ' key links present. Natal potential ' + Math.round(ctx.natalS.N) + '/100 (' + ctx.natalS.band + ').';
    },
    /* 6 */ (ctx) => {
      ctx.segs.forEach((seg) => {
        seg.tr = V.transitFor(ctx.natal, seg.utcMs);
        seg.S = { moon: moonFacts(ctx.natal, seg.tr, ctx.cfgS, ctx.rules, ctx.HS) };
        if (ctx.cfgO) seg.O = { moon: moonFacts(ctx.natal, seg.tr, ctx.cfgO, ctx.rules, ctx.HO) };
      });
      ctx.main = ctx.segs.reduce((best, s) => ((s.endMs - s.startMs) > (best.endMs - best.startMs) ? s : best), ctx.segs[0]);
      const mb = ctx.main.tr.planets.Moon; const m = ctx.main.S.moon;
      return 'Moon in ' + AM.fmt.signPos(mb.lon) + ' (' + mb.nak + ') = your ' + ord(mb.house) + ' house; ' + (m.contacts.length ? 'with natal ' + m.contacts.join(', ') : 'no natal planet in that sign') + '. Moon score ' + (m.score >= 0 ? '+' : '') + Math.round(m.score) + '.';
    },
    /* 7 */ (ctx) => {
      const m = ctx.main.S.moon; const D = m.dispositor; const b = ctx.natal.planets[D];
      return D + ' (lord of ' + ctx.main.tr.planets.Moon.signName + ') sits in your ' + ord(b.house) + ' house in ' + b.signName + ', ' + (b.dignity ? b.dignity.label.toLowerCase() : '') + ', ' + Math.round(ctx.natal.strength[D].pct) + '% strength.';
    },
    /* 8 */ (ctx) => {
      const m = ctx.main.S.moon;
      return m.aspecting.length ? 'Natal ' + m.aspecting.map((a) => a + ' (' + ord(ctx.natal.planets[a].house) + ')').join(', ') + ' aspect the Moon\'s ' + ctx.main.tr.planets.Moon.signName + '.' : 'No natal planet aspects the Moon\'s sign.';
    },
    /* 9 */ (ctx) => {
      ctx.segs.forEach((seg) => {
        seg.S.confirm = confirmFacts(ctx.natal, seg.tr, ctx.cfgS, ctx.rules, ctx.HS);
        if (ctx.cfgO) seg.O.confirm = confirmFacts(ctx.natal, seg.tr, ctx.cfgO, ctx.rules, ctx.HO);
      });
      const c = ctx.main.S.confirm; const tr = ctx.main.tr;
      return 'Chandra Bala ' + (tr.chandraBala.ok ? 'favourable' : 'unfavourable') + ', Tara ' + tr.tara.name + '; ' + c.factors.length + ' transit checks; score ' + (c.score >= 0 ? '+' : '') + Math.round(c.score) + '.';
    },
    /* 10 */ (ctx) => {
      const caps = { unknownTime: ctx.natal.mode === 'moon', lagnaUncertain: ctx.natal.lagnaUncertain };
      const run = (kind) => {
        const cfg = kind === 'O' ? ctx.cfgO : ctx.cfgS; const nat = kind === 'O' ? ctx.natalO : ctx.natalS;
        return ctx.segs.map((seg) => Object.assign({ seg }, decide(nat, seg[kind].moon, seg[kind].confirm, cfg, ctx.rules, caps)));
      };
      const sRuns = run('S'); const oRuns = ctx.cfgO ? run('O') : null;
      const heads = ctx.segs.map((_, i) => (oRuns ? HEAD(oRuns[i].verdict, sRuns[i].verdict) : sRuns[i].verdict));
      const varies = new Set(heads).size > 1;
      if (varies) { caps.timeVaries = true; }
      const mi = ctx.segs.indexOf(ctx.main);
      const finalS = decide(ctx.natalS, ctx.main.S.moon, ctx.main.S.confirm, ctx.cfgS, ctx.rules, caps);
      const finalO = ctx.cfgO ? decide(ctx.natalO, ctx.main.O.moon, ctx.main.O.confirm, ctx.cfgO, ctx.rules, caps) : null;
      ctx.final = { S: finalS, O: finalO, head: finalO ? HEAD(finalO.verdict, finalS.verdict) : finalS.verdict, segs: ctx.segs.map((seg, i) => ({ startMs: seg.startMs, endMs: seg.endMs, moonSign: seg.tr.planets.Moon.signName, moonHouse: seg.tr.planets.Moon.house, S: r1(sRuns[i].S), verdict: heads[i] })), varies };
      /* confidence of the headline follows the success judgement (and the weaker of the two when both exist) */
      const order = { Low: 0, Moderate: 1, High: 2 };
      ctx.final.confidence = finalO && order[finalO.confidence] < order[finalS.confidence] ? finalO.confidence : finalS.confidence;
      return ctx.final.head + ' (' + ctx.final.confidence + ' confidence), final score ' + (finalS.S >= 0 ? '+' : '') + Math.round(finalS.S) + '.';
    },
  ];

  function sortTop(factors, sign, n) {
    return factors.filter((f) => (sign > 0 ? f.delta > 0.4 : f.delta < -0.4)).sort((a, b) => (sign > 0 ? b.delta - a.delta : a.delta - b.delta)).slice(0, n);
  }
  const bandMoon = (m) => (m >= 25 ? 'gives strong support' : m >= 8 ? 'gives some support' : m > -8 ? 'is largely neutral' : m > -25 ? 'adds friction' : 'pulls against it');

  function finalize(ctx) {
    const { natal, sheet, cfgS, cfgO, rules } = ctx;
    const main = ctx.main; const mb = main.tr.planets.Moon;
    const fin = ctx.final; const vKey = fin.head.toLowerCase();
    const sText = cfgS.texts[fin.S.verdict.toLowerCase()];
    const oText = cfgO ? cfgO.texts[fin.O.verdict.toLowerCase()] : null;
    /* headline sentence: if the event itself is doubtful, say so first */
    const headline = cfgO && fin.O.verdict === 'NO' ? oText : cfgO && fin.O.verdict === 'MAYBE' && fin.S.verdict !== 'NO' ? oText + ' ' + sText : sText;
    const natalSentence = 'Natal potential is ' + ctx.natalS.band.toLowerCase() + ' (' + Math.round(ctx.natalS.N) + '/100).';
    const moonSentence = 'The transit Moon in ' + mb.signName + ' (your ' + ord(mb.house) + ' house) ' + bandMoon(main.S.moon.score) + '.';
    const confSentence = 'Other transits are ' + (main.S.confirm.score >= 12 ? 'supportive' : main.S.confirm.score <= -12 ? 'unsupportive' : 'mixed') + '.';
    const nat = []; /* natal indications as pseudo-factors for the lists */
    ctx.natalS.combos.forEach((c) => { if (Math.abs(c.effect) >= 1.5) nat.push({ id: 'n.combo', stage: 5, cat: 'natal', delta: c.effect, text: c.text + '.' }); });
    ctx.natalS.houses.forEach((h) => { const d = ((h.score - 50) / 10) * h.weight; if (Math.abs(d) >= 1) nat.push({ id: 'n.house.' + h.h, stage: 5, cat: 'natal', delta: r1(d), text: 'The ' + ord(h.h) + ' house (' + h.role + ') is ' + (h.score >= 60 ? 'well supported' : h.score < 42 ? 'under pressure' : 'moderately supported') + ': lord ' + h.lord + ' (' + Math.round(natal.strength[h.lord].pct) + '% strength) in the ' + ord(natal.planets[h.lord].house) + ' house.' }); });
    ctx.natalS.planets.forEach((p) => { const d = (p.R - 50) / 10; if (Math.abs(d) >= 1) nat.push({ id: 'n.planet.' + p.p, stage: 4, cat: 'natal', delta: r1(d), text: p.p + ' (' + p.role + ') is ' + p.band.toLowerCase() + ' at ' + Math.round(p.pct) + '%, ' + p.dignity.toLowerCase() + ', ' + p.func.toLowerCase() + '.' }); });
    const pos = sortTop(nat, 1, 3).concat(sortTop(main.S.moon.factors, 1, 3), sortTop(main.S.confirm.factors, 1, 2));
    const neg = sortTop(nat, -1, 3).concat(sortTop(main.S.moon.factors, -1, 3), sortTop(main.S.confirm.factors, -1, 2));
    /* timing */
    let timing;
    if (ctx.frame.mode === 'instant') {
      const jd = AM.m.jdFromMs(main.utcMs || main.startMs);
      const next = AM.eph.moonIngresses(jd, jd + 1.2, { ayanamsa: natal.input.ayanamsa, node: natal.input.node })[0];
      timing = { mode: 'instant', text: 'Analysed for exactly ' + AM.fmt.clock(ctx.event.place, main.utcMs) + ' local time.' + (next ? ' The Moon moves into ' + AM.SIGNS[next.to].name + ' (your ' + ord(V.houseFrom(natal.lagna.sign, next.to)) + ' house) at about ' + AM.fmt.clock(ctx.event.place, next.utcMs) + ' ' + AM.fmt.dateText(ctx.event.place, next.utcMs) + '.' : ' The Moon stays in ' + mb.signName + ' for the next day.'), segments: fin.segs };
    } else {
      const segs = fin.segs;
      const lines = segs.map((s) => AM.fmt.clock(ctx.event.place, s.startMs) + '-' + AM.fmt.clock(ctx.event.place, s.endMs) + ': Moon in ' + s.moonSign + ' (your ' + ord(s.moonHouse) + ' house), ' + s.verdict);
      let t = 'No event time given: analysed for ' + AM.fmt.clock(ctx.event.place, ctx.frame.startMs) + '-' + AM.fmt.clock(ctx.event.place, ctx.frame.endMs) + ' local time. ';
      if (segs.length === 1) t += 'The Moon stays in ' + segs[0].moonSign + ' throughout, so the indication holds all day.';
      else {
        t += 'The Moon changes sign during this window. ' + lines.join('; ') + '.';
        const best = segs.reduce((a, b) => (b.S > a.S ? b : a), segs[0]);
        if (fin.varies) t += ' The most favourable stretch is ' + AM.fmt.clock(ctx.event.place, best.startMs) + '-' + AM.fmt.clock(ctx.event.place, best.endMs) + '.';
      }
      timing = { mode: 'window', text: t, segments: segs };
    }
    const dashaText = main.tr.dasha ? main.tr.dasha.md.lord + '-' + main.tr.dasha.ad.lord + '-' + main.tr.dasha.pd.lord : null;
    const result = {
      v: 1, engine: AM.ENGINE_VERSION, appVersion: AM.APP_VERSION, ruleset: AM.rules.ref(), computedAt: Date.now(), elapsedMs: Date.now() - ctx.t0,
      question: { id: sheet.id, cat: sheet.cat, text: sheet.text, short: sheet.short, distinct: !!sheet.distinct }, sheetHash: AM.util.hash(JSON.stringify(sheet)),
      event: { date: ctx.event.date, time: ctx.event.time || null, place: ctx.event.place, notes: ctx.event.notes || '', utcMs: main.utcMs, mode: ctx.frame.mode },
      verdict: fin.head, confidence: fin.confidence, confidenceNotes: fin.S.confNotes, score: r1(fin.S.S),
      success: { verdict: fin.S.verdict, score: r1(fin.S.S), label: cfgS.label, q: cfgS.q },
      occurrence: fin.O ? { verdict: fin.O.verdict, score: r1(fin.O.S), label: 'Occurrence', q: cfgO.q } : null,
      headline, natalSentence, moonSentence, confSentence,
      summary: headline + ' ' + natalSentence + ' ' + moonSentence + ' ' + confSentence,
      action: sheet.action[vKey],
      criteria: sheet.criteria, positives: pos, negatives: neg, timing,
      natal: { N: r1(ctx.natalS.N), base: r1(ctx.natalS.base), band: ctx.natalS.band, parts: ctx.natalS.parts, houses: ctx.natalS.houses, planets: ctx.natalS.planets, lagna: ctx.natalS.lagna, combos: ctx.natalS.combos.map((c) => ({ combo: c.combo, effect: c.effect, status: c.status, text: c.text })) },
      natalOcc: ctx.natalO ? { N: r1(ctx.natalO.N), band: ctx.natalO.band, houses: ctx.natalO.houses, planets: ctx.natalO.planets, combos: ctx.natalO.combos.map((c) => ({ combo: c.combo, effect: c.effect, status: c.status, text: c.text })) } : null,
      queryHouses: ctx.qh, significators: ctx.sig, capacity: ctx.cap,
      moon: { sign: mb.signName, deg: mb.deg, lon: mb.lon, nak: mb.nak, pada: mb.pada, house: mb.house, dispositor: main.S.moon.dispositor, score: r1(main.S.moon.score), raw: r1(main.S.moon.raw), factors: main.S.moon.factors, tithi: main.tr.tithi, strong: main.tr.moonStrong, tara: main.tr.tara, chandraBala: main.tr.chandraBala },
      moonOcc: ctx.cfgO ? { score: r1(main.O.moon.score), factors: main.O.moon.factors } : null,
      confirm: { score: r1(main.S.confirm.score), raw: r1(main.S.confirm.raw), factors: main.S.confirm.factors }, confirmOcc: ctx.cfgO ? { score: r1(main.O.confirm.score), factors: main.O.confirm.factors } : null,
      transit: { utcMs: main.utcMs, planets: BODIES.reduce((o, b) => { const p = main.tr.planets[b]; o[b] = { lon: p.lon, sign: p.sign, signName: p.signName, deg: p.deg, house: p.house, houseFromMoon: p.houseFromMoon, nak: p.nak, pada: p.pada, retro: p.retro, combust: !!p.combust, speed: p.speed, dignity: p.dignity ? p.dignity.label : null }; return o; }, {}), dasha: dashaText },
      decision: { S: r1(fin.S.S), Ns: r1(fin.S.Ns), M: r1(main.S.moon.score), C: r1(main.S.confirm.score), yesAt: fin.S.yesAt, noAt: fin.S.noAt, weights: { natal: rules.weights.finalNatal, moon: rules.weights.finalMoon, confirm: rules.weights.finalConfirm } },
      decisionOcc: fin.O ? { S: r1(fin.O.S), Ns: r1(fin.O.Ns), M: r1(main.O.moon.score), C: r1(main.O.confirm.score), verdict: fin.O.verdict } : null,
      stages: ctx.stages,
      warnings: natal.warnings.slice(),
    };
    ctx.result = result;
    return result;
  }

  function runStage(ctx, i) {
    const t = Date.now();
    const summary = STAGES[i](ctx);
    ctx.stages[i] = { id: i + 1, name: STAGE_NAMES[i], summary, ms: Date.now() - t };
    return ctx.stages[i];
  }
  function analyze(natal, sheet, event, rules) {
    const ctx = createContext(natal, sheet, event, rules);
    for (let i = 0; i < STAGES.length; i += 1) runStage(ctx, i);
    return finalize(ctx);
  }
  /** Runs the same stages one by one, yielding to the browser between stages so the progress display reflects real completion. */
  async function analyzeStaged(natal, sheet, event, rules, onStage) {
    const ctx = createContext(natal, sheet, event, rules);
    /* yield so the browser can paint each finished stage; the timer is a fallback for hidden tabs where animation frames are paused */
    const tick = () => (AM.fastTick ? Promise.resolve() : new Promise((res) => { let done = false; const f = () => { if (!done) { done = true; res(); } }; if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 45); }));
    for (let i = 0; i < STAGES.length; i += 1) {
      if (onStage) onStage({ id: i + 1, name: STAGE_NAMES[i], state: 'running' });
      const st = runStage(ctx, i); /* the stage is real work; it is reported as done only after it has finished */
      if (onStage) onStage({ id: st.id, name: st.name, state: 'done', summary: st.summary, ms: st.ms });
      await tick(); /* let the browser paint the finished stage */
    }
    return finalize(ctx);
  }

  AM.predict = { cfgOf, helpers, houseReadiness, evalCombo, natalPotential, moonFacts, confirmFacts, decide, createContext, analyze, analyzeStaged, STAGE_NAMES, HEAD };
})(typeof window !== 'undefined' ? window : globalThis);
