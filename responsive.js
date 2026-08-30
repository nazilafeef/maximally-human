/* Generates the responsive stylesheet.
   The document's prose carries its sizing in INLINE styles (341 instances of
   font-size:17px alone, 261 inline grid-template-columns), so ordinary CSS
   selectors lose to specificity. Everything here therefore targets the inline
   style attribute directly — the same technique the file already uses for its
   dark-mode remapping — and wins with !important. */

const SIZE_MAP = {
  phone:  { 8.5:12, 9:12, 9.5:12, 10:12, 10.5:12,
            11:14, 11.5:14, 12:14, 12.5:14,
            13:15, 13.5:15, 14:15, 14.5:15,
            15:16, 15.5:16, 16:16.5, 16.5:16.5,
            17:17, 18:17.5, 19:18, 20:19, 21:19, 22:20,
            24:21, 25:22, 28:23, 30:25, 32:26, 36:27, 38:28, 40:28,
            44:30, 46:31, 52:32, 56:34, 64:36, 76:40 },
  small:  { 8.5:12, 9:12, 9.5:12, 10:12, 10.5:12.5,
            11:14, 11.5:14, 12:14, 12.5:14.5,
            13:15, 13.5:15, 14:15.5, 14.5:15.5,
            15:16, 15.5:16.5, 16:17, 16.5:17,
            17:17.5, 18:18, 19:18.5, 20:19.5, 21:20, 22:21,
            24:22, 25:23, 28:25, 30:26, 32:28, 36:30, 38:31, 40:32,
            44:34, 46:35, 52:38, 56:40, 64:44, 76:48 },
  tablet: { 8.5:12, 9:12.5, 9.5:13, 10:13, 10.5:13,
            11:14, 11.5:14.5, 12:14.5, 12.5:15,
            13:15, 13.5:15.5, 14:16, 14.5:16,
            15:16.5, 15.5:17, 16:17.5, 16.5:17.5,
            17:18, 18:18.5, 19:19, 20:20, 21:21, 22:22,
            24:24, 25:25, 28:27, 30:29, 32:31, 36:34, 38:35, 40:36,
            44:39, 46:40, 52:44, 56:47, 64:52, 76:58 }
};

function sizeRules(map, indent) {
  const pad = ' '.repeat(indent);
  return Object.keys(map).map(from => {
    const to = map[from];
    // Match the inline declaration exactly as it is written in the document.
    return pad + '#hos-reader [style*="font-size:' + from + 'px"]' +
           ' { font-size: ' + to + 'px !important; }';
  }).join('\n');
}

/* The stylesheet's own small sizes are class-driven, so the inline-style
   selectors above never reach them. Rather than transcribe 123 selectors by
   hand, read them out of the CSS and raise each one to the right floor:
   anything a reader must actually read to 14px, pure chrome to 12px. */
const CONTENT_RE = /hos-(pop|table|stage|phase|map|rule|log|w-note|w-tag|entry|metric|legend|check|score|card-face|result|cal|strip|status|cite|grade|ruin|yn|luck|reveal|sec-|prose|note)/;

function cssFloorRules(css, floorContent, floorChrome, indent) {
  const pad = ' '.repeat(indent);
  const re = /([^{}]+)\{([^}]*)\}/g;
  const seen = new Set();
  const out = [];
  let m;
  while ((m = re.exec(css))) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    const body = m[2];
    if (/^@/.test(sel) || sel.includes('@media')) continue;
    const fs = body.match(/font-size:\s*([0-9.]+)px/);
    if (!fs) continue;
    const size = parseFloat(fs[1]);
    const floor = CONTENT_RE.test(sel) ? floorContent : floorChrome;
    if (size >= floor) continue;
    if (seen.has(sel)) continue;
    seen.add(sel);
    out.push(pad + sel + ' { font-size: ' + floor + 'px !important; }');
  }
  return out.join('\n');
}

/* Reading measure: the document pins 565 max-widths in em. On a phone the
   gutter should decide the measure, not a fixed em value. */
const MEASURE_PHONE = `
    #hos-reader [style*="max-width:"] { max-width: 100% !important; }
    #hos-reader [style*="margin-left:auto"],
    #hos-reader [style*="margin:0 auto"] { margin-left: 0 !important; margin-right: 0 !important; }`;

/* The document builds its tables as inline CSS grids. Collapsing every one to
   a single column is the correct phone behaviour: each cell becomes a block,
   and the label cell that starts each row reads as that row's heading. */
