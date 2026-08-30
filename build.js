const fs = require('fs');
const path = require('path');
const SRC = __dirname;
const OUT = 'D:/2026/maximally-human';
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');

/* ---------- 1. CSS, byte-identical ---------- */
const dc = read('Maximally Human Reader.dc.html');
const cssStart = dc.indexOf('<style>');
const cssEnd = dc.indexOf('</style>', cssStart);
if (cssStart < 0 || cssEnd < 0) throw new Error('style block not found');
const CSS = dc.slice(cssStart + '<style>'.length, cssEnd);
console.log('CSS bytes:', CSS.length);

/* ---------- 2. SHELL markup, unescaped from hos-shell.js ---------- */
const shellSrc = read('hos-shell.js');
const m = shellSrc.match(/var SHELL = ("(?:\\.|[^"\\])*");/);
if (!m) throw new Error('SHELL literal not found');
const SHELL = JSON.parse(m[1]);
if (!/id="hos-reader"/.test(SHELL) || !/id="hos-tree"/.test(SHELL)) {
  throw new Error('SHELL missing boot anchors');
}
console.log('SHELL bytes:', SHELL.length, '| dropped dynamic loader:', /hos-app\.js\?v=/.test(shellSrc));

/* ---------- 3. modules ---------- */
const sections = read('hos-sections.js');
const widgets  = read('hos-widgets.js');
const write    = read('hos-write.js');
const places   = read('hos-places.js');
let app        = read('hos-app.js');

/* added layers */
const storage   = read('hos-storage.js');
const dataUI    = read('hos-data-ui.js');
const mobile    = read('hos-mobile.js');
const RESPONSIVE = require('./responsive.js')(CSS);

/* Cap the shell-wait retries so a missing anchor fails loudly instead of
   spinning forever. The shell is static now, so the first check should pass. */
const RETRY_OLD = "  if (!document.getElementById('hos-reader') || !document.getElementById('hos-tree')) {\n    setTimeout(boot, 60);\n    return;\n  }";
const RETRY_NEW = [
  "  if (!document.getElementById('hos-reader') || !document.getElementById('hos-tree')) {",
  "    boot.__tries = (boot.__tries || 0) + 1;",
  "    if (boot.__tries > 25) {",
  "      console.error('[HOS] shell anchors #hos-reader / #hos-tree never appeared - aborting boot.');",
  "      var warn = document.createElement('pre');",
  "      warn.style.cssText = 'padding:24px;font:14px/1.5 monospace;color:#7A2E2A';",
  "      warn.textContent = 'The reader failed to start: shell markup is missing.';",
  "      document.body.appendChild(warn);",
  "      return;",
  "    }",
  "    setTimeout(boot, 60);",
  "    return;",
  "  }"
].join('\n');
if (!app.includes(RETRY_OLD)) throw new Error('boot retry block not matched');
app = app.replace(RETRY_OLD, RETRY_NEW);
console.log('boot retry capped at 25 attempts (~1.5s)');

/* Hook the added layers into the engine's own boot tail, so they run once the
   writing fields are mounted and the DOM they decorate exists. */
const HOOK_OLD = `    } catch (e) { console.warn('[HOS] writing layer failed', e); }
  }`;
const HOOK_NEW = `    } catch (e) { console.warn('[HOS] writing layer failed', e); }
  }
  if (window.HOS_DATA_UI) window.HOS_DATA_UI(window.HOS);
  if (window.HOS_MOBILE) window.HOS_MOBILE(window.HOS);
  if (window.HOS_TODAY) window.HOS_TODAY(window.HOS);`;
if (!app.includes(HOOK_OLD)) throw new Error('boot hook point not matched');
app = app.replace(HOOK_OLD, HOOK_NEW);
console.log('added layers hooked into boot');

/* ---------- 4. storage shim ---------- */
const STORAGE_SHIM_UNUSED = [
  "/* Design supplied window.storage; a plain page does not. Same async",
  "   get/set/delete contract, backed by localStorage, so written text survives",
  "   a reload. Falls back to in-memory when localStorage is unavailable. */",
  "(function () {",
  "  if (window.storage && typeof window.storage.get === 'function') return;",
  "  var mem = {};",
  "  var LS = (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true; } catch (e) { return false; } })();",
  "  window.storage = {",
  "    get: function (k) {",
  "      return Promise.resolve().then(function () {",
  "        if (!LS) return mem[k];",
  "        var v = localStorage.getItem('mh:' + k);",
  "        if (v == null) return undefined;",
  "        try { return JSON.parse(v); } catch (e) { return v; }",
  "      });",
  "    },",
  "    set: function (k, v) {",
  "      return Promise.resolve().then(function () {",
  "        mem[k] = v;",
  "        if (LS) localStorage.setItem('mh:' + k, JSON.stringify(v));",
  "      });",
  "    },",
  "    delete: function (k) {",
  "      return Promise.resolve().then(function () {",
  "        delete mem[k];",
  "        if (LS) localStorage.removeItem('mh:' + k);",
  "      });",
  "    }",
  "  };",
  "})();"
].join('\n');

