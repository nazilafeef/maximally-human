/* Maximally Human — offline support.

   The whole reader is one HTML file, so caching is nearly trivial: cache the
   page and its handful of assets, serve the cached page when the network is
   gone, and refresh the cache in the background when it is not.

   Deliberately never prompts to install. No beforeinstallprompt handling
   anywhere — add-to-home-screen stays something a reader finds if they want
   it, never something they are asked. */

var VERSION = 'mh-v3';
var CORE = [
  '/',
  '/index.html',
  '/cover.png',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return c.addAll(CORE.map(function (u) { return new Request(u, { cache: 'reload' }); })); })
      .catch(function () {})
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== VERSION; })
                              .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // Google Fonts: cache-first, since they never change under a given URL.
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
          return res;
        }).catch(function () { return hit; });
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  /* Navigations: network first so a redeploy is picked up promptly, falling
     back to the cached page the moment the network is unavailable. */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put('/index.html', copy); }).catch(function () {});
          return res;
        })
        .catch(function () {
          return caches.match('/index.html').then(function (hit) {
            return hit || caches.match('/');
          });
        })
    );
    return;
  }

  // Everything else same-origin: cache first, refresh behind the reader.
  e.respondWith(
    caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
