/* MAXIMALLY HUMAN — touch and small-screen behaviour.
   Layout lives in CSS; this covers only what CSS cannot express: opening
   popovers on tap rather than hover, dismissing them without a hover state,
   keeping the drawer honest, and keeping the keyboard off the field being
   typed into. */
(function () {
  'use strict';

  function isTouch() {
    return window.matchMedia('(hover: none)').matches ||
           ('ontouchstart' in window) ||
           navigator.maxTouchPoints > 0;
  }
  function isPhone() { return window.matchMedia('(max-width: 600px)').matches; }

  var TRIGGERS = 'a.xref, [data-ref].hos-chip, .hos-clickable-row[data-ref]';

  function init(HOS) {
    var pop = document.getElementById('hos-pop');
    var scrim = null;

    /* ── popover: tap to open, tap outside to close ───────────────────── */
    function addScrim() {
      if (scrim || !isPhone()) return;
      scrim = document.createElement('div');
      scrim.id = 'hos-pop-scrim';
      scrim.addEventListener('click', closePop);
      document.body.appendChild(scrim);
    }
    function dropScrim() {
      if (!scrim) return;
      scrim.remove(); scrim = null;
    }
    function closePop() {
      pop.hidden = true;
      pop.__for = null;
      dropScrim();
    }

    if (isTouch()) {
      /* The engine opens the popover from mouseover, plus a touchstart bound
         to a.xref only — so on a phone the chips and clickable rows never
         opened at all, and dismissal depended on :hover, which a finger cannot
         produce. Drive the engine's own delegated mouseover handler from the
         click (which every tap produces, on every trigger), then give the
         sheet a scrim to tap away. */
      document.addEventListener('click', function (e) {
        var t = e.target.closest(TRIGGERS);
        if (t) {
          if (pop.hidden || pop.__for !== t) {
            e.preventDefault();
            t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
            pop.__for = t;
          }
          // the engine debounces its render by 90ms
          setTimeout(function () { if (!pop.hidden) addScrim(); }, 140);
          return;
        }
        if (pop.hidden) return;
        if (e.target.closest('#hos-pop')) return;
        closePop();
      }, true);

      // a jump from inside the popover closes it
      pop.addEventListener('click', function (e) {
        if (e.target.closest('[data-jump]')) closePop();
      });

      // the engine's mouseleave dismissal is meaningless on touch
      pop.addEventListener('mouseleave', function (e) { e.stopPropagation(); }, true);
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !pop.hidden) closePop();
    });

    /* ── drawer: close on Escape, on browser back, after navigation ───── */
    var body = document.body;
    function drawerOpen() { return body.classList.contains('drawer-open'); }
    function closeDrawer() {
      if (!drawerOpen()) return;
      body.classList.remove('drawer-open');
      var menu = document.getElementById('hos-menu');
      if (menu) menu.setAttribute('aria-expanded', 'false');
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    // any navigation inside the tree closes it
    var tree = document.getElementById('hos-tree');
    if (tree) tree.addEventListener('click', function (e) {
      if (e.target.closest('[data-row], [data-jump], a')) setTimeout(closeDrawer, 60);
    });

    // browser back closes the drawer instead of leaving the page
    var menuBtn = document.getElementById('hos-menu');
    if (menuBtn) {
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.addEventListener('click', function () {
        var open = drawerOpen();
        menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          try { history.pushState({ hosDrawer: 1 }, ''); } catch (e) {}
        }
      });
    }
    window.addEventListener('popstate', function () {
      if (drawerOpen()) closeDrawer();
    });

    /* focus stays inside the open drawer */
    document.addEventListener('focusin', function (e) {
      if (!drawerOpen() || !isPhone()) return;
      var side = document.getElementById('hos-sidebar');
      var top = document.getElementById('hos-topbar');
      if (!side) return;
      if (side.contains(e.target) || (top && top.contains(e.target))) return;
      var first = side.querySelector('input, button, [href], [tabindex]:not([tabindex="-1"])');
      if (first) first.focus();
    });

    /* ── keyboard must not cover the field being typed into ──────────── */
    document.addEventListener('focusin', function (e) {
      var el = e.target;
      if (!el.matches || !el.matches('textarea, input[type="text"], input[type="search"], input:not([type])')) return;
      if (!isTouch()) return;
      setTimeout(function () {
        try {
          var r = el.getBoundingClientRect();
          var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
          if (r.bottom > vh - 20 || r.top < 60) {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }
        } catch (err) {}
      }, 320);
    });

    // the visual viewport shrinking means the keyboard just appeared
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', function () {
        var el = document.activeElement;
        if (!el || !el.matches || !el.matches('textarea, input')) return;
        try {
          var r = el.getBoundingClientRect();
          if (r.bottom > window.visualViewport.height - 12) {
            el.scrollIntoView({ block: 'center' });
          }
        } catch (e) {}
      });
    }

    /* ── back pill and support button must not share a corner ────────── */
    var backEl = document.getElementById('hos-back');
    if (backEl) {
      var sync = function () { body.classList.toggle('has-back', !backEl.hidden); };
      sync();
      new MutationObserver(sync).observe(backEl, { attributes: true, attributeFilter: ['hidden'] });
    }
  }

  window.HOS_MOBILE = function (HOS) {
    try { init(HOS); } catch (e) { console.warn('[HOS] mobile layer failed', e); }
  };
})();
