/* ASTROMATE chart drawing: North Indian (diamond) and South Indian (square) charts as inline SVG strings.
   Works for the natal chart (D1), Navamsha (D9) and a transit overlay. Pure functions; no DOM access. */
(function (g) {
  'use strict';
  const AM = g.AM;
  const PCOL = { Sun: '#f5c451', Moon: '#e8eefc', Mars: '#ff7a7a', Mercury: '#6fe0a2', Jupiter: '#ffd86b', Venus: '#ff9bd0', Saturn: '#7fb2ff', Rahu: '#c3c8d8', Ketu: '#c3c8d8' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* North Indian geometry (400 x 400): polygon points, label centre, sign-number position, label columns per row */
  const GEO = [
    { pts: '200,0 300,100 200,200 100,100', c: [200, 100], num: [200, 172], hn: [200, 22], cols: 3 },
    { pts: '0,0 200,0 100,100', c: [100, 38], num: [100, 82], hn: [52, 14], cols: 2 },
    { pts: '0,0 100,100 0,200', c: [34, 100], num: [80, 100], hn: [12, 54], cols: 1 },
    { pts: '0,200 100,100 200,200 100,300', c: [90, 200], num: [176, 200], hn: [24, 200], cols: 2 },
    { pts: '0,200 100,300 0,400', c: [34, 300], num: [80, 300], hn: [12, 346], cols: 1 },
    { pts: '0,400 100,300 200,400', c: [100, 364], num: [100, 318], hn: [52, 388], cols: 2 },
    { pts: '200,400 100,300 200,200 300,300', c: [200, 306], num: [200, 230], hn: [200, 388], cols: 3 },
    { pts: '200,400 300,300 400,400', c: [300, 364], num: [300, 318], hn: [348, 388], cols: 2 },
    { pts: '400,400 300,300 400,200', c: [366, 300], num: [320, 300], hn: [388, 346], cols: 1 },
    { pts: '400,200 300,300 200,200 300,100', c: [310, 200], num: [224, 200], hn: [376, 200], cols: 2 },
    { pts: '400,200 300,100 400,0', c: [366, 100], num: [320, 100], hn: [388, 54], cols: 1 },
    { pts: '400,0 300,100 200,0', c: [300, 38], num: [300, 82], hn: [348, 14], cols: 2 },
  ];
  /* South Indian: sign -> [column, row] in a 4 x 4 grid */
  const SCELL = { 11: [0, 0], 0: [1, 0], 1: [2, 0], 2: [3, 0], 3: [3, 1], 4: [3, 2], 5: [3, 3], 6: [2, 3], 7: [1, 3], 8: [0, 3], 9: [0, 2], 10: [0, 1] };

  /** items per sign: [{abbr,name,deg,retro,dig,color,t}] and the Lagna sign */
  function model(chart, o) {
    const opts = o || {};
    const d9 = opts.varga === 'D9';
    const bySign = Array.from({ length: 12 }, () => []);
    for (const b of AM.BODIES) {
      const p = chart.planets[b];
      bySign[d9 ? p.nav : p.sign].push({ abbr: AM.PLANET[b].abbr, name: b, deg: d9 ? null : p.deg, retro: !!p.retro && b !== 'Rahu' && b !== 'Ketu', dig: p.dignity ? p.dignity.key : null, color: PCOL[b] });
    }
    if (opts.overlay) {
      for (const b of AM.BODIES) {
        const p = opts.overlay.planets[b];
        bySign[p.sign].push({ abbr: AM.PLANET[b].abbr, name: b, deg: p.deg, retro: !!p.retro && b !== 'Rahu' && b !== 'Ketu', dig: null, color: '#ffd24a', t: true });
      }
    }
    return { bySign, lagnaSign: d9 ? chart.lagna.nav : chart.lagna.sign };
  }

  function labelsAt(items, c, cols, compact, extra) {
    const n = items.length;
    if (!n) return '';
    let perRow = cols; let fs = compact ? 11 : 13; let hideDeg = !!compact;
    const maxRows = cols === 1 ? 4 : 3;
    if (Math.ceil(n / perRow) > maxRows) { perRow += 1; fs = 10; hideDeg = true; }
    if (n >= 6) hideDeg = true;
    const rows = Math.ceil(n / perRow); const dy = fs + 4; const dx = hideDeg ? 28 : 47;
    return items.map((it, i) => {
      const r = Math.floor(i / perRow); const inRow = Math.min(perRow, n - r * perRow); const k = i - r * perRow;
      const x = c[0] + (k - (inRow - 1) / 2) * dx; const y = c[1] + (r - (rows - 1) / 2) * dy;
      const mark = (it.retro ? 'R' : '') + (it.dig === 'exalted' ? '↑' : it.dig === 'debilitated' ? '↓' : '');
      const deg = !hideDeg && it.deg != null ? ' ' + Math.floor(it.deg) + '°' : '';
      return '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" font-weight="700" fill="' + it.color + '"' + (it.t ? ' font-style="italic" text-decoration="underline"' : '') + '>' + esc(it.abbr) +
        (deg ? '<tspan font-size="' + (fs - 3) + '" font-weight="500" fill="#c8d0ea">' + deg + '</tspan>' : '') + (mark ? '<tspan font-size="' + (fs - 3) + '" fill="#e8eefc">' + mark + '</tspan>' : '') + '</text>';
    }).join('') + (extra || '');
  }

  const FILL = { primary: 'rgba(214,168,74,0.30)', secondary: 'rgba(214,168,74,0.14)', moon: 'rgba(106,165,255,0.30)', lagna: 'rgba(214,168,74,0.10)', none: 'rgba(255,255,255,0.02)' };

  /** North Indian chart. opts: { varga:'D9', overlay:transit, highlight:{house:'primary'|'secondary'|'moon'}, compact, showHouseNo, title } */
  function north(chart, o) {
    const opts = o || {};
    const m = model(chart, opts);
    let out = '<svg viewBox="-6 -6 412 412" role="img" aria-label="North Indian chart, ' + esc(AM.SIGNS[m.lagnaSign].name) + ' Lagna" xmlns="http://www.w3.org/2000/svg">';
    out += '<rect x="-3" y="-3" width="406" height="406" rx="12" fill="#0a1534" stroke="rgba(214,168,74,0.55)" stroke-width="1.5"/>';
    for (let h = 1; h <= 12; h += 1) {
      const geo = GEO[h - 1]; const sign = (m.lagnaSign + h - 1) % 12;
      const hl = opts.highlight && opts.highlight[h];
      const fill = hl ? FILL[hl] : h === 1 ? FILL.lagna : FILL.none;
      const stroke = hl === 'moon' ? '#6aa5ff' : hl ? '#f1d28a' : 'rgba(214,168,74,0.6)';
      out += '<g><polygon points="' + geo.pts + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (hl ? 2.4 : 1.3) + '" stroke-linejoin="round"/>';
      out += '<circle cx="' + geo.num[0] + '" cy="' + geo.num[1] + '" r="11" fill="' + (h === 1 ? '#f1d28a' : '#0a1534') + '" stroke="rgba(241,210,138,0.6)" stroke-width="1"/>';
      out += '<text x="' + geo.num[0] + '" y="' + (geo.num[1] + 4.5) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + (h === 1 ? '#231703' : '#f1d28a') + '">' + (sign + 1) + '</text>';
      if (opts.showHouseNo) out += '<text x="' + geo.hn[0] + '" y="' + (geo.hn[1] + 3) + '" text-anchor="middle" font-size="9" fill="#7d88ad">H' + h + '</text>';
      out += labelsAt(m.bySign[sign], geo.c, geo.cols, opts.compact) + '</g>';
    }
    if (!opts.compact) out += '<text x="200" y="30" text-anchor="middle" font-size="10" letter-spacing="2" font-weight="700" fill="#d6a84a">' + (opts.title ? esc(opts.title) : 'ASC ' + (opts.varga === 'D9' ? '' : Math.floor(chart.lagna.deg) + '°')) + '</text>';
    return out + '</svg>';
  }

  /** South Indian chart. Signs are fixed; the Lagna sign is marked. */
  function south(chart, o) {
    const opts = o || {};
    const m = model(chart, opts);
    let out = '<svg viewBox="-6 -6 412 412" role="img" aria-label="South Indian chart, ' + esc(AM.SIGNS[m.lagnaSign].name) + ' Lagna" xmlns="http://www.w3.org/2000/svg">';
    out += '<rect x="-3" y="-3" width="406" height="406" rx="12" fill="#0a1534" stroke="rgba(214,168,74,0.55)" stroke-width="1.5"/>';
    for (let sign = 0; sign < 12; sign += 1) {
      const [cx, cy] = SCELL[sign]; const x = cx * 100; const y = cy * 100;
      const house = ((sign - m.lagnaSign + 12) % 12) + 1;
      const hl = opts.highlight && opts.highlight[house];
      const fill = hl ? FILL[hl] : sign === m.lagnaSign ? FILL.lagna : FILL.none;
      out += '<g><rect x="' + x + '" y="' + y + '" width="100" height="100" fill="' + fill + '" stroke="' + (hl === 'moon' ? '#6aa5ff' : 'rgba(214,168,74,0.6)') + '" stroke-width="' + (hl ? 2.2 : 1.2) + '"/>';
      out += '<text x="' + (x + 6) + '" y="' + (y + 14) + '" font-size="10" fill="#7d88ad">' + esc(AM.SIGNS[sign].name.slice(0, 3)) + '</text>';
      if (sign === m.lagnaSign) out += '<line x1="' + x + '" y1="' + y + '" x2="' + (x + 26) + '" y2="' + y + '" stroke="#f1d28a" stroke-width="3"/><line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (y + 26) + '" stroke="#f1d28a" stroke-width="3"/><text x="' + (x + 94) + '" y="' + (y + 14) + '" text-anchor="end" font-size="10" font-weight="800" fill="#f1d28a">Asc</text>';
      if (opts.showHouseNo) out += '<text x="' + (x + 94) + '" y="' + (y + 95) + '" text-anchor="end" font-size="9" fill="#7d88ad">H' + house + '</text>';
      out += labelsAt(m.bySign[sign], [x + 50, y + 54], 2, opts.compact) + '</g>';
    }
    const t1 = opts.title || (opts.varga === 'D9' ? 'Navamsha D9' : 'Rashi D1');
    out += '<text x="200" y="190" text-anchor="middle" font-size="15" font-weight="800" letter-spacing="2" fill="#f1d28a">' + esc(t1) + '</text>';
    out += '<text x="200" y="212" text-anchor="middle" font-size="11" fill="#a9b3d1">' + esc(AM.SIGNS[m.lagnaSign].name) + ' Lagna</text>';
    return out + '</svg>';
  }

  AM.charts = { model, north, south, PCOL };
})(typeof window !== 'undefined' ? window : globalThis);
