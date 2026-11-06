/* ASTROMATE rule set: every tunable weight, threshold and switch of the prediction engine lives here (not in UI code).
   A rule set is versioned: a saved prediction stores the full reasoning plus the rule-set version and fingerprint it was produced with,
   so changing the active rule set never silently alters a historical prediction. */
(function (g) {
  'use strict';
  const AM = g.AM;

  const DEFAULT = {
    version: '1.0.0',
    name: 'ASTROMATE Parashari Moon-Transit Rule Set',
    released: '2026-11-06',
    changelog: ['1.0.0 - Initial rule set: natal potential (houses, significators, combinations), transit-Moon trigger (house, contacts, dispositor, aspects, relation to query houses), transit confirmations (Chandra Bala, Tara Bala, Gochara, transit contacts), YES / MAYBE / NO decision matrix.'],
    /* how the three judgements are combined: S = natal*Nscaled + moon*M + confirm*C   (Nscaled = (N-50)*2) */
    weights: {
      finalNatal: 0.3, finalMoon: 0.5, finalConfirm: 0.2,
      natalHouses: 0.4, natalPlanets: 0.25, natalLagna: 0.1, natalCombos: 0.25,
      primaryHouse: 1.0, secondaryHouse: 0.5,
    },
    /* statistical centering of the three point systems (derived from simulation over random charts, questions and dates so that 0 means
       "an average chart on an average day" and the three components have comparable spread) */
    calibration: { natalCenter: 37.3, natalGain: 3.0 },
    /* decision matrix */
    thresholds: {
      natalStrong: 62, natalModerate: 45, /* N bands: Strong >= 62, Moderate >= 45, else Weak */
      yes: 10, no: -14, /* S >= yes (+2 x sheet strict) => YES ; S <= no => NO ; otherwise MAYBE */
      occYes: 2, occNo: -22, /* the occurrence judgement (will the event take place?) uses its own, more lenient thresholds */
      minNatalForYes: 35, moonFloorForYes: -10, /* YES also needs N >= minNatalForYes and M >= moonFloorForYes */
      moonVetoNo: -55, moonVetoMaxNatal: 50, /* M <= moonVetoNo while N < moonVetoMaxNatal forces NO */
    },
    /* transit Moon (stages 6 to 8) */
    moon: {
      scaleOut: 2.2, center: 18.8, /* (raw points - center) x scaleOut -> -100..+100 */
      goodHouse: 9, goodDusthana: 5, badHouse: -10, badEighth: -14, genericScale: 0.6,
      activationPrimary: 1.3, activationSecondary: 1.15,
      contactScale: 12, dispositorScale: 14, dispositorGood: 7, dispositorBad: -9, dispositorLinkScale: 2,
      aspectScale: 8, nakshatraScale: 5, relationScale: 2,
      strongPaksha: 4, weakPaksha: -3, newMoonExtra: -3, ownOrExalted: 3, debilitated: -3, gandanta: -3,
    },
    /* other planetary transits (stage 9) */
    confirm: {
      scaleOut: 3.6, center: -6.5,
      chandraBala: 4, taraBala: 4, taraJanma: -2, gochara: 2, gocharaScale: 0.6,
      queryHouseScale: 1.0, queryAspectScale: 0.5, moonContactScale: 1.0, significatorContact: 2, mercuryRetro: -3, mercuryCombust: -2,
    },
    /* feature switches */
    toggles: { chandraBala: true, taraBala: true, gochara: true, queryHouseTransits: true, moonContacts: true, significatorContacts: true, mercuryRetro: true },
    /* analysis window used when the user gives no event time (local hours) */
    window: { startHour: 9, endHour: 18 },
    /* confidence caps */
    confidence: { highAt: 4, moderateAt: 2 },
  };

  /* Editable parameter registry (drives the Administrator rule editor): path, label, range, help */
  const PARAMS = [
    { path: 'weights.finalNatal', label: 'Final weight: natal potential', min: 0, max: 1, step: 0.05, help: 'Share of the natal promise in the final score.' },
    { path: 'weights.finalMoon', label: 'Final weight: transit Moon', min: 0, max: 1, step: 0.05, help: 'Share of the Moon trigger in the final score (the method gives it special importance).' },
    { path: 'weights.finalConfirm', label: 'Final weight: other transits', min: 0, max: 1, step: 0.05, help: 'Share of the confirming transits.' },
    { path: 'weights.natalHouses', label: 'Natal: query houses', min: 0, max: 1, step: 0.05, help: 'Weight of the readiness of the query houses.' },
    { path: 'weights.natalPlanets', label: 'Natal: significators', min: 0, max: 1, step: 0.05, help: 'Weight of the natural significators.' },
    { path: 'weights.natalLagna', label: 'Natal: Lagna and its lord', min: 0, max: 1, step: 0.05, help: 'Weight of the native (Lagna lord and 1st house).' },
    { path: 'weights.natalCombos', label: 'Natal: combinations', min: 0, max: 1, step: 0.05, help: 'Weight of the rule-sheet combinations (Sambandha, placements).' },
    { path: 'thresholds.natalStrong', label: 'Natal band: Strong from', min: 40, max: 90, step: 1, help: 'Natal potential at or above this is Strong.' },
    { path: 'thresholds.natalModerate', label: 'Natal band: Moderate from', min: 20, max: 80, step: 1, help: 'Natal potential at or above this is Moderate; below is Weak.' },
    { path: 'thresholds.yes', label: 'YES threshold (final score)', min: 0, max: 60, step: 1, help: 'Final score at or above this (plus a sheet strictness shift) gives YES.' },
    { path: 'thresholds.no', label: 'NO threshold (final score)', min: -60, max: 0, step: 1, help: 'Final score at or below this gives NO.' },
    { path: 'thresholds.minNatalForYes', label: 'Minimum natal potential for YES', min: 0, max: 80, step: 1, help: 'A YES needs at least this natal potential.' },
    { path: 'thresholds.moonFloorForYes', label: 'Minimum Moon score for YES', min: -60, max: 40, step: 1, help: 'A YES needs the transit Moon score at or above this.' },
    { path: 'thresholds.moonVetoNo', label: 'Moon veto (forces NO)', min: -100, max: -20, step: 1, help: 'A Moon score at or below this forces NO when natal potential is below the cap.' },
    { path: 'moon.scaleOut', label: 'Moon: raw-to-score scale', min: 0.5, max: 4, step: 0.1, help: 'Multiplier turning raw Moon points into the -100..+100 score.' },
    { path: 'moon.goodHouse', label: 'Moon: supportive house points', min: 0, max: 20, step: 1, help: 'Points when the Moon is in a house the sheet lists as good.' },
    { path: 'moon.badHouse', label: 'Moon: obstructive house points', min: -25, max: 0, step: 1, help: 'Points when the Moon is in a house the sheet lists as bad.' },
    { path: 'moon.contactScale', label: 'Moon: natal planet contact scale', min: 0, max: 30, step: 1, help: 'Strength of conjunctions with natal planets.' },
    { path: 'moon.dispositorScale', label: 'Moon: dispositor scale', min: 0, max: 30, step: 1, help: 'Strength of the dispositor evaluation.' },
    { path: 'moon.aspectScale', label: 'Moon: natal aspect scale', min: 0, max: 20, step: 1, help: 'Strength of natal aspects on the Moon.' },
    { path: 'confirm.scaleOut', label: 'Confirmations: raw-to-score scale', min: 0.5, max: 5, step: 0.1, help: 'Multiplier turning raw confirmation points into the -100..+100 score.' },
    { path: 'confirm.chandraBala', label: 'Chandra Bala points', min: 0, max: 12, step: 1, help: 'Moon in a favourable house from the natal Moon.' },
    { path: 'confirm.taraBala', label: 'Tara Bala points', min: 0, max: 12, step: 1, help: 'Favourable nakshatra count from the birth nakshatra.' },
    { path: 'confirm.gochara', label: 'Gochara points per planet', min: 0, max: 8, step: 0.5, help: 'Classical transit favourability from the natal Moon.' },
  ];

  function getPath(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
  function setPath(o, path, v) { const ks = path.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i += 1) a = a[ks[i]]; a[ks[ks.length - 1]] = v; }
  function deepMerge(base, over) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k of Object.keys(over || {})) {
      if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && base && typeof base[k] === 'object') out[k] = deepMerge(base[k], over[k]);
      else out[k] = over[k];
    }
    return out;
  }
  function fingerprint(rs) {
    const core = { w: rs.weights, t: rs.thresholds, m: rs.moon, c: rs.confirm, g: rs.toggles, win: rs.window, cf: rs.confidence, cal: rs.calibration };
    return AM.util.hash(JSON.stringify(core));
  }
  const rules = {
    DEFAULT, PARAMS, getPath, setPath, deepMerge, fingerprint,
    active: AM.util.clone(DEFAULT),
    setActive(rs) { rules.active = AM.util.clone(deepMerge(DEFAULT, rs || {})); return rules.active; },
    ref() { return { version: rules.active.version, fingerprint: fingerprint(rules.active), name: rules.active.name }; },
  };
  AM.rules = rules;
})(typeof window !== 'undefined' ? window : globalThis);
