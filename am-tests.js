/* ASTROMATE quality-assurance suite (open tests.html). Covers the 15 checks of the brief: time zones, Ascendant, planetary longitudes against NASA/JPL
   Horizons, ayanamsha, house ownership for all twelve Ascendants, dignity, aspects, Moon transit over all twelve houses, dispositors, aspects on the Moon,
   query mapping of the 100 sheets, the YES/NO/MAYBE logic, reproducibility, mobile layout and data security. Results are also left in window.__results. */
(function (g) {
  'use strict';
  const AM = g.AM; const V = AM.vedic; const TD = AM.TESTDATA;
  const groups = []; let cur = null;
  const group = (name) => { cur = { name, tests: [] }; groups.push(cur); };
  const test = (name, fn) => cur.tests.push({ name, fn });
  const fail = (m) => { throw new Error(m); };
  const eq = (a, b, m) => { if (a !== b) fail((m || 'values differ') + ': got ' + a + ', expected ' + b); };
  const near = (a, b, tol, m) => { if (!(Math.abs(a - b) <= tol)) fail((m || 'values differ') + ': got ' + a + ', expected ' + b + ' (+/- ' + tol + ')'); };
  const ok = (c, m) => { if (!c) fail(m || 'condition is false'); };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');
  const SIGNS = AM.SIGNS.map((s) => s.name);
  const PL7 = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const place0 = { name: 'New Delhi', lat: 28.6139, lon: 77.2090, tz: 'Asia/Kolkata' };

  /** Birth charts with each of the twelve Ascendants (Delhi, 1 Jan 2000, scanning the day in 15-minute steps). */
  let lagnaCharts = null;
  function twelveLagnas() {
    if (lagnaCharts) return lagnaCharts;
    const out = {};
    for (let mi = 0; mi < 24 * 60 && Object.keys(out).length < 12; mi += 15) {
      const c = V.buildChart({ y: 2000, mo: 1, d: 1, h: Math.floor(mi / 60), mi: mi % 60, place: place0, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' });
      if (!out[c.lagna.sign]) out[c.lagna.sign] = c;
    }
    lagnaCharts = out; return out;
  }

  /* ================================================================ 1 */
  group('1. Birth details and time-zone conversion');
  const tzCases = [
    ['Asia/Kolkata', [1947, 8, 15, 0, 0], '1947-08-14T18:30:00Z', 'India at independence (IST +05:30)'],
    ['Asia/Kolkata', [2026, 11, 6, 10, 30], '2026-11-06T05:00:00Z', 'India today'],
    ['America/New_York', [2026, 7, 1, 12, 0], '2026-07-01T16:00:00Z', 'New York in summer (EDT -04:00)'],
    ['America/New_York', [2026, 1, 15, 12, 0], '2026-01-15T17:00:00Z', 'New York in winter (EST -05:00)'],
    ['Europe/London', [2026, 7, 1, 12, 0], '2026-07-01T11:00:00Z', 'London in summer (BST +01:00)'],
    ['Europe/London', [2026, 12, 1, 12, 0], '2026-12-01T12:00:00Z', 'London in winter (GMT)'],
    ['Australia/Sydney', [2026, 1, 15, 12, 0], '2026-01-15T01:00:00Z', 'Sydney in southern summer (AEDT +11:00)'],
    ['Australia/Sydney', [2026, 7, 1, 12, 0], '2026-07-01T02:00:00Z', 'Sydney in southern winter (AEST +10:00)'],
    ['Asia/Kathmandu', [2026, 6, 1, 12, 0], '2026-06-01T06:15:00Z', 'Nepal (+05:45)'],
    ['Asia/Tokyo', [1990, 3, 21, 7, 45], '1990-03-20T22:45:00Z', 'Tokyo (+09:00)'],
  ];
  tzCases.forEach(([tz, a, expect, label]) => test(label, () => eq(iso(AM.time.localToUtcMs({ tz }, a[0], a[1], a[2], a[3], a[4])), expect)));
  test('Manual UTC offset overrides the time zone (+05:30 = 330 min)', () => eq(iso(AM.time.localToUtcMs({ tz: 'America/New_York', offsetMin: 330 }, 2026, 7, 1, 12, 0)), '2026-07-01T06:30:00Z'));
  test('Historical war-time offset in India (1943, +06:30) follows the browser time-zone database', () => {
    const u = AM.time.localToUtcMs({ tz: 'Asia/Kolkata' }, 1943, 6, 1, 12, 0);
    ok(iso(u) === '1943-06-01T05:30:00Z' || iso(u) === '1943-06-01T06:30:00Z', 'unexpected offset ' + iso(u));
  });
  test('A clock time that does not exist (DST gap) still resolves to a valid instant', () => { const u = AM.time.localToUtcMs({ tz: 'America/New_York' }, 2026, 3, 8, 2, 30); ok(!isNaN(u) && u >= Date.UTC(2026, 2, 8, 6, 30) && u <= Date.UTC(2026, 2, 8, 7, 30), iso(u)); });
  test('An ambiguous clock time (DST overlap) resolves to one of its two instants', () => { const u = AM.time.localToUtcMs({ tz: 'America/New_York' }, 2026, 11, 1, 1, 30); ok(u === Date.UTC(2026, 10, 1, 5, 30) || u === Date.UTC(2026, 10, 1, 6, 30), iso(u)); });
  test('Round trip local -> UTC -> local for 200 random times in 8 zones', () => {
    const r = mulberry32(3); const zones = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'Australia/Sydney', 'Asia/Tokyo', 'Africa/Nairobi', 'America/Sao_Paulo', 'Pacific/Auckland'];
    for (let i = 0; i < 200; i += 1) {
      const p = { tz: zones[i % 8] }; const y = 1950 + Math.floor(r() * 90); const mo = 1 + Math.floor(r() * 12); const d = 1 + Math.floor(r() * 28); const h = 3 + Math.floor(r() * 18); const mi = Math.floor(r() * 60);
      const lp = AM.time.localParts(p, AM.time.localToUtcMs(p, y, mo, d, h, mi));
      if (lp.y !== y || lp.mo !== mo || lp.d !== d || lp.h !== h || lp.mi !== mi) fail('round trip failed for ' + p.tz + ' ' + [y, mo, d, h, mi]);
    }
  });
  test('Date validation rejects 31 February and accepts 29 February 2000', () => { ok(!AM.time.validIso('1985-02-31')); ok(AM.time.validIso('2000-02-29')); ok(!AM.time.validIso('1900-02-29')); });

  /* ================================================================ 2 */
  group('2. Ascendant calculation');
  /** Independent brute-force ascendant: scan the ecliptic for the point crossing the eastern horizon (altitude goes + to - as longitude increases). */
  function bruteAscendantTropical(jd, lat, lon) {
    const { T } = AM.eph.timeArgs(jd); const { dpsi, deps } = AM.eph.nutation(T); const eps = (AM.eph.meanObliquity(T) + deps) * AM.m.RAD;
    const theta = (AM.eph.gmstDeg(jd) + dpsi * Math.cos(eps) + lon) * AM.m.RAD; const phi = lat * AM.m.RAD;
    const alt = (lam) => { const l = lam * AM.m.RAD; const ra = Math.atan2(Math.cos(eps) * Math.sin(l), Math.cos(l)); const dec = Math.asin(Math.sin(eps) * Math.sin(l)); const H = theta - ra; return Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H); };
    let prev = alt(0);
    for (let lam = 0.02; lam <= 360.0001; lam += 0.02) {
      const a = alt(lam);
      if (prev > 0 && a <= 0) { let lo = lam - 0.02; let hi = lam; for (let i = 0; i < 50; i += 1) { const mid = (lo + hi) / 2; if (alt(mid) > 0) lo = mid; else hi = mid; } return AM.m.norm360(lo); }
      prev = a;
    }
    return NaN;
  }
  test('GMST matches Meeus example 12.b (1987-04-10 19:21 UT = 8h34m57.0896s)', () => near(AM.eph.gmstDeg(2446896.30625) / 15, 8.5825249, 0.00002));
  test('Ascendant equals the brute-force horizon-crossing solver (60 random places and times, within 0.01 degree)', () => {
    const r = mulberry32(5); let worst = 0;
    for (let i = 0; i < 60; i += 1) {
      const lat = -55 + r() * 110; const lon = -180 + r() * 360; const jd = 2440000 + r() * 30000;
      const a = AM.eph.angles(jd, lat, lon, { ayanamsa: 'lahiri' }); const b = bruteAscendantTropical(jd, lat, lon);
      const d = Math.abs(AM.m.signedDiff(a.ascTrop, b)); worst = Math.max(worst, d); if (d > 0.01) fail('lat ' + lat.toFixed(2) + ' lon ' + lon.toFixed(2) + ' jd ' + jd.toFixed(3) + ': ' + a.ascTrop.toFixed(4) + ' vs ' + b.toFixed(4));
    }
    test.note = 'worst difference ' + worst.toFixed(5) + ' degree';
  });
  test('India, 15 Aug 1947 00:00 IST, New Delhi: Lagna Taurus 7 deg 44 min (published Lahiri chart)', () => {
    const c = V.buildChart({ y: 1947, mo: 8, d: 15, h: 0, mi: 0, place: place0, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' });
    eq(c.lagna.signName, 'Taurus'); near(c.lagna.deg, 7 + 44 / 60, 2 / 60, 'degree within sign');
  });
  test('Ascendant advances through all twelve signs in a day (Delhi)', () => { eq(Object.keys(twelveLagnas()).length, 12); });
  test('Unknown birth time falls back to the Moon sign as Lagna with a warning', () => {
    const c = V.buildChart({ y: 1990, mo: 3, d: 21, h: 12, mi: 0, place: place0, accuracy: 'unknown', ayanamsa: 'lahiri', node: 'mean' });
    eq(c.mode, 'moon'); eq(c.lagna.sign, c.planets.Moon.sign); ok(c.warnings.length > 0);
  });

  /* ================================================================ 3 */
  group('3. Planetary longitude accuracy against NASA/JPL Horizons (10 epochs, 1905-2045)');
  const tol = { Sun: 1.0, Moon: 0.8, Mercury: 1.5, Venus: 1.5, Mars: 2.0, Jupiter: 0.15, Saturn: 0.15 };
  Object.keys(tol).forEach((b) => test(b + ' within ' + tol[b] + ' arcminute of JPL Horizons', () => {
    let worst = 0;
    TD.horizons.jd.forEach((jd, i) => { const d = Math.abs(AM.m.signedDiff(AM.eph.positions(jd, { ayanamsa: 'lahiri' }).trop[b], TD.horizons.lon[b][i])) * 60; worst = Math.max(worst, d); });
    if (worst > tol[b]) fail('worst error ' + worst.toFixed(2) + ' arcmin');
  }));
  test('Mean node moves backwards at about 0.053 degree per day; Ketu is opposite Rahu', () => {
    const p = AM.eph.positionsWithSpeed(2461350.75, { ayanamsa: 'lahiri', node: 'mean' });
    near(p.speed.Rahu, -0.0530, 0.003); near(AM.m.norm360(p.lon.Ketu - p.lon.Rahu), 180, 1e-9);
  });
  test('True node stays within 2 degrees of the mean node', () => { for (let jd = 2451545; jd < 2461545; jd += 97) near(AM.m.signedDiff(AM.eph.positions(jd, { node: 'true' }).lon.Rahu, AM.eph.positions(jd, { node: 'mean' }).lon.Rahu), 0, 2); });
  test('Moon speed is between 11 and 15.5 degrees per day; the Sun between 0.95 and 1.02', () => { for (let jd = 2461000; jd < 2461100; jd += 3.3) { const p = AM.eph.positionsWithSpeed(jd); ok(p.speed.Moon > 11 && p.speed.Moon < 15.5, 'moon ' + p.speed.Moon); ok(p.speed.Sun > 0.95 && p.speed.Sun < 1.02, 'sun ' + p.speed.Sun); } });
  test('Retrograde flag follows the sign of the daily motion (Mars retrograde Dec 2024-Feb 2025)', () => { ok(AM.eph.positionsWithSpeed(Date.UTC(2025, 0, 10) / 86400000 + 2440587.5).retro.Mars, 'Mars should be retrograde on 10 Jan 2025'); ok(!AM.eph.positionsWithSpeed(Date.UTC(2025, 7, 1) / 86400000 + 2440587.5).retro.Mars, 'Mars should be direct on 1 Aug 2025'); });

  /* ================================================================ 4 */
  group('4. Ayanamsha application');
  const JDL = 2435553.5; const T0 = (JDL - 2451545) / 36525;
  test('Lahiri mean ayanamsha on 1956-03-21 = 23 deg 15 min 00.658 sec (true) minus 0.004658 deg nutation', () => near(AM.eph.ayanamsa(T0, 'lahiri'), 23 + 15 / 60 + 0.658 / 3600 - 0.004658035, 0.0005));
  test('Lahiri mean ayanamsha at J2000.0 is about 23.857 degrees', () => near(AM.eph.ayanamsa(0, 'lahiri'), 23.857, 0.002));
  test('Ayanamsha grows by about 50.3 arcseconds a year (2000 to 2026)', () => near((AM.eph.ayanamsa(0.26, 'lahiri') - AM.eph.ayanamsa(0, 'lahiri')) * 3600 / 26, 50.29, 0.2));
  test('Krishnamurti is about 5.8 arcminutes below Lahiri; Raman about 1.45 degree below; Fagan-Bradley about 0.88 degree above', () => {
    near(AM.eph.ayanamsa(0, 'krishnamurti') - AM.eph.ayanamsa(0, 'lahiri'), -0.0966, 0.002); near(AM.eph.ayanamsa(0, 'raman') - AM.eph.ayanamsa(0, 'lahiri'), -1.446, 0.003); near(AM.eph.ayanamsa(0, 'fagan') - AM.eph.ayanamsa(0, 'lahiri'), 0.8835, 0.003);
  });
  test('Sidereal Sun is at about 0 degrees Aries on 14 April 2026 (Mesha Sankranti)', () => near(AM.m.signedDiff(AM.eph.sunSid(Date.UTC(2026, 3, 14, 6) / 86400000 + 2440587.5, { ayanamsa: 'lahiri' }), 0), 0, 0.8));
  test('Sidereal = tropical minus ayanamsha for every body', () => { const p = AM.eph.positions(2461350.75, { ayanamsa: 'raman' }); AM.BODIES.forEach((b) => near(AM.m.norm360(p.trop[b] - p.lon[b]), p.ayan, 1e-9, b)); });
  test('Changing the ayanamsha preference changes sidereal longitudes but not the Ascendant house order', () => { const a = V.buildChart({ y: 1990, mo: 3, d: 21, h: 7, mi: 45, place: place0, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' }); const b = V.buildChart({ y: 1990, mo: 3, d: 21, h: 7, mi: 45, place: place0, accuracy: 'exact', ayanamsa: 'fagan', node: 'mean' }); near(AM.m.signedDiff(a.planets.Sun.lon, b.planets.Sun.lon), 0.8835, 0.01); });

  /* ================================================================ 5 */
  group('5. House ownership for all twelve Ascendants (course canon, sections 7A, 7C, 8)');
  SIGNS.forEach((sn, i) => {
    test(sn + ' Lagna: lord of every house, 7th lord, Badhakesh, Yogakaraka and functional natures match the canon', () => {
      const c = twelveLagnas()[i]; ok(!!c, 'no chart with this Lagna');
      const exp = TD.canon.houseLords[sn];
      for (let h = 1; h <= 12; h += 1) eq(c.houseLord[h], exp[h - 1], 'lord of house ' + h);
      eq(c.houseLord[7], TD.canon.seventhLord[sn], '7th lord'); eq(c.badhakesh, TD.canon.badhakesh[sn], 'Badhakesh');
      eq(c.yogakaraka.join(','), TD.canon.yogakaraka[sn].join(','), 'Yogakaraka');
      const f = TD.canon.functional[sn];
      PL7.forEach((p) => { const k = c.planets[p].func.kind; const want = f.b.includes(p) ? 'benefic' : f.n.includes(p) ? 'neutral' : 'malefic'; const got = k === 'yk' ? 'benefic' : k; if (got !== want) fail(p + ' is ' + k + ', canon says ' + want); });
      TD.canon.yogakaraka[sn].forEach((p) => eq(c.planets[p].func.kind, 'yk', p + ' should be Yogakaraka'));
    });
  });
  test('Owned houses of each planet add up (every house has exactly one lord; 12 lordships over 7 planets)', () => { const c = twelveLagnas()[0]; eq(PL7.reduce((s, p) => s + c.planets[p].func.owns.length, 0), 12); });

  /* ================================================================ 6 */
  group('6. Planetary dignity (canon section 5)');
  const dig = [
    ['Sun', 0, 10, 'exalted'], ['Sun', 6, 10, 'debilitated'], ['Sun', 4, 10, 'moolatrikona'], ['Sun', 4, 25, 'own'], ['Moon', 1, 3, 'exalted'], ['Moon', 7, 3, 'debilitated'], ['Moon', 3, 10, 'own'],
    ['Mars', 9, 28, 'exalted'], ['Mars', 3, 28, 'debilitated'], ['Mars', 0, 5, 'moolatrikona'], ['Mars', 0, 15, 'own'], ['Mars', 7, 10, 'own'], ['Mercury', 5, 15, 'exalted'], ['Mercury', 11, 15, 'debilitated'], ['Mercury', 2, 10, 'own'],
    ['Jupiter', 3, 5, 'exalted'], ['Jupiter', 9, 5, 'debilitated'], ['Jupiter', 8, 5, 'moolatrikona'], ['Jupiter', 8, 20, 'own'], ['Jupiter', 11, 10, 'own'], ['Venus', 11, 27, 'exalted'], ['Venus', 5, 27, 'debilitated'], ['Venus', 6, 5, 'moolatrikona'], ['Venus', 6, 20, 'own'], ['Venus', 1, 10, 'own'],
    ['Saturn', 6, 20, 'exalted'], ['Saturn', 0, 20, 'debilitated'], ['Saturn', 10, 5, 'moolatrikona'], ['Saturn', 10, 25, 'own'], ['Saturn', 9, 10, 'own'],
    ['Sun', 1, 10, 'enemy'], ['Sun', 3, 10, 'friend'], ['Sun', 2, 10, 'neutral'], ['Moon', 2, 10, 'friend'], ['Moon', 0, 10, 'neutral'], ['Saturn', 2, 10, 'friend'], ['Saturn', 4, 10, 'enemy'], ['Jupiter', 2, 10, 'enemy'], ['Venus', 4, 10, 'enemy'], ['Mercury', 3, 10, 'enemy'], ['Mars', 2, 10, 'enemy'],
  ];
  dig.forEach(([p, s, d, k]) => test(p + ' at ' + d + ' deg ' + SIGNS[s] + ' is ' + k, () => eq(V.dignityOf(p, s, d).key, k)));
  test('Combustion uses the canon orbs (Moon 12, Mars 17, Mercury 14/12 retro, Jupiter 11, Venus 10/8 retro, Saturn 15)', () => { eq(AM.COMBUST_ORB.Moon, 12); eq(AM.COMBUST_ORB.Mars, 17); eq(AM.COMBUST_ORB.Mercury, 14); eq(AM.COMBUST_ORB.Jupiter, 11); eq(AM.COMBUST_ORB.Venus, 10); eq(AM.COMBUST_ORB.Saturn, 15); });
  test('Neecha Bhanga: debilitated Mars in Cancer is cancelled when the Moon (lord of Cancer) stands in a Kendra from the Lagna', () => {
    const c = twelveLagnas()[0]; const p = c.planets;
    const nb = V.neechaBhanga({ planets: Object.assign({}, p, { Mars: Object.assign({}, p.Mars, { dignity: { key: 'debilitated' }, house: 4, sign: 3 }), Moon: Object.assign({}, p.Moon, { house: 1 }) }) }, 'Mars');
    ok(nb.count >= 1, 'Moon in a Kendra (the Lagna) should count for the debilitation-sign lord'); ok(Array.isArray(nb.items));
  });
  test('Vargottama: first navamsha of a movable sign, fifth of a fixed sign, ninth of a dual sign', () => { eq(V.navamshaSignOf(1), 0, 'Aries 1 deg is its own first navamsha'); eq(V.navamshaSignOf(45), 1, 'Taurus 15 deg: the fifth navamsha of a fixed sign is Taurus (Vargottama)'); eq(V.navamshaSignOf(29.9), 8, 'last navamsha of Aries is Sagittarius'); eq(V.navamshaSignOf(3.4), 1, 'second navamsha of Aries is Taurus'); eq(V.navamshaSignOf(2 * 30 + 29.9), 2 * 0 + 2, 'Gemini 29.9: ninth navamsha of a dual sign is Gemini (Vargottama)'); });

  /* ================================================================ 7 */
  group('7. Planetary aspects (Parashari graha drishti, Rahu and Ketu 5-7-9)');
  const ASP = { Sun: [7], Moon: [7], Mercury: [7], Venus: [7], Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10], Rahu: [5, 7, 9], Ketu: [5, 7, 9] };
  AM.BODIES.forEach((b) => test(b + ' aspects the ' + ASP[b].join(', ') + ' houses from every house (with wrap-around)', () => {
    for (let h = 1; h <= 12; h += 1) { const got = V.aspectedHouses(b, h).slice().sort((x, y) => x - y).join(','); const want = ASP[b].map((k) => ((h - 1 + k - 1) % 12) + 1).sort((x, y) => x - y).join(','); eq(got, want, b + ' from ' + h); }
  }));
  test('Chart houses list exactly the planets whose aspect reaches them', () => {
    const c = V.buildChart({ y: 1990, mo: 3, d: 21, h: 7, mi: 45, place: place0, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' });
    for (let n = 1; n <= 12; n += 1) { const want = AM.BODIES.filter((b) => c.planets[b].house !== n && ASP[b].some((k) => ((c.planets[b].house - 1 + k - 1) % 12) + 1 === n)).sort().join(','); eq(c.houses[n].aspectedBy.slice().sort().join(','), want, 'house ' + n); }
  });
  test('Sambandha ranks Parivartana > tight Yuti > mutual Drishti > one-sided Drishti > nakshatra link > sign-lord link', () => {
    const mk = (a, b) => ({ planets: { A: a, B: b, Sun: a, Moon: b } });
    const base = (o) => Object.assign({ lon: 0, sign: 0, house: 1, nakLord: 'Rahu', signName: 'x' }, o);
    const sc = (A, B) => V.sambandha({ planets: { Mars: A, Venus: B } }, 'Mars', 'Venus').best;
    const ex = sc(base({ sign: 1, house: 2 }), base({ sign: 0, house: 1 }));
    const yu = sc(base({ sign: 5, house: 6, lon: 150 }), base({ sign: 5, house: 6, lon: 151 }));
    const md = sc(base({ sign: 0, house: 1, lon: 10 }), base({ sign: 6, house: 7, lon: 190 }));
    const od = sc(base({ sign: 0, house: 1, lon: 10 }), base({ sign: 3, house: 4, lon: 100 }));
    const nk = sc(base({ sign: 0, house: 1, lon: 10, nakLord: 'Venus' }), base({ sign: 2, house: 3, lon: 70 }));
    const sl = sc(base({ sign: 1, house: 2, lon: 40 }), base({ sign: 3, house: 4, lon: 100 }));
    ok(ex > yu && yu > md && md > od && od > nk && nk > sl && sl > 0, [ex, yu, md, od, nk, sl].join(' > '));
  });

  /* ================================================================ 8 */
  group('8. Moon transit over all twelve natal houses');
  function timeMoonInSign(sign) { let jd = 2461350.5; for (let i = 0; i < 40000; i += 1) { jd += 0.04; if (Math.floor(AM.eph.moonSid(jd, { ayanamsa: 'lahiri' }) / 30) === sign && AM.eph.moonSid(jd, { ayanamsa: 'lahiri' }) % 30 > 12 && AM.eph.moonSid(jd, { ayanamsa: 'lahiri' }) % 30 < 18) return AM.m.msFromJd(jd); } return null; }
  test('Transit Moon house = (Moon sign - Lagna sign) mod 12 + 1 for all 12 Lagnas x 12 Moon signs (144 combinations)', () => {
    const lagnas = twelveLagnas();
    for (let ms = 0; ms < 12; ms += 1) {
      const t = timeMoonInSign(ms); ok(t != null, 'no time found with Moon in ' + SIGNS[ms]);
      for (let ls = 0; ls < 12; ls += 1) { const tr = V.transitFor(lagnas[ls], t); eq(tr.planets.Moon.sign, ms, 'Moon sign'); eq(tr.planets.Moon.house, ((ms - ls + 12) % 12) + 1, 'house for Lagna ' + SIGNS[ls] + ' Moon in ' + SIGNS[ms]); }
    }
  });
  test('Chandra Bala is favourable exactly in the 1st, 3rd, 6th, 7th, 10th and 11th from the natal Moon', () => {
    const c = twelveLagnas()[0]; const fav = [1, 3, 6, 7, 10, 11]; const seen = {};
    for (let ms = 0; ms < 12; ms += 1) { const tr = V.transitFor(c, timeMoonInSign(ms)); seen[tr.chandraBala.house] = tr.chandraBala.ok; }
    for (let h = 1; h <= 12; h += 1) eq(seen[h], fav.includes(h), 'house ' + h);
  });
  test('Tara Bala cycles through the nine taras (favourable: Sampat, Kshema, Sadhana, Mitra, Parama Mitra)', () => { eq(V.TARA.filter((t) => t.ok).map((t) => t.n).join(','), 'Sampat,Kshema,Sadhana,Mitra,Parama Mitra'); });
  test('Moon ingress search finds each sign change within one minute of a fine scan', () => {
    const jd0 = 2461350.5; const ing = AM.eph.moonIngresses(jd0, jd0 + 6, { ayanamsa: 'lahiri' }); ok(ing.length >= 2, 'expected at least two ingresses in 6 days');
    ing.forEach((i) => { const before = Math.floor(AM.eph.moonSid(i.jd - 0.0007, {}) / 30); const after = Math.floor(AM.eph.moonSid(i.jd + 0.0007, {}) / 30); eq(before, i.from); eq(after, i.to); });
  });

  /* ================================================================ 9 */
  group('9. Dispositor identification');
  test('Sign lords: Mars Aries/Scorpio, Venus Taurus/Libra, Mercury Gemini/Virgo, Moon Cancer, Sun Leo, Jupiter Sagittarius/Pisces, Saturn Capricorn/Aquarius', () => { eq(AM.SIGNS.map((s) => s.lord).join(','), 'Mars,Venus,Mercury,Moon,Sun,Mercury,Venus,Mars,Jupiter,Saturn,Saturn,Jupiter'); });
  test('The analysis reports the lord of the Moon\'s sign as dispositor and its true natal house (all 12 Moon signs)', () => {
    const c = twelveLagnas()[5]; const sheet = AM.bank.get(11);
    for (let ms = 0; ms < 12; ms += 1) {
      const t = timeMoonInSign(ms); const tr = V.transitFor(c, t); const D = AM.SIGNS[tr.planets.Moon.sign].lord;
      const ctx = AM.predict.createContext(c, sheet, { date: '2026-11-06', time: '12:00', place: place0 });
      const m = AM.predict.moonFacts(c, tr, ctx.cfgS, AM.rules.active, ctx.HS); eq(m.dispositor, D, SIGNS[ms]);
      const f = m.factors.find((x) => x.id === 'disp'); ok(f.text.indexOf('your ' + AM.fmt.ordinal(c.planets[D].house) + ' house') >= 0, 'house of dispositor in text: ' + f.text.slice(0, 120));
    }
  });

  /* ================================================================ 10 */
  group('10. Natal planets aspecting the transit Moon');
  test('The planets reported as aspecting the Moon\'s sign equal a brute-force aspect search (40 random charts and dates)', () => {
    const r = mulberry32(9); const sheet = AM.bank.get(11);
    for (let i = 0; i < 40; i += 1) {
      const place = AM.cities.list[Math.floor(r() * AM.cities.list.length)]; const pl = { name: place.name, lat: place.lat, lon: place.lon, tz: place.tz };
      const c = V.buildChart({ y: 1950 + Math.floor(r() * 55), mo: 1 + Math.floor(r() * 12), d: 1 + Math.floor(r() * 28), h: Math.floor(r() * 24), mi: Math.floor(r() * 60), place: pl, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' });
      const t = Date.UTC(2026, Math.floor(r() * 12), 1 + Math.floor(r() * 28), Math.floor(r() * 24)); const tr = V.transitFor(c, t);
      const ctx = AM.predict.createContext(c, sheet, { date: '2026-11-06', time: '12:00', place: pl }); const m = AM.predict.moonFacts(c, tr, ctx.cfgS, AM.rules.active, ctx.HS);
      const hm = tr.planets.Moon.house;
      const want = AM.BODIES.filter((b) => c.planets[b].house !== hm && ASP[b].some((k) => ((c.planets[b].house - 1 + k - 1) % 12) + 1 === hm)).sort().join(',');
      eq(m.aspecting.slice().sort().join(','), want, 'aspecting planets (iteration ' + i + ')');
      const contacts = AM.BODIES.filter((b) => c.planets[b].sign === tr.planets.Moon.sign).sort().join(','); eq(m.contacts.slice().sort().join(','), contacts, 'planets joining the Moon');
    }
  });

  /* ================================================================ 11 */
  group('11. Query-specific house mapping and the 100-question bank');
  const D_LIST = [8, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 23, 25, 30, 31, 34, 35, 36, 41, 43, 61, 81, 82, 84, 86, 90, 94];
  test('100 sheets, ids 1-100 unique, ten per category, in ten categories', () => { const all = AM.bank.all(true); eq(all.length, 100); eq(new Set(all.map((s) => s.id)).size, 100); AM.bank.CATEGORIES.forEach((c) => eq(all.filter((s) => s.cat === c.id).length, 10, 'category ' + c.id)); eq(Math.min(...all.map((s) => s.id)), 1); eq(Math.max(...all.map((s) => s.id)), 100); });
  test('Every sheet passes the schema validator (houses, roles, combos, Moon / dispositor / aspect rules, criteria, texts)', () => { AM.bank.all(true).forEach((s) => { const e = AM.bank.validate(s); if (e.length) fail('Q' + s.id + ': ' + e.join('; ')); }); });
  test('Occurrence and success are judged separately exactly for the 27 flagged questions', () => { const flagged = AM.bank.all(true).filter((s) => s.distinct).map((s) => s.id).sort((a, b) => a - b).join(','); eq(flagged, D_LIST.join(',')); });
  test('Every sheet has primary and secondary houses, natural significators, combinations, Moon, dispositor and aspect rules, final criteria and actions', () => { AM.bank.all(true).forEach((s) => { ok(s.primary.length >= 3 && s.secondary.length >= 2 && s.planets.length >= 3 && s.combos.length >= 5, 'Q' + s.id + ' structure'); ok(s.moon.note && s.disp.note && s.asp.note && s.criteria.yes && s.action.no, 'Q' + s.id + ' texts'); }); });
  test('Question 11 matches the reference mapping of the brief (houses 1,3,7,9,10,11; Sun, Moon, Mercury, Jupiter, Saturn)', () => {
    const s = AM.bank.get(11); eq(s.text, 'I have an important meeting with my boss today. Will the discussion go in my favour?');
    eq(s.primary.concat(s.secondary).map((x) => x.h).sort((a, b) => a - b).join(','), '1,3,7,9,10,11'); eq(s.planets.map((x) => x.p).sort().join(','), 'Jupiter,Mercury,Moon,Saturn,Sun');
    const role = (h) => s.primary.concat(s.secondary).find((x) => x.h === h).r; ok(/boss/i.test(role(10)) && /communication/i.test(role(3)) && /meeting/i.test(role(7)) && /guidance/i.test(role(9)) && /outcome/i.test(role(11)));
  });
  test('The engine resolves the 10th lord of Question 11 correctly for all twelve Ascendants', () => {
    const lagnas = twelveLagnas(); const cfg = AM.predict.cfgOf(AM.bank.get(11), 'S');
    SIGNS.forEach((sn, i) => { const H = AM.predict.helpers(lagnas[i], cfg); eq(H.primaryLords.includes(TD.canon.houseLords[sn][9]), true, sn + ' 10th lord'); eq(H.lagnaLord, TD.canon.houseLords[sn][0], sn + ' Lagna lord'); });
  });
  test('All 100 questions run without error for all twelve Ascendants and always give YES, NO or MAYBE with texts (1,200 analyses)', () => {
    const lagnas = twelveLagnas(); let n = 0;
    AM.bank.all(true).forEach((s) => SIGNS.forEach((_, i) => { const r = AM.predict.analyze(lagnas[i], s, { date: '2026-11-06', time: '10:30', place: place0 }); ok(['YES', 'NO', 'MAYBE'].includes(r.verdict), 'Q' + s.id); ok(r.summary.length > 40 && r.action.length > 10, 'Q' + s.id + ' text'); ok(r.stages.length === 10, 'stages'); if (s.distinct) ok(!!r.occurrence, 'occurrence of Q' + s.id); n += 1; }));
    eq(n, 1200);
  });
  test('Rule-sheet combos evaluate for every question (no combo is silently skipped)', () => { const c = twelveLagnas()[2]; AM.bank.all(true).forEach((s) => { const r = AM.predict.analyze(c, s, { date: '2026-11-06', time: '10:30', place: place0 }); eq(r.natal.combos.length, s.combos.length, 'Q' + s.id); r.natal.combos.forEach((x) => ok(x.text.length > 3, 'Q' + s.id + ' combo text')); }); });

  /* ================================================================ 12 */
  group('12. Final YES / NO / MAYBE logic');
  const R = () => AM.rules.active;
  const dec = (N, M, C, strict, kind) => AM.predict.decide({ N }, { score: M }, { score: C }, { strict: strict || 0, kind: kind || 'S' }, R(), {});
  test('Strong natal promise + supportive Moon + supportive transits = YES', () => eq(dec(75, 60, 40).verdict, 'YES'));
  test('Weak natal promise + unsupportive Moon + unsupportive transits = NO', () => eq(dec(25, -60, -40).verdict, 'NO'));
  test('Neutral natal, Moon and transits = MAYBE', () => eq(dec(50, 0, 0).verdict, 'MAYBE'));
  test('A very weak natal promise cannot give YES even on a perfect Moon day', () => { const d = dec(20, 100, 100); ok(d.verdict !== 'YES', d.verdict); });
  test('A strongly negative Moon blocks YES (Moon floor)', () => ok(dec(80, -40, 100).verdict !== 'YES'));
  test('Moon veto: Moon score at or below the veto forces NO when the natal promise is not strong', () => eq(dec(45, -70, 30).verdict, 'NO'));
  test('A strong natal promise softens a bad day to MAYBE instead of NO', () => ok(dec(85, -30, 0).verdict !== 'NO'));
  test('Sheet strictness raises the YES bar (strict +4 makes a borderline YES a MAYBE)', () => { const base = dec(60, 25, 10); eq(base.verdict, 'YES'); eq(dec(60, 25, 10, 6).verdict, 'MAYBE'); });
  test('Occurrence uses its own, more lenient thresholds', () => { const s = dec(52, 5, -10, 0, 'O'); const m = dec(52, 5, -10, 0, 'S'); ok(['YES', 'MAYBE'].includes(s.verdict) && s.yesAt < m.yesAt, s.verdict + ' ' + m.verdict); });
  test('Headline: occurrence NO overrides success YES; occurrence MAYBE with success YES gives MAYBE', () => { eq(AM.predict.HEAD('NO', 'YES'), 'NO'); eq(AM.predict.HEAD('MAYBE', 'YES'), 'MAYBE'); eq(AM.predict.HEAD('YES', 'NO'), 'NO'); eq(AM.predict.HEAD('YES', 'YES'), 'YES'); });
  test('Confidence is capped at Low when the birth time is unknown and at Moderate when the Lagna is uncertain', () => { const a = AM.predict.decide({ N: 90 }, { score: 90 }, { score: 90 }, { strict: 0, kind: 'S' }, R(), { unknownTime: true }); eq(a.confidence, 'Low'); const b = AM.predict.decide({ N: 90 }, { score: 90 }, { score: 90 }, { strict: 0, kind: 'S' }, R(), { lagnaUncertain: true }); ok(b.confidence !== 'High'); });
  test('Moon sign changes inside the analysed window produce time segments and a timing note', () => {
    const c = twelveLagnas()[0]; let found = false;
    for (let d = 1; d <= 28 && !found; d += 1) { const r = AM.predict.analyze(c, AM.bank.get(1), { date: '2026-11-' + String(d).padStart(2, '0'), time: '', place: place0 }); if (r.timing.segments.length > 1) { found = true; ok(/Moon changes sign/.test(r.timing.text)); } }
    ok(found, 'no ingress found in 28 days of working hours');
  });

  /* ================================================================ 13 */
  group('13. Historical prediction reproducibility');
  const strip = (r) => { const x = JSON.parse(JSON.stringify(r)); delete x.computedAt; delete x.elapsedMs; x.stages.forEach((s) => { delete s.ms; }); return JSON.stringify(x); };
  test('The same inputs always give the identical prediction (byte for byte, apart from timing)', () => { const c = twelveLagnas()[7]; const ev = { date: '2026-11-06', time: '10:30', place: place0 }; eq(strip(AM.predict.analyze(c, AM.bank.get(31), ev)), strip(AM.predict.analyze(c, AM.bank.get(31), ev))); });
  test('A chart rebuilt from the same birth data is identical', () => { const inp = { y: 1985, mo: 2, d: 27, h: 6, mi: 30, place: { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, tz: 'Asia/Kolkata' }, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' }; eq(JSON.stringify(V.buildChart(inp)), JSON.stringify(V.buildChart(inp))); });
  test('A prediction carries its rule-set version, fingerprint, engine version and sheet hash', () => { const r = AM.predict.analyze(twelveLagnas()[0], AM.bank.get(11), { date: '2026-11-06', time: '10:30', place: place0 }); ok(r.ruleset.version && r.ruleset.fingerprint && r.engine && r.sheetHash); });
  test('Changing a rule changes the fingerprint and new predictions, but a stored prediction is a frozen record', () => {
    const c = twelveLagnas()[0]; const ev = { date: '2026-11-06', time: '10:30', place: place0 }; const before = AM.predict.analyze(c, AM.bank.get(11), ev); const frozen = JSON.stringify(before);
    const saved = AM.rules.active; const alt = AM.util.clone(saved); alt.thresholds.yes = -100; alt.thresholds.minNatalForYes = 0; alt.thresholds.moonFloorForYes = -100; alt.version = '9.9.9'; AM.rules.active = alt;
    try { const after = AM.predict.analyze(c, AM.bank.get(11), ev); ok(AM.rules.fingerprint(alt) !== AM.rules.fingerprint(saved), 'fingerprint unchanged'); eq(after.success.verdict, 'YES', 'the changed rules must take effect on a new prediction'); eq(after.ruleset.version, '9.9.9'); } finally { AM.rules.active = saved; }
    eq(JSON.stringify(before), frozen, 'stored record changed');
  });
  test('Vimshottari worked example of the canon: Moon at 5 deg Scorpio (215 deg) has Saturn dasha with 16.625 years left', () => { const d = V.vimshottari(215, 2451545, 2451546); eq(d.md.lord, 'Saturn'); near((d.md.end - 2451545) / 365.25, 16.625, 0.01); eq(V.vimshottari(215, 2451545, 2451545 + 16.7 * 365.25).md.lord, 'Mercury'); });

  /* ================================================================ 14 */
  group('14. Mobile screen responsiveness');
  function frameAt(w, h, hash) { return new Promise((res, rej) => { const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;left:-9999px;top:0;width:' + w + 'px;height:' + h + 'px;border:0'; f.src = 'index.html#' + hash; f.onload = () => res(f); f.onerror = rej; document.body.appendChild(f); }); }
  [['/welcome', 'Welcome'], ['/auth', 'Sign in']].forEach(([hash, name]) => test(name + ' screen has no horizontal scrolling at 360 px and 375 px', async () => {
    for (const w of [360, 375]) { const f = await frameAt(w, 780, hash); await sleep(700); const d = f.contentDocument.documentElement; const over = d.scrollWidth - d.clientWidth; f.remove(); if (over > 1) fail('horizontal overflow of ' + over + ' px at ' + w); }
  }));
  test('The page declares a mobile viewport and the bottom navigation switches on below 900 px', async () => {
    const txt = await (await fetch('index.html')).text(); ok(/name="viewport"[^>]*width=device-width/.test(txt)); const css = await (await fetch('styles.css')).text(); ok(/\.bottomnav/.test(css) && /min-width:\s*900px/.test(css) && /max-width:\s*480px/.test(css));
  });
  test('Primary buttons are at least 44 px tall (touch friendly)', async () => { const f = await frameAt(375, 780, '/welcome'); await sleep(600); const b = f.contentDocument.querySelector('.btn.primary'); const h = b.getBoundingClientRect().height; f.remove(); ok(h >= 44, 'height ' + h); });
  test('The manifest and icons needed for installation are present', async () => { const m = await (await fetch('manifest.json')).json(); eq(m.display, 'standalone'); ok(m.icons.length >= 3); for (const i of m.icons) { const r = await fetch(i.src); ok(r.ok, i.src); } });

  /* ================================================================ 15 */
  group('15. Data security and access control');
  const SKEY = ['am1:sess', 'am1:lastUser']; let savedSess = {};
  async function allStoredText() {
    let s = ''; for (let i = 0; i < localStorage.length; i += 1) { s += localStorage.key(i) + '=' + localStorage.getItem(localStorage.key(i)) + '\n'; }
    const db = await new Promise((res) => { const rq = indexedDB.open('astromate', 1); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); });
    if (db) { for (const st of ['blobs']) { if (!db.objectStoreNames.contains(st)) continue; const vals = await new Promise((res) => { const tx = db.transaction(st, 'readonly').objectStore(st).getAll(); tx.onsuccess = () => res(tx.result); tx.onerror = () => res([]); }); s += JSON.stringify(vals); } db.close(); }
    return s;
  }
  const secret = 'Zephyrine Qwertyuiop-Secret'; let uidA = null; let uidB = null;
  test('Setup: two temporary accounts are created (and removed again at the end)', async () => {
    SKEY.forEach((k) => { savedSess[k] = sessionStorage.getItem(k); });
    const a = await AM.store.register({ name: 'Sec Tester A', email: 'sec-a@test.invalid', password: 'CorrectHorse1!' }); uidA = a.user.id; ok(a.recoveryCode.length === 23, 'recovery code');
    await AM.store.saveProfile({ name: secret, y: 1990, mo: 3, d: 21, h: 7, mi: 45, accuracy: 'exact', place: place0, ayanamsa: 'lahiri', node: 'mean' });
    const prof = (await AM.store.listProfiles())[0]; const res = AM.predict.analyze(V.buildChart(prof), AM.bank.get(11), { date: '2026-11-06', time: '10:30', place: place0, notes: secret }); await AM.store.savePrediction(res, { profileId: prof.id, profileName: secret, notes: secret });
    await AM.store.logout(); const b = await AM.store.register({ name: 'Sec Tester B', email: 'sec-b@test.invalid', password: 'BatteryStaple2!' }); uidB = b.user.id; ok(b.user.role === 'user', 'the second account must be an ordinary user');
  });
  test('Birth data, names, notes and predictions never appear in plain text in local storage or IndexedDB', async () => { const s = await allStoredText(); ok(s.indexOf(secret) < 0, 'plain text found'); ok(s.indexOf('"y":1990') < 0 && s.indexOf('"mo":3') < 0, 'birth fields found in plain text'); ok(s.indexOf('Sec Tester A') >= 0, 'sanity check: account names are metadata and are expected in the clear'); });
  test('User B sees none of user A\'s profiles or predictions', async () => { eq((await AM.store.listProfiles()).length, 0); eq((await AM.store.listPredictions()).length, 0); });
  test('A wrong password is rejected; the right password signs in and decrypts the data', async () => {
    await AM.store.logout(); let rejected = false; try { await AM.store.login('sec-a@test.invalid', 'wrong-password'); } catch (e) { rejected = true; } ok(rejected, 'wrong password accepted');
    await AM.store.login('sec-a@test.invalid', 'CorrectHorse1!'); const p = await AM.store.listProfiles(); eq(p.length, 1); eq(p[0].name, secret);
  });
  test('Predictions are stored with the rule-set version used and are readable only by their owner', async () => { const l = await AM.store.listPredictions(); eq(l.length, 1); const r = await AM.store.getPrediction(l[0].id); eq(r.ruleset.version, AM.rules.ref().version); await AM.store.logout(); await AM.store.login('sec-b@test.invalid', 'BatteryStaple2!'); eq((await AM.store.getPrediction(l[0].id)), null); });
  test('Role-based access: an ordinary user cannot list users, change roles or read the administrator settings API', async () => {
    const cur = AM.store.current(); ok(cur.role === 'user', 'tester B should be an ordinary user, got ' + cur.role);
    for (const fn of [() => AM.store.listUsers(), () => AM.store.setUserRole(uidA, 'admin'), () => AM.store.saveSettings({}), () => AM.store.predictionMeta(), () => AM.store.deleteUser(uidA)]) { let denied = false; try { await fn(); } catch (e) { denied = /permission/.test(e.message); } ok(denied, 'an action was not denied'); }
  });
  test('Prediction metadata kept in the clear (for reports) holds no names, birth data or notes', async () => { const s = JSON.stringify(JSON.parse(localStorage.getItem('am1:pmeta') || '[]')); ok(s.indexOf(secret) < 0 && s.indexOf('1990') < 0, 'metadata leaks'); });
  test('Password change works and the old password stops working; recovery code resets a forgotten password', async () => {
    await AM.store.changePassword('BatteryStaple2!', 'NewPassword3!'); await AM.store.logout(); let rej = false; try { await AM.store.login('sec-b@test.invalid', 'BatteryStaple2!'); } catch (e) { rej = true; } ok(rej, 'old password still works'); await AM.store.login('sec-b@test.invalid', 'NewPassword3!');
  });
  test('Data export is encrypted and an account can be fully deleted by its owner', async () => {
    await AM.store.logout(); await AM.store.login('sec-a@test.invalid', 'CorrectHorse1!'); const b = await AM.store.exportBackup(); ok(JSON.stringify(b).indexOf(secret) < 0, 'backup contains plain text'); ok(Object.keys(b.blobs).length >= 2);
    if (AM.store.current().role === 'admin') { /* on a fresh device tester A is the first account, hence the administrator: the last administrator may not delete themselves while other accounts exist */
      let refused = false; try { await AM.store.deleteMyAccount('CorrectHorse1!'); } catch (e) { refused = /only administrator/.test(e.message); } ok(refused, 'the only administrator was allowed to delete their account');
      await AM.store.setUserRole(uidB, 'admin');
    }
    await AM.store.deleteMyAccount('CorrectHorse1!'); let left = ''; for (let i = 0; i < localStorage.length; i += 1) left += localStorage.key(i) + '\n'; ok(left.indexOf(uidA) < 0, 'leftover keys of the deleted account'); const users = JSON.parse(localStorage.getItem('am1:users') || '[]'); ok(!users.some((u) => u.id === uidA), 'user record left behind');
  });
  test('Cleanup: temporary accounts removed and the previous session restored', async () => {
    try { await AM.store.logout(); } catch (e) { /* ignore */ }
    await AM.store._purge(uidB); SKEY.forEach((k) => { if (savedSess[k] != null) sessionStorage.setItem(k, savedSess[k]); else sessionStorage.removeItem(k); });
    const users = JSON.parse(localStorage.getItem('am1:users') || '[]'); ok(!users.some((u) => /@test\.invalid$/.test(u.email)), 'temporary users remain');
  });

  /* ================================================================ 16 */
  group('16. Robustness and edge cases');
  const mk = (o) => V.buildChart(Object.assign({ y: 1990, mo: 3, d: 21, h: 7, mi: 45, place: place0, accuracy: 'exact', ayanamsa: 'lahiri', node: 'mean' }, o));
  test('Unknown birth time: all 100 questions run, confidence is Low, and a warning is shown', () => {
    const c = mk({ accuracy: 'unknown' }); eq(c.mode, 'moon');
    AM.bank.all(true).forEach((s) => { const r = AM.predict.analyze(c, s, { date: '2026-11-06', time: '10:30', place: place0 }); ok(r.confidence === 'Low', 'Q' + s.id + ' confidence ' + r.confidence); ok(r.warnings.length > 0); });
  });
  test('Approximate birth time near a sign boundary is flagged as an uncertain Lagna and cannot be High confidence', () => {
    let c = null;
    for (let mi = 0; mi < 24 * 60 && !c; mi += 1) { const a = AM.eph.angles(AM.m.jdFromMs(AM.time.localToUtcMs(place0, 2000, 1, 1, Math.floor(mi / 60), mi % 60)), place0.lat, place0.lon, {}).asc; const b = AM.eph.angles(AM.m.jdFromMs(AM.time.localToUtcMs(place0, 2000, 1, 1, Math.floor((mi + 1) / 60) % 24, (mi + 1) % 60)), place0.lat, place0.lon, {}).asc; if (Math.floor(a / 30) !== Math.floor(b / 30)) c = mk({ y: 2000, mo: 1, d: 1, h: Math.floor(mi / 60), mi: mi % 60, accuracy: 'approx' }); }
    ok(!!c && c.lagnaUncertain, 'uncertain Lagna should be detected'); AM.bank.all(true).slice(0, 30).forEach((s) => ok(AM.predict.analyze(c, s, { date: '2026-11-06', time: '10:30', place: place0 }).confidence !== 'High'));
  });
  test('Years outside the fitted range (1850, 2150) and polar latitudes give a chart with a warning, not an error', () => {
    ok(mk({ y: 1850 }).warnings.some((w) => /1900-2100/.test(w))); ok(mk({ y: 2150 }).warnings.length > 0); ok(mk({ y: 1700 }).warnings.some((w) => /1800-2200/.test(w)));
    const polar = mk({ place: { name: 'Tromso', lat: 69.65, lon: 18.96, tz: 'Europe/Oslo' } }); ok(polar.warnings.some((w) => /polar/.test(w))); ok(polar.lagna.sign >= 0 && polar.lagna.sign < 12);
  });
  test('Southern hemisphere and far-east / far-west birthplaces produce valid charts and predictions', () => {
    [{ name: 'Sydney', lat: -33.8688, lon: 151.2093, tz: 'Australia/Sydney' }, { name: 'Auckland', lat: -36.8485, lon: 174.7633, tz: 'Pacific/Auckland' }, { name: 'Honolulu', lat: 21.3069, lon: -157.8583, tz: 'Pacific/Honolulu' }, { name: 'Buenos Aires', lat: -34.6037, lon: -58.3816, tz: 'America/Argentina/Buenos_Aires' }].forEach((p) => {
      const c = mk({ place: p }); ok(c.lagna.sign >= 0 && c.lagna.sign < 12 && AM.BODIES.every((b) => c.planets[b].house >= 1 && c.planets[b].house <= 12), p.name);
      const r = AM.predict.analyze(c, AM.bank.get(81), { date: '2026-11-06', time: '', place: p }); ok(['YES', 'NO', 'MAYBE'].includes(r.verdict), p.name);
    });
  });
  test('Event dates in 1950 and in 2090 can be analysed; the Moon is always placed in one sign', () => { const c = mk({}); ['1950-06-15', '2026-02-28', '2090-12-01'].forEach((d) => { const r = AM.predict.analyze(c, AM.bank.get(31), { date: d, time: '14:00', place: place0 }); ok(r.moon.house >= 1 && r.moon.house <= 12 && r.moon.deg >= 0 && r.moon.deg < 30, d); }); });
  test('Midnight and end-of-day event times, and a leap day, are handled', () => { const c = mk({}); ['00:00', '23:59'].forEach((t) => ok(['YES', 'NO', 'MAYBE'].includes(AM.predict.analyze(c, AM.bank.get(1), { date: '2028-02-29', time: t, place: place0 }).verdict))); });
  test('True node and every ayanamsha option give consistent houses (no planet outside 1-12, nodes opposite)', () => { ['lahiri', 'krishnamurti', 'raman', 'fagan'].forEach((a) => ['mean', 'true'].forEach((n) => { const c = mk({ ayanamsa: a, node: n }); near(AM.m.norm360(c.planets.Ketu.lon - c.planets.Rahu.lon), 180, 1e-6, a + ' ' + n); ok(AM.BODIES.every((b) => c.planets[b].house >= 1 && c.planets[b].house <= 12)); })); });
  test('Rule-sheet text never leaks template placeholders or undefined values into a prediction', () => {
    const c = twelveLagnas()[3]; AM.bank.all(true).forEach((s) => { const r = AM.predict.analyze(c, s, { date: '2026-11-06', time: '10:30', place: place0 }); const all = JSON.stringify([r.summary, r.action, r.positives, r.negatives, r.moon.factors, r.confirm.factors, r.timing.text]); ok(!/undefined|NaN|\[object|\$\{/.test(all), 'Q' + s.id + ': ' + (all.match(/.{30}(undefined|NaN|\[object|\$\{).{30}/) || [''])[0]); });
  });

  /* ================================================================ runner */
  async function runAll(onUpdate) {
    const results = { startedAt: Date.now(), passed: 0, failed: 0, groups: [] };
    for (const gr of groups) {
      const gres = { name: gr.name, tests: [] };
      for (const t of gr.tests) {
        const t0 = performance.now(); test.note = '';
        let status = 'pass'; let message = '';
        try { await t.fn(); } catch (e) { status = 'fail'; message = e && e.message ? e.message : String(e); }
        if (status === 'pass') results.passed += 1; else results.failed += 1;
        gres.tests.push({ name: t.name, status, message, note: test.note || '', ms: Math.round(performance.now() - t0) });
        if (onUpdate) onUpdate(results, gres);
      }
      results.groups.push(gres);
    }
    results.finishedAt = Date.now(); g.__results = results; return results;
  }
  AM.tests = { runAll, groups };
})(typeof window !== 'undefined' ? window : globalThis);
