/* Ink and burnished bronze.

   The document carries its colours as inline hex literals — 3,197 of them
   across 18 values — so a palette change is a rewrite of those literals at
   build time, not a CSS override. Rewriting them means light mode is simply
   correct rather than layered, and the existing dark-mode remapping keeps
   working once its selectors point at the new hexes.

   Contrast-corrected values are marked. Where a value failed, its lightness
   was walked within its own hue until it cleared, rather than substituting a
   different colour. */

const LIGHT = {
  paper:      '#F8F6F1',
  surface:    '#FDFCFA',
  surfaceAlt: '#F1ECE3',
  ink:        '#1C1A17',
  ink2:       '#4A453D',
  mute:       '#6E675C',
  hairline:   '#E2DCD1',
  accent:     '#8B4A24',
  accentSoft: '#F0E3D8',
  marker:     '#FBEDCB',
  claret:     '#7A2E38'
};

const DARK = {
  paper:      '#1A1917',
  surface:    '#232120',
  surfaceAlt: '#2B2825',
  ink:        '#EDE8DF',
  ink2:       '#C0B8AC',
  mute:       '#948E83',   // corrected from #8E877C — 4.12:1 on surface-alt
  hairline:   '#34302B',
  accent:     '#E5A470',
  accentSoft: '#3A2B21',
  marker:     '#4A3A1E',
  claret:     '#E58F99'
};

/* Evidence grades. Letters carry the distinction; colour is a second signal. */
const GRADES = {
  E1: { light: '#1F5136', dark: '#86C7A4' },
  E2: { light: '#2A5F6B', dark: '#82C0CD' },
  E3: { light: '#876613', dark: '#D6B462' },  // corrected from #8B6914
  E4: { light: '#6E675C', dark: '#A79E92' },
  E5: { light: '#706B61', dark: '#948E83' },  // corrected from #8A8478 / #8E877C
  X:  { light: '#7A2E38', dark: '#E58F99' }
};

/* Two values that had to be solved rather than taken from the brief. */
const ONACCENT   = '#D8D3CB';  // small labels sitting on the accent fill
const ACCENT_TINT= '#EBD9C8';  // italic text on the accent fill
const CLARET_SOFT= '#F6E8E6';  // the claret-tinted block background

/* Context-qualified rules run first: #A79C8A is a dotted border on light and
   a label on the accent fill, and one value cannot serve both. */
const CONTEXT_MAP = {
  'color:#A79C8A': ONACCENT,
  'color:#8A8072': LIGHT.mute
};

/* Every inline literal in the document, mapped to its replacement.
   Counts are occurrences in HOS_DATA at the time of writing. */
const MAP = {
  '#1A1917': LIGHT.ink,        // 1303 · body text, and dark block backgrounds
  '#1F3A5F': LIGHT.accent,     //  789 · the old blue accent — gone entirely
  '#D8D1C4': LIGHT.hairline,   //  281 · rules and borders
  '#8A8072': LIGHT.mute,       //  212 · was --faint at 3.62:1; folds into mute
  '#E0DACE': LIGHT.hairline,   //  143 · the lighter rule, folds into hairline
  '#4A453D': LIGHT.ink2,       //  112 · unchanged value, kept explicit
  '#7A2E2A': LIGHT.claret,     //  108 · Retired Claims and the X chip
  '#6B6357': LIGHT.mute,       //   54 · labels and metadata
  '#F1EDE4': LIGHT.surfaceAlt, //   53 · quiet blocks
  '#F7F4EE': LIGHT.paper,      //   52 · page background
  '#E4EAF1': LIGHT.accentSoft, //   35 · was a blue wash
  '#C0CDDC': '#D6CFC2',        //   24 · unhighlighted bars in figures -> neutral
  '#7A6F5D': '#A29A8C',        //   11 · chip borders -> light neutral
  '#A79C8A': '#A29A8C',        //    8 · what is left is border use only
  '#F4EDE9': CLARET_SOFT,      //    7 · the claret-tinted block background
  '#C9D5E2': ACCENT_TINT,      //    3 · text sitting on the accent fill
  '#3A5F8C': '#A55C2E',        //    1 · a figure's highlighted element
  '#7B95B5': '#C08355'         //    1 · its lighter partner
};

/* Dark-mode remapping targets, keyed by the NEW literal. */
const DARK_REMAP = [
  ['color:' + LIGHT.ink,        'color: var(--ink) !important'],
  ['background:' + LIGHT.ink,   'background: var(--ink-2) !important; color: var(--paper) !important'],
  ['color:' + LIGHT.ink2,       'color: var(--ink-2) !important'],
  ['color:' + LIGHT.mute,       'color: var(--mute) !important'],
  ['color:' + LIGHT.accent,     'color: var(--accent) !important'],
  ['background:' + LIGHT.accent,'background: ' + DARK.accentSoft + ' !important; color: ' + DARK.accent + ' !important'],
  ['background:' + LIGHT.surfaceAlt, 'background: var(--paper-2) !important'],
  ['background:' + LIGHT.accentSoft, 'background: var(--accent-soft) !important'],
  ['background:' + LIGHT.paper, 'background: var(--paper) !important'],
  ['background:#F6E8E6',        'background: #2E2022 !important'],
  ['color:' + LIGHT.claret,     'color: var(--ox) !important'],
  ['color:#EBD9C8',             'color: ' + DARK.accent + ' !important'],
  ['color:' + ONACCENT,         'color: var(--ink-2) !important'],
  ['color:#A29A8C',             'color: var(--mute) !important'],
  ['fill:#D6CFC2',              'fill: #4A443C !important'],
  ['color:#A55C2E',             'color: ' + DARK.accent + ' !important'],
  ['color:#C08355',             'color: ' + DARK.accent + ' !important']
];

