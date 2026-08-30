# Maximally Human — The Human Operating System v2.0

The reading environment for *Maximally Human*, by Nazil Afeef.
Live at **<https://human.malebay.com/>**.

A 150-page framework for capability, health, wealth, character and meaning,
in which every significant claim carries an honest label saying how well it is
supported — from *established* down to *speculative* — and which publishes
what it retired.

## What this repo is

A static site. One self-contained `index.html` (~1 MB) with no build step, no
dependencies and no external requests other than Google Fonts. Everything —
markup, CSS, the whole document, and the reading engine — is inlined.

```
index.html            the entire reader: shell, styles, document, engine
robots.txt            open to everyone, AI crawlers named and allowed
sitemap.xml           the single canonical URL
cover.png             1200×630 Open Graph card
manifest.webmanifest  installable app metadata
sw.js                 offline cache
icon-192/512.png      app icons
```

## Structure of index.html

The page is assembled from six modules, inlined in dependency order because
each one reads globals defined by the ones before it:

| # | Source | Defines |
|---|--------|---------|
| 0 | storage shim | `window.storage` — localStorage-backed |
| 1 | `hos-sections.js` | `window.HOS_DATA` — the whole document, 46 sections |
| 2 | `hos-widgets.js` | `window.HOS_WIDGETS` — instruments layer |
| 3 | `hos-write.js` | `window.HOS_WRITE`, `window.HOS_WRITE_API` |
| 4 | `hos-places.js` | `window.HOS_PLACES`, `window.HOS_OPEN_WORKBOOK` |
| 5 | shell markup | static HTML in `<body>` — `#hos-reader`, `#hos-tree` |
| 6 | `hos-app.js` | `window.HOS` — the engine; boots on load |

### Crawlability

The document text lives in a JavaScript string, so a crawler that does not run
JS would otherwise see an empty shell. The build pre-renders all 46 sections as
semantic HTML directly inside `#hos-reader` — the engine's own render target,
which it clears on boot. The real text is therefore in the served HTML
response, visible to crawlers and to readers without JavaScript, and is
replaced by the full interactive render the moment the engine starts.

### Responsive

The document carries its sizing inline — 341 `font-size:17px` declarations
and 261 `grid-template-columns` — so ordinary selectors lose on specificity.
The responsive layer targets the style attribute directly, the same technique
the file already uses for dark-mode remapping, and generates its class-level
overrides from the stylesheet rather than transcribing 123 selectors.

Breakpoints: 480 / 600 / 768 / 900 / 901–1100 / 1360, plus short landscape.
Body text ≥17px on phones and ≥18px on tablets, readable text ≥14px, chrome
≥12px, every input 16px so iOS does not zoom on focus, every target ≥44px.
Inline grids stack to one column below 900px so the tables read without
horizontal scrolling.

One subtlety worth keeping: a bare `1fr` track is `minmax(auto, 1fr)`, and
that auto minimum is min-content — one wide grid was sizing the whole column
to 594px inside a 375px viewport. Because `html`/`body` are `overflow:hidden`
the excess was clipped rather than scrolled, so `scrollWidth` reported nothing
while text was visibly cut off. The fix is `minmax(0, 1fr)`.

### Today

A first sidebar item above the document, assembling one screen from state the
reader has already set: mode and stage, the ninety-day phase and day number,
the laws they are working on, tonight's audit and prosperity ledger fillable
inline, their open WOOP, decisions past review, and one rule a day drawn
preferentially from the ones marked shaky. Entries written here go into the
same practice logs the document's own instruments use.

No streaks, points, badges, levels, celebrations or progress-as-score. The
document argues against motivational scaffolding, and an app contradicting its
own text would be worse than no app.

### Persistence

Reading position, bookmarks, instrument entries and everything typed into the
workbook are held in IndexedDB (`maximally-human`), falling back to `localStorage` then memory, batched into three
keys (`hos:reader`, `hos:practice`, `hos:workbook`). Nothing leaves the
browser. If `localStorage` is unavailable the same interface degrades to
in-memory for the session.

## Rebuilding

The source modules are not in this repo. `build.js` (kept alongside the
extracted Claude Design export) inlines them, strips the Design scaffolding —
`<x-import>`, `<x-dc>`, the `DCLogic` block and the dynamic `hos-app.js`
loader — and writes `index.html`.

```
node build.js
```

## Deployment

Cloudflare Pages, connected to this repo. No build command; the output
directory is the repository root; production branch `main`.

### Rocket Loader

Rocket Loader is on zone-wide for `malebay.com` and rewrites script types.
The reader is six inline scripts that must run in a strict dependency order,
so any deferral or reordering breaks it. Every script tag therefore carries
`data-cfasync="false"`, Cloudflare's documented per-script opt-out, which
makes the page correct regardless of the zone setting. A Configuration Rule
scoped to `hostname eq "human.malebay.com"` would be belt-and-braces but is
not required for correctness.

### AI Crawl Control

The zone has AI Crawl Control enabled, which injects a managed `robots.txt`
block *above* this repo's file, with `Disallow: /` for GPTBot, ClaudeBot,
CCBot, Google-Extended, Bytespider, Amazonbot, Applebot-Extended and
meta-externalagent. Because robots.txt resolves the first matching
user-agent group, those directives win over the permissive ones here. The
feature is zone-wide and dashboard-only, with no per-hostname scope, so
`robots.txt` in this repo states the intent but the zone setting decides the
outcome.

## Support

- PayPal — <https://www.paypal.com/ncp/payment/YMCKV5QLWEP6N>
- Gumroad — <https://kauti.gumroad.com/l/MaximallyHuman>

---

© Nazil Afeef. The text is the author's; this repository is the presentation
layer for it.