const GRID_STACK = `
    #hos-reader [style*="grid-template-columns"] {
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 4px !important;
    }
    #hos-reader [style*="grid-template-columns"] > * { min-width: 0; }
    /* the label cell of each stacked row reads as its heading */
    #hos-reader [style*="grid-template-columns"] > span:first-child,
    #hos-reader [style*="grid-template-columns"] > div:first-child {
      font-weight: 600;
      padding-top: 4px;
    }
    /* real <table> elements: stack rows into labelled cards */
    #hos-reader table { display: block !important; width: 100% !important; }
    #hos-reader table thead { display: none !important; }
    #hos-reader table tbody, #hos-reader table tr, #hos-reader table td, #hos-reader table th {
      display: block !important; width: auto !important;
    }
    #hos-reader table tr {
      border: 1px solid var(--rule); border-radius: 3px;
      padding: 10px 12px; margin-bottom: 10px; background: var(--paper);
    }
    #hos-reader table td { padding: 4px 0 !important; border: none !important; }
    #hos-reader table td[data-label]::before {
      content: attr(data-label);
      display: block;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase;
      color: var(--faint); margin-bottom: 2px;
    }`;

module.exports = function buildResponsiveCss(baseCss) {
  baseCss = baseCss || '';
  return `
  /* ═══════════════════════════════════════════════════════════════════
     RESPONSIVE LAYER
     Layout and type scale only — no content, colour or design-language
     changes. Targets inline styles because the document carries its own
     sizing inline and would otherwise win on specificity.
     ═══════════════════════════════════════════════════════════════════ */

  /* iOS safe areas, used throughout */
  :root {
    --sat: env(safe-area-inset-top, 0px);
    --sab: env(safe-area-inset-bottom, 0px);
    --sal: env(safe-area-inset-left, 0px);
    --sar: env(safe-area-inset-right, 0px);
  }
  html { -webkit-text-size-adjust: 100%; }
  #hos-reader img, #hos-reader svg, #hos-reader canvas { max-width: 100%; height: auto; }

  /* Nothing may push the page sideways.
     A bare 1fr track is minmax(auto, 1fr), and that auto minimum is
     min-content — so one wide inline grid deep in the document was sizing the
     whole column to 594px inside a 375px viewport. Because html/body are
     overflow:hidden the excess was clipped rather than scrolled, which is why
     it read as "no overflow" while text was visibly cut off. minmax(0, 1fr)
     lets the track shrink below its content. */
  #hos-app, #hos-main, #hos-reader { min-width: 0; }
  #hos-main, #hos-reader, #hos-sidebar { min-width: 0; }
  #hos-reader, #hos-reader * { overflow-wrap: break-word; }

  /* ─────────── 901–1100px · tablet landscape ───────────
     Sidebar stays, but narrower; the mini table of contents goes.
     Floored at 901px so it cannot override the drawer layout below 900px. */
  @media (min-width: 901px) and (max-width: 1100px) {
    #hos-app { grid-template-columns: 250px 1fr; }
    #hos-mini { display: none !important; }
    #hos-reader { padding-left: 34px; padding-right: 34px; }
${sizeRules(SIZE_MAP.tablet, 4)}
${cssFloorRules(baseCss, 14, 12, 4)}
  }

  /* ─────────── ≤900px · large phone / small tablet ───────────
     The existing drawer breakpoint. Everything below extends it. */
  @media (max-width: 900px) {
    /* the single column must be allowed to shrink below its content */
    #hos-app { grid-template-columns: minmax(0, 1fr) !important; }
    #hos-main { overflow-x: hidden; }
    #hos-topbar { padding-top: var(--sat); height: calc(52px + var(--sat)); }
    #hos-sidebar {
      top: calc(52px + var(--sat));
      padding-bottom: calc(20px + var(--sab));
      width: min(302px, 86vw);
    }
    body.drawer-open #hos-scrim { inset: calc(52px + var(--sat)) 0 0; }
    #hos-reader { padding: 24px 20px 55vh; }

    /* Below the drawer breakpoint the reading column is narrow enough that
       every inline grid must stack, or rows run off the side. This is what
       makes the tables readable without horizontal scrolling. */
${MEASURE_PHONE}
${GRID_STACK}
    /* Type scale applies from here down, so the 769–900px band — a phone held
       sideways — is covered rather than falling back to desktop sizes. */
${sizeRules(SIZE_MAP.tablet, 4)}
${cssFloorRules(baseCss, 14, 12, 4)}
  }

  /* ─────────── ≤768px · tablet portrait ─────────── */
  @media (max-width: 768px) {
${sizeRules(SIZE_MAP.tablet, 4)}
${cssFloorRules(baseCss, 14, 12, 4)}
    #hos-reader { padding: 24px 22px 55vh; font-size: 18px; }
    #hos-reader p { line-height: 1.66 !important; margin-bottom: 1em !important; }
  }

  /* ─────────── ≤600px · phone ─────────── */
  @media (max-width: 600px) {
${sizeRules(SIZE_MAP.small, 4)}
${cssFloorRules(baseCss, 14, 12, 4)}

    #hos-reader { padding: 20px 18px 50vh; }
    /* looser leading and more air between paragraphs on a small screen */
    #hos-reader p { line-height: 1.68 !important; margin-bottom: 1.05em !important; }
    #hos-reader h2, #hos-reader h3 { line-height: 1.18 !important; }
    #hos-reader blockquote { margin-left: 0 !important; margin-right: 0 !important; }

    /* fluid display sizes rather than breakpoint jumps */
    #hos-reader [style*="font-size:76px"] { font-size: clamp(34px, 11vw, 48px) !important; }
    #hos-reader [style*="font-size:64px"] { font-size: clamp(32px, 10vw, 44px) !important; }
    #hos-reader [style*="font-size:44px"] { font-size: clamp(27px, 8vw, 35px) !important; }
    #hos-reader [style*="font-size:40px"] { font-size: clamp(26px, 7.5vw, 32px) !important; }

    /* the Architecture map: one column, tappable cells */
    .hos-map-grid { grid-template-columns: 1fr !important; }
    .hos-map-grid > * { min-height: 44px; display: flex; align-items: center; }

    /* overlays become full-screen sheets rather than centred modals */
    #hos-overlay { padding: 0 !important; align-items: stretch !important; }
    #hos-overlay .hos-sheet {
      max-width: none !important; width: 100% !important;
      max-height: none !important; height: 100% !important;
      border-radius: 0 !important; margin: 0 !important;
      display: flex; flex-direction: column;
      padding-top: var(--sat);
      padding-bottom: var(--sab);
    }
    #hos-overlay-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .hos-sheet-head { position: sticky; top: 0; z-index: 2; background: var(--paper); }

    /* workbook export controls stay reachable */
    .hos-wb-export { position: sticky; bottom: 0; background: var(--paper);
                     padding-bottom: calc(10px + var(--sab)); }
    .hos-wb-export button { min-height: 44px; }

    /* the back pill clears the iOS home indicator */
    #hos-back {
      bottom: calc(16px + var(--sab)) !important;
      left: 16px !important; right: auto !important;
      min-height: 44px; padding: 10px 16px;
      max-width: calc(100vw - 32px);
    }
    /* the floating support button must not sit under the back pill */
    .hos-support-full, .hos-support {
      bottom: calc(16px + var(--sab)) !important;
      right: 16px !important; left: auto !important;
      min-height: 44px;
    }
    body.has-back .hos-support-full, body.has-back .hos-support { display: none !important; }

    /* prev/next stacks and stays tappable */
    .hos-prevnext { grid-template-columns: 1fr !important; gap: 8px; }
    .hos-pn { min-height: 44px; display: flex; flex-direction: column; justify-content: center; }
  }

  /* ─────────── ≤480px · small phone ─────────── */
  @media (max-width: 480px) {
${sizeRules(SIZE_MAP.phone, 4)}
${cssFloorRules(baseCss, 14, 12, 4)}
    #hos-reader { padding: 18px 16px 50vh; }
    .hos-brand span { display: none; }
    #hos-crumb { display: none !important; }
  }

  /* ─────────── touch targets, all touch devices ─────────── */
  @media (hover: none), (max-width: 900px) {
    #hos-tree [data-row],
    #hos-tree button,
    .hos-side-item,
    .hos-tool,
    .hos-grade,
    #hos-grades button,
    .hos-star, .hos-copy,
    .hos-yn button,
    .hos-btn-sm,
    .hos-linky,
    .hos-reveal-btn,
    .hos-wb-todo-row {
      min-height: 44px;
    }
    .hos-tool { min-width: 44px; display: inline-flex; align-items: center; justify-content: center; }
    /* the stage checkbox and its label are one 44px target */
    .hos-stage-check, .hos-phase-check, .hos-luck-check {
      min-height: 44px; display: flex; align-items: center; gap: 10px;
    }
    .hos-stage-check input[type="checkbox"],
    .hos-phase-check input[type="checkbox"],
    .hos-luck-check input[type="checkbox"] {
      width: 22px; height: 22px; flex: none;
    }
    /* evidence-grade chips: readable and tappable */
    #hos-grades button { min-width: 44px; font-size: 14px !important; }

  }

  /* ─────────── cross-reference popover as a bottom sheet ───────────
     On touch it opens on tap and dismisses by tap-outside, so it must not
     depend on a hover state that a finger cannot produce. */
  @media (max-width: 600px) {
    #hos-pop {
      position: fixed !important;
      left: 0 !important; right: 0 !important;
      top: auto !important;
      bottom: 0 !important;
      width: 100% !important;
      max-width: none !important;
      max-height: 72vh;
      overflow-y: auto;
      border-radius: 12px 12px 0 0;
      padding: 18px 18px calc(18px + var(--sab));
      box-shadow: 0 -8px 32px rgba(26,25,23,0.22);
      border: 1px solid var(--rule);
      border-bottom: none;
      z-index: 90;
      animation: hos-sheet-up .18s ease;
    }
    #hos-pop .hos-pop-body, #hos-pop p { font-size: 15px !important; line-height: 1.6 !important; }
    #hos-pop a, #hos-pop button, #hos-pop [data-jump] {
      min-height: 44px; display: inline-flex; align-items: center;
    }
    #hos-pop-scrim {
      position: fixed; inset: 0; z-index: 89;
      background: rgba(26,25,23,0.28);
    }
  }
  @keyframes hos-sheet-up { from { transform: translateY(12px); opacity: .6 } to { transform: none; opacity: 1 } }
  @media (prefers-reduced-motion: reduce) { #hos-pop { animation: none !important; } }

  /* ─────────── short landscape phone ───────────
     A phone held sideways has almost no vertical room; give it back. */
  @media (max-height: 500px) and (orientation: landscape) {
    #hos-topbar { height: calc(44px + var(--sat)); }
    #hos-sidebar { top: calc(44px + var(--sat)); }
    body.drawer-open #hos-scrim { inset: calc(44px + var(--sat)) 0 0; }
    #hos-reader { padding-top: 14px; padding-bottom: 40vh; }
    /* the bar gets shorter, but the targets inside it stay thumb-sized */
    #hos-topbar .hos-tool { min-height: 44px; }
    #hos-overlay .hos-sheet { height: 100%; }
    #hos-pop { max-height: 80vh; }
  }

  /* ─────────── search / command palette at 375px ─────────── */
  @media (max-width: 600px) {
    #hos-overlay input, #hos-overlay .hos-input { font-size: 16px !important; min-height: 44px; }
    #hos-overlay .hos-result, #hos-overlay [data-jump] { min-height: 44px; }
    #hos-overlay .hos-result { font-size: 15px !important; }
  }

  /* ─────────── inputs: 16px floor, last word in the cascade ───────────
     iOS zooms the viewport whenever a focused field is under 16px. This sits
     at the end deliberately: the generated floor rules above are also
     !important, so only source order can settle it. */
  @media (hover: none), (max-width: 1100px) {
    input, textarea, select,
    .hos-ta, #hos-filter, .hos-input,
    #hos-overlay input, #hos-reader input, #hos-reader textarea {
      font-size: 16px !important;
    }
  }

  /* ─────────── the storage warning strip ─────────── */
  .hos-storage-warn {
    display: block; margin: 10px 0 0; padding: 9px 11px;
    border: 1px solid var(--ox); border-left-width: 3px;
    background: var(--paper-2); color: var(--ink);
    font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; line-height: 1.5;
  }
  .hos-storage-warn b { display: block; margin-bottom: 3px; color: var(--ox); }
  .hos-storage-warn button {
    margin-top: 6px; min-height: 34px; padding: 5px 10px;
    border: 1px solid var(--rule); background: var(--paper); font-size: 12px;
  }
  .hos-storage-meter {
    font-family: 'IBM Plex Mono', monospace; font-size: 10px;
    letter-spacing: 0.06em; color: var(--faint); padding: 5px 0 0;
  }
  @media (max-width: 900px) { .hos-storage-meter { font-size: 12px; } }
`;
};
