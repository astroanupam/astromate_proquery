/* ASTROMATE ephemeris engine (deterministic, offline).
   Sun: Meeus ch.25. Moon: Meeus ch.47 (60 longitude terms). Mercury..Saturn: JPL approximate Keplerian elements (1800-2050) with
   light-time and aberration. Rahu/Ketu: mean node (default) or true node (Meeus periodic terms).
   Sidereal conversion: Lahiri (Chitrapaksha, default), Krishnamurti, Raman, Fagan-Bradley.
   Ascendant: apparent sidereal time, true obliquity, nutation.  Nothing here is estimated by AI: every number is a formula. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const { norm360, sinD, cosD, tanD, asinD, atan2D, signedDiff, jdFromMs, msFromJd } = AM.m;
  const DEG = AM.m.DEG;

  /* ---- Delta-T (TT - UT, seconds): observed USNO values 2005-2026, Espenak-Meeus polynomials elsewhere ---- */
  const DT_OBS = [[2005.5, 64.7995], [2006.5, 64.9895], [2007.5, 65.3413], [2008.5, 65.6288], [2009.5, 65.9509], [2010.5, 66.2409], [2011.5, 66.4749],
    [2012.5, 66.7708], [2013.5, 67.1266], [2014.5, 67.4858], [2015.5, 67.8606], [2016.5, 68.3964], [2017.5, 68.8245], [2018.5, 69.1134],
    [2019.5, 69.3582], [2020.5, 69.4241], [2021.5, 69.3514], [2022.5, 69.2527], [2023.5, 69.2201], [2024.5, 69.1879], [2025.5, 69.1406], [2026.5, 69.1695]];
  function deltaTSeconds(y) {
    let t;
    if (y >= 2005.5 && y <= 2026.5) {
      for (let i = 1; i < DT_OBS.length; i += 1) {
        if (y <= DT_OBS[i][0]) { const a = DT_OBS[i - 1]; const b = DT_OBS[i]; return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]); }
      }
    }
    if (y > 2026.5 && y < 2050) { t = y - 2026.5; return 69.1695 + 0.25 * t + 0.0316 * t * t; }
    if (y < 1800) { t = (y - 1820) / 100; return -20 + 32 * t * t; }
    if (y < 1860) { t = y - 1800; return 13.72 - 0.332447 * t + 0.0068612 * t ** 2 + 0.0041116 * t ** 3 - 0.00037436 * t ** 4 + 0.0000121272 * t ** 5 - 0.0000001699 * t ** 6 + 0.000000000875 * t ** 7; }
    if (y < 1900) { t = y - 1860; return 7.62 + 0.5737 * t - 0.251754 * t ** 2 + 0.01680668 * t ** 3 - 0.0004473624 * t ** 4 + t ** 5 / 233174; }
    if (y < 1920) { t = y - 1900; return -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4; }
    if (y < 1941) { t = y - 1920; return 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3; }
    if (y < 1961) { t = y - 1950; return 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547; }
    if (y < 1986) { t = y - 1975; return 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718; }
    if (y < 2005.5) { t = y - 2000; return 63.86 + 0.3345 * t - 0.060374 * t ** 2 + 0.0017275 * t ** 3 + 0.000651814 * t ** 4 + 0.00002373599 * t ** 5; }
    if (y < 2150) return -20 + 32 * ((y - 1820) / 100) ** 2 - 0.5628 * (2150 - y);
    t = (y - 1820) / 100;
    return -20 + 32 * t * t;
  }

  /* ---- Precession, ayanamsha, nutation, obliquity ---- */
  const precessionDeg = (T) => (5028.796195 * T + 1.1054348 * T * T) / 3600;
  /* Mean ayanamsha at J2000.0 (degrees). Lahiri: 23d15'00.658" true at 1956-03-21 less nutation, carried to J2000. Others from their published epoch values. */
  const AYAN = {
    lahiri: { name: 'Lahiri (Chitrapaksha)', j2000: 23.857056 },
    krishnamurti: { name: 'Krishnamurti (KP)', j2000: 23.76047 },
    raman: { name: 'B. V. Raman', j2000: 22.41102 },
    fagan: { name: 'Fagan-Bradley', j2000: 24.74041 },
  };
  const ayanamsa = (T, sys) => (AYAN[sys] || AYAN.lahiri).j2000 + precessionDeg(T);

  function nutation(T) {
    const om = 125.04452 - 1934.136261 * T;
    const L = 280.4665 + 36000.7698 * T;
    const Lm = 218.3165 + 481267.8813 * T;
    return {
      dpsi: (-17.2 * sinD(om) - 1.32 * sinD(2 * L) - 0.23 * sinD(2 * Lm) + 0.21 * sinD(2 * om)) / 3600,
      deps: (9.2 * cosD(om) + 0.57 * cosD(2 * L) + 0.1 * cosD(2 * Lm) - 0.09 * cosD(2 * om)) / 3600,
    };
  }
  const meanObliquity = (T) => 23.439291111 - 0.013004167 * T - 1.63889e-7 * T * T + 5.0361e-7 * T ** 3;

  /* ---- Sun ---- */
  function sunTropical(T) {
    const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * sinD(M) + (0.019993 - 0.000101 * T) * sinD(2 * M) + 0.000289 * sinD(3 * M);
    return norm360(L0 + C - 0.00569); /* mean equinox of date, aberration included */
  }

  /* ---- Moon: Meeus ch.47 longitude series [D, M, M', F, coefficient (1e-6 deg)] ---- */
  const MOON_LON_TERMS = [
    [0, 0, 1, 0, 6288774], [2, 0, -1, 0, 1274027], [2, 0, 0, 0, 658314], [0, 0, 2, 0, 213618], [0, 1, 0, 0, -185116], [0, 0, 0, 2, -114332],
    [2, 0, -2, 0, 58793], [2, -1, -1, 0, 57066], [2, 0, 1, 0, 53322], [2, -1, 0, 0, 45758], [0, 1, -1, 0, -40923], [1, 0, 0, 0, -34720],
    [0, 1, 1, 0, -30383], [2, 0, 0, -2, 15327], [0, 0, 1, 2, -12528], [0, 0, 1, -2, 10980], [4, 0, -1, 0, 10675], [0, 0, 3, 0, 10034],
    [4, 0, -2, 0, 8548], [2, 1, -1, 0, -7888], [2, 1, 0, 0, -6766], [1, 0, -1, 0, -5163], [1, 1, 0, 0, 4987], [2, -1, 1, 0, 4036],
    [2, 0, 2, 0, 3994], [4, 0, 0, 0, 3861], [2, 0, -3, 0, 3665], [0, 1, -2, 0, -2689], [2, 0, -1, 2, -2602], [2, -1, -2, 0, 2390],
    [1, 0, 1, 0, -2348], [2, -2, 0, 0, 2236], [0, 1, 2, 0, -2120], [0, 2, 0, 0, -2069], [2, -2, -1, 0, 2048], [2, 0, 1, -2, -1773],
    [2, 0, 0, 2, -1595], [4, -1, -1, 0, 1215], [0, 0, 2, 2, -1110], [3, 0, -1, 0, -892], [2, 1, 1, 0, -810], [4, -1, -2, 0, 759],
    [0, 2, -1, 0, -713], [2, 2, -1, 0, -700], [2, 1, -2, 0, 691], [2, -1, 0, -2, 596], [4, 0, 1, 0, 549], [0, 0, 4, 0, 537],
    [4, -1, 0, 0, 520], [1, 0, -2, 0, -487], [2, 1, 0, -2, -399], [0, 0, 2, -2, -381], [1, 1, 1, 0, 351], [3, 0, -2, 0, -340],
    [4, 0, -3, 0, 330], [2, -1, 2, 0, 327], [0, 2, 1, 0, -323], [1, 1, -1, 0, 299], [2, 0, 3, 0, 294],
  ];
  function lunarArgs(T) {
    const T2 = T * T; const T3 = T2 * T; const T4 = T3 * T;
    return {
      Lp: norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T2 + T3 / 538841 - T4 / 65194000),
      D: norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T2 + T3 / 545868 - T4 / 113065000),
      M: norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T2 + T3 / 24490000),
      Mp: norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T2 + T3 / 69699 - T4 / 14712000),
      F: norm360(93.272095 + 483202.0175233 * T - 0.0036539 * T2 - T3 / 3526000 + T4 / 863310000),
    };
  }
  function moonTropical(T) {
    const { Lp, D, M, Mp, F } = lunarArgs(T);
    const A1 = norm360(119.75 + 131.849 * T);
    const A2 = norm360(53.09 + 479264.29 * T);
    const E = 1 - 0.002516 * T - 0.0000074 * T * T;
    let sum = 0;
    for (const [d, mm, mp, f, c] of MOON_LON_TERMS) {
      const ef = mm === 0 ? 1 : Math.abs(mm) === 1 ? E : E * E;
      sum += c * ef * sinD(d * D + mm * M + mp * Mp + f * F);
    }
    sum += 3958 * sinD(A1) + 1962 * sinD(Lp - F) + 318 * sinD(A2);
    return norm360(Lp + sum / 1e6);
  }

  /* ---- Lunar nodes ---- */
  function meanNodeTropical(T) {
    const T2 = T * T;
    return norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T2 + (T2 * T) / 467441 - (T2 * T2) / 60616000);
  }
  /** True node = mean node + Meeus ch.47 periodic terms (an approximation of the osculating node; typically within ~0.1 degree). */
  function trueNodeTropical(T) {
    const { D, M, Mp, F } = lunarArgs(T);
    const corr = -1.4979 * sinD(2 * (D - F)) - 0.15 * sinD(M) - 0.1226 * sinD(2 * D) + 0.1176 * sinD(2 * F) - 0.0801 * sinD(2 * (Mp - F));
    return norm360(meanNodeTropical(T) + corr);
  }

  /* ---- Planets: JPL approximate Keplerian elements, 1800-2050 ----
     [a, a', e, e', I, I', L, L', long.peri, long.peri', long.node, long.node'] per Julian century */
  const KEPLER = {
    Mercury: [0.38709927, 0.00000037, 0.20563593, 0.00001906, 7.00497902, -0.00594749, 252.2503235, 149472.67411175, 77.45779628, 0.16047689, 48.33076593, -0.12534081],
    Venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889, 181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
    Earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668, 100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
    Mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131, -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
    Jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714, 34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
    Saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609, 49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
  };
  function helio(name, T) {
    const k = KEPLER[name];
    const a = k[0] + k[1] * T; const e = k[2] + k[3] * T; const I = k[4] + k[5] * T;
    const L = k[6] + k[7] * T; const wbar = k[8] + k[9] * T; const node = k[10] + k[11] * T;
    const w = wbar - node;
    const M = norm360(L - wbar + 180) - 180;
    const eStar = e * DEG;
    let E = M + eStar * sinD(M);
    for (let i = 0; i < 40; i += 1) {
      const dE = (M - (E - eStar * sinD(E))) / (1 - e * cosD(E));
      E += dE;
      if (Math.abs(dE) < 1e-8) break;
    }
    const xp = a * (cosD(E) - e); const yp = a * Math.sqrt(1 - e * e) * sinD(E);
    const cw = cosD(w); const sw = sinD(w); const cn = cosD(node); const sn = sinD(node); const ci = cosD(I); const si = sinD(I);
    return {
      x: (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
      y: (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
      z: sw * si * xp + cw * si * yp,
    };
  }
  /** Geocentric ecliptic longitude, J2000 frame, light-time corrected. */
  function planetGeoLonJ2000(name, T) {
    const earth = helio('Earth', T);
    let tau = 0; let lon = 0;
    for (let i = 0; i < 3; i += 1) {
      const p = helio(name, T - tau / 36525);
      const dx = p.x - earth.x; const dy = p.y - earth.y; const dz = p.z - earth.z;
      tau = Math.sqrt(dx * dx + dy * dy + dz * dz) * 0.0057755183;
      lon = atan2D(dy, dx);
    }
    return norm360(lon);
  }

  /* ---- Fitted correction for Jupiter and Saturn (table am-ephem-corr.js, 1900-2100, Catmull-Rom interpolation) ---- */
  function corrDeg(name, jdUT) {
    const C = AM.EPH_CORR;
    if (!C || !C[name]) return 0;
    const x = (jdUT - C.jd0) / C.step;
    if (x < 0 || x > C.n - 1) return 0;
    const a = C[name];
    const i = Math.min(C.n - 2, Math.floor(x)); const f = x - i;
    const p0 = a[Math.max(i - 1, 0)]; const p1 = a[i]; const p2 = a[i + 1]; const p3 = a[Math.min(i + 2, C.n - 1)];
    const v = 0.5 * (2 * p1 + (-p0 + p2) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (-p0 + 3 * p1 - 3 * p2 + p3) * f * f * f);
    return (v * C.unit) / 3600;
  }

  /* ---- Positions of all nine bodies at a UT instant ---- */
  function timeArgs(jdUT) {
    const dT = deltaTSeconds(2000 + (jdUT - 2451545.0) / 365.25);
    return { dT, T: (jdUT + dT / 86400 - 2451545.0) / 36525 };
  }
  /** Sidereal longitudes (degrees) of Sun..Ketu. opts: { ayanamsa:'lahiri'|..., node:'mean'|'true' }. */
  function positions(jdUT, opts) {
    const o = opts || {};
    const sys = o.ayanamsa || 'lahiri';
    const { dT, T } = timeArgs(jdUT);
    const ayan = ayanamsa(T, sys);
    const prec = precessionDeg(T);
    const trop = {};
    const sunGeo = sunTropical(T);
    trop.Sun = sunGeo;
    trop.Moon = moonTropical(T);
    for (const name of ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
      const lamTrop = norm360(planetGeoLonJ2000(name, T) + prec);
      trop[name] = norm360(lamTrop - 0.0056932 * cosD(sunGeo - lamTrop) + corrDeg(name, jdUT)); /* annual aberration + fitted Jupiter/Saturn correction */
    }
    trop.Rahu = o.node === 'true' ? trueNodeTropical(T) : meanNodeTropical(T);
    trop.Ketu = norm360(trop.Rahu + 180);
    const lon = {};
    for (const b of AM.BODIES) lon[b] = norm360(trop[b] - ayan);
    return { jd: jdUT, T, dT, ayan, ayanSys: sys, lon, trop };
  }
  /** Daily motion (degrees/day) by central difference; retrograde = negative motion. Rahu/Ketu are always retrograde (mean/true). */
  function positionsWithSpeed(jdUT, opts) {
    const base = positions(jdUT, opts);
    const h = 0.125;
    const a = positions(jdUT + h, opts); const b = positions(jdUT - h, opts);
    base.speed = {}; base.retro = {};
    for (const n of AM.BODIES) {
      base.speed[n] = signedDiff(a.lon[n], b.lon[n]) / (2 * h);
      base.retro[n] = n === 'Rahu' || n === 'Ketu' ? true : base.speed[n] < 0;
    }
    base.retro.Sun = false; base.retro.Moon = false;
    return base;
  }
  function moonSid(jdUT, opts) {
    const o = opts || {};
    const { T } = timeArgs(jdUT);
    return norm360(moonTropical(T) - ayanamsa(T, o.ayanamsa || 'lahiri'));
  }
  function sunSid(jdUT, opts) {
    const o = opts || {};
    const { T } = timeArgs(jdUT);
    return norm360(sunTropical(T) - ayanamsa(T, o.ayanamsa || 'lahiri'));
  }

  /* ---- Ascendant / Midheaven (sidereal) ---- */
  const gmstDeg = (jdUT) => { const Tut = (jdUT - 2451545.0) / 36525; return norm360(280.46061837 + 360.98564736629 * (jdUT - 2451545.0) + 0.000387933 * Tut * Tut - Tut ** 3 / 38710000); };
  function angles(jdUT, latDeg, lonDeg, opts) {
    const o = opts || {};
    const { T } = timeArgs(jdUT);
    const { dpsi, deps } = nutation(T);
    const eps = meanObliquity(T) + deps;
    const gmst = gmstDeg(jdUT);
    const ramc = norm360(gmst + dpsi * cosD(eps) + lonDeg);
    const asc = norm360(atan2D(cosD(ramc), -(sinD(ramc) * cosD(eps) + tanD(latDeg) * sinD(eps))));
    const mc = norm360(atan2D(sinD(ramc), cosD(ramc) * cosD(eps)));
    const ayan = ayanamsa(T, o.ayanamsa || 'lahiri');
    return { asc: norm360(asc - (ayan + dpsi)), mc: norm360(mc - (ayan + dpsi)), ascTrop: asc, ramc, eps, dpsi, ayan };
  }

  /* ---- Moon sign changes (ingress) inside a UT window ---- */
  function moonIngresses(jdFrom, jdTo, opts) {
    const out = [];
    const step = 1 / 24;
    let t0 = jdFrom; let s0 = Math.floor(moonSid(t0, opts) / 30);
    while (t0 < jdTo) {
      const t1 = Math.min(jdTo, t0 + step);
      const s1 = Math.floor(moonSid(t1, opts) / 30);
      if (s1 !== s0) {
        let lo = t0; let hi = t1;
        for (let i = 0; i < 40; i += 1) { const mid = (lo + hi) / 2; if (Math.floor(moonSid(mid, opts) / 30) === s0) lo = mid; else hi = mid; }
        out.push({ jd: hi, utcMs: msFromJd(hi), from: s0, to: s1 });
      }
      t0 = t1; s0 = s1;
    }
    return out;
  }

  /* ---- Panchang helpers ---- */
  function tithiOf(sunLon, moonLon) {
    const elong = norm360(moonLon - sunLon);
    const n = Math.floor(elong / 12); /* 0..29 */
    const paksha = n < 15 ? 'Shukla' : 'Krishna';
    const k = n % 15;
    const name = n === 14 ? 'Purnima' : n === 29 ? 'Amavasya' : AM.TITHI_NAMES[k];
    return { elong, index: n + 1, paksha, name, inPaksha: k + 1 };
  }

  AM.eph = {
    AYAN, deltaTSeconds, precessionDeg, ayanamsa, nutation, meanObliquity, sunTropical, moonTropical, meanNodeTropical, trueNodeTropical,
    planetGeoLonJ2000, positions, positionsWithSpeed, angles, moonSid, sunSid, moonIngresses, tithiOf, timeArgs, corrDeg, gmstDeg,
  };
})(typeof window !== 'undefined' ? window : globalThis);
