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

    /* ── the gift link becomes top-bar chrome on phones ────────────────
       The floating button overlapped the reading area on the first screen,
       duplicated the sidebar footer entry, and needed opacity tuning to stay
       out of the back pill's way. As a tool in the bar it is always visible,
       never overlaps, and needs no tuning at all.

       Built here but hidden above 600px by CSS, so nothing changes on tablet
       or desktop and there is no resize handling to get wrong. */
    var tools = document.querySelector('#hos-topbar .hos-tools');
    if (tools && !document.getElementById('hos-gift-top')) {
      var url = null;
      var sideLink = document.querySelector('#hos-support-side a.is-primary') ||
                     document.querySelector('.hos-support-link');
      if (sideLink) url = sideLink.getAttribute('href');
      if (url) {
        var gift = document.createElement('a');
        gift.id = 'hos-gift-top';
        gift.className = 'hos-tool';           // one tool among several
        gift.href = url;
        gift.target = '_blank';
        gift.rel = 'noopener noreferrer';
        gift.title = 'Leave a gift';
        gift.setAttribute('aria-label', 'Leave a gift');
        gift.textContent = '♦';           // the glyph the sidebar already uses
        // sits after the theme toggle, away from the menu and the jump tools
        var theme = document.getElementById('hos-theme');
        if (theme && theme.parentNode === tools) tools.insertBefore(gift, theme.nextSibling);
        else tools.appendChild(gift);

        /* same fallback as the floating button: a blocked popup leaves a
           copyable link rather than a dead control */
        gift.addEventListener('click', function (e) {
          var w = null;
          try { w = window.open(gift.href, '_blank', 'noopener,noreferrer'); } catch (err) {}
          if (!w) {
            e.preventDefault();
            try {
              navigator.clipboard.writeText(gift.href);
              if (HOS.toast) HOS.toast('Opening was blocked — link copied');
            } catch (err2) {
              if (HOS.toast) HOS.toast('Opening was blocked — the link is in the sidebar');
            }
          }
        });
      }
    }

    /* ── phones: move the tools the bar cannot hold into the sidebar ────
       At 375px the bar was already overflowing before the gift arrived —
       Search, Jump, theme and help were rendering past the right edge. A
       cramped bar is worse than a slightly longer menu, so the overlay tools
       move into the contents drawer and keep their existing wiring by
       clicking the original buttons. */
    var tree = document.getElementById('hos-tree');
    if (tree && !document.getElementById('hos-phone-tools')) {
      var MOVED = [
        ['hos-map-btn', '▦', 'The Architecture map'],
        ['hos-rules-btn', '§', 'All seventeen Rules'],
        ['hos-review-btn', '↻', 'Review cards'],
        ['hos-help-btn', '?', 'Keyboard shortcuts']
      ];
      var box = document.createElement('div');
      box.id = 'hos-phone-tools';
      MOVED.forEach(function (m) {
        var src = document.getElementById(m[0]);
        if (!src) return;
        var row = document.createElement('button');
        row.className = 'hos-side-item';
        row.innerHTML = '<span class="hos-side-glyph">' + m[1] + '</span><span>' + m[2] + '</span>';
        row.addEventListener('click', function () {
          closeDrawer();
          setTimeout(function () { src.click(); }, 60);
        });
        box.appendChild(row);
      });
      if (box.children.length) tree.parentNode.insertBefore(box, tree);
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
