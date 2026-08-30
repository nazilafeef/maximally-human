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
index.html    the entire reader: shell, styles, document, engine
robots.txt    open to everyone, AI crawlers named and allowed explicitly
sitemap.xml   the single canonical URL
cover.png     1200×630 Open Graph card
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

### Persistence

Reading position, bookmarks, instrument entries and everything typed into the
workbook are held in `localStorage` under the `mh:` prefix, batched into three
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
directory is the repository root; production branch `main`. A Configuration
Rule scoped to `human.malebay.com` disables Rocket Loader, which would
otherwise rewrite the inline scripts the reader is made of.

## Support

- PayPal — <https://www.paypal.com/ncp/payment/YMCKV5QLWEP6N>
- Gumroad — <https://kauti.gumroad.com/l/MaximallyHuman>

---

© Nazil Afeef. The text is the author's; this repository is the presentation
layer for it.
