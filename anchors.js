/* Re-anchoring the writing fields.

   27 of the 34 placements used endOf(section), which stacks every field at the
   bottom of its section, far from the instruction it belongs to. Each one below
   gets an explicit anchor <div> injected into the document HTML immediately
   after the element that carries its instruction, and the field is then mounted
   into that anchor.

   Anchors are injected rather than matched at runtime because several of the
   instructions live inside nested flex rows where a text match would resolve to
   the outer container and land the field after the whole block. */

/* key -> { section, after: unique text inside the target element } */
const ANCHORS = {
  // ── Law 16: the five logs, each beside its own instruction ──
  'law16-nightly':   { s: 'law-16', after: 'The audit is for the record; the rumination is for nothing.' },
  'law16-weekly':    { s: 'law-16', after: "What worked? What didn&#39;t? What is next week&#39;s single priority?",
                       alt: "What worked? What didn't? What is next week's single priority?" },
  'law16-quarterly': { s: 'law-16', after: 'What should I stop doing entirely? What am I persisting at out of sunk cost?' },
  'law16-annual':    { s: 'law-16', after: 'Am I on a path I would choose again' },
  'law16-redteam':   { s: 'law-16', after: 'The version an intelligent adversary would write' },

  // ── Section 9: the three pictures ──
  'sec9-ten':   { s: 'sec-9', after: "Write the ten-year picture. Then the three-year. Then this year" },
  'sec9-three': { s: 'sec-9', after: "Write the ten-year picture. Then the three-year. Then this year", order: 2 },
  'sec9-year':  { s: 'sec-9', after: "Write the ten-year picture. Then the three-year. Then this year", order: 3 },

  // ── Law 15: each question sits under its own question block ──
  'law15-q1': { s: 'law-15', after: 'Purpose sits at the intersection of a real problem and an unfair advantage.' },
  'law15-q2': { s: 'law-15', after: 'This filters status-seeking out of the answer' },
  'law15-q3': { s: 'law-15', after: 'Regret is a better instrument than desire' },
  'law15-statement': { s: 'law-15', after: 'Become extraordinarily capable, and use that capability' },

  // ── Law 13: the inner and outer portfolios ──
  'law13-five': { s: 'law-13', after: 'who would arrive if something went badly wrong at 3am' },
  'law13-cold': { s: 'law-13', after: 'Opportunity arrives disproportionately from the middle distance' },

  // ── the remaining endOf placements ──
  'law1-three':        { s: 'law-1',  after: 'each morning, register several things of genuine value' },
  'law3-desires':      { s: 'law-3',  after: 'I want this. I do not have to have it.' },
  'law5-decathlon':    { s: 'law-5',  after: 'trained backwards from what you in' },
  'law6-change':       { s: 'law-6',  after: 'come the kind of person who ' },
  'law6-impint':       { s: 'law-6',  after: 'come the kind of person who ', order: 2 },
  'law9-beliefs':      { s: 'law-9',  after: 'be able to state it bette' },
  'law10-premortem':   { s: 'law-10', after: 'assume it is eighteen months later and the thing has failed badly' },
  'law11-withholding': { s: 'law-11', after: 'perfectionism is excellence' },
  'law12-term':        { s: 'law-12', after: 'A checklist of the four terms you can actually move' },
  'sec11-wedge':       { s: 'sec-11', after: 'Nobody selling personal branding will tell you this' },
  'luck-ledger':       { s: 'sec-luck', after: 'prosperity ledger' },
  'luck-audit':        { s: 'sec-luck', after: 'prosperity ledger', order: 2 }
};

const BLOCK = 'p|div|h1|h2|h3|h4|h5|h6|ul|ol|table|blockquote|section|figure';

/* Find the element containing `needle` and return the index just past its
   closing tag, respecting nesting of the same tag name. */
function endOfElementContaining(html, needle, wantTag) {
  const at = html.indexOf(needle);
  if (at < 0) return -1;

  // walk backwards to the opening tag of the enclosing block element
  const before = html.slice(0, at);
  const opens = [...before.matchAll(new RegExp('<(' + BLOCK + ')\\b[^>]*>', 'gi'))];
  const closes = [...before.matchAll(new RegExp('</(' + BLOCK + ')>', 'gi'))];

  // the innermost still-open element before the needle
  const stack = [];
  const events = [];
  opens.forEach(m => events.push({ i: m.index, type: 'open', tag: m[1].toLowerCase(), len: m[0].length }));
  closes.forEach(m => events.push({ i: m.index, type: 'close', tag: m[1].toLowerCase() }));
  events.sort((a, b) => a.i - b.i);
  events.forEach(e => {
    if (e.type === 'open') stack.push(e);
    else { for (let k = stack.length - 1; k >= 0; k--) { if (stack[k].tag === e.tag) { stack.splice(k, 1); break; } } }
  });
  if (!stack.length) return -1;

  let open = stack[stack.length - 1];
  if (wantTag) {
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].tag === wantTag.toLowerCase()) { open = stack[k]; break; }
    }
  }

  // scan forward from the open tag for its matching close
  const tag = open.tag;
  const re = new RegExp('<(/?)' + tag + '\\b[^>]*>', 'gi');
  re.lastIndex = open.i + open.len;
  let depth = 1, m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

function anchorId(key, order) {
  return 'wf-' + key + (order && order > 1 ? '-' + order : '');
}

/* Inject anchors into HOS_DATA.html. Returns { html, map, missed }. */
function inject(D) {
  const map = {};
  const missed = [];
  // group by section so multiple insertions into one section stay ordered
  const bySection = {};
  Object.keys(ANCHORS).forEach(key => {
    const a = ANCHORS[key];
    (bySection[a.s] = bySection[a.s] || []).push({ key, ...a });
  });

  Object.keys(bySection).forEach(sec => {
    let html = D.html[sec];
    if (!html) { bySection[sec].forEach(x => missed.push(x.key + ' (no section)')); return; }

    // Insert from the end backwards so earlier offsets stay valid.
    const jobs = [];
    bySection[sec].forEach(spec => {
      let needle = spec.after;
      let idx = endOfElementContaining(html, needle, spec.tag);
      if (idx < 0 && spec.alt) idx = endOfElementContaining(html, spec.alt, spec.tag);
      if (idx < 0) { missed.push(spec.key + ' (no match: "' + String(needle).slice(0, 40) + '")'); return; }
      jobs.push({ idx, key: spec.key, order: spec.order || 1 });
    });

    // same insertion point: keep declared order by nudging offsets
    jobs.sort((a, b) => a.idx - b.idx || a.order - b.order);
    jobs.slice().reverse().forEach(j => {
      const id = anchorId(j.key, j.order);
      html = html.slice(0, j.idx) + '<div id="' + id + '" class="hos-anchor"></div>' + html.slice(j.idx);
      map[j.key] = id;
    });

    D.html[sec] = html;
  });

  return { map, missed };
}

module.exports = { ANCHORS, inject, anchorId };
