/* ASTROMATE core: namespace, constants, math, time-zone and formatting helpers. No dependencies. */
(function (g) {
  'use strict';
  const AM = (g.AM = g.AM || {});
  AM.APP_VERSION = '1.0.0';
  AM.ENGINE_VERSION = 'AM-Analytic-1.0';

  /* ---------------------------------------------------------------- math */
  const RAD = Math.PI / 180;
  const DEG = 180 / Math.PI;
  const m = {
    RAD, DEG,
    norm360: (x) => ((x % 360) + 360) % 360,
    sinD: (d) => Math.sin(d * RAD),
    cosD: (d) => Math.cos(d * RAD),
    tanD: (d) => Math.tan(d * RAD),
    asinD: (x) => Math.asin(Math.max(-1, Math.min(1, x))) * DEG,
    acosD: (x) => Math.acos(Math.max(-1, Math.min(1, x))) * DEG,
    atan2D: (y, x) => Math.atan2(y, x) * DEG,
    clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
    pad2: (n) => String(Math.trunc(Math.abs(n))).padStart(2, '0'),
    signedDiff: (a, b) => (((a - b + 180) % 360) + 360) % 360 - 180,
    jdFromMs: (ms) => ms / 86400000 + 2440587.5,
    msFromJd: (jd) => (jd - 2440587.5) * 86400000,
    round: (x, d) => { const k = Math.pow(10, d || 0); return Math.round(x * k) / k; },
    sum: (a) => a.reduce((s, x) => s + x, 0),
  };
  AM.m = m;

  /* ---------------------------------------------------------- constants */
  AM.SIGNS = [
    { name: 'Aries', sk: 'Mesha', lord: 'Mars', glyph: '♈', el: 'Fire', mod: 'Movable' },
    { name: 'Taurus', sk: 'Vrishabha', lord: 'Venus', glyph: '♉', el: 'Earth', mod: 'Fixed' },
    { name: 'Gemini', sk: 'Mithuna', lord: 'Mercury', glyph: '♊', el: 'Air', mod: 'Dual' },
    { name: 'Cancer', sk: 'Karka', lord: 'Moon', glyph: '♋', el: 'Water', mod: 'Movable' },
    { name: 'Leo', sk: 'Simha', lord: 'Sun', glyph: '♌', el: 'Fire', mod: 'Fixed' },
    { name: 'Virgo', sk: 'Kanya', lord: 'Mercury', glyph: '♍', el: 'Earth', mod: 'Dual' },
    { name: 'Libra', sk: 'Tula', lord: 'Venus', glyph: '♎', el: 'Air', mod: 'Movable' },
    { name: 'Scorpio', sk: 'Vrishchika', lord: 'Mars', glyph: '♏', el: 'Water', mod: 'Fixed' },
    { name: 'Sagittarius', sk: 'Dhanu', lord: 'Jupiter', glyph: '♐', el: 'Fire', mod: 'Dual' },
    { name: 'Capricorn', sk: 'Makara', lord: 'Saturn', glyph: '♑', el: 'Earth', mod: 'Movable' },
    { name: 'Aquarius', sk: 'Kumbha', lord: 'Saturn', glyph: '♒', el: 'Air', mod: 'Fixed' },
    { name: 'Pisces', sk: 'Meena', lord: 'Jupiter', glyph: '♓', el: 'Water', mod: 'Dual' },
  ];
  AM.SEVEN = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  AM.BODIES = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  AM.PLANET = {
    Sun: { abbr: 'Su', sk: 'Surya', glyph: '☉', sig: 'soul, authority, father, ego, vitality, government, status' },
    Moon: { abbr: 'Mo', sk: 'Chandra', glyph: '☽', sig: 'mind, emotion, mother, public, nurturing, daily changes' },
    Mars: { abbr: 'Ma', sk: 'Mangala', glyph: '♂︎', sig: 'energy, courage, drive, competition, conflict, technical skill' },
    Mercury: { abbr: 'Me', sk: 'Budha', glyph: '☿', sig: 'speech, intellect, trade, communication, documents, analysis' },
    Jupiter: { abbr: 'Ju', sk: 'Guru', glyph: '♃', sig: 'wisdom, guidance, wealth, sanction, advisers, goodwill, expansion' },
    Venus: { abbr: 'Ve', sk: 'Shukra', glyph: '♀︎', sig: 'harmony, charm, diplomacy, money flow, comfort, sales appeal' },
    Saturn: { abbr: 'Sa', sk: 'Shani', glyph: '♄', sig: 'discipline, delay, duty, hard work, hierarchy, service, structure' },
    Rahu: { abbr: 'Ra', sk: 'Rahu', glyph: '☊', sig: 'foreign, technology, sudden turns, ambition, large organisations' },
    Ketu: { abbr: 'Ke', sk: 'Ketu', glyph: '☋', sig: 'detachment, withdrawal, depth, cutting off, sudden loss' },
  };
  AM.NAKSHATRAS = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
    'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha',
    'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha',
    'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
  ];
  /* Vimshottari order; nakshatra n has lord DASHA_ORDER[n % 9]. */
  AM.DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
  AM.DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };
  AM.TITHI_NAMES = ['Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi'];
  AM.WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  AM.MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* Dignity tables (course canon, section 5). EXALT [sign, degree]; MOOL [sign, from, to]. */
  AM.EXALT = { Sun: [0, 10], Moon: [1, 3], Mars: [9, 28], Mercury: [5, 15], Jupiter: [3, 5], Venus: [11, 27], Saturn: [6, 20] };
  AM.OWN = { Sun: [4], Moon: [3], Mars: [0, 7], Mercury: [2, 5], Jupiter: [8, 11], Venus: [1, 6], Saturn: [9, 10] };
  AM.MOOL = { Sun: [4, 0, 20], Moon: [1, 4, 20], Mars: [0, 0, 12], Mercury: [5, 16, 20], Jupiter: [8, 0, 10], Venus: [6, 0, 15], Saturn: [10, 0, 20] };
  AM.FRIENDS = { Sun: ['Moon', 'Mars', 'Jupiter'], Moon: ['Sun', 'Mercury'], Mars: ['Sun', 'Moon', 'Jupiter'], Mercury: ['Sun', 'Venus'], Jupiter: ['Sun', 'Moon', 'Mars'], Venus: ['Mercury', 'Saturn'], Saturn: ['Mercury', 'Venus'] };
  AM.ENEMIES = { Sun: ['Venus', 'Saturn'], Moon: [], Mars: ['Mercury'], Mercury: ['Moon'], Jupiter: ['Mercury', 'Venus'], Venus: ['Sun', 'Moon'], Saturn: ['Sun', 'Moon', 'Mars'] };
  AM.COMBUST_ORB = { Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15 };
  AM.DIG_HOUSE = { Sun: 10, Mars: 10, Mercury: 1, Jupiter: 1, Moon: 4, Venus: 4, Saturn: 7 };
  /* Graha drishti by counted house (own house = 1). Rahu/Ketu 5-7-9 (course convention). */
  AM.ASPECT_NUMS = { Mars: [4, 7, 8], Jupiter: [5, 7, 9], Saturn: [3, 7, 10], Rahu: [5, 7, 9], Ketu: [5, 7, 9] };

  AM.HOUSE = {
    1: { ord: '1st', short: 'Self', kw: 'you, body, energy, confidence and personal performance' },
    2: { ord: '2nd', short: 'Speech & wealth', kw: 'speech, money in hand, receipts, savings and family resources' },
    3: { ord: '3rd', short: 'Communication', kw: 'communication, calls, courage, effort, initiative and short trips' },
    4: { ord: '4th', short: 'Comfort & base', kw: 'peace of mind, comfort, premises, vehicles and the base you work from' },
    5: { ord: '5th', short: 'Intelligence', kw: 'intelligence, judgement, decisions, creativity and advice' },
    6: { ord: '6th', short: 'Service & rivals', kw: 'service, routine, competition, rivals, obstacles, debts and subordinates' },
    7: { ord: '7th', short: 'Other party', kw: 'the other party, partners, clients, contracts, negotiations and meetings' },
    8: { ord: '8th', short: 'Sudden & hidden', kw: 'sudden events, hidden matters, delays, obstruction and other people\'s money' },
    9: { ord: '9th', short: 'Guidance & fortune', kw: 'senior guidance, mentors, fortune, law and long journeys' },
    10: { ord: '10th', short: 'Career & authority', kw: 'profession, boss, authority, action and its result, reputation' },
    11: { ord: '11th', short: 'Gains', kw: 'gains, income, fulfilment of desires, networks and the realised outcome' },
    12: { ord: '12th', short: 'Loss & foreign', kw: 'expenses, losses, isolation, foreign matters and withdrawal' },
  };
  AM.HOUSE_CLASS = {
    kendra: [1, 4, 7, 10], trikona: [1, 5, 9], dusthana: [6, 8, 12], upachaya: [3, 6, 10, 11], maraka: [2, 7],
  };

  /* ---------------------------------------------- time zone handling */
  const zoneFormatters = new Map();
  function zoneFormatter(tz) {
    let f = zoneFormatters.get(tz);
    if (!f) {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
      zoneFormatters.set(tz, f);
    }
    return f;
  }
  /** Offset (ms, east positive) of a place from UTC at a UTC instant. place.offsetMin (manual override) wins over place.tz. */
  function zoneOffsetMs(place, utcMs) {
    if (place && typeof place.offsetMin === 'number' && !isNaN(place.offsetMin)) return place.offsetMin * 60000;
    if (!place || !place.tz) return ((place && place.offsetHours) || 0) * 3600000;
    const v = {};
    for (const p of zoneFormatter(place.tz).formatToParts(new Date(utcMs))) { if (p.type !== 'literal') v[p.type] = parseInt(p.value, 10); }
    const asUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour % 24, v.minute, v.second);
    return asUtc - Math.floor(utcMs / 1000) * 1000;
  }
  /** Wall-clock time at a place -> UTC milliseconds (handles DST gaps/overlaps by the standard two-pass method). */
  function localToUtcMs(place, y, mo, d, h, mi) {
    const guess = Date.UTC(y, mo - 1, d, h, mi, 0);
    const off1 = zoneOffsetMs(place, guess);
    let utc = guess - off1;
    const off2 = zoneOffsetMs(place, utc);
    if (off2 !== off1) utc = guess - off2;
    return utc;
  }
  function localParts(place, utcMs) {
    const t = new Date(utcMs + zoneOffsetMs(place, utcMs));
    return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), s: t.getUTCSeconds(), wd: t.getUTCDay() };
  }
  const isoOf = (y, mo, d) => y + '-' + m.pad2(mo) + '-' + m.pad2(d);
  function todayAt(place) { const p = localParts(place, Date.now()); return isoOf(p.y, p.mo, p.d); }
  function addDaysISO(iso, n) {
    const [y, mo, d] = iso.split('-').map(Number);
    const t = new Date(Date.UTC(y, mo - 1, d + n));
    return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }
  function validIso(iso) {
    const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!mt) return false;
    const y = +mt[1], mo = +mt[2], d = +mt[3];
    const t = new Date(Date.UTC(y, mo - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d && y >= 1600 && y <= 2400;
  }
  AM.time = { zoneOffsetMs, localToUtcMs, localParts, isoOf, todayAt, addDaysISO, validIso };

  /* ------------------------------------------------------- formatting */
  function dm(d) {
    let t = Math.round(m.norm360(d) * 60);
    if (t >= 21600) t -= 21600;
    const dd = Math.floor((t % 1800) / 60);
    return dd + '°' + m.pad2(t % 60) + '′';
  }
  function dms(d) {
    let t = Math.round(m.norm360(d) * 3600);
    if (t >= 1296000) t -= 1296000;
    const x = t % 108000;
    return Math.floor(x / 3600) + '°' + m.pad2(Math.floor((x % 3600) / 60)) + '′' + m.pad2(x % 60) + '″';
  }
  /** "Taurus 12°34′" from a sidereal longitude. */
  function signPos(lon) {
    let l = m.norm360(lon);
    let s = Math.floor(l / 30);
    let inSign = l - s * 30;
    if (Math.round(inSign * 60) >= 1800) { s = (s + 1) % 12; inSign = 0; }
    return AM.SIGNS[s].name + ' ' + dm(inSign);
  }
  const ordinal = (n) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : n + 'th');
  function clock(place, utcMs, h24) {
    const p = localParts(place, utcMs + 30000);
    if (h24 !== false) return m.pad2(p.h) + ':' + m.pad2(p.mi);
    return (((p.h + 11) % 12) + 1) + ':' + m.pad2(p.mi) + ' ' + (p.h < 12 ? 'AM' : 'PM');
  }
  function dateText(place, utcMs, withWeekday) {
    const p = localParts(place, utcMs);
    return (withWeekday ? AM.WEEKDAYS[p.wd].slice(0, 3) + ', ' : '') + p.d + ' ' + AM.MONTHS[p.mo - 1] + ' ' + p.y;
  }
  function isoDateText(iso) {
    const [y, mo, d] = iso.split('-').map(Number);
    const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    return AM.WEEKDAYS[wd].slice(0, 3) + ', ' + d + ' ' + AM.MONTHS[mo - 1] + ' ' + y;
  }
  function offsetText(ms) {
    const mm = Math.round(Math.abs(ms) / 60000);
    return 'UTC' + (ms < 0 ? '-' : '+') + m.pad2(Math.floor(mm / 60)) + ':' + m.pad2(mm % 60);
  }
  const joinAnd = (arr) => (arr.length <= 1 ? (arr[0] || '') : arr.length === 2 ? arr[0] + ' and ' + arr[1] : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
  AM.fmt = { dm, dms, signPos, ordinal, clock, dateText, isoDateText, offsetText, joinAnd };

  /* ---------------------------------------------------------- misc */
  AM.util = {
    uid: (p) => (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    clone: (o) => JSON.parse(JSON.stringify(o)),
    // djb2-style non-cryptographic fingerprint (used for rule-set version fingerprints, not for security)
    hash: (str) => { let h = 5381; for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(16).padStart(8, '0'); },
  };
})(typeof window !== 'undefined' ? window : globalThis);
