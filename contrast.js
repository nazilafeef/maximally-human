/* WCAG contrast checker. Silent unless run directly. */
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}
function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function grey(hex) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
  const y = Math.round(0.2126*r + 0.7152*g + 0.0722*b);
  return '#' + [y,y,y].map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
}

module.exports = { ratio, lum, grey };

if (require.main === module) {
  const P = require('./palette.js');
  const fails = [];
  const check = (label, fg, bg, min) => {
    const r = ratio(fg, bg), pass = r >= min;
    if (!pass) fails.push({ label, fg, bg, r, min });
    console.log('  ' + (pass ? 'ok  ' : 'FAIL') + '  ' + label.padEnd(40) +
                fg + ' on ' + bg + '  ' + r.toFixed(2) + ':1');
  };

  for (const [name, S] of [['LIGHT', P.LIGHT], ['DARK', P.DARK]]) {
    const key = name.toLowerCase();
    console.log('\n══════════ ' + name + ' ══════════');
    console.log(' body text (7:1)');
    check('ink / paper', S.ink, S.paper, 7);
    check('ink / surface', S.ink, S.surface, 7);
    check('ink / surface-alt', S.ink, S.surfaceAlt, 7);
    check('ink / marker', S.ink, S.marker, 7);
    console.log(' secondary and chrome (4.5:1)');
    check('ink-2 / paper', S.ink2, S.paper, 4.5);
    check('mute / paper', S.mute, S.paper, 4.5);
    check('mute / surface', S.mute, S.surface, 4.5);
    check('mute / surface-alt', S.mute, S.surfaceAlt, 4.5);
    console.log(' accent (4.5:1)');
    check('accent / paper', S.accent, S.paper, 4.5);
    check('accent / surface', S.accent, S.surface, 4.5);
    check('accent / surface-alt', S.accent, S.surfaceAlt, 4.5);
    check('accent / accent-soft', S.accent, S.accentSoft, 4.5);
    console.log(' claret (4.5:1)');
    check('claret / paper', S.claret, S.paper, 4.5);
    check('claret / surface-alt', S.claret, S.surfaceAlt, 4.5);
    console.log(' evidence chips on paper (4.5:1)');
    Object.entries(P.GRADES).forEach(([k, v]) => check(k + ' / paper', v[key], S.paper, 4.5));
    console.log(' evidence chips on surface-alt (4.5:1)');
    Object.entries(P.GRADES).forEach(([k, v]) => check(k + ' / surface-alt', v[key], S.surfaceAlt, 4.5));
  }

  console.log('\n══════════ TEXT ON FILLS ══════════');
  check('paper / accent fill', P.LIGHT.paper, P.LIGHT.accent, 4.5);
  check('on-accent label / accent', P.ONACCENT, P.LIGHT.accent, 4.5);
  check('on-accent tint / accent', P.ACCENT_TINT, P.LIGHT.accent, 4.5);
  check('paper / ink fill', P.LIGHT.paper, P.LIGHT.ink, 4.5);
  check('claret / claret-soft', P.LIGHT.claret, P.CLARET_SOFT, 4.5);
  check('ink / claret-soft', P.LIGHT.ink, P.CLARET_SOFT, 7);

  console.log('\n══════════ GREYSCALE (figures) ══════════');
  const L = P.LIGHT;
  [['ink', L.ink], ['ink-2', L.ink2], ['mute', L.mute], ['accent', L.accent]].forEach(([n, h]) =>
    console.log('  ' + n.padEnd(8) + grey(h) + ' vs paper ' + ratio(grey(h), grey(L.paper)).toFixed(2) + ':1'));
  console.log('  accent vs ink, in greyscale: ' + ratio(grey(L.accent), grey(L.ink)).toFixed(2) + ':1');
  Object.entries(P.GRADES).forEach(([k, v]) =>
    console.log('  chip ' + k.padEnd(3) + ' ' + grey(v.light) + ' vs paper ' +
                ratio(grey(v.light), grey(L.paper)).toFixed(2) + ':1'));

  console.log('\n══════════ SUMMARY ══════════');
  if (!fails.length) console.log('  all checks pass');
  else {
    console.log('  ' + fails.length + ' FAILURES:');
    fails.forEach(f => console.log('    ' + f.label + '  ' + f.fg + ' on ' + f.bg +
      '  ' + f.r.toFixed(2) + ':1, need ' + f.min));
    process.exitCode = 1;
  }
}
