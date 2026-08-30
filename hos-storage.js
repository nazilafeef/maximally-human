/* MAXIMALLY HUMAN — storage transport for the open web.

   The engine calls window.storage.get/set/delete and keeps its own three-slot
   cache, debounce, flush-on-blur and flush-on-pagehide. None of that changes.
   Only the transport underneath it does:

     1. window.storage, if a host already provides one (so the same file still
        works unchanged inside a Claude artifact)
     2. IndexedDB — one database, one object store. Chosen over localStorage
        because the workbook grows without bound as daily audits and ledger
        entries accumulate, and localStorage caps near 5MB.
     3. localStorage — only where IndexedDB is unavailable, e.g. some private
        browsing modes.
     4. memory — last resort, with a visible warning, because silent loss is
        the failure this whole layer exists to prevent.

   Quota exhaustion is caught explicitly and surfaced. The engine wraps every
   storage call in try/catch, so without this a full disk would drop writes
   with no sign to the reader at all. */
(function () {
  'use strict';

  var DB_NAME = 'maximally-human';
  var STORE = 'kv';
  var LS_PREFIX = 'mh:';
  var VERSION = 1;

  var mem = {};
  var backend = 'memory';
  var db = null;
  var warned = { quota: false, memory: false };

  /* ─────────────── IndexedDB ─────────────── */
  function openDB() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no indexedDB'));
      var req;
      try { req = indexedDB.open(DB_NAME, VERSION); }
      catch (e) { return reject(e); }
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('indexedDB open failed')); };
      req.onblocked = function () { reject(new Error('indexedDB blocked')); };
      // Some private modes hang rather than error.
      setTimeout(function () { reject(new Error('indexedDB timeout')); }, 3000);
    });
  }

  function idbReq(mode, fn) {
    return new Promise(function (resolve, reject) {
      var tx;
      try { tx = db.transaction(STORE, mode); }
      catch (e) { return reject(e); }
      var store = tx.objectStore(STORE);
      var r = fn(store);
      tx.oncomplete = function () { resolve(r && r.result); };
      tx.onerror = tx.onabort = function () { reject(tx.error || (r && r.error) || new Error('tx failed')); };
    });
  }

  /* ─────────────── quota + warnings ─────────────── */
  function isQuota(err) {
    if (!err) return false;
    var n = err.name || '';
    return n === 'QuotaExceededError' ||
           n === 'NS_ERROR_DOM_QUOTA_REACHED' ||
           err.code === 22 || err.code === 1014 ||
           /quota/i.test(err.message || '');
  }

  function footHost() {
    return document.querySelector('.hos-side-foot') ||
           document.getElementById('hos-sidebar');
  }

  function showWarning(id, title, body, withExport) {
    var host = footHost();
    if (!host) return;
    var el = document.getElementById(id);
    if (!el) {
      el = document.createElement('div');
      el.id = id;
      el.className = 'hos-storage-warn';
      el.setAttribute('role', 'status');
      host.appendChild(el);
    }
    el.innerHTML = '<b>' + title + '</b>' + body;
    if (withExport) {
      var b = document.createElement('button');
      b.textContent = 'Download my data now';
      b.onclick = function () { API.exportData(); };
      el.appendChild(b);
    }
  }

  function quotaWarning() {
    if (warned.quota) return;
    warned.quota = true;
    showWarning('hos-warn-quota', 'Storage is full',
      'New entries are no longer being saved in this browser. ' +
      'Download your data, then clear some space or free storage for this site.', true);
  }

  function memoryWarning() {
    if (warned.memory) return;
    warned.memory = true;
    showWarning('hos-warn-memory', 'Entries are not being saved',
      'This browser is blocking storage, so anything you write will be lost when you close the tab. ' +
      'Download your data before leaving.', true);
  }

  /* ─────────────── usage meter ─────────────── */
  function updateMeter() {
    if (!navigator.storage || !navigator.storage.estimate) return;
    navigator.storage.estimate().then(function (est) {
      if (!est || !est.quota) return;
      var pct = (est.usage / est.quota) * 100;
      var host = footHost();
      if (!host) return;
      var el = document.getElementById('hos-storage-meter');
      if (pct < 60) { if (el) el.remove(); return; }
      if (!el) {
        el = document.createElement('div');
        el.id = 'hos-storage-meter';
        el.className = 'hos-storage-meter';
        host.appendChild(el);
      }
      el.textContent = 'Storage ' + pct.toFixed(0) + '% full · ' +
                       (est.usage / 1048576).toFixed(1) + ' MB of ' +
                       (est.quota / 1048576).toFixed(0) + ' MB';
      if (pct > 90) el.style.color = 'var(--ox)';
    }).catch(function () {});
  }

  /* ─────────────── the transport ───────────────
     Every operation waits on backend selection first. The engine hydrates
     from storage during its own boot, so a get() that raced the IndexedDB
     open would read an empty cache and silently discard saved work. */
  var host = (window.storage && typeof window.storage.get === 'function') ? window.storage : null;
  var readyP = null; // assigned at the bottom, before anything can call in

  function whenReady() { return readyP || Promise.resolve(); }

  function get(k) {
    return whenReady().then(function () { return get_(k); });
  }
  function set(k, v) {
    mem[k] = v;
    return whenReady().then(function () { return set_(k, v); });
  }
  function del(k) {
    delete mem[k];
    return whenReady().then(function () { return del_(k); });
  }

  function get_(k) {
    if (host) return Promise.resolve(host.get(k));
    if (backend === 'idb') {
      return idbReq('readonly', function (s) { return s.get(k); })
        .catch(function () { return mem[k]; });
    }
    if (backend === 'localStorage') {
      return Promise.resolve().then(function () {
        var v = localStorage.getItem(LS_PREFIX + k);
        if (v == null) return undefined;
        try { return JSON.parse(v); } catch (e) { return v; }
      });
    }
    return Promise.resolve(mem[k]);
  }

  function set_(k, v) {
    mem[k] = v; // the cache always succeeds, so the session keeps working
    if (host) return Promise.resolve(host.set(k, v));
    if (backend === 'idb') {
      return idbReq('readwrite', function (s) { return s.put(v, k); })
        .then(function (r) { updateMeter(); return r; })
        .catch(function (e) {
          if (isQuota(e)) quotaWarning();
          else fallbackFromIdb();
          throw e;
        });
    }
    if (backend === 'localStorage') {
      return Promise.resolve().then(function () {
        try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); }
        catch (e) { if (isQuota(e)) quotaWarning(); throw e; }
      });
    }
    memoryWarning();
    return Promise.resolve();
  }

  function del_(k) {
    delete mem[k];
    if (host) return Promise.resolve(host.delete(k));
    if (backend === 'idb') return idbReq('readwrite', function (s) { return s.delete(k); }).catch(function () {});
    if (backend === 'localStorage') {
      return Promise.resolve().then(function () { localStorage.removeItem(LS_PREFIX + k); });
    }
    return Promise.resolve();
  }

  function fallbackFromIdb() {
    // IndexedDB died mid-session; keep going on localStorage if we can.
    try {
      localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
      backend = 'localStorage';
    } catch (e) { backend = 'memory'; memoryWarning(); }
  }

  window.storage = { get: get, set: set, delete: del };

  /* ─────────────── export / import ─────────────── */
  var SLOTS = ['hos:reader', 'hos:practice', 'hos:workbook'];

  var API = {
    backend: function () { return host ? 'host' : backend; },

    collect: function () {
      return Promise.all(SLOTS.map(function (k) { return get(k); })).then(function (vals) {
        var data = {};
        SLOTS.forEach(function (k, i) {
          var v = vals[i];
          if (typeof v === 'string') { try { v = JSON.parse(v); } catch (e) {} }
          data[k] = v && typeof v === 'object' ? v : {};
        });
        return {
          format: 'maximally-human/backup',
          version: 1,
          exported: new Date().toISOString(),
          source: 'https://human.malebay.com/',
          data: data
        };
      });
    },

    exportData: function () {
      // Prefer live in-memory state: it is never staler than the store.
      var live = window.__hosState;
      var build = live
        ? Promise.resolve({
            format: 'maximally-human/backup', version: 1,
            exported: new Date().toISOString(),
            source: 'https://human.malebay.com/',
            data: {
              'hos:reader': live.reader || {},
              'hos:practice': live.practice || {},
              'hos:workbook': live.workbook || {}
            }
          })
        : API.collect();

      return build.then(function (payload) {
        var json = JSON.stringify(payload, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        var d = new Date();
        var stamp = d.getFullYear() + '-' +
                    String(d.getMonth() + 1).padStart(2, '0') + '-' +
                    String(d.getDate()).padStart(2, '0');
        a.href = url;
        a.download = 'maximally-human-' + stamp + '.json';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
        if (window.HOS && window.HOS.toast) window.HOS.toast('Data downloaded');
        return json.length;
      });
    },

    /* Merge rather than replace: an import must never silently destroy
       entries the reader made on this device since the backup was taken. */
    importData: function (payload) {
      if (!payload || payload.format !== 'maximally-human/backup' || !payload.data) {
        throw new Error('That file is not a Maximally Human backup.');
      }
      var live = window.__hosState;
      var added = 0, kept = 0;
      SLOTS.forEach(function (slot) {
        var incoming = payload.data[slot] || {};
        var current = (live && live[slot.split(':')[1]]) || {};
        Object.keys(incoming).forEach(function (k) {
          if (k in current) {
            var a = JSON.stringify(current[k]), b = JSON.stringify(incoming[k]);
            if (a === b) { kept++; return; }
            // Keep both sides where the value is a list of entries.
            if (Array.isArray(current[k]) && Array.isArray(incoming[k])) {
              var seen = {};
              var merged = current[k].concat(incoming[k]).filter(function (e) {
                var sig = JSON.stringify(e);
                if (seen[sig]) return false;
                seen[sig] = 1; return true;
              });
              current[k] = merged; added++;
            } else {
              kept++; // a scalar already set on this device wins
            }
          } else {
            current[k] = incoming[k]; added++;
          }
        });
        if (live) live[slot.split(':')[1]] = current;
        set(slot, current);
      });
      return { added: added, kept: kept };
    }
  };

  window.HOS_STORAGE = API;

  /* ─────────────── pick a backend, then let the engine boot ───────────────
     The engine's own hydrate step awaits window.storage.get, so resolving the
     backend before it runs keeps the existing boot order intact. */
  readyP = (host
    ? Promise.resolve('host')
    : openDB().then(function (d) {
        db = d; backend = 'idb';
        // Ask for durable storage, silently; refusal changes nothing.
        if (navigator.storage && navigator.storage.persist) {
          try { navigator.storage.persist().catch(function () {}); } catch (e) {}
        }
        return 'idb';
      }).catch(function () {
        try {
          localStorage.setItem('__t', '1'); localStorage.removeItem('__t');
          backend = 'localStorage';
          return 'localStorage';
        } catch (e) {
          backend = 'memory';
          return 'memory';
        }
      })
  ).then(function (b) {
    if (b === 'memory') {
      document.addEventListener('hos:ready', memoryWarning);
      if (document.getElementById('hos-sidebar')) memoryWarning();
    }
    document.addEventListener('hos:ready', function () {
      updateMeter();
      // One migration pass: earlier builds wrote to localStorage directly.
      if (b === 'idb') {
        SLOTS.forEach(function (slot) {
          var old = null;
          try { old = localStorage.getItem(LS_PREFIX + slot); } catch (e) {}
          if (!old) return;
          get(slot).then(function (cur) {
            if (cur && Object.keys(cur).length) return;
            try { set(slot, JSON.parse(old)); } catch (e) {}
          });
        });
      }
    });
    return b;
  });

  window.HOS_STORAGE_READY = readyP;
})();
