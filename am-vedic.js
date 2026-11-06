/* ASTROMATE Vedic chart engine: natal chart, dignity, functional nature, aspects, Sambandha, strength, Navamsha, Vimshottari,
   transit snapshot. Conventions follow the course canon: Parashari, whole-sign houses, Lahiri, natural friendship for dignity,
   Rahu/Ketu aspect 5-7-9, functional natures by Lagna from the canon table. Pure functions; chart objects are JSON-safe. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const { norm360, signedDiff, jdFromMs, clamp } = AM.m;
  const { SIGNS, BODIES, SEVEN } = AM;

  /* ---- Functional nature by Lagna (canon section 8): b benefic, n neutral/mixed, m malefic, yk Yogakaraka ---- */
  const FUNC_TABLE = [
    { b: ['Mars', 'Sun', 'Jupiter'], n: ['Moon', 'Venus'], m: ['Mercury', 'Saturn'], yk: [] },
    { b: ['Venus', 'Mercury', 'Saturn'], n: ['Sun'], m: ['Moon', 'Jupiter', 'Mars'], yk: ['Saturn'] },
    { b: ['Mercury', 'Venus', 'Saturn'], n: ['Moon', 'Jupiter'], m: ['Sun', 'Mars'], yk: [] },
    { b: ['Moon', 'Mars', 'Jupiter'], n: ['Sun'], m: ['Mercury', 'Venus', 'Saturn'], yk: ['Mars'] },
    { b: ['Sun', 'Mars', 'Jupiter'], n: ['Moon'], m: ['Mercury', 'Venus', 'Saturn'], yk: ['Mars'] },
    { b: ['Mercury', 'Venus', 'Saturn'], n: ['Jupiter'], m: ['Mars', 'Moon', 'Sun'], yk: [] },
    { b: ['Venus', 'Saturn', 'Mercury'], n: ['Moon'], m: ['Jupiter', 'Sun', 'Mars'], yk: ['Saturn'] },
    { b: ['Mars', 'Jupiter', 'Moon', 'Sun'], n: [], m: ['Saturn', 'Mercury', 'Venus'], yk: [] },
    { b: ['Jupiter', 'Sun', 'Mars'], n: ['Moon', 'Mercury'], m: ['Saturn', 'Venus'], yk: [] },
    { b: ['Saturn', 'Venus', 'Mercury'], n: ['Moon', 'Sun'], m: ['Jupiter', 'Mars'], yk: ['Venus'] },
    { b: ['Saturn', 'Venus', 'Mercury'], n: ['Sun'], m: ['Jupiter', 'Mars', 'Moon'], yk: ['Venus'] },
    { b: ['Jupiter', 'Moon', 'Mars'], n: ['Mercury'], m: ['Sun', 'Venus', 'Saturn'], yk: [] },
  ];
  /* quality factor of a functional nature, used when judging how supportive a planet is for an outcome */
  const FUNC_Q = { yk: 1.0, benefic: 0.75, neutral: 0.25, malefic: -0.4 };
  const FUNC_LABEL = { yk: 'Yogakaraka', benefic: 'Functional benefic', neutral: 'Neutral / mixed', malefic: 'Functional malefic', node: 'Shadow planet' };

  /* classical Gochara: houses (counted from the natal Moon) in which a transiting planet gives favourable results */
  const GOCHARA_FAV = {
    Sun: [3, 6, 10, 11], Moon: [1, 3, 6, 7, 10, 11], Mars: [3, 6, 11], Mercury: [2, 4, 6, 8, 10, 11], Jupiter: [2, 5, 7, 9, 11],
    Venus: [1, 2, 3, 4, 5, 8, 9, 11, 12], Saturn: [3, 6, 11], Rahu: [3, 6, 10, 11], Ketu: [3, 6, 11],
  };
  const TARA = [
    { n: 'Janma', ok: false, mixed: true }, { n: 'Sampat', ok: true }, { n: 'Vipat', ok: false }, { n: 'Kshema', ok: true }, { n: 'Pratyak', ok: false },
    { n: 'Sadhana', ok: true }, { n: 'Naidhana', ok: false }, { n: 'Mitra', ok: true }, { n: 'Parama Mitra', ok: true },
  ];

  const HOUSE_PTS = { 1: 15, 2: 9, 3: 7, 4: 14, 5: 14, 6: 3, 7: 12, 8: 0, 9: 15, 10: 15, 11: 12, 12: 0 };
  const DIG_PTS = { exalted: 20, moolatrikona: 17, own: 15, friend: 11, neutral: 7, enemy: 3, debilitated: 0 };
  const DIG_LABEL = { exalted: 'Exalted', moolatrikona: 'Moolatrikona', own: 'Own sign', friend: "Friend's sign", neutral: 'Neutral sign', enemy: "Enemy's sign", debilitated: 'Debilitated' };

  const houseFrom = (a, b) => ((b - a + 12) % 12) + 1; /* house b counted from house a */
  const aspectedHouses = (planet, house) => (AM.ASPECT_NUMS[planet] || [7]).map((k) => ((house - 1 + k - 1) % 12) + 1);
  const ownsSign = (p, sign) => !!AM.OWN[p] && AM.OWN[p].includes(sign);
  const isKendra = (h) => h === 1 || h === 4 || h === 7 || h === 10;
  const isTrikona = (h) => h === 1 || h === 5 || h === 9;
  const isDusthana = (h) => h === 6 || h === 8 || h === 12;

  function dignityOf(p, sign, deg) {
    const ex = AM.EXALT[p];
    if (sign === ex[0]) return { key: 'exalted', label: DIG_LABEL.exalted, pts: DIG_PTS.exalted };
    if (sign === (ex[0] + 6) % 12) return { key: 'debilitated', label: DIG_LABEL.debilitated, pts: DIG_PTS.debilitated };
    const mt = AM.MOOL[p];
    if (sign === mt[0] && deg >= mt[1] && deg < mt[2]) return { key: 'moolatrikona', label: DIG_LABEL.moolatrikona, pts: DIG_PTS.moolatrikona };
    if (AM.OWN[p].includes(sign)) return { key: 'own', label: DIG_LABEL.own, pts: DIG_PTS.own };
    const lord = SIGNS[sign].lord;
    const key = AM.FRIENDS[p].includes(lord) ? 'friend' : AM.ENEMIES[p].includes(lord) ? 'enemy' : 'neutral';
    return { key, label: DIG_LABEL[key], pts: DIG_PTS[key], lord };
  }
  /** Compound (Panchadha) relationship of p to the lord of its sign: +2 great friend ... -2 great enemy (shown for astrologers). */
  function compoundRelation(p, q, signOf) {
    const nat = AM.FRIENDS[p].includes(q) ? 1 : AM.ENEMIES[p].includes(q) ? -1 : 0;
    const temp = [2, 3, 4, 10, 11, 12].includes(houseFrom(signOf[p], signOf[q])) ? 1 : -1;
    return nat + temp;
  }

  /* ---- bodies: everything that depends only on longitude, speed and the Lagna sign (used for natal AND transit) ---- */
  function makeBodies(pos, lagnaSign) {
    const bodies = {};
    for (const b of BODIES) {
      const lon = pos.lon[b];
      const sign = Math.floor(lon / 30);
      const nakF = lon / (360 / 27);
      const nakIdx = Math.floor(nakF) % 27;
      bodies[b] = {
        name: b, lon, sign, signName: SIGNS[sign].name, deg: lon - sign * 30, house: houseFrom(lagnaSign, sign),
        nakIdx, nak: AM.NAKSHATRAS[nakIdx], pada: Math.floor((nakF - Math.floor(nakF)) * 4) + 1, nakLord: AM.DASHA_ORDER[nakIdx % 9],
        nav: Math.floor(lon / (30 / 9)) % 12, retro: !!(pos.retro && pos.retro[b]), speed: pos.speed ? pos.speed[b] : null,
      };
      bodies[b].vargottama = bodies[b].nav === sign;
    }
    const sunLon = bodies.Sun.lon;
    for (const b of SEVEN) {
      const bd = bodies[b];
      bd.dignity = dignityOf(b, bd.sign, bd.deg);
      bd.digbala = AM.DIG_HOUSE[b] === bd.house;
      bd.combust = false; bd.sunSep = null;
      if (b !== 'Sun') {
        let orb = AM.COMBUST_ORB[b];
        if (b === 'Mercury' && bd.retro) orb = 12;
        if (b === 'Venus' && bd.retro) orb = 8;
        bd.sunSep = Math.abs(signedDiff(bd.lon, sunLon));
        bd.combust = bd.sunSep < orb;
      }
    }
    return bodies;
  }

  /* ---- functional nature of a planet for a Lagna ---- */
  function funcNature(planet, lagnaSign) {
    const owns = SIGNS.map((s, i) => ({ s, i })).filter(({ s }) => s.lord === planet).map(({ i }) => houseFrom(lagnaSign, i)).sort((a, b) => a - b);
    if (planet === 'Rahu' || planet === 'Ketu') return { kind: 'node', label: FUNC_LABEL.node, owns: [], yk: false, q: -0.4, reasons: ['Rahu and Ketu own no sign; they act through the planet that rules their sign, their house and their company.'] };
    const row = FUNC_TABLE[lagnaSign];
    const kind = row.yk.includes(planet) ? 'yk' : row.b.includes(planet) ? 'benefic' : row.n.includes(planet) ? 'neutral' : 'malefic';
    const reasons = [];
    if (owns.length) reasons.push('Lord of the ' + AM.fmt.joinAnd(owns.map(AM.fmt.ordinal)) + (owns.length > 1 ? ' houses' : ' house'));
    if (kind === 'yk') reasons.push('Owns a Kendra and a Trikona: the Yogakaraka for this Lagna');
    const natMal = planet === 'Sun' || planet === 'Mars' || planet === 'Saturn';
    const natBen = planet === 'Jupiter' || planet === 'Venus' || planet === 'Mercury';
    const dual = (natMal && (kind === 'yk' || kind === 'benefic')) || (natBen && kind === 'malefic');
    if (dual) reasons.push(natMal ? 'Natural malefic that is a functional benefic here: it keeps both natures (double-edged)' : 'Natural benefic that is a functional malefic here: it keeps both natures (double-edged)');
    return { kind, label: FUNC_LABEL[kind], owns, yk: kind === 'yk', q: FUNC_Q[kind], dual, reasons };
  }

  /* ---- Neecha Bhanga (canon section 5, four conditions) ---- */
  function neechaBhanga(chart, p) {
    const b = chart.planets[p];
    if (!b || b.dignity.key !== 'debilitated') return { count: 0, items: [] };
    const items = [];
    const debLord = SIGNS[(AM.EXALT[p][0] + 6) % 12].lord;
    const exLord = SIGNS[AM.EXALT[p][0]].lord;
    const moonH = chart.planets.Moon.house;
    const kendraFrom = (pl, withMoon) => {
      const h = chart.planets[pl].house;
      return isKendra(h) || (withMoon && pl !== 'Moon' && isKendra(houseFrom(moonH, h)));
    };
    if (kendraFrom(debLord, true)) items.push('The lord of the debilitation sign (' + debLord + ') is in a Kendra');
    if (kendraFrom(exLord, true)) items.push('The lord of the exaltation sign (' + exLord + ') is in a Kendra');
    if (debLord !== p && aspectedHouses(debLord, chart.planets[debLord].house).includes(b.house)) items.push(debLord + ' (lord of the debilitation sign) aspects ' + p);
    if (debLord !== p && ownsSign(p, chart.planets[debLord].sign) && ownsSign(debLord, b.sign)) items.push('Exchange of signs (Parivartana) with ' + debLord);
    return { count: items.length, items };
  }

  /* ---- natural nature (benefic / malefic) ---- */
  function moonStrongPaksha(elong) { return elong >= 90 && elong <= 270; }
  function naturalNature(chart, p) {
    if (p === 'Jupiter' || p === 'Venus') return 'benefic';
    if (p === 'Moon') return chart.moonStrong ? 'benefic' : 'malefic';
    if (p === 'Mercury') return chart.mercuryAfflicted ? 'malefic' : 'benefic';
    return 'malefic';
  }
  /** Is planet p a benefic / malefic influence for this chart (natural OR functional; both may be true = double-edged)? */
  function classify(chart, p) {
    const b = chart.planets[p];
    const nat = naturalNature(chart, p);
    const f = b.func.kind;
    let ben = nat === 'benefic' || f === 'yk' || f === 'benefic';
    let mal = nat === 'malefic' || f === 'malefic';
    if (p === 'Sun' && !(f === 'malefic')) mal = false; /* the Sun is only a mild malefic: counted malefic only when functionally malefic */
    if (p === 'Rahu' || p === 'Ketu') { ben = false; mal = true; }
    return { ben, mal, nat, func: f };
  }

  /* ---- strength / capacity ---- */
  function strengthOf(chart, p) {
    const b = chart.planets[p];
    const parts = [];
    const add = (k, label, pts) => { if (pts) parts.push({ k, label, pts }); };
    if (p === 'Rahu' || p === 'Ketu') {
      const disp = SIGNS[b.sign].lord;
      const ds = chart.strength[disp] || strengthOf(chart, disp);
      const hp = ((HOUSE_PTS[b.house] + 15) / 70) * 100;
      const pct = clamp(0.6 * ds.pct + 0.4 * hp, 0, 100);
      return { raw: null, pct, band: bandOf(pct), parts: [{ k: 'dispositor', label: 'Borrowed from its dispositor ' + disp + ' (' + Math.round(ds.pct) + '%)', pts: Math.round(0.6 * ds.pct) }, { k: 'house', label: 'House position (' + AM.fmt.ordinal(b.house) + ')', pts: Math.round(0.4 * hp) }], node: true };
    }
    add('dignity', b.dignity.label, b.dignity.pts);
    if (b.dignity.key === 'debilitated' && b.nb && b.nb.count > 0) add('nb', 'Neecha Bhanga (cancellation of debilitation)', 8);
    add('house', 'Placed in the ' + AM.fmt.ordinal(b.house) + ' house', HOUSE_PTS[b.house]);
    if (b.digbala) add('dig', 'Directional strength (Digbala)', 6);
    if (b.vargottama) add('varg', 'Vargottama', 5);
    if (b.combust) add('comb', 'Combust (too close to the Sun)', p === 'Moon' ? -6 : -10);
    if (b.retro && ['Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].includes(p)) add('retro', 'Retrograde (strength of effort)', 2);
    let infl = 0; const inflParts = [];
    for (const q of BODIES) {
      if (q === p) continue;
      const Q = chart.planets[q];
      let w = 0; let how = '';
      if (Q.sign === b.sign) { w = Math.abs(signedDiff(Q.lon, b.lon)) <= 3 ? 6 : 4; how = 'with'; } else if (aspectedHouses(q, Q.house).includes(b.house)) { w = q === 'Jupiter' ? 4 : 3; how = 'aspected by'; }
      if (!w) continue;
      const nat = naturalNature(chart, q);
      let sgn = nat === 'benefic' ? 1 : -1;
      if (q === 'Sun') w *= 0.5;
      infl += sgn * w;
      inflParts.push((sgn > 0 ? '+' : '-') + ' ' + how + ' ' + q);
    }
    infl = clamp(infl, -14, 14);
    if (infl) add('infl', 'Company and aspects (' + inflParts.join(', ') + ')', Math.round(infl * 10) / 10);
    const raw = parts.reduce((s, x) => s + x.pts, 0);
    const pct = clamp(((raw + 15) / 70) * 100, 0, 100);
    return { raw, pct, band: bandOf(pct), parts };
  }
  function bandOf(pct) { return pct >= 70 ? 'Very strong' : pct >= 55 ? 'Strong' : pct >= 40 ? 'Moderate' : pct >= 25 ? 'Weak' : 'Very weak'; }

  /* ---- Sambandha between two planets (canon section 10 ranking) ---- */
  function sambandha(chart, a, b) {
    if (a === b) return { a, b, score: 5, best: 5, types: [{ score: 5, label: a + ' rules both (the same planet)' }], text: a + ' is the same planet in both roles' };
    const A = chart.planets[a]; const B = chart.planets[b];
    const types = [];
    const add = (score, label) => types.push({ score, label });
    if (ownsSign(a, B.sign) && ownsSign(b, A.sign)) add(5, 'Parivartana (exchange of signs)');
    if (A.sign === B.sign) {
      const orb = Math.abs(signedDiff(A.lon, B.lon));
      add(orb <= 3 ? 4 : 3.3, orb <= 3 ? 'Yuti (tight conjunction, ' + orb.toFixed(1) + '°)' : 'Yuti (together in ' + A.signName + ')');
    }
    const aToB = A.house !== B.house && aspectedHouses(a, A.house).includes(B.house);
    const bToA = A.house !== B.house && aspectedHouses(b, B.house).includes(A.house);
    if (aToB && bToA) add(3, 'Mutual Drishti (aspect)'); else if (aToB) add(2, a + ' aspects ' + b); else if (bToA) add(2, b + ' aspects ' + a);
    const nAB = A.nakLord === b; const nBA = B.nakLord === a;
    if (nAB && nBA) add(1.8, 'Mutual nakshatra link'); else if (nAB) add(1.5, a + ' is in the nakshatra of ' + b); else if (nBA) add(1.5, b + ' is in the nakshatra of ' + a);
    const dAB = SIGNS[A.sign].lord === b; const dBA = SIGNS[B.sign].lord === a;
    if (dAB && !dBA) add(1, a + ' is in the sign of ' + b); else if (dBA && !dAB) add(1, b + ' is in the sign of ' + a);
    types.sort((x, y) => y.score - x.score);
    const best = types.length ? types[0].score : 0;
    const extra = types.slice(1).reduce((s, t) => s + t.score, 0);
    const score = types.length ? Math.min(5.5, best + 0.25 * extra) : 0;
    return { a, b, score, best, types, text: types.length ? types.map((t) => t.label).join('; ') : 'no direct link' };
  }
  function sambandhaMatrix(chart, list) {
    const names = list || BODIES;
    const out = {};
    for (const a of names) { out[a] = {}; for (const b of names) { if (a !== b) out[a][b] = sambandha(chart, a, b); } }
    return out;
  }

  /* ---- Navamsha (D9) ---- */
  function navamshaSignOf(lon) { return Math.floor(norm360(lon) / (30 / 9)) % 12; }

  /* ---- Vimshottari dasha (Mahadasha / Antardasha / Pratyantardasha) at a UT Julian day ---- */
  function vimshottari(moonLon, birthJd, atJd) {
    const span = 360 / 27;
    const n = Math.floor(moonLon / span) % 27;
    const frac = (moonLon - Math.floor(moonLon / span) * span) / span;
    const YEAR = 365.25;
    const idx0 = n % 9;
    const startLord = AM.DASHA_ORDER[idx0];
    let t = birthJd - frac * AM.DASHA_YEARS[startLord] * YEAR;
    for (let k = 0; k < 20; k += 1) {
      const lord = AM.DASHA_ORDER[(idx0 + k) % 9];
      const len = AM.DASHA_YEARS[lord] * YEAR;
      if (atJd < t + len) {
        const md = { lord, start: t, end: t + len };
        const sub = (parent, level) => {
          let tt = parent.start; const pi = AM.DASHA_ORDER.indexOf(parent.lord);
          for (let j = 0; j < 9; j += 1) {
            const l2 = AM.DASHA_ORDER[(pi + j) % 9];
            const ln = ((parent.end - parent.start) * AM.DASHA_YEARS[l2]) / 120;
            if (atJd < tt + ln || j === 8) return { lord: l2, start: tt, end: tt + ln, level };
            tt += ln;
          }
          return null;
        };
        const ad = sub(md, 'AD');
        const pd = sub(ad, 'PD');
        return { md, ad, pd };
      }
      t += len;
    }
    return null;
  }

  /* ---- Chart builder ---- */
  function buildChart(input) {
    const inp = Object.assign({ accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' }, input);
    const place = inp.place;
    const warnings = [];
    const unknown = inp.accuracy === 'unknown';
    const utcMs = AM.time.localToUtcMs(place, inp.y, inp.mo, inp.d, unknown ? 12 : inp.h, unknown ? 0 : inp.mi);
    const offsetMs = AM.time.zoneOffsetMs(place, utcMs);
    const jd = jdFromMs(utcMs);
    const opts = { ayanamsa: inp.ayanamsa, node: inp.node };
    const pos = AM.eph.positionsWithSpeed(jd, opts);
    const ang = AM.eph.angles(jd, place.lat, place.lon, opts);
    let mode = 'lagna'; let lagnaLon = ang.asc; let lagnaUncertain = false;
    if (unknown) {
      mode = 'moon'; lagnaLon = pos.lon.Moon;
      warnings.push('Birth time unknown: the Moon sign is used as the Lagna (Chandra Lagna) and the planets are taken at local noon. House-based results are less reliable and confidence is limited.');
      const ing = AM.eph.moonIngresses(jd - 0.5, jd + 0.5, opts);
      if (ing.length) warnings.push('The Moon changes sign during your birth date, so your Moon sign (and therefore the Lagna used) may be wrong. Please try to find your birth time.');
    } else if (inp.accuracy === 'approx') {
      const a1 = AM.eph.angles(jd - 30 / 1440, place.lat, place.lon, opts).asc;
      const a2 = AM.eph.angles(jd + 30 / 1440, place.lat, place.lon, opts).asc;
      if (Math.floor(a1 / 30) !== Math.floor(a2 / 30)) { lagnaUncertain = true; warnings.push('Your birth time is approximate and the Ascendant changes sign within 30 minutes either side of it. The Lagna may be different; confidence is reduced.'); }
    }
    if (!unknown && Math.abs(place.lat) > 66) warnings.push('The birthplace is near or inside a polar circle, where the Ascendant changes very quickly and is unreliable. Check the Lagna with an independent source.');
    if (inp.y < 1800 || inp.y > 2200) warnings.push('The birth year is outside 1800-2200, where the planetary formulas are less accurate.');
    else if (inp.y < 1900 || inp.y > 2100) warnings.push('The birth year is outside 1900-2100: Jupiter and Saturn lose their fitted correction and may be off by up to about 20 arcminutes.');
    const lagnaSign = Math.floor(lagnaLon / 30);
    const planets = makeBodies(pos, lagnaSign);
    const elong = norm360(pos.lon.Moon - pos.lon.Sun);
    const chart = {
      engine: AM.ENGINE_VERSION, input: inp, mode, warnings, lagnaUncertain, utcMs, offsetMs, jd, T: pos.T, deltaT: pos.dT,
      ayanamsaName: AM.eph.AYAN[inp.ayanamsa] ? AM.eph.AYAN[inp.ayanamsa].name : 'Lahiri', ayanamsa: pos.ayan, nodeType: inp.node,
      lagna: { lon: lagnaLon, sign: lagnaSign, signName: SIGNS[lagnaSign].name, deg: lagnaLon - lagnaSign * 30, source: mode === 'moon' ? 'moon' : 'ascendant', nav: navamshaSignOf(lagnaLon) },
      mc: mode === 'moon' ? null : ang.mc, planets, moonStrong: moonStrongPaksha(elong), moonElong: elong,
      tithi: AM.eph.tithiOf(pos.lon.Sun, pos.lon.Moon), strength: {}, houses: [null],
    };
    const ascNak = lagnaLon / (360 / 27);
    chart.lagna.nak = AM.NAKSHATRAS[Math.floor(ascNak) % 27];
    chart.lagna.pada = Math.floor((ascNak - Math.floor(ascNak)) * 4) + 1;

    /* houses */
    for (let n = 1; n <= 12; n += 1) {
      const sign = (lagnaSign + n - 1) % 12;
      chart.houses.push({ n, sign, signName: SIGNS[sign].name, lord: SIGNS[sign].lord, occupants: BODIES.filter((b) => planets[b].house === n), aspectedBy: [] });
    }
    for (const b of BODIES) {
      planets[b].aspHouses = aspectedHouses(b, planets[b].house);
      planets[b].conj = BODIES.filter((o) => o !== b && planets[o].sign === planets[b].sign);
      for (const h of planets[b].aspHouses) if (h !== planets[b].house) chart.houses[h].aspectedBy.push(b);
    }
    chart.mercuryAfflicted = ['Mars', 'Saturn', 'Rahu', 'Ketu'].some((x) => planets.Mercury.conj.includes(x) || chart.houses[planets.Mercury.house].aspectedBy.includes(x));
    /* functional nature, Neecha Bhanga */
    for (const b of BODIES) planets[b].func = funcNature(b, lagnaSign);
    for (const b of SEVEN) planets[b].nb = neechaBhanga(chart, b);
    for (const b of ['Rahu', 'Ketu']) {
      const disp = planets[SIGNS[planets[b].sign].lord].func.kind;
      planets[b].func.q = disp === 'yk' || disp === 'benefic' ? -0.15 : disp === 'neutral' ? -0.3 : -0.5;
      planets[b].func.reasons.push('Its dispositor ' + SIGNS[planets[b].sign].lord + ' is a ' + FUNC_LABEL[disp].toLowerCase() + ' for this Lagna.');
    }
    if (chart.moonStrong === false) planets.Moon.func.q -= 0.15;
    /* house kartari (canon: natural nature of flanking planets) */
    for (let n = 1; n <= 12; n += 1) {
      const prev = chart.houses[((n + 10) % 12) + 1].occupants; const next = chart.houses[(n % 12) + 1].occupants;
      const ben = (arr) => arr.some((x) => naturalNature(chart, x) === 'benefic'); const mal = (arr) => arr.some((x) => naturalNature(chart, x) === 'malefic');
      chart.houses[n].kartari = ben(prev) && ben(next) && !mal(prev) && !mal(next) ? 'shubha' : mal(prev) && mal(next) && !ben(prev) && !ben(next) ? 'papa' : null;
    }
    /* strength */
    for (const b of SEVEN) chart.strength[b] = strengthOf(chart, b);
    for (const b of ['Rahu', 'Ketu']) chart.strength[b] = strengthOf(chart, b);
    /* convenient lists */
    chart.houseLord = [null].concat(chart.houses.slice(1).map((h) => h.lord));
    const bsign = SIGNS[lagnaSign].mod;
    chart.badhakaHouse = bsign === 'Movable' ? 11 : bsign === 'Fixed' ? 9 : 7;
    chart.badhakesh = chart.houseLord[chart.badhakaHouse];
    chart.yogakaraka = FUNC_TABLE[lagnaSign].yk.slice();
    chart.summary = { lagna: chart.lagna.signName, moonSign: planets.Moon.signName, sunSign: planets.Sun.signName, moonNak: planets.Moon.nak, moonPada: planets.Moon.pada };
    return chart;
  }

  /* ---- roles used by rule sheets: planet names or L1..L12 ---- */
  function resolveRole(chart, role) {
    if (!role) return null;
    if (BODIES.includes(role)) return role;
    const mt = /^L(\d{1,2})$/.exec(role);
    return mt ? chart.houseLord[+mt[1]] || null : null;
  }
  function roleLabel(role) {
    if (BODIES.includes(role)) return role;
    const mt = /^L(\d{1,2})$/.exec(role);
    return mt ? 'lord of the ' + AM.fmt.ordinal(+mt[1]) : role;
  }

  /* ---- Transit snapshot relative to a natal chart ---- */
  function transitFor(natal, utcMs) {
    const jd = jdFromMs(utcMs);
    const pos = AM.eph.positionsWithSpeed(jd, { ayanamsa: natal.input.ayanamsa, node: natal.input.node });
    const bodies = makeBodies(pos, natal.lagna.sign);
    const natalMoonSign = natal.planets.Moon.sign;
    for (const b of BODIES) {
      const bd = bodies[b];
      bd.houseFromMoon = houseFrom(natalMoonSign, bd.sign);
      bd.aspHouses = aspectedHouses(b, bd.house);
      bd.conj = BODIES.filter((o) => o !== b && bodies[o].sign === bd.sign);
      bd.gocharaOk = GOCHARA_FAV[b].includes(bd.houseFromMoon);
    }
    const elong = norm360(pos.lon.Moon - pos.lon.Sun);
    const tithi = AM.eph.tithiOf(pos.lon.Sun, pos.lon.Moon);
    const tara = ((bodies.Moon.nakIdx - natal.planets.Moon.nakIdx + 27) % 27) % 9;
    return {
      utcMs, jd, T: pos.T, ayanamsa: pos.ayan, planets: bodies, moonElong: elong, moonStrong: moonStrongPaksha(elong), tithi,
      tara: { index: tara + 1, name: TARA[tara].n, ok: TARA[tara].ok, mixed: !!TARA[tara].mixed },
      chandraBala: { house: bodies.Moon.houseFromMoon, ok: GOCHARA_FAV.Moon.includes(bodies.Moon.houseFromMoon) },
      dasha: natal.mode === 'moon' ? null : vimshottari(natal.planets.Moon.lon, natal.jd, jd),
    };
  }

  AM.vedic = {
    FUNC_TABLE, FUNC_Q, FUNC_LABEL, GOCHARA_FAV, TARA, HOUSE_PTS, DIG_PTS, DIG_LABEL,
    houseFrom, aspectedHouses, ownsSign, isKendra, isTrikona, isDusthana,
    dignityOf, compoundRelation, makeBodies, funcNature, neechaBhanga, naturalNature, classify, strengthOf, bandOf,
    sambandha, sambandhaMatrix, navamshaSignOf, vimshottari, buildChart, resolveRole, roleLabel, transitFor,
  };
})(typeof window !== 'undefined' ? window : globalThis);