/* ---------- 5. static pre-render of the document ---------- */
const sandbox = {};
(function (window) { eval(sections); })(sandbox);
const D = sandbox.HOS_DATA;
const ids = Object.keys(D.html);

/* Strip presentation down to semantics: no inline styles, no SVG, no widget
   hooks. Headings, paragraphs and lists survive with their text intact. */
function semantic(html) {
  return html
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(\w[\w-]*)((?:\s+[^>]*)?)>/g, function (all, tag, attrs) {
      if (tag.toLowerCase() === 'a') {
        const h = attrs.match(/\shref\s*=\s*"([^"]*)"/i);
        if (h) return '<a href="' + h[1] + '">';
      }
      return '<' + tag + '>';
    })
    .replace(/<div>\s*<\/div>/g, '')
    .replace(/<span>\s*<\/span>/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

const prerender = ids.map(function (id) {
  return '<section id="doc-' + id + '">\n' + semantic(D.html[id]) + '\n</section>';
}).join('\n');
console.log('pre-render bytes:', prerender.length, 'from raw', sections.length, '| sections:', ids.length);

/* ---------- 6. head ---------- */
const TITLE  = 'Maximally Human \u2014 The Human Operating System v2.0';
const DESC   = 'A 150-page framework for capability, health, wealth, character and meaning, where every claim carries an honest label saying how well it is supported.';
const OGDESC = 'Every significant claim carries a grade from established to speculative. It also publishes what it retired.';

const JSONLD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: TITLE,
  name: 'Maximally Human',
  alternativeHeadline: 'The Human Operating System v2.0',
  description: DESC,
  abstract: OGDESC,
  author: { '@type': 'Person', name: 'Nazil Afeef' },
  publisher: { '@type': 'Person', name: 'Nazil Afeef' },
  datePublished: '2026-08-30',
  dateModified: '2026-08-30',
  inLanguage: 'en',
  url: 'https://human.malebay.com/',
  mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://human.malebay.com/' },
  image: 'https://human.malebay.com/cover.png',
  version: '2.0',
  keywords: 'human operating system, evidence grading, capability, health, wealth, character, meaning, epistemics'
}, null, 2);

const HEAD = [
  '<meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>' + TITLE + '</title>',
  '<meta name="description" content="' + DESC + '">',
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">',
  '<link rel="canonical" href="https://human.malebay.com/">',
  '<meta property="og:type" content="article">',
  '<meta property="og:url" content="https://human.malebay.com/">',
  '<meta property="og:title" content="' + TITLE + '">',
  '<meta property="og:description" content="' + OGDESC + '">',
  '<meta property="og:image" content="https://human.malebay.com/cover.png">',
  '<meta property="og:site_name" content="Maximally Human">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:creator" content="@nazilafeef">',
  '<meta name="twitter:image" content="https://human.malebay.com/cover.png">',
  '<meta name="author" content="Nazil Afeef">',
  '<link rel="preconnect" href="https://fonts.googleapis.com">',
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
  '<link href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400;1,500&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">',
  '<script type="application/ld+json">',
  JSONLD,
  '<' + '/script>'
].join('\n');

const PRERENDER_CSS = [
  '',
  '  /* static pre-render: the real document in the served HTML, cleared on boot */',
  "  #hos-prerender { font-family: 'Spectral', Georgia, serif; font-size: 17px; line-height: 1.62; color: var(--ink); }",
  '  #hos-prerender section { max-width: 38em; margin: 0 auto 3em; }',
  '  #hos-prerender h1, #hos-prerender h2, #hos-prerender h3 { font-weight: 400; line-height: 1.15; }',
  ''
].join('\n');

const BODY = SHELL.replace(
  '<div id="hos-reader"></div>',
  '<div id="hos-reader"><div id="hos-prerender">\n' + prerender + '\n</div></div>'
);
if (BODY === SHELL) throw new Error('pre-render injection point not found');

/* data-cfasync="false" is Cloudflare's documented opt-out: Rocket Loader
   leaves these scripts alone. The whole reader is inline scripts in a strict
   dependency order, so any deferral or reordering breaks it. This makes the
   page immune whatever the zone setting says. */
const S = '<' + 'script data-cfasync="false">';
const E = '<' + '/script>';
const html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' + HEAD +
  '\n<style>' + CSS + PRERENDER_CSS + RESPONSIVE + '</style>\n</head>\n<body>\n' + BODY + '\n' +
  S + storage + E + '\n' +
  S + sections + E + '\n' +
  S + widgets + E + '\n' +
  S + write + E + '\n' +
  S + places + E + '\n' +
  S + dataUI + E + '\n' +
  S + mobile + E + '\n' +
  S + app + E + '\n' +
  '</body>\n</html>\n';

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), html, 'utf8');
console.log('\nWROTE', path.join(OUT, 'index.html'), (html.length / 1048576).toFixed(2), 'MB');