/* ─────────── evidence chips ───────────
   The scale was carrying only three colours: E1 solid-filled in the old blue,
   E2 outlined in it, and E3/E4/E5 all sharing one neutral. Each grade now
   takes its own value, and the fill goes — solidly filled chips at this
   density read as a dashboard.

   Every non-colour decision is preserved: font-size, the solid/dashed/dotted
   border that already distinguishes E3/E4/E5, and the strikethrough on X.
   Un-filling E1 needs a border it did not have, so its padding drops by
   exactly that border width and the chip's outer size is unchanged. */
function chipCss(grade, style) {
  const c = GRADES[grade].light;
  const size = (style.match(/font-size:\s*[0-9.]+px/) || ['font-size:11px'])[0];
  const strike = /line-through/.test(style) ? '; text-decoration:line-through' : '';
  const dash = /border:\s*1px\s+(dashed|dotted)/.exec(style);
  const borderStyle = dash ? dash[1] : 'solid';
  const hadBorder = /border:/.test(style);

  let pad = (style.match(/padding:\s*([^;"]+)/) || [, '1px 6px'])[1].trim();
  if (!hadBorder) {
    pad = pad.split(/\s+/).map(v => {
      const n = parseFloat(v);
      return isNaN(n) ? v : Math.max(0, n - 1) + 'px';
    }).join(' ');
  }

  // E2 keeps a quiet ground; the rest sit straight on the page
  const bg = grade === 'E2' ? '; background:' + LIGHT.surfaceAlt : '';

  return "font-family:'IBM Plex Mono',monospace; " + size +
         '; font-weight:500; letter-spacing:0.1em' +
         '; border:1px ' + borderStyle + ' ' + c +
         '; color:' + c + bg +
         '; padding:' + pad + strike;
}

function repaintChips(html) {
  let n = 0;
  const out = html.replace(/<span style="([^"]*)">(E[1-5]|X)<\/span>/g, (all, style, grade) => {
    n++;
    return '<span style="' + chipCss(grade, style) + '">' + grade + '</span>';
  });
  return { html: out, n };
}

/* Rewrite every literal in the document's HTML. Chips are rebuilt first, then
   the context-qualified rules, then the bare hexes. */
function repaint(D) {
  const counts = { __chips: 0 };
  const ctx = Object.keys(CONTEXT_MAP);
  const bare = Object.keys(MAP);

  Object.keys(D.html).forEach(id => {
    let html = D.html[id];

    const chips = repaintChips(html);
    html = chips.html;
    counts.__chips += chips.n;

    ctx.forEach(key => {
      const re = new RegExp(key, 'gi');
      const hits = (html.match(re) || []).length;
      if (!hits) return;
      const prop = key.slice(0, key.indexOf(':') + 1);
      html = html.replace(re, prop + CONTEXT_MAP[key]);
      counts[key] = (counts[key] || 0) + hits;
    });

    bare.forEach(old => {
      const re = new RegExp(old, 'gi');
      const hits = (html.match(re) || []).length;
      if (!hits) return;
      html = html.replace(re, MAP[old]);
      counts[old] = (counts[old] || 0) + hits;
    });

    D.html[id] = html;
  });
  return counts;
}

/* ─────────── the stylesheet ───────────
   The old variable names are kept, because the whole stylesheet and every
   added module reference them. --faint folds into --mute: it was #8A8072 at
   3.62:1, the palette has no fourth neutral, and folding it up is a fix. */
function repaintCss(css) {
  const L = LIGHT, D = DARK;

  /* Sweep the old literals out of the stylesheet first. This matters most for
     the SVG attribute selectors — svg [stroke="#1F3A5F"] and friends — which
     match on the document's presentation attributes and would silently stop
     matching once those attributes were repainted. It also catches the print
     rule and the map-gate colours. The variable blocks are rewritten wholesale
     below, so sweeping them here is harmless. */
  Object.keys(MAP).forEach(old => {
    if (MAP[old].toUpperCase() === old.toUpperCase()) return;
    css = css.replace(new RegExp(old, 'gi'), MAP[old]);
  });
  // the old ink also appears as an rgba triple in scrims and shadows
  css = css.replace(/rgba\(\s*26\s*,\s*25\s*,\s*23\s*,/g, 'rgba(28,26,23,');

  const rootNew =
    ':root {\n' +
    '    --paper: ' + L.paper + '; --surface: ' + L.surface + '; --paper-2: ' + L.surfaceAlt + ';\n' +
    '    --ink: ' + L.ink + '; --ink-2: ' + L.ink2 + '; --mute: ' + L.mute + '; --faint: ' + L.mute + ';\n' +
    '    --rule: ' + L.hairline + '; --rule-2: ' + L.hairline + '; --hairline: ' + L.hairline + ';\n' +
    '    --accent: ' + L.accent + '; --accent-soft: ' + L.accentSoft + '; --marker: ' + L.marker + ';\n' +
    '    --ox: ' + L.claret + '; --chrome: ' + L.surfaceAlt + ';\n' +
    '    --shadow: 0 1px 2px rgba(28,26,23,0.06), 0 8px 28px rgba(28,26,23,0.09);\n' +
    '  }';

  const darkNew =
    '[data-theme="dark"] {\n' +
    '    --paper: ' + D.paper + '; --surface: ' + D.surface + '; --paper-2: ' + D.surfaceAlt + ';\n' +
    '    --ink: ' + D.ink + '; --ink-2: ' + D.ink2 + '; --mute: ' + D.mute + '; --faint: ' + D.mute + ';\n' +
    '    --rule: ' + D.hairline + '; --rule-2: ' + D.hairline + '; --hairline: ' + D.hairline + ';\n' +
    '    --accent: ' + D.accent + '; --accent-soft: ' + D.accentSoft + '; --marker: ' + D.marker + ';\n' +
    '    --ox: ' + D.claret + '; --chrome: #131211;\n' +
    '    --shadow: 0 1px 2px rgba(0,0,0,0.4), 0 8px 28px rgba(0,0,0,0.45);\n' +
    '  }';

  const rootRe = /:root \{[\s\S]*?\n  \}/;
  const darkRe = /\[data-theme="dark"\] \{[\s\S]*?\n  \}/;
  if (!rootRe.test(css)) throw new Error('palette: :root block not found');
  if (!darkRe.test(css)) throw new Error('palette: dark block not found');
  css = css.replace(rootRe, rootNew).replace(darkRe, darkNew);

  /* The floating support link renders at the resting opacity of its wrapper,
     which was tuned for the old navy. At 0.62 the bronze computes to #DDCDBF
     on paper — 1.33:1. The navy was already failing there at 3.63:1, so this
     is a pre-existing fault the repaint made visible; 0.85 is the least
     opacity that clears 4.5:1 in light mode, and it clears 6.3:1 in dark.
     The transient scrolling fade is left alone. */
  css = css.replace(/(\.hos-support-full \{[^}]*?)opacity: 0\.62;/, '$1opacity: 0.85;');

  // search-match highlight
  css = css.replace(/mark \{ background: #F3E2A9;/, 'mark { background: var(--marker);');
  css = css.replace(/\[data-theme="dark"\] mark \{ background: #4A431F;/,
                    '[data-theme="dark"] mark { background: var(--marker);');

  /* Replace the dark-mode remapping of inline literals. The old rules point at
     the old hexes, so they would silently stop matching after the repaint. */
  const start = css.indexOf('/* ─── dark-mode remapping');
  if (start < 0) throw new Error('palette: dark remap block not found');
  const endMarker = css.indexOf('\n\n', css.indexOf('[data-theme="dark"] #hos-reader', start));
  let lastRule = start;
  const ruleRe = /\[data-theme="dark"\] #hos-reader \[style\*="[^"]*"\][^\n]*\n/g;
  ruleRe.lastIndex = start;
  let m, end = start;
  while ((m = ruleRe.exec(css)) && m.index <= end + 400) end = m.index + m[0].length;

  const rebuilt =
    '/* ─── dark-mode remapping of the document\'s inline literals ─── */\n' +
    DARK_REMAP.map(([lit, decl]) =>
      '  [data-theme="dark"] #hos-reader [style*="' + lit + '"] { ' + decl + '; }'
    ).join('\n') +
    '\n  [data-theme="dark"] #hos-reader [style*="' + LIGHT.hairline + '"] { border-color: var(--rule) !important; }\n';

  css = css.slice(0, start) + rebuilt + css.slice(end);

  /* Evidence chips in dark mode: swap each grade's light value for its dark
     partner, so the scale lifts rather than inverting. */
  css += '\n  /* ─── evidence chips in dark mode ─── */\n' +
    Object.entries(GRADES).map(([g, v]) =>
      '  [data-theme="dark"] #hos-reader [style*="color:' + v.light + '"] { color: ' + v.dark +
      ' !important; border-color: ' + v.dark + ' !important; }'
    ).join('\n') + '\n';

  return css;
}

/* Check nothing from the old scheme survives. */
function orphans(text) {
  const old = Object.keys(MAP);
  const found = {};
  old.filter(o => MAP[o].toUpperCase() !== o.toUpperCase()).forEach(o => {
    const n = (text.match(new RegExp(o, 'gi')) || []).length;
    if (n) found[o] = n;
  });
  return found;
}

module.exports = { LIGHT, DARK, GRADES, MAP, CONTEXT_MAP, DARK_REMAP,
                   ONACCENT, ACCENT_TINT, CLARET_SOFT, repaint, repaintCss, orphans };
