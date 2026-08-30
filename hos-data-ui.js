/* MAXIMALLY HUMAN — data safety and privacy UI.
   Download / restore sit beside Reset in the sidebar footer, because that is
   where a reader already goes to think about their saved work. */
(function () {
  'use strict';

  var PRIVACY_HTML =
    '<h2 style="font-family:\'Spectral\',Georgia,serif;font-weight:400;font-size:28px;margin:0 0 6px">Privacy</h2>' +
    '<p style="font-family:\'IBM Plex Mono\',monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--faint);margin:0 0 18px">What this site does with what you write</p>' +
    '<div style="font-family:\'Spectral\',Georgia,serif;font-size:16px;line-height:1.6;color:var(--ink)">' +
    '<p style="margin:0 0 0.9em">There is no account, because there is nothing to log in to. There is no tracking, no analytics, and no cookies set by this site.</p>' +
    '<p style="margin:0 0 0.9em">Everything you type — the workbook, the audits, the ledger, the diagnostic, the stage tracker, every field in the document — is stored in your own browser and never transmitted anywhere. It is not sent to a server, because there is no server holding it. No one else can read it, including me.</p>' +
    '<p style="margin:0 0 0.9em">That is a real guarantee and also a real risk: clearing your browser data will erase it. Download a copy when you have written something you would not want to lose.</p>' +
    '<p style="margin:0 0 0.9em">The only outbound links are PayPal and Gumroad, for readers who choose to pay. Following one takes you to their site, under their policies, not this one. Nothing about you is passed along with you.</p>' +
    '<p style="margin:0 0 0.9em">Fonts load from Google Fonts, which sees the request as any font request would. If that matters to you, the document reads correctly without them.</p>' +
    '<p style="margin:0">If I ever add analytics, this page will say so before it happens.</p>' +
    '</div>';

  function mount(HOS) {
    var foot = document.querySelector('.hos-side-foot');
    if (!foot || document.getElementById('hos-data-tools')) return;

    var wrap = document.createElement('div');
    wrap.id = 'hos-data-tools';
    wrap.innerHTML =
      '<div class="hos-foot-title">Your data</div>' +
      '<button class="hos-side-item" id="hos-export">' +
        '<span class="hos-side-glyph">↓</span><span>Download my data</span></button>' +
      '<button class="hos-side-item" id="hos-import">' +
        '<span class="hos-side-glyph">↑</span><span>Restore from file</span></button>' +
      '<a class="hos-side-item" id="hos-privacy" href="#privacy">' +
        '<span class="hos-side-glyph">·</span><span>Privacy</span></a>' +
      '<p class="hos-data-note">Entries are stored in this browser only. They are never uploaded ' +
        'anywhere, and clearing your browser data will erase them.</p>' +
      '<input type="file" id="hos-import-file" accept="application/json,.json" hidden>';

    // Sit above Reset if it is there, otherwise at the end.
    var reset = foot.querySelector('.hos-reset-wrap') ||
                document.querySelector('.hos-reset-wrap');
    if (reset && reset.parentNode === foot) foot.insertBefore(wrap, reset);
    else foot.appendChild(wrap);

    var S = window.HOS_STORAGE;

    document.getElementById('hos-export').onclick = function () {
      S.exportData().catch(function (e) {
        HOS.toast ? HOS.toast('Could not download: ' + e.message) : alert(e.message);
      });
    };

    var fileInput = document.getElementById('hos-import-file');
    document.getElementById('hos-import').onclick = function () { fileInput.click(); };

    fileInput.onchange = function () {
      var f = fileInput.files && fileInput.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        var payload;
        try { payload = JSON.parse(rd.result); }
        catch (e) { return say('That file is not valid JSON.'); }

        var slots = payload && payload.data ? Object.keys(payload.data) : [];
        var count = slots.reduce(function (n, k) {
          return n + Object.keys(payload.data[k] || {}).length;
        }, 0);
        var when = payload && payload.exported
          ? new Date(payload.exported).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
          : 'an unknown date';

        var okToGo = window.confirm(
          'Restore from this backup?\n\n' +
          'Exported ' + when + ' · ' + count + ' saved item' + (count === 1 ? '' : 's') + '.\n\n' +
          'This merges into what is already here. Nothing currently saved will be ' +
          'deleted; where the same entry exists on both sides, what is already in ' +
          'this browser is kept.'
        );
        if (!okToGo) { fileInput.value = ''; return; }

        try {
          var r = window.HOS_STORAGE.importData(payload);
          say('Restored — ' + r.added + ' added, ' + r.kept + ' already here. Reloading.');
          if (window.HOS && window.HOS.flushAll) window.HOS.flushAll();
          setTimeout(function () { location.reload(); }, 900);
        } catch (e) { say(e.message); }
        fileInput.value = '';
      };
      rd.readAsText(f);
    };

    function say(m) { HOS.toast ? HOS.toast(m) : alert(m); }

    /* privacy opens in the overlay the reader already knows */
    document.getElementById('hos-privacy').onclick = function (e) {
      e.preventDefault();
      HOS.openOverlay('Privacy', PRIVACY_HTML);
    };

    /* and from the end of the document */
    var support = document.querySelector('.hos-support-side');
    if (support && !document.getElementById('hos-privacy-inline')) {
      var a = document.createElement('a');
      a.id = 'hos-privacy-inline';
      a.className = 'hos-side-item';
      a.href = '#privacy';
      a.innerHTML = '<span class="hos-side-glyph">·</span><span>Privacy</span>';
      a.onclick = function (e) { e.preventDefault(); HOS.openOverlay('Privacy', PRIVACY_HTML); };
    }
  }

  window.HOS_DATA_UI = function (HOS) {
    try { mount(HOS); } catch (e) { console.warn('[HOS] data UI failed', e); }
  };
  window.HOS_PRIVACY_HTML = PRIVACY_HTML;
})();
