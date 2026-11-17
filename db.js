/* Bibliothek – Speicher (IndexedDB). Stores: shelves, books, meta. */
(function (root) {
  'use strict';
  const DB_NAME = 'bibliothek';
  const VERSION = 2;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('shelves')) db.createObjectStore('shelves', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('books')) {
          const s = db.createObjectStore('books', { keyPath: 'id' });
          s.createIndex('isbn', 'isbn', { unique: false });
          s.createIndex('shelfId', 'shelfId', { unique: false });
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
        if (!db.objectStoreNames.contains('series')) db.createObjectStore('series', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then((db) => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then((v) => { out = v; });
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  const DB = {
    all: (store) => tx(store, 'readonly', (s) => req2p(s.getAll())),
    get: (store, id) => tx(store, 'readonly', (s) => req2p(s.get(id))),
    put: (store, obj) => tx(store, 'readwrite', (s) => req2p(s.put(obj))),
    del: (store, id) => tx(store, 'readwrite', (s) => req2p(s.delete(id))),
    byIndex: (store, index, value) => tx(store, 'readonly', (s) => req2p(s.index(index).getAll(value))),
    clear: (store) => tx(store, 'readwrite', (s) => req2p(s.clear())),
    putMany: (store, arr) => tx(store, 'readwrite', (s) => Promise.all(arr.map((o) => req2p(s.put(o))))),
    async getMeta(key, fallback) {
      const r = await DB.get('meta', key);
      return r ? r.value : fallback;
    },
    setMeta: (key, value) => DB.put('meta', { key, value }),
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* egal */ }
      return false;
    }
  };
  root.DB = DB;
})(self);
