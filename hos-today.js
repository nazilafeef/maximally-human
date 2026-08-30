/* MAXIMALLY HUMAN — the Today view.

   One screen answering "what am I doing today?", assembled entirely from
   state the reader has already set elsewhere. It stores nothing of its own
   except which laws they are working on and the reminder preference: the
   audit and the ledger write into the same practice logs the document's own
   instruments use, so there is one source of truth and an entry made here
   shows up there.

   Deliberately not built: streaks, points, badges, levels, celebrations,
   scores or nagging. The document argues against motivational scaffolding,
   and an app that contradicted its own text would be worse than no app. */
(function () {
  'use strict';

  var HOS, P, esc;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s + 'T00:00:00');
    if (isNaN(d)) return s;
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }
  function daysBetween(a, b) {
    return Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }
  function get(k, d) { try { return P.get(k, d); } catch (e) { return d; } }
  function set(k, v) { try { P.set(k, v); } catch (e) {} }

  var PHASES = [
    { key: 'calm', name: 'Calm', from: 1, to: 14 },
    { key: 'vision', name: 'Vision', from: 15, to: 35 },
    { key: 'action', name: 'Action', from: 36, to: 63 },
    { key: 'integration', name: 'Integration', from: 64, to: 90 }
  ];

  /* ─────────── the pieces, each returning null when unset ─────────── */

  function modeCard() {
    var answers = get('law0-mode', null);
    if (!answers || !Object.keys(answers).length) return null;
    var keys = Object.keys(answers);
    var yes = keys.filter(function (k) { return answers[k] === 'y'; }).length;
    var band = yes <= 2 ? { name: 'Mode A · Early stage', target: 'law0-stage-0' }
             : yes <= 4 ? { name: 'Mode A · Late stage', target: 'law0-stage-4' }
             : { name: 'Mode B', target: 'law0-part-8' };

    var stages = get('law0-stages', {}) || {};
    var done = Object.keys(stages).filter(function (k) { return stages[k]; }).length;

    return card('Your position', band.name,
      (keys.length < 6 ? keys.length + ' of 6 answered. ' : '') +
      (done ? done + ' stage' + (done === 1 ? '' : 's') + ' complete.' : 'No stages marked complete yet.'),
      band.target, 'Go to your stage');
  }

  function ninetyCard() {
    var d = get('ninety', null);
    if (!d || !d.start) return null;
    var day = daysBetween(d.start, today()) + 1;
    if (day < 1) return card('Ninety days', 'Starts ' + fmtDate(d.start), '', 'sec-13', 'The ninety days');
    if (day > 90) return card('Ninety days', 'Day ' + day, 'Past ninety. Worth setting a new start date, or letting it go.', 'sec-13', 'The ninety days');
    var ph = PHASES.find(function (p) { return day >= p.from && day <= p.to; }) || PHASES[3];
    return card('Ninety days', 'Day ' + day + ' · ' + ph.name,
      'Days ' + ph.from + '–' + ph.to + ' of the ninety.', 'sec-13', 'The ninety days');
  }

  function workingCard() {
    var working = get('working-laws', []) || [];
    var LAWS = (HOS.LAWS) || {};
    if (!working.length) {
      return '<div class="hos-today-card"><div class="hos-today-k">Working on</div>' +
        '<p class="hos-today-empty">No laws marked yet. Open the Rules sheet and mark one to three you are actually working on.</p>' +
        '<button class="hos-today-go" data-today-rules="1">Choose from the Rules →</button></div>';
    }
    var rows = working.slice(0, 3).map(function (n) {
      var L = LAWS[n] || {};
      return '<button class="hos-today-row" data-jump="law-' + n + '">' +
        '<span class="hos-today-n">' + n + '</span>' +
        '<span><b>' + esc(L.name || ('Law ' + n)) + '</b>' +
        (L.thesis ? '<em>' + esc(L.thesis) + '</em>' : '') + '</span></button>';
    }).join('');
    return '<div class="hos-today-card"><div class="hos-today-k">Working on</div>' + rows +
      '<button class="hos-today-go" data-today-rules="1">Change these →</button></div>';
  }

  function ruleOfDay() {
    var LAWS = HOS.LAWS || {};
    var nums = Object.keys(LAWS);
    if (!nums.length) return null;
    var marks = get('rule-state', {}) || {};
    var shaky = nums.filter(function (n) { return marks[n] === 'shaky'; });
    var pool = shaky.length ? shaky : nums;
    // rotate by day number so it is stable within a day and moves each day
    var seed = Math.floor(new Date(today() + 'T00:00:00') / 86400000);
    var n = pool[seed % pool.length];
    var L = LAWS[n] || {};
    return '<div class="hos-today-card"><div class="hos-today-k">One rule' +
      (shaky.length ? ' · from the ones you marked shaky' : '') + '</div>' +
      '<p class="hos-today-rule">' + esc(L.rule || L.thesis || '') + '</p>' +
      '<button class="hos-today-go" data-jump="law-' + n + '">' +
      esc(L.name || ('Law ' + n)) + ' →</button></div>';
  }

  function woopCard() {
    var all = get('woop', []) || [];
    var open = all.filter(function (e) { return !e.done; })[0];
    if (!open) return null;
    return '<div class="hos-today-card"><div class="hos-today-k">Your open WOOP</div>' +
      (open.wish ? '<p class="hos-today-line"><span>Wish</span>' + esc(open.wish) + '</p>' : '') +
      (open.obstacle ? '<p class="hos-today-line"><span>Obstacle</span>' + esc(open.obstacle) + '</p>' : '') +
      (open.plan ? '<p class="hos-today-plan">' + esc(open.plan) + '</p>' : '') +
      '<button class="hos-today-go" data-jump="law-6">Where this is explained →</button></div>';
  }

  function decisionsDue() {
    var all = get('decisions', []) || [];
    var t = today();
    var due = all.filter(function (e) { return e.review && e.review <= t && !e.scored; });
    if (!due.length) return null;
    return '<div class="hos-today-card"><div class="hos-today-k">Past their review date</div>' +
      due.slice(0, 4).map(function (e) {
        return '<p class="hos-today-line"><span>' + esc(e.review) + '</span>' +
               esc(e.decision || 'Untitled decision') + '</p>';
      }).join('') +
      '<button class="hos-today-go" data-jump="law-10">Score them →</button></div>';
  }

  /* ─────────── inline fillable: nightly audit + prosperity ledger ─────── */

  function auditQuestions() {
    // the document defines these; fall back to the published eight
    var sec = document.getElementById('law-16');
    var qs = [];
    if (sec) {
      var block = Array.prototype.slice.call(sec.querySelectorAll('div')).find(function (d) {
        return d.children.length >= 6 && /audit/i.test(d.textContent) === false &&
               d.children.length <= 10 && d.children[0] && d.children[0].children.length === 2;
      });
      if (block) qs = Array.prototype.slice.call(block.children).map(function (row) {
        var k = row.children;
        return k[1] ? k[1].textContent.replace(/\s+/g, ' ').trim() : '';
      }).filter(Boolean);
    }
    if (qs.length < 4) qs = [
      'What did I do well today?',
      'What did I do badly?',
      'What did I avoid?',
      'What did I learn?',
      'Who did I help?',
      'What am I grateful for?',
      'What is tomorrow’s single priority?',
      'What am I not facing?'
    ];
    return qs.slice(0, 8);
  }

  var LEDGER_LINES = [
    'Three things I am grateful for',
    'One opportunity I noticed today',
    'One action I took',
    'One thing I learned',
    'One shot I will take tomorrow'
  ];

  function fillable(key, title, labels, jumpTo, saveLabel) {
    var all = get(key, []) || [];
    var doneToday = all.some(function (e) { return e.date === today(); });
    return '<div class="hos-today-card" data-fill="' + key + '">' +
      '<div class="hos-today-k">' + esc(title) +
        (doneToday ? '<span class="hos-today-done">written today</span>' : '') + '</div>' +
      labels.map(function (l, i) {
        return '<label class="hos-today-field"><span>' + esc(l) + '</span>' +
          '<textarea rows="1" data-f="' + (key === 'ledger' ? 'l' : 'q') + i + '" ' +
          'aria-label="' + esc(l) + '"></textarea></label>';
      }).join('') +
      '<div class="hos-today-actions">' +
        '<button class="hos-today-save" data-save-fill="' + key + '">' + esc(saveLabel) + '</button>' +
        '<span class="hos-today-saved" data-saved-fill="' + key + '" role="status"></span>' +
      '</div>' +
      '<button class="hos-today-go" data-jump="' + jumpTo + '">Where this is explained →</button>' +
      '</div>';
  }

  /* ─────────── weekly / quarterly, offered once and never nagged ─────── */

  function boundaryLine() {
    var t = today();
    var now = new Date(t + 'T00:00:00');
    var seen = get('review-offers', {}) || {};

    // ISO week and quarter identifiers
    var d = new Date(now); d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    var week = d.getFullYear() + '-W' + Math.ceil((((d - new Date(d.getFullYear(), 0, 1)) / 86400000) + 1) / 7);
    var quarter = now.getFullYear() + '-Q' + (Math.floor(now.getMonth() / 3) + 1);

    var weekly = get('law16-weekly-log', null);
    var out = [];
    if (seen.week !== week) {
      out.push('<div class="hos-today-offer" data-offer="week" data-id="' + week + '">' +
        '<span>A week has turned. The weekly review is three questions.</span>' +
        '<button data-jump="law-16">Open it</button>' +
        '<button data-dismiss-offer="week" data-id="' + week + '" aria-label="Dismiss">Not now</button></div>');
    }
    if (seen.quarter !== quarter) {
      out.push('<div class="hos-today-offer" data-offer="quarter" data-id="' + quarter + '">' +
        '<span>A quarter has turned. The quarterly review is worth the two hours.</span>' +
        '<button data-jump="law-16">Open it</button>' +
        '<button data-dismiss-offer="quarter" data-id="' + quarter + '" aria-label="Dismiss">Not now</button></div>');
    }
    return out.join('');
  }

  /* ─────────── reminder toggle ─────────── */

  function reminderCard() {
    var r = get('reminder', { on: false, time: '21:30' }) || { on: false, time: '21:30' };
    var supported = ('Notification' in window);
    if (!supported) return '';
    return '<div class="hos-today-card hos-today-reminder">' +
      '<div class="hos-today-k">A daily reminder</div>' +
      '<label class="hos-today-toggle">' +
        '<input type="checkbox" id="hos-remind-on"' + (r.on ? ' checked' : '') + '>' +
        '<span>Remind me once a day that the review is waiting</span></label>' +
      '<label class="hos-today-time"><span>At</span>' +
        '<input type="time" id="hos-remind-at" value="' + esc(r.time) + '"></label>' +
      '<p class="hos-today-note">One notification, from this browser only, on the days you have this page open. ' +
      'No streak, no count, no second reminder. Off unless you turn it on.</p></div>';
  }

  /* ─────────── assembly ─────────── */

  function card(kicker, title, note, target, cta) {
    return '<div class="hos-today-card">' +
      '<div class="hos-today-k">' + esc(kicker) + '</div>' +
      '<div class="hos-today-title">' + esc(title) + '</div>' +
      (note ? '<p class="hos-today-note">' + esc(note) + '</p>' : '') +
      (target ? '<button class="hos-today-go" data-jump="' + target + '">' + esc(cta) + ' →</button>' : '') +
      '</div>';
  }

  function render() {
    var pieces = [modeCard(), ninetyCard()].filter(Boolean);
    var anySetup = pieces.length > 0;

    var head = '<div class="hos-today-head">' +
      '<div class="hos-today-date">' + fmtDate(today()) + '</div></div>';

    if (!anySetup) {
      return head +
        '<div class="hos-today-start">' +
          '<p>Nothing is set up yet.</p>' +
          '<p class="hos-today-note">Today assembles itself from what you have already answered. ' +
          'Start with the mode diagnostic in Law 0 — six questions, and it decides which half of the ' +
          'book applies to you right now.</p>' +
          '<button class="hos-today-go" data-jump="law-0">The mode diagnostic →</button>' +
        '</div>' +
        boundaryLine() +
        fillable('audit', 'Tonight’s audit', auditQuestions(), 'law-16', 'Save tonight’s audit') +
        fillable('ledger', 'The prosperity ledger', LEDGER_LINES, 'sec-luck', 'Save tonight’s ledger') +
        reminderCard();
    }

    return head +
      boundaryLine() +
      pieces.join('') +
      workingCard() +
      (woopCard() || '') +
      (decisionsDue() || '') +
      fillable('audit', 'Tonight’s audit', auditQuestions(), 'law-16', 'Save tonight’s audit') +
      fillable('ledger', 'The prosperity ledger', LEDGER_LINES, 'sec-luck', 'Save tonight’s ledger') +
      (ruleOfDay() || '') +
      reminderCard();
  }

  function open() {
    HOS.openOverlay('today', 'Today', '<div id="hos-today">' + render() + '</div>');
    wire();
  }

  function wire() {
    var root = document.getElementById('hos-today');
    if (!root) return;

    root.addEventListener('click', function (e) {
      var j = e.target.closest('[data-jump]');
      if (j) { HOS.closeOverlay(); HOS.jumpTo(j.getAttribute('data-jump')); return; }

      var rules = e.target.closest('[data-today-rules]');
      if (rules) { HOS.closeOverlay(); var b = document.getElementById('hos-rules-btn'); if (b) b.click(); return; }

      var dis = e.target.closest('[data-dismiss-offer]');
      if (dis) {
        var seen = get('review-offers', {}) || {};
        seen[dis.getAttribute('data-dismiss-offer')] = dis.getAttribute('data-id');
        set('review-offers', seen);
        var row = dis.closest('.hos-today-offer');
        if (row) row.remove();
        return;
      }

      var save = e.target.closest('[data-save-fill]');
      if (save) {
        var key = save.getAttribute('data-save-fill');
        var cardEl = root.querySelector('[data-fill="' + key + '"]');
        var entry = { date: today(), id: 'today-' + Date.now().toString(36) };
        var any = false;
        cardEl.querySelectorAll('textarea[data-f]').forEach(function (t) {
          if (t.value.trim()) { entry[t.getAttribute('data-f')] = t.value.trim(); any = true; }
        });
        if (!any) { flashSaved(key, 'Nothing written yet.'); return; }
        var all = get(key, []) || [];
        all.unshift(entry);
        set(key, all);
        if (HOS.flushAll) HOS.flushAll();
        cardEl.querySelectorAll('textarea[data-f]').forEach(function (t) { t.value = ''; });
        flashSaved(key, key === 'audit' ? 'Written. Close it and sleep.' : 'Saved.');
        return;
      }
    });

    // grow the textareas as they fill
    root.addEventListener('input', function (e) {
      if (e.target.tagName === 'TEXTAREA') {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 220) + 'px';
      }
    });

    // reminder
    var onBox = document.getElementById('hos-remind-on');
    var atBox = document.getElementById('hos-remind-at');
    if (onBox) {
      onBox.addEventListener('change', function () {
        if (!onBox.checked) {
          set('reminder', { on: false, time: atBox.value });
          cancelReminder();
          return;
        }
        Notification.requestPermission().then(function (p) {
          if (p !== 'granted') {
            onBox.checked = false;
            set('reminder', { on: false, time: atBox.value });
            if (HOS.toast) HOS.toast('Notifications are blocked for this site.');
            return;
          }
          set('reminder', { on: true, time: atBox.value });
          scheduleReminder();
          if (HOS.toast) HOS.toast('Reminder set for ' + atBox.value);
        });
      });
    }
    if (atBox) atBox.addEventListener('change', function () {
      var r = get('reminder', { on: false, time: '21:30' }) || {};
      set('reminder', { on: !!r.on, time: atBox.value });
      if (r.on) scheduleReminder();
    });
  }

  function flashSaved(key, msg) {
    var el = document.querySelector('[data-saved-fill="' + key + '"]');
    if (!el) return;
    el.textContent = msg;
    setTimeout(function () { if (el) el.textContent = ''; }, 3200);
  }

  /* ─────────── the reminder itself ───────────
     One local notification, scheduled only while the page is open. No push
     service, no server, nothing that could fire when they are not here. */
  var reminderTimer = null;
  function cancelReminder() { clearTimeout(reminderTimer); reminderTimer = null; }

  function scheduleReminder() {
    cancelReminder();
    var r = get('reminder', null);
    if (!r || !r.on || !('Notification' in window) || Notification.permission !== 'granted') return;
    var parts = (r.time || '21:30').split(':');
    var when = new Date();
    when.setHours(+parts[0] || 21, +parts[1] || 30, 0, 0);
    if (when <= new Date()) return; // already past today; it will be set again tomorrow
    var fired = get('reminder-last', '');
    if (fired === today()) return;
    var ms = when - new Date();
    if (ms > 2147483647) return;
    reminderTimer = setTimeout(function () {
      try {
        new Notification('Maximally Human', {
          body: 'Your review is waiting.',
          tag: 'hos-daily',
          silent: false
        });
        set('reminder-last', today());
      } catch (e) {}
    }, ms);
  }

  /* ─────────── sidebar entry, above the document ─────────── */
  function mountSidebar() {
    var tree = document.getElementById('hos-tree');
    if (!tree || document.getElementById('hos-today-open')) return;
    var b = document.createElement('button');
    b.id = 'hos-today-open';
    b.className = 'hos-side-item hos-today-entry';
    b.innerHTML = '<span class="hos-side-glyph">◆</span><span>Today</span>';
    b.addEventListener('click', open);
    tree.parentNode.insertBefore(b, tree);
  }

  window.HOS_TODAY = function (hos) {
    HOS = hos;
    P = hos.practice;
    esc = function (s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    };
    try {
      mountSidebar();
      scheduleReminder();
      if (location.hash === '#today') setTimeout(open, 300);
    } catch (e) { console.warn('[HOS] today view failed', e); }
  };
  window.HOS_OPEN_TODAY = function () { if (HOS) open(); };
})();
