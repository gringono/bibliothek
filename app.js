/* Bibliothek – Oberfläche */
(function () {
  'use strict';
  const L = window.BibLib;
  const APP_VERSION = '0.2.5';
  const $app = document.getElementById('app');

  const THEMES = { leseecke: 'Leseecke', roman: 'Romane', krimi: 'Krimi', thriller: 'Thriller', horror: 'Horror', fantasy: 'Fantasy', romantasy: 'Romantasy', scifi: 'Science-Fiction' };
  const THEME_COLOR = { leseecke: '#F6EEE3', roman: '#FAF7F2', krimi: '#EAE3D2', thriller: '#0E1013', horror: '#121013', fantasy: '#F1EBD9', romantasy: '#FBF0EE', scifi: '#070B18' };
  const SPINES = {
    leseecke: ['#8A5A35', '#B8865B', '#5E3B22', '#C9A37A', '#7A4A2A', '#A0703F', '#4A2E1A', '#D2B48C', '#93623A', '#6B4428', '#BC8F5F', '#55351F'],
    horror: ['#2B1B1E', '#5A1A1A', '#1F2326', '#3A2F2A', '#7A1F1F', '#141414', '#4B3B33', '#2E2124', '#601C1C', '#24282B', '#3D1515', '#1A1A1D'],
    romantasy: ['#D9A3B4', '#B5739A', '#E8C4C8', '#C9A45C', '#9C7BB0', '#F0D4D8', '#7E4E6E', '#D4B5E0', '#C27C93', '#B9A06A', '#E6B9C5', '#8F6AA3'],
    roman: ['#2F5D66', '#C9B8A3', '#7A6A5C', '#A9C2C7', '#5B4B3F', '#E3D6C5', '#3E4A57', '#B08E6E', '#8FA9AE', '#4A3C33', '#D2C2AE', '#6E8B91'],
    krimi: ['#3F3A33', '#8E2A1B', '#6B6152', '#C2B59A', '#2B2B2B', '#9C8B6E', '#5A3A2E', '#D8CCAF', '#4A453D', '#7E1F15', '#B3A588', '#33302B'],
    thriller: ['#1F232A', '#F2C230', '#3A404A', '#13161B', '#5B636F', '#2A2F37', '#C9A227', '#0E1013', '#454C57', '#262B33', '#8A919C', '#181B20'],
    scifi: ['#0E1530', '#39D0FF', '#142047', '#7B5CFF', '#1E2B57', '#9FE6FF', '#0A1024', '#3A4F8F', '#1FB6E6', '#24306A', '#B9A6FF', '#101A3A'],
    fantasy: ['#2F4A3A', '#6B5A3A', '#3C5F4B', '#8C6B3E', '#1F3A30', '#A0844F', '#4D6B55', '#5B4630', '#2A4A44', '#7A6440', '#3E5A47', '#94774A']
  };
  const STATUS = [['ungelesen', 'ungelesen'], ['liest', 'liest gerade'], ['gelesen', 'gelesen'], ['abgebrochen', 'abgebrochen']];
  const STATUS_LABEL = Object.fromEntries(STATUS);
  const BACKUP_EVERY = 20;
  const BACKUP_DAYS = 14;

  const S = { shelves: [], books: [], route: '', scan: null };

  // ---------- Hilfen ----------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();
  const now = () => new Date().toISOString();
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const fmtNum = (n) => Number(n || 0).toLocaleString('de-DE');
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('de-DE') : '';
  const qs = (sel) => $app.querySelector(sel);
  const qsa = (sel) => Array.from($app.querySelectorAll(sel));
  const on = (sel, ev, fn) => qsa(sel).forEach((el) => el.addEventListener(ev, fn));
  const shelfById = (id) => S.shelves.find((s) => s.id === id);
  const bookById = (id) => S.books.find((b) => b.id === id);
  const booksIn = (shelfId) => S.books.filter((b) => b.shelfId === shelfId);
  const authorStr = (b) => (b.authors || []).join(', ');
  const shelfLabel = (s) => s ? s.name : 'ohne Regal';

  function toast(msg, ms, action) {
    document.querySelectorAll('.toast').forEach((x) => x.remove());
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    const span = document.createElement('span');
    span.textContent = msg;
    t.appendChild(span);
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'toast-btn';
      btn.textContent = action.label;
      btn.addEventListener('click', () => { t.remove(); action.fn(); });
      t.appendChild(btn);
    }
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
  }

  /** Aktuelle Ansicht neu zeichnen, Scrollposition behalten. */
  function refresh() {
    const y = window.scrollY;
    route(true);
    window.scrollTo(0, y);
  }

  /** Nach links wischen = löschen (mit Rückgängig). */
  function hookSwipe() {
    qsa('li.swipe > a.book').forEach((a) => {
      const li = a.parentElement;
      let x0 = 0, y0 = 0, dx = 0, mode = '', pid = null, swiped = false;
      const W = () => li.getBoundingClientRect().width;
      const reset = () => { a.style.transition = 'transform .2s'; a.style.transform = ''; li.classList.remove('armed'); };
      a.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        x0 = e.clientX; y0 = e.clientY; dx = 0; mode = ''; pid = e.pointerId; swiped = false;
        a.style.transition = 'none';
      });
      a.addEventListener('pointermove', (e) => {
        if (pid !== e.pointerId) return;
        const mx = e.clientX - x0, my = e.clientY - y0;
        if (!mode) {
          if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
          mode = Math.abs(mx) > Math.abs(my) * 1.2 && mx < 0 ? 'swipe' : 'scroll';
          if (mode === 'swipe') { try { a.setPointerCapture(e.pointerId); } catch (err) { /* egal */ } }
        }
        if (mode !== 'swipe') return;
        dx = Math.min(0, mx);
        a.style.transform = 'translateX(' + dx + 'px)';
        li.classList.toggle('armed', dx < -W() * 0.4);
      });
      const end = (e) => {
        if (pid !== e.pointerId) return;
        pid = null;
        if (mode !== 'swipe') return;
        swiped = true;
        if (dx < -W() * 0.4) removeWithUndo(li, a.dataset.id);
        else reset();
      };
      a.addEventListener('pointerup', end);
      a.addEventListener('pointercancel', (e) => { if (pid === e.pointerId) { pid = null; reset(); } });
      a.addEventListener('click', (e) => { if (swiped) { e.preventDefault(); swiped = false; } }, true);
    });
  }

  async function removeWithUndo(li, id) {
    const b = bookById(id);
    if (!b) return;
    const a = li.querySelector('a.book');
    a.style.transition = 'transform .2s';
    a.style.transform = 'translateX(-110%)';
    li.style.transition = 'height .25s .15s, opacity .25s .15s';
    li.style.height = li.offsetHeight + 'px';
    requestAnimationFrame(() => { li.style.height = '0px'; li.style.opacity = '0'; li.style.overflow = 'hidden'; });
    const copy = JSON.parse(JSON.stringify(b));
    await deleteBook(id);
    setTimeout(refresh, 450);
    toast('„' + (b.title || 'Buch') + '“ gelöscht', 5000, {
      label: 'Rückgängig',
      fn: async () => { await restoreBook(copy); refresh(); }
    });
  }

  function setTheme(t) {
    const theme = THEMES[t] ? t : 'leseecke';
    document.body.dataset.theme = theme;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', THEME_COLOR[theme]);
  }

  function setTab(tab) {
    document.querySelectorAll('nav.tabs a').forEach((a) => {
      if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  }

  // ---------- Icons ----------
  const ICON = {
    trash: '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M10 11v6M14 11v6"></path><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"></path><path d="M9 7V4h6v3"></path></svg>',
    back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>',
    chevron: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>',
    search: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>',
    star: (filled) => '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path></svg>',
    heart: (filled) => '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"></path></svg>',
    ornament: () => ORNAMENTS[document.body.dataset.theme] || ''
  };
  const ORNAMENTS = {
    romantasy: '<svg class="ornament" aria-hidden="true" width="180" height="16" viewBox="0 0 180 16" fill="none" stroke="#C9A45C" stroke-width="1.3" stroke-linecap="round"><path d="M2 8h64"></path><path d="M114 8h64"></path><path d="M90 2c-6 0-10 6-16 6s-6-4-2-4M90 2c6 0 10 6 16 6s6-4 2-4"></path><path d="M90 14c-6 0-10-6-16-6M90 14c6 0 10-6 16-6"></path><circle cx="90" cy="8" r="2" fill="#C9A45C"></circle></svg>',
    fantasy: '<svg class="ornament" aria-hidden="true" width="220" height="26" viewBox="0 0 220 26" fill="none" stroke="#C99A2E" stroke-width="1.4" stroke-linecap="round"><path d="M4 13c20 0 30-9 46-9s22 9 34 9"></path><path d="M216 13c-20 0-30-9-46-9s-22 9-34 9"></path><path d="M38 8c-4-5 2-8 5-4M182 8c4-5-2-8-5-4"></path><path d="M110 3l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#C99A2E"></path><circle cx="92" cy="13" r="1.6" fill="#2F6B3E"></circle><circle cx="128" cy="13" r="1.6" fill="#2F6B3E"></circle></svg>',
    krimi: '<div class="ornament" aria-hidden="true" style="width:210px;height:14px;transform:rotate(-1.5deg);background:repeating-linear-gradient(-45deg,#E8C23A 0 10px,#262421 10px 20px);opacity:.85"></div>',
    thriller: '<svg class="ornament" aria-hidden="true" width="200" height="24" viewBox="0 0 200 24" fill="none" stroke="#F2C230" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M2 14h70l6-10 8 18 7-14 5 6h100"></path></svg>',
    scifi: '<svg class="ornament" aria-hidden="true" width="200" height="14" viewBox="0 0 200 14" fill="none" stroke="#39D0FF" stroke-width="1.4"><path d="M2 7h60l6-5h40l6 5h84"></path><circle cx="62" cy="7" r="2.2" fill="#39D0FF"></circle><circle cx="114" cy="7" r="2.2" fill="#39D0FF"></circle><path d="M150 7v5M160 7v5M170 7v5" stroke-opacity=".6"></path></svg>',
    roman: '<svg class="ornament" aria-hidden="true" width="120" height="12" viewBox="0 0 120 12" fill="none" stroke="#2F5D66" stroke-width="1"><path d="M2 6h48M70 6h48"></path><path d="M60 1l5 5-5 5-5-5z" fill="#2F5D66"></path></svg>'
  };
  const ratingIcon = (filled, size) => {
    const svg = document.body.dataset.theme === 'romantasy' ? ICON.heart(filled) : ICON.star(filled);
    return size ? svg.replace(/width="26" height="26"/, 'width="' + size + '" height="' + size + '"') : svg;
  };

  // ---------- Daten ----------
  async function load() {
    S.googleKey = await DB.getMeta('googleKey', '');
    S.shelves = (await DB.all('shelves')).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    S.books = await DB.all('books');
    S.series = (await DB.all('series')).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    for (const sr of S.series) {
      if (sr.author && sr.author.split(',').length > 2) { sr.author = sr.author.split(',')[0].trim(); await DB.put('series', sr); }
    }
  }

  async function saveBook(b) {
    b.updatedAt = now();
    await DB.put('books', b);
    const i = S.books.findIndex((x) => x.id === b.id);
    if (i >= 0) S.books[i] = b; else S.books.push(b);
    return b;
  }

  async function saveShelf(s) {
    await DB.put('shelves', s);
    const i = S.shelves.findIndex((x) => x.id === s.id);
    if (i >= 0) S.shelves[i] = s; else S.shelves.push(s);
    S.shelves.sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
  }

  async function saveSeries(sr) {
    await DB.put('series', sr);
    const i = S.series.findIndex((x) => x.id === sr.id);
    if (i >= 0) S.series[i] = sr; else S.series.push(sr);
    S.series.sort((a, b) => a.name.localeCompare(b.name, 'de'));
    return sr;
  }
  const seriesById = (id) => S.series.find((x) => x.id === id);
  const seriesByName = (name) => S.series.find((x) => x.name.trim().toLowerCase() === String(name || '').trim().toLowerCase());
  const fmtVol = (v) => String(v).replace('.', ',');

  /** Kennzahlen einer Reihe: Bände 1..n plus vorhandene Sonderbände. */
  function seriesInfo(sr) {
    const books = S.books.filter((b) => b.seriesId === sr.id);
    const withVol = books.filter((b) => b.volume != null);
    const maxOwned = withVol.reduce((m, b) => Math.max(m, Math.floor(b.volume)), 0);
    const total = sr.total || maxOwned;
    const vols = new Set();
    for (let i = 1; i <= total; i++) vols.add(i);
    withVol.forEach((b) => vols.add(b.volume));
    const rows = Array.from(vols).sort((a, b) => a - b).map((v) => {
      const own = withVol.filter((b) => b.volume === v);
      return { volume: v, books: own, owned: own.length > 0, read: own.some((b) => b.status === 'gelesen'), reading: own.some((b) => b.status === 'liest') };
    });
    return {
      books, rows, noVolume: books.filter((b) => b.volume == null), totalKnown: !!sr.total, total: rows.length,
      owned: rows.filter((r) => r.owned).length, read: rows.filter((r) => r.read).length,
      missing: rows.filter((r) => !r.owned).length, reading: rows.filter((r) => r.reading).length
    };
  }

  /** Buch einer Reihe zuordnen; legt die Reihe bei Bedarf an. */
  async function assignSeries(b, name, volume) {
    name = String(name || '').trim();
    if (!name) return;
    let sr = seriesByName(name);
    if (!sr) sr = await saveSeries({ id: uid() + uid(), name, author: (b.authors || [])[0] || '', total: null, createdAt: now() });
    b.seriesId = sr.id;
    b.volume = volume != null && !isNaN(volume) ? volume : null;
    b.seriesHint = null;
    await saveBook(b);
    return sr;
  }

  /** Lücke schließen: nachfolgende Bücher im selben Fach rücken auf. */
  async function closeGap(shelfId, fach, pos, exceptId) {
    if (!shelfId || !pos) return;
    for (const x of S.books.filter((x) => x.id !== exceptId && x.shelfId === shelfId && (x.fach || 0) === (fach || 0) && x.pos > pos)) { x.pos -= 1; await saveBook(x); }
  }
  /** Platz freimachen: Bücher ab pos rücken eins nach hinten. */
  async function openGap(shelfId, fach, pos, exceptId) {
    if (!shelfId || !pos) return;
    if (!S.books.some((x) => x.id !== exceptId && x.shelfId === shelfId && (x.fach || 0) === (fach || 0) && x.pos === pos)) return;
    for (const x of S.books.filter((x) => x.id !== exceptId && x.shelfId === shelfId && (x.fach || 0) === (fach || 0) && x.pos >= pos)) { x.pos += 1; await saveBook(x); }
  }

  async function deleteBook(id) {
    const b = bookById(id);
    await DB.del('books', id);
    S.books = S.books.filter((x) => x.id !== id);
    if (b) await closeGap(b.shelfId, b.fach, b.pos);
  }

  /** Gelöschtes Buch wiederherstellen, am alten Platz. */
  async function restoreBook(copy) {
    await openGap(copy.shelfId, copy.fach, copy.pos, copy.id);
    await saveBook(copy);
  }

  function nextPos(shelfId, fach) {
    let max = 0;
    S.books.forEach((b) => { if (b.shelfId === shelfId && (b.fach || 0) === (fach || 0) && b.pos > max) max = b.pos; });
    return max + 1;
  }

  function newBook(fields) {
    return Object.assign({
      id: uid() + uid(), isbn: '', title: '', subtitle: '', authors: [], publisher: '', year: '', pages: null,
      language: '', cover: '', description: '', categories: [], sources: [],
      shelfId: '', fach: 0, pos: null, status: 'ungelesen', rating: 0,
      notes: '', copies: 1, needsLookup: false, needsReview: false, addedAt: now(), updatedAt: now()
    }, fields);
  }

  async function bumpBackupCounter(n) {
    const c = await DB.getMeta('booksSinceBackup', 0);
    await DB.setMeta('booksSinceBackup', c + (n || 1));
  }

  // ---------- Cover-Suche (ohne Schlüssel) ----------
  /** Lädt ein Bild probeweise. true, wenn es lädt und keine Mini-Grafik ist. */
  function probeImage(url, ms) {
    return new Promise((resolve) => {
      const img = new Image();
      const t = setTimeout(() => { img.src = ''; resolve(false); }, ms || 8000);
      img.onload = () => { clearTimeout(t); resolve(img.naturalWidth >= 40 && img.naturalHeight >= 40); };
      img.onerror = () => { clearTimeout(t); resolve(false); };
      img.referrerPolicy = 'no-referrer';
      img.src = url;
    });
  }

  /** JSONP-Abruf (Google Dynamic Links liefert kein CORS, aber ein Skript mit Rückruf). */
  function jsonp(url, ms) {
    return new Promise((resolve, reject) => {
      const cb = '__gbcb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const s = document.createElement('script');
      const done = () => { clearTimeout(t); s.remove(); window[cb] = function () {}; };
      const t = setTimeout(() => { done(); reject(new Error('Zeitüberschreitung')); }, ms || 8000);
      window[cb] = (data) => { done(); resolve(data); };
      s.onerror = () => { done(); reject(new Error('nicht erreichbar')); };
      s.src = url + '&callback=' + cb;
      document.head.appendChild(s);
    });
  }

  const COVER_SOURCES = {
    googlebild: async (isbn) => {
      const d = await jsonp('https://books.google.com/books?jscmd=viewapi&bibkeys=ISBN:' + isbn);
      const e = d && d['ISBN:' + isbn];
      if (!e || !e.thumbnail_url) return '';
      const url = e.thumbnail_url.replace(/^http:/, 'https:').replace(/zoom=\d/, 'zoom=1').replace('&edge=curl', '');
      return (await probeImage(url)) ? url : '';
    },
    openlibrary: async (isbn) => {
      const url = 'https://covers.openlibrary.org/b/isbn/' + isbn + '-M.jpg?default=false';
      return (await probeImage(url)) ? url : '';
    }
  };
  const COVER_LABEL = { googlebild: 'Google (Bild, ohne Schlüssel)', openlibrary: 'Open Library' };

  /** Sucht ein Cover über die ISBN. Rückgabe { url, source, tried: {quelle: 'ok'|'kein'|'fehler'|'aus'} }. */
  async function findCover(isbn) {
    const tried = {};
    const order = ['googlebild', 'openlibrary'];
    for (const k of order) {
      try {
        const url = await COVER_SOURCES[k](isbn);
        tried[k] = url ? 'ok' : 'kein';
        if (url) return { url, source: k, tried };
      } catch (e) {
        tried[k] = 'fehler';
      }
    }
    return { url: '', source: '', tried };
  }

  // ---------- Datenabfrage (Warteschlange) ----------
  const Lookup = {
    queue: [], running: 0, listeners: new Set(), coverOnly: new Set(),
    addCover(id) { this.coverOnly.add(id); this.add(id); },
    add(id) { if (!this.queue.includes(id)) this.queue.push(id); this.pump(); },
    async pump() {
      while (this.running < 2 && this.queue.length) {
        const id = this.queue.shift();
        this.running++;
        this.run(id).finally(() => { this.running--; this.pump(); });
      }
    },
    async run(id) {
      const b = bookById(id);
      if (!b || !b.isbn) return;
      let r;
      const coverOnly = this.coverOnly.has(id);
      this.coverOnly.delete(id);
      try { r = await L.lookupIsbn(b.isbn, { googleKey: S.googleKey }); } catch (e) { r = { book: null, status: {}, errors: {}, offline: true }; }
      await DB.setMeta('lastSourceStatus', { at: now(), isbn: b.isbn, status: r.status, errors: r.errors });
      const cur = bookById(id);
      if (!cur) return;
      let outcome;
      if (coverOnly) {
        // Nur Lücken füllen, bearbeitete Daten nicht überschreiben
        if (r.book) {
          if (!cur.cover && r.book.cover) cur.cover = r.book.cover;
          if (!cur.pages && r.book.pages) cur.pages = r.book.pages;
          if (!cur.description && r.book.description) cur.description = r.book.description;
          (r.book.sources || []).forEach((q) => { if (!(cur.sources || []).includes(q)) cur.sources = (cur.sources || []).concat(q); });
        }
        outcome = r.book && cur.cover ? 'ok' : 'leer';
      } else if (r.book) {
        ['title', 'subtitle', 'authors', 'publisher', 'year', 'pages', 'language', 'cover', 'description', 'categories', 'sources']
          .forEach((k) => { if (r.book[k] && (!Array.isArray(r.book[k]) || r.book[k].length)) cur[k] = r.book[k]; });
        cur.needsLookup = false; cur.needsReview = !cur.title;
        outcome = 'ok';
      } else if (r.offline) {
        cur.needsLookup = true; outcome = 'offline';
      } else {
        cur.needsLookup = false; cur.needsReview = true; outcome = 'leer';
      }
      if (cur.isbn && !r.offline && !cur.seriesId && !cur.seriesHintDone) {
        try {
          const m = await L.lookupSeries(cur.isbn);
          if (m) {
            if (!cur.pages && m.pages) cur.pages = m.pages;
            const hint = m.series[0];
            if (hint) {
              const sr = seriesByName(hint.name);
              if (sr) { cur.seriesId = sr.id; cur.volume = hint.volume; }
              else cur.seriesHint = hint;
            }
          }
        } catch (e) { /* Reihe ist optional */ }
      }
      if (!cur.cover && cur.isbn && !r.offline) {
        try {
          const c = await findCover(cur.isbn);
          if (c.url) {
            cur.cover = c.url;
            if (!(cur.sources || []).includes(c.source)) cur.sources = (cur.sources || []).concat(c.source);
            if (coverOnly) outcome = 'ok';
          }
        } catch (e) { /* Cover ist optional */ }
      }
      await saveBook(cur);
      this.listeners.forEach((fn) => fn(id, outcome, r.status));
    },
    retryPending() {
      S.books.filter((b) => b.needsLookup && b.isbn).forEach((b) => this.add(b.id));
    }
  };
  window.addEventListener('online', () => Lookup.retryPending());

  // ---------- Ton ----------
  let audioCtx = null;
  function initAudio() {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) { audioCtx = null; }
  }
  function beep(kind) {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = kind === 'dup' ? 440 : kind === 'shelf' ? 660 : 990;
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (kind === 'dup' ? 0.3 : 0.12));
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.35);
  }

  // ---------- Scanner ----------
  /* Eigene Scan-Schleife statt ZXings decodeContinuously: Dort beendet jeder unerwartete
     Fehler eines Einzelbilds die Schleife stillschweigend. Ausgewertet wird nur der Rahmenausschnitt. */
  const Scanner = {
    reader: null, stream: null, video: null, canvas: null, timer: null, lastCode: '', lastAt: 0, track: null, busy: false,
    async start(video, onCode) {
      this.stop();
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.QR_CODE]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.MultiFormatReader();
      reader.setHints(hints);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      this.reader = reader; this.stream = stream; this.video = video;
      this.track = stream.getVideoTracks()[0] || null;
      video.setAttribute('playsinline', ''); video.muted = true;
      video.srcObject = stream;
      try { await video.play(); } catch (e) { /* iOS startet trotzdem, sobald Daten da sind */ }
      this.canvas = document.createElement('canvas');
      let n = 0;
      const loop = () => {
        if (this.reader !== reader) return;
        const code = this.decodeFrame(++n % 3 === 0);
        if (code) this.handle(code, onCode);
        this.timer = setTimeout(loop, code ? 250 : 120);
      };
      loop();
    },
    decodeFrame(full) {
      const v = this.video;
      if (!v || v.readyState < 2 || !v.videoWidth) return null;
      // Meist nur der Rahmenausschnitt (76 % Breite, 50 % Höhe, mittig), jedes 3. Bild komplett; max. 960 px breit
      const fw = full ? 1 : 0.76, fh = full ? 1 : 0.5;
      const sw = Math.round(v.videoWidth * fw), sh = Math.round(v.videoHeight * fh);
      const sx = Math.round((v.videoWidth - sw) / 2), sy = Math.round((v.videoHeight - sh) / 2);
      const scale = Math.min(1, 960 / sw);
      const c = this.canvas;
      c.width = Math.round(sw * scale); c.height = Math.round(sh * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      try {
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
        const bmp = new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(new ZXing.HTMLCanvasElementLuminanceSource(c)));
        return this.reader.decode(bmp).getText();
      } catch (e) {
        return null; // kein Code im Bild oder Lesefehler: nächstes Bild
      } finally {
        try { this.reader.reset(); } catch (e) { /* egal */ }
      }
    },
    handle(text, onCode) {
      const t = Date.now();
      if (text === this.lastCode && t - this.lastAt < 3000) { this.lastAt = t; return; }
      this.lastCode = text; this.lastAt = t;
      onCode(text);
    },
    torchSupported() {
      try { const c = this.track && this.track.getCapabilities ? this.track.getCapabilities() : null; return !!(c && c.torch); } catch (e) { return false; }
    },
    async torch(onOff) {
      if (!this.track) return;
      try { await this.track.applyConstraints({ advanced: [{ torch: onOff }] }); } catch (e) { toast('Taschenlampe nicht verfügbar'); }
    },
    stop() {
      if (this.timer) clearTimeout(this.timer);
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
      if (this.video) { try { this.video.pause(); this.video.srcObject = null; } catch (e) { /* egal */ } }
      this.reader = null; this.stream = null; this.video = null; this.track = null; this.timer = null; this.lastCode = '';
    }
  };

  // ---------- Bausteine ----------
  function coverHtml(b, big) {
    const ini = esc(((b.title || '?').trim()[0] || '?').toUpperCase());
    return '<div class="cover' + (big ? ' big' : '') + '" aria-hidden="true"><span class="ini">' + ini + '</span>' +
      (b.cover ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="position:absolute;inset:0">' : '') + '</div>';
  }

  function ratingHtml(r) {
    if (!r) return '';
    let s = '<span class="rating" role="img" aria-label="' + r + ' von 5">';
    for (let i = 1; i <= 5; i++) s += ratingIcon(i <= r, 13);
    return s + '</span>';
  }

  function bookRow(b, opts) {
    opts = opts || {};
    const shelf = shelfById(b.shelfId);
    const where = [];
    if (opts.showShelf) where.push(shelfLabel(shelf));
    if (b.fach) where.push('Fach ' + b.fach);
    if (b.pos) where.push('Platz ' + b.pos);
    let pill = '<span class="pill">' + esc(STATUS_LABEL[b.status] || b.status) + '</span>';
    if (b.needsLookup) pill = '<span class="pill warn">Daten fehlen</span>';
    else if (b.needsReview) pill = '<span class="pill warn">prüfen</span>';
    return '<li class="swipe"><div class="swipe-bg" aria-hidden="true">' + ICON.trash + 'Löschen</div><a class="book" draggable="false" data-id="' + esc(b.id) + '" href="#/buch/' + esc(b.id) + '">' + coverHtml(b) +
      '<div class="grow"><div class="book-title">' + esc(b.title || ('ISBN ' + L.formatIsbn(b.isbn))) + '</div>' +
      '<div class="muted small">' + esc(authorStr(b) || '–') + (b.seriesId && seriesById(b.seriesId) ? ' · ' + esc(seriesById(b.seriesId).name) + (b.volume != null ? ' ' + fmtVol(b.volume) : '') : '') + (b.copies > 1 ? ' · ' + b.copies + ' Exemplare' : '') + '</div>' +
      '<div class="book-meta">' + pill + ratingHtml(b.rating) + '<span class="muted small">' + esc(where.join(' · ')) + '</span></div></div></a></li>';
  }

  function hookCovers() {
    qsa('.cover img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
  }

  function spinesHtml(theme) {
    const w = [14, 18, 12, 16, 20, 13, 17, 15, 19, 14, 16, 12];
    const h = [40, 44, 36, 42, 46, 38, 43, 45, 34, 41, 44, 39];
    return (SPINES[theme] || SPINES.leseecke).map((c, i) => '<i style="width:' + w[i] + 'px;height:' + h[i] + 'px;background:' + c + '"></i>').join('');
  }

  function head(opts) {
    return '<header class="head' + (opts.art ? ' has-art' : '') + '">' + (opts.art ? '<div class="art" aria-hidden="true"></div>' : '') +
      (opts.back ? '<a class="back" href="' + esc(opts.back) + '">' + ICON.back + esc(opts.backLabel || 'Zurück') + '</a>' : '') +
      (opts.kicker ? '<p class="kicker">' + esc(opts.kicker) + '</p>' : '') +
      '<h1 class="display">' + esc(opts.title) + '</h1>' + ICON.ornament() +
      (opts.sub ? '<p class="sub">' + esc(opts.sub) + '</p>' : '') + '</header>';
  }

  // ---------- Ansichten ----------
  async function viewHome() {
    setTheme('leseecke'); setTab('home');
    const lastBackup = await DB.getMeta('lastBackupAt', null);
    const since = await DB.getMeta('booksSinceBackup', 0);
    const days = lastBackup ? (Date.now() - new Date(lastBackup).getTime()) / 864e5 : Infinity;
    const needBackup = S.books.length > 0 && (since >= BACKUP_EVERY || (since > 0 && days > BACKUP_DAYS));
    const review = S.books.filter((b) => b.needsReview || b.needsLookup).length;
    const read = S.books.filter((b) => b.status === 'gelesen').length;
    const unread = S.books.filter((b) => b.status === 'ungelesen').length;
    const total = S.books.reduce((n, b) => n + (b.copies || 1), 0);

    let html = head({ kicker: 'Leseecke', title: 'Meine Bibliothek', art: true });
    if (needBackup) {
      html += '<div class="banner" role="status"><div class="grow">' + since + ' neue Bücher seit der letzten Sicherung' +
        (lastBackup ? ' (' + fmtDate(lastBackup) + ')' : '') + '.</div><button class="btn small" data-act="backup">Sichern</button></div>';
    }
    if (review) {
      html += '<a class="banner" href="#/nacharbeiten" style="text-decoration:none"><div class="grow">' + review + (review === 1 ? ' Buch muss' : ' Bücher müssen') + ' nachgearbeitet werden.</div>' + ICON.chevron + '</a>';
    }
    html += '<a class="search" href="#/suche" style="text-decoration:none;color:var(--muted)">' + ICON.search + '<span>Titel, Autor oder ISBN</span></a>';
    const statsLink = '<a class="card row" href="#/statistik" style="padding:12px 16px;margin-top:10px;text-decoration:none;color:var(--text)"><span class="grow"><b>Lesestatistik</b> <span class="muted small">· ' + monthLabel(todayIso().slice(0, 7)) + ': ' + readIn(todayIso().slice(0, 7)).length + ' gelesen</span></span>' + ICON.chevron + '</a>';
    html += '<div class="stats">' +
      '<a class="stat" href="#/buecher/alle"><b>' + total + '</b><span>Bücher</span></a>' +
      '<a class="stat" href="#/buecher/gelesen"><b>' + read + '</b><span>gelesen</span></a>' +
      '<a class="stat" href="#/buecher/ungelesen"><b>' + unread + '</b><span>ungelesen</span></a></div>' + statsLink +
      '<a class="card row" href="#/reihen" style="padding:12px 16px;margin-top:10px;text-decoration:none;color:var(--text)"><span class="grow"><b>Reihen</b> <span class="muted small">· ' + S.series.length + (S.series.length === 1 ? ' Reihe' : ' Reihen') + '</span></span>' +
      (S.books.some((b) => b.seriesHint && !b.seriesId) ? '<span class="pill warn">Vorschläge</span>' : '') + ICON.chevron + '</a>';
    html += '<div class="section-head"><h2>Regale</h2><a class="linkbtn" href="#/regal/neu" style="text-decoration:none;display:inline-flex;align-items:center">+ Regal anlegen</a></div>';
    if (!S.shelves.length) {
      html += '<div class="card empty"><p>Noch keine Regale.</p><a class="btn" href="#/regal/neu">Erstes Regal anlegen</a></div>';
    } else {
      html += '<div class="shelves">' + S.shelves.map((s) => {
        const n = booksIn(s.id).length;
        return '<a class="card shelf" href="#/regal/' + esc(s.id) + '"><div aria-hidden="true"><div class="spines">' + spinesHtml(s.theme) + '</div><div class="plank"></div></div>' +
          '<div class="row"><div class="grow"><div class="shelf-name">' + esc(s.name) + '</div><div class="muted small">' + esc([s.room, THEMES[s.theme]].filter(Boolean).join(' · ')) + '</div></div>' +
          '<span class="muted" style="font-weight:700">' + n + '</span>' + ICON.chevron + '</div></a>';
      }).join('') + '</div>';
      html += '<div style="display:flex;gap:10px;margin-top:16px"><a class="btn ghost block" href="#/scan/finden">Regal-QR oder Buch scannen</a></div>';
    }
    $app.innerHTML = html;
    on('[data-act="backup"]', 'click', exportData);
  }

  async function viewShelf(id) {
    const s = shelfById(id);
    if (!s) return notFound();
    setTheme(s.theme); setTab('home');
    const st = viewShelf.state[id] || (viewShelf.state[id] = { fach: 'alle', sort: 'pos' });
    let list = booksIn(id);
    const total = list.length;
    if (st.fach !== 'alle') list = list.filter((b) => String(b.fach || 0) === st.fach);
    const sorters = {
      pos: (a, b) => (a.fach || 0) - (b.fach || 0) || (a.pos || 1e9) - (b.pos || 1e9),
      titel: (a, b) => (a.title || '').localeCompare(b.title || '', 'de'),
      autor: (a, b) => authorStr(a).localeCompare(authorStr(b), 'de') || (a.title || '').localeCompare(b.title || '', 'de')
    };
    list.sort(sorters[st.sort] || sorters.pos);

    let html = head({ art: true, back: '#/', backLabel: 'Bibliothek', title: s.name, sub: [s.room, THEMES[s.theme], total + (total === 1 ? ' Buch' : ' Bücher')].filter(Boolean).join(' · ') });
    if (s.fachCount > 0) {
      const chips = [['alle', 'Alle']];
      for (let i = 1; i <= s.fachCount; i++) chips.push([String(i), 'Fach ' + i]);
      if (booksIn(id).some((b) => !b.fach)) chips.push(['0', 'ohne Fach']);
      html += '<div class="chips" role="group" aria-label="Fach wählen">' + chips.map(([v, l]) => '<button type="button" class="chip" data-fach="' + v + '" aria-pressed="' + (st.fach === v) + '">' + l + '</button>').join('') + '</div>';
    }
    html += '<div class="row" style="margin:14px 0 6px"><a class="btn small" href="#/scan/regal/' + esc(id) + '">Bücher erfassen</a>' +
      '<a class="btn small ghost" href="#/regal/' + esc(id) + '/bearbeiten">Bearbeiten</a><div class="grow"></div>' +
      '<label class="sr-only" for="sort">Sortierung</label><select id="sort" class="input" style="width:auto;min-height:36px;padding:4px 10px;font-size:14px">' +
      [['pos', 'Platz'], ['titel', 'Titel'], ['autor', 'Autor']].map(([v, l]) => '<option value="' + v + '"' + (st.sort === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
    html += list.length ? '<ul class="books">' + list.map((b) => bookRow(b)).join('') + '</ul><p class="muted small" style="text-align:center;margin-top:14px">Tipp: Buch nach links wischen zum Löschen.</p>'
      : '<div class="empty">' + (total ? 'In diesem Fach steht noch nichts.' : 'Noch keine Bücher in diesem Regal. Tippe auf „Bücher erfassen“.') + '</div>';
    $app.innerHTML = html;
    hookCovers(); hookSwipe();
    on('[data-fach]', 'click', (e) => { st.fach = e.currentTarget.dataset.fach; viewShelf(id); });
    on('#sort', 'change', (e) => { st.sort = e.currentTarget.value; viewShelf(id); });
  }
  viewShelf.state = {};

  function viewShelfForm(id) {
    const s = id ? shelfById(id) : { id: '', name: '', room: '', theme: 'leseecke', fachCount: 0 };
    if (id && !s) return notFound();
    setTheme(s.theme); setTab('home');
    const n = id ? booksIn(id).length : 0;
    let html = head({ back: id ? '#/regal/' + id : '#/', backLabel: id ? s.name : 'Bibliothek', title: id ? 'Regal bearbeiten' : 'Neues Regal' });
    html += '<form class="form card" style="padding:16px" id="f">' +
      '<label class="field">Name<input class="input" name="name" required maxlength="40" placeholder="z. B. Regal A" value="' + esc(s.name) + '"></label>' +
      '<label class="field">Raum<input class="input" name="room" maxlength="40" placeholder="z. B. Wohnzimmer" value="' + esc(s.room) + '"></label>' +
      '<fieldset style="border:0;padding:0;margin:0"><legend class="field" style="font-size:14px;font-weight:700;color:var(--muted);margin-bottom:6px">Thema</legend><div class="chips" style="margin:0;padding:0;flex-wrap:wrap">' +
      Object.entries(THEMES).map(([k, l]) => '<button type="button" class="chip" data-theme-pick="' + k + '" aria-pressed="' + (s.theme === k) + '">' + l + '</button>').join('') + '</div></fieldset>' +
      '<label class="field">Anzahl Fächer (0 = ohne Fächer)<input class="input" name="fachCount" type="number" inputmode="numeric" min="0" max="12" value="' + (s.fachCount || 0) + '"></label>' +
      '<button class="btn block" type="submit">Speichern</button></form>';
    if (id) {
      html += '<div style="margin-top:16px">' + (n ? '<p class="muted small">Ein Regal mit Büchern kann nicht gelöscht werden (' + n + ' Bücher).</p>' : '<button class="btn danger block" data-act="del">Regal löschen</button>') + '</div>';
    }
    $app.innerHTML = html;
    let theme = s.theme;
    on('[data-theme-pick]', 'click', (e) => {
      theme = e.currentTarget.dataset.themePick;
      qsa('[data-theme-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themePick === theme)));
      setTheme(theme);
    });
    qs('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const shelf = Object.assign({}, s, {
        id: s.id || uid(), name: String(fd.get('name')).trim(), room: String(fd.get('room')).trim(), theme,
        fachCount: Math.max(0, Math.min(12, parseInt(fd.get('fachCount'), 10) || 0)), createdAt: s.createdAt || now()
      });
      if (!shelf.name) return;
      await saveShelf(shelf);
      location.hash = '#/regal/' + shelf.id;
    });
    on('[data-act="del"]', 'click', async () => {
      if (!confirm('Regal „' + s.name + '“ löschen?')) return;
      await DB.del('shelves', id);
      S.shelves = S.shelves.filter((x) => x.id !== id);
      location.hash = '#/';
    });
  }

  function viewBook(id) {
    const b = bookById(id);
    if (!b) return notFound();
    const s = shelfById(b.shelfId);
    setTheme(s ? s.theme : 'leseecke'); setTab('home');
    let html = '<header class="head"><a class="back" href="' + (s ? '#/regal/' + esc(s.id) : '#/') + '">' + ICON.back + esc(s ? s.name : 'Bibliothek') + '</a></header>';
    html += '<div class="detail-top"><div style="display:flex;flex-direction:column;gap:8px;align-items:center">' + coverHtml(b, true) +
      '<a class="btn small ghost" style="padding:0 12px;width:100%" target="_blank" rel="noopener" href="' + esc(coverSearchUrl(b)) + '">Im Web suchen</a>' +
      '<button type="button" class="btn small ghost" data-act="paste" style="padding:0 12px;width:100%">Cover einfügen</button>' +
      '<label class="btn small ghost" style="cursor:pointer;padding:0 12px;width:100%">Cover-Foto<input type="file" id="coverfile" accept="image/*" class="sr-only"></label>' +
      (b.cover ? '<button type="button" class="linkbtn small" data-act="nocover" style="min-height:32px">entfernen</button>' : '') + '</div><div class="grow"><h1 class="book-title" style="font-size:24px;-webkit-line-clamp:4">' + esc(b.title || 'ISBN ' + L.formatIsbn(b.isbn)) + '</h1>' +
      (b.subtitle ? '<p class="muted" style="margin:4px 0 0">' + esc(b.subtitle) + '</p>' : '') +
      '<p style="margin:8px 0 0;font-weight:600">' + esc(authorStr(b) || '–') + '</p>' +
      '<p class="muted small" style="margin:4px 0 0">' + esc([b.year, b.pages ? b.pages + ' Seiten' : ''].filter(Boolean).join(' · ')) + '</p>' +
      (b.needsLookup ? '<p class="pill warn" style="margin-top:8px">Daten werden nachgeladen</p>' : b.needsReview ? '<p class="pill warn" style="margin-top:8px">bitte prüfen</p>' : '') +
      '</div></div>';

    html += '<div class="stack" style="margin-top:20px">';
    html += '<div class="seg" role="group" aria-label="Lesestatus">' + STATUS.map(([v, l]) => '<button type="button" data-status="' + v + '" aria-pressed="' + (b.status === v) + '">' + l + '</button>').join('') + '</div>';
    if (b.status === 'gelesen') {
      html += '<label class="row card" style="padding:10px 16px;gap:12px"><span class="grow" style="font-weight:700">Gelesen am</span>' +
        '<input type="date" id="finished" class="input" style="width:auto;min-height:40px" max="' + todayIso() + '" value="' + esc(b.finishedAt || '') + '"></label>';
    }
    html += '<div class="stars" role="group" aria-label="Bewertung">' + [1, 2, 3, 4, 5].map((i) => '<button type="button" data-rate="' + i + '" aria-label="' + i + ' von 5" aria-pressed="' + (b.rating >= i) + '">' + ratingIcon(b.rating >= i) + '</button>').join('') + '</div>';

    // Reihe
    const bsr = b.seriesId ? seriesById(b.seriesId) : null;
    html += '<div class="card" style="padding:14px 16px">';
    if (bsr) {
      html += '<div class="row"><div class="grow"><div class="muted small" style="font-weight:700">Reihe</div><a href="#/reihe/' + esc(bsr.id) + '" style="font-weight:700">' + esc(bsr.name) + '</a></div>' +
        '<label class="field" style="width:96px">Band<input class="input" id="vol" type="number" inputmode="decimal" step="0.5" min="0" value="' + (b.volume != null ? b.volume : '') + '"></label></div>' +
        (!bsr.total ? '<form class="row" id="sertotal" style="margin-top:10px;align-items:flex-end"><label class="field grow">Wie viele Bände hat die Reihe?<input class="input" name="total" type="number" inputmode="numeric" min="1" max="200" placeholder="z. B. 3"></label><button class="btn small" type="submit" style="margin-bottom:5px">OK</button></form>' : '') +
        '<button class="linkbtn small" data-act="unseries" style="padding:0;min-height:36px">aus der Reihe entfernen</button>';
    } else if (b.seriesHint) {
      html += '<p style="margin:0 0 10px">Gehört zur Reihe <b>„' + esc(b.seriesHint.name) + '“</b>, Band ' + fmtVol(b.seriesHint.volume) + '?</p>' +
        '<div class="row"><button class="btn small" data-act="takehint">Übernehmen</button><button class="btn small ghost" data-act="nohint">Nein</button></div>';
    } else {
      html += '<form class="row" id="serform" style="align-items:flex-end"><label class="field grow">Reihe<input class="input" name="sname" list="serlist" placeholder="keine (Einzelband)" autocomplete="off"></label>' +
        '<label class="field" style="width:80px">Band<input class="input" name="svol" type="number" inputmode="decimal" step="0.5" min="0"></label>' +
        '<button class="btn small" type="submit" style="margin-bottom:5px">OK</button></form>' +
        '<datalist id="serlist">' + S.series.map((x) => '<option value="' + esc(x.name) + '">').join('') + '</datalist>';
    }
    html += '</div>';

    // Standort
    const fachOpts = (sh) => { let o = '<option value="0">ohne Fach</option>'; for (let i = 1; i <= ((sh && sh.fachCount) || 0); i++) o += '<option value="' + i + '"' + (b.fach === i ? ' selected' : '') + '>Fach ' + i + '</option>'; return o; };
    html += '<div class="card" style="padding:14px 16px"><div class="form">' +
      '<label class="field">Regal<select class="input" id="mv-shelf"><option value="">ohne Regal</option>' + S.shelves.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === b.shelfId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
      (s && !s.fachCount ? '<p class="muted small" style="margin:0">Dieses Regal hat keine Fächer. <a href="#/regal/' + esc(s.id) + '/bearbeiten">Fächer einrichten</a></p>' : '') +
      '<div class="row"><label class="field grow">Fach<select class="input" id="mv-fach"' + (s && s.fachCount ? '' : ' disabled') + '>' + fachOpts(s) + '</select></label>' +
      '<label class="field" style="width:96px">Platz<input class="input" id="mv-pos" type="number" inputmode="numeric" min="1" value="' + (b.pos || '') + '"></label></div>' +
      '<div class="row"><span class="grow muted small">Exemplare</span><button class="btn small ghost" data-copies="-1" aria-label="Ein Exemplar weniger">−</button><b id="copies" style="min-width:24px;text-align:center">' + (b.copies || 1) + '</b><button class="btn small ghost" data-copies="1" aria-label="Ein Exemplar mehr">+</button></div>' +
      '</div></div>';

    html += '<label class="field">Notizen<textarea class="input" id="notes" placeholder="Gedanken, Zitate, Lieblingsfigur …">' + esc(b.notes) + '</textarea></label>';

    if (b.description) html += '<details class="card"><summary>Klappentext</summary><p style="margin:0 0 14px;white-space:pre-line">' + esc(b.description) + '</p></details>';

    html += '<details class="card"' + (b.needsReview ? ' open' : '') + '><summary>Daten bearbeiten</summary><form class="form" id="edit" style="padding-bottom:16px">' +
      '<label class="field">Titel<input class="input" name="title" value="' + esc(b.title) + '"></label>' +
      '<label class="field">Untertitel<input class="input" name="subtitle" value="' + esc(b.subtitle) + '"></label>' +
      '<label class="field">Autor(en), mit Komma getrennt<input class="input" name="authors" value="' + esc(authorStr(b)) + '"></label>' +
      '<div class="row"><label class="field grow">Verlag<input class="input" name="publisher" value="' + esc(b.publisher) + '"></label><label class="field" style="width:96px">Jahr<input class="input" name="year" inputmode="numeric" value="' + esc(b.year) + '"></label></div>' +
      '<label class="field">Seiten<input class="input" name="pages" type="number" inputmode="numeric" min="1" max="20000" value="' + esc(b.pages || '') + '"></label>' +
      '<label class="field">ISBN<input class="input" name="isbn" inputmode="numeric" value="' + esc(b.isbn) + '"></label>' +
      '<label class="field">Cover-Adresse (URL)<input class="input" name="cover" value="' + esc(/^data:/.test(b.cover) ? '' : b.cover) + '" placeholder="' + (/^data:/.test(b.cover) ? 'eigenes Foto gespeichert' : 'https://…') + '"></label>' +
      '<button class="btn block" type="submit">Daten speichern</button>' +
      '<button class="btn ghost block" type="button" data-act="titlesearch">Online nach Titel suchen</button>' +
      (b.isbn ? '<button class="btn ghost block" type="button" data-act="relookup">ISBN erneut abfragen</button>' : '') +
      '<div id="ts"></div></form></details>';

    html += '<dl class="kv card" style="padding:14px 16px;margin:0"><dt>ISBN</dt><dd>' + esc(L.formatIsbn(b.isbn) || '–') + '</dd><dt>Verlag</dt><dd>' + esc(b.publisher || '–') + '</dd>' +
      '<dt>Quellen</dt><dd>' + esc((b.sources || []).join(', ') || 'manuell') + '</dd><dt>Erfasst</dt><dd>' + fmtDate(b.addedAt) + '</dd></dl>';
    html += '<button class="btn danger block" data-act="delete">Buch löschen</button></div>';
    $app.innerHTML = html;
    hookCovers();

    const upd = async (patch, rerender) => { Object.assign(b, patch); await saveBook(b); if (rerender !== false) viewBook(id); };
    on('[data-status]', 'click', (e) => {
      const st = e.currentTarget.dataset.status;
      const patch = { status: st };
      if (st === 'gelesen' && !b.finishedAt) patch.finishedAt = todayIso();
      upd(patch);
    });
    on('#finished', 'change', (e) => upd({ finishedAt: e.currentTarget.value || '' }, false));
    on('[data-rate]', 'click', (e) => { const r = +e.currentTarget.dataset.rate; upd({ rating: b.rating === r ? 0 : r }); });
    on('#mv-shelf', 'change', async (e) => { const sid = e.currentTarget.value; const old = [b.shelfId, b.fach, b.pos]; await closeGap(old[0], old[1], old[2], b.id); upd({ shelfId: sid, fach: 0, pos: sid ? nextPos(sid, 0) : null }); });
    on('#mv-fach', 'change', async (e) => { const f = +e.currentTarget.value; const old = [b.shelfId, b.fach, b.pos]; await closeGap(old[0], old[1], old[2], b.id); upd({ fach: f, pos: b.shelfId ? nextPos(b.shelfId, f) : null }); });
    on('#mv-pos', 'change', (e) => upd({ pos: parseInt(e.currentTarget.value, 10) || null }, false));
    on('[data-copies]', 'click', (e) => { const c = Math.max(1, (b.copies || 1) + +e.currentTarget.dataset.copies); upd({ copies: c }); });
    on('#notes', 'change', (e) => upd({ notes: e.currentTarget.value }, false));
    qs('#edit').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      const isbnRaw = String(fd.get('isbn')).trim();
      const isbn = isbnRaw ? L.normalizeIsbn(isbnRaw) : '';
      if (isbnRaw && !isbn) { toast('ISBN ungültig (Prüfziffer stimmt nicht)'); return; }
      const title = String(fd.get('title')).trim();
      upd({
        title, subtitle: String(fd.get('subtitle')).trim(),
        authors: String(fd.get('authors')).split(',').map((x) => x.trim()).filter(Boolean),
        publisher: String(fd.get('publisher')).trim(), year: String(fd.get('year')).trim(),
        pages: parseInt(fd.get('pages'), 10) || null,
        isbn: isbn || '', cover: String(fd.get('cover')).trim() || (/^data:/.test(b.cover) ? b.cover : ''), needsReview: !title
      });
      toast('Gespeichert');
    });
    on('#vol', 'change', (e) => { const v = parseFloat(String(e.currentTarget.value).replace(',', '.')); upd({ volume: isNaN(v) ? null : v }, false); });
    on('[data-act="unseries"]', 'click', () => upd({ seriesId: null, volume: null, seriesHintDone: true }));
    on('[data-act="takehint"]', 'click', async () => { await assignSeries(b, b.seriesHint.name, b.seriesHint.volume); toast('Zur Reihe hinzugefügt'); viewBook(id); });
    on('[data-act="nohint"]', 'click', () => upd({ seriesHint: null, seriesHintDone: true }));
    const stf = qs('#sertotal');
    if (stf) stf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = parseInt(stf.total.value, 10);
      if (!n || !bsr) return;
      bsr.total = n; await saveSeries(bsr);
      toast('Reihe hat ' + n + ' Bände');
      viewBook(id);
    });
    const sf = qs('#serform');
    if (sf) sf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = sf.sname.value.trim();
      if (!name) return;
      const v = parseFloat(String(sf.svol.value).replace(',', '.'));
      await assignSeries(b, name, isNaN(v) ? null : v);
      toast('Zur Reihe hinzugefügt');
      viewBook(id);
    });
    on('#coverfile', 'change', async (e) => {
      const f = e.currentTarget.files && e.currentTarget.files[0];
      if (!f) return;
      try {
        const data = await shrinkImage(f, 360, 0.8);
        await upd({ cover: data });
        toast('Cover gespeichert');
      } catch (err) {
        toast('Bild konnte nicht gelesen werden');
      }
    });
    on('[data-act="nocover"]', 'click', () => upd({ cover: '' }));
    on('[data-act="paste"]', 'click', () => pasteCover((data) => upd({ cover: data }).then(() => toast('Cover gespeichert'))));
    on('[data-act="relookup"]', 'click', () => { b.needsLookup = true; saveBook(b).then(() => { Lookup.add(b.id); toast('Wird abgefragt …'); }); });
    on('[data-act="titlesearch"]', 'click', () => {
      const q = [qs('#edit [name="title"]').value, qs('#edit [name="authors"]').value].join(' ').trim();
      titleSearch(qs('#ts'), q, (r) => {
        upd({
          title: r.title, subtitle: r.subtitle || '', authors: r.authors || [], publisher: r.publisher || b.publisher, year: r.year || b.year,
          cover: r.cover || b.cover, isbn: b.isbn || r.isbn || '', description: r.description || b.description, needsReview: false, needsLookup: false,
          sources: [r.source]
        });
        toast('Übernommen');
      });
    });
    on('[data-act="delete"]', 'click', async () => {
      if (!confirm('„' + (b.title || b.isbn) + '“ wirklich löschen?')) return;
      await deleteBook(id);
      location.hash = s ? '#/regal/' + s.id : '#/';
    });
  }

  /**
   * Cover aus der Zwischenablage: zuerst ein kopiertes Bild, sonst ein kopierter Bild-Link.
   * Muss direkt im Tipp-Ereignis aufgerufen werden (iOS zeigt dann „Einfügen“ zum Bestätigen).
   */
  async function pasteCover(save) {
    const cb = navigator.clipboard;
    if (!cb || (!cb.read && !cb.readText)) { toast('Einfügen wird auf diesem Gerät nicht unterstützt'); return; }
    try {
      if (cb.read) {
        const items = await cb.read();
        for (const it of items) {
          const t = it.types.find((x) => x.indexOf('image/') === 0);
          if (t) { const blob = await it.getType(t); return save(await shrinkImage(blob, 360, 0.8)); }
        }
        for (const it of items) {
          const t = it.types.includes('text/uri-list') ? 'text/uri-list' : it.types.includes('text/plain') ? 'text/plain' : '';
          if (t) { const txt = (await (await it.getType(t)).text()).trim(); return saveLink(txt, save); }
        }
      } else {
        return saveLink((await cb.readText()).trim(), save);
      }
      toast('Kein Bild in der Zwischenablage. Im Web: Bild lange drücken → „Kopieren“.', 4000);
    } catch (e) {
      toast(e && e.name === 'NotAllowedError' ? 'Einfügen abgebrochen' : 'Zwischenablage nicht lesbar', 3000);
    }
  }

  async function saveLink(txt, save) {
    const url = (txt.split(/\s+/)[0] || '');
    if (!/^https:\/\/\S+$/i.test(url)) { toast('Kein Bild in der Zwischenablage. Im Web: Bild lange drücken → „Kopieren“.', 4000); return; }
    if (!(await probeImage(url))) { toast('Der kopierte Link ist kein Bild'); return; }
    return save(url);
  }

  /** Google-Bildersuche nach dem Cover (Titel + Autor, sonst ISBN). */
  function coverSearchUrl(b) {
    const q = b.title ? [b.title, authorStr(b), 'Buch Cover'].filter(Boolean).join(' ') : (b.isbn + ' Buch Cover');
    return 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(q);
  }

  /** Foto verkleinern (max. Höhe px) und als JPEG-Daten-URL zurückgeben (~20–40 KB). */
  function shrinkImage(file, maxH, quality) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxH / img.naturalHeight);
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild')); };
      img.src = url;
    });
  }

  async function titleSearch(box, q, onPick) {
    if (!q) { toast('Bitte Titel eingeben'); return; }
    box.innerHTML = '<p class="muted">Suche nach „' + esc(q) + '“ …</p>';
    const res = await L.searchByTitle(q, { googleKey: S.googleKey });
    if (!res.length) { box.innerHTML = '<p class="muted">Nichts gefunden oder keine Verbindung.</p>'; return; }
    box.innerHTML = '<ul class="books">' + res.map((r, i) => '<li><button type="button" class="book" data-pick="' + i + '" style="width:100%;background:none;border:0;border-bottom:1px solid var(--line);text-align:left;cursor:pointer">' +
      coverHtml(r) + '<div class="grow"><div class="book-title" style="font-size:16px">' + esc(r.title) + '</div><div class="muted small">' + esc((r.authors || []).join(', ')) + ' · ' + esc(r.year || '') + ' · ' + esc(r.source) + '</div></div></button></li>').join('') + '</ul>';
    box.querySelectorAll('.cover img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
    box.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => onPick(res[+btn.dataset.pick])));
  }

  function viewManualAdd(shelfId) {
    setTheme('leseecke'); setTab('mehr');
    let html = head({ back: '#/mehr', backLabel: 'Mehr', title: 'Buch ohne ISBN' });
    html += '<form class="form card" style="padding:16px" id="f">' +
      '<label class="field">Titel<input class="input" name="title" required></label>' +
      '<label class="field">Autor(en), mit Komma getrennt<input class="input" name="authors"></label>' +
      '<label class="field">Regal<select class="input" name="shelf"><option value="">ohne Regal</option>' + S.shelves.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === shelfId ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') + '</select></label>' +
      '<button class="btn ghost block" type="button" data-act="ts">Erst online suchen</button><div id="ts"></div>' +
      '<button class="btn block" type="submit">Hinzufügen</button></form>' +
      '<p class="muted small">Tipp: Titel vom Buchrücken mit iOS-Livetext (Kamera auf den Text halten, markieren, kopieren) ins Titelfeld einfügen.</p>';
    $app.innerHTML = html;
    let picked = null;
    on('[data-act="ts"]', 'click', () => {
      const f = qs('#f');
      titleSearch(qs('#ts'), (f.title.value + ' ' + f.authors.value).trim(), (r) => {
        picked = r; f.title.value = r.title; f.authors.value = (r.authors || []).join(', ');
        qs('#ts').innerHTML = '<p class="pill">Übernommen: ' + esc(r.title) + '</p>';
      });
    });
    qs('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const sid = f.shelf.value;
      const isbn = picked && picked.isbn ? picked.isbn : '';
      const b = newBook(Object.assign({}, picked || {}, {
        title: f.title.value.trim(), authors: f.authors.value.split(',').map((x) => x.trim()).filter(Boolean),
        isbn, shelfId: sid, fach: 0, pos: sid ? nextPos(sid, 0) : null, sources: picked ? [picked.source] : []
      }));
      delete b.source;
      await saveBook(b);
      await bumpBackupCounter(1);
      location.hash = '#/buch/' + b.id;
    });
  }

  // ---------- Scannen ----------
  function viewScan(mode, shelfId) {
    setTab('scan');
    const find = mode === 'finden';
    const sc = S.scan = S.scan && S.scan.mode === mode ? S.scan : { mode, shelfId: '', fach: 0, log: [], running: false };
    if (shelfId) { sc.shelfId = shelfId; sc.fach = 0; }
    if (!find && !sc.shelfId && S.shelves.length) sc.shelfId = S.shelves[0].id;
    setTheme('leseecke');   // Scan-Seite ist neutral; das Regal wird erst im Fenster gewählt

    let html = head({ back: '#/', backLabel: 'Bibliothek', title: find ? 'Nachschlagen' : 'Bücher erfassen' });
    if (!find && !S.shelves.length) {
      $app.innerHTML = html + '<div class="card empty"><p>Lege zuerst ein Regal an.</p><a class="btn" href="#/regal/neu">Regal anlegen</a></div>';
      return;
    }
    html += find ? '<p class="muted" style="margin-top:0">Buch-Barcode scannen: zeigt, ob es schon im Bestand ist. Regal-QR scannen: öffnet das Regal.</p>'
      : '<p class="muted" style="margin-top:0">Barcode scannen, danach Reihe und Platz wählen. Ein Regal-QR legt das vorgewählte Regal fest.</p>';
    html += '<div class="scanbox"><video id="video" playsinline muted></video><div class="scanframe" id="frame"></div><div class="scanhint" id="hint">Barcode in den Rahmen halten</div>' +
      '<div class="scanstart" id="startbox"><button class="btn" id="start">Kamera starten</button><span class="small">Beim ersten Mal fragt iOS nach der Kamera-Erlaubnis.</span></div></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn small ghost hidden" id="stop">Kamera stoppen</button><button class="btn small ghost hidden" id="torch">Licht</button></div>' +
      '<form class="row" id="manual" style="margin-top:10px"><label class="sr-only" for="misbn">ISBN von Hand</label><input class="input grow" id="misbn" inputmode="numeric" placeholder="ISBN von Hand eingeben" autocomplete="off"><button class="btn small" type="submit">OK</button></form>' +
      '<ul class="scanlog" id="log"></ul>';
    $app.innerHTML = html;
    renderLog();
    qs('#start').addEventListener('click', startCamera);
    qs('#stop').addEventListener('click', () => { Scanner.stop(); qs('#startbox').classList.remove('hidden'); qs('#stop').classList.add('hidden'); qs('#torch').classList.add('hidden'); });
    let torchOn = false;
    qs('#torch').addEventListener('click', () => { torchOn = !torchOn; Scanner.torch(torchOn); });
    qs('#manual').addEventListener('submit', (e) => { e.preventDefault(); initAudio(); const v = qs('#misbn').value; qs('#misbn').value = ''; handleCode(v, true); });
  }

  // ---------- Erfassen-Fenster nach dem Scan ----------
  let sheet = null;   // aktueller Zustand des Fensters

  function openScanSheet(isbn) {
    const sc = S.scan;
    const st = sheet = {
      isbn, data: null, dataDone: false, marc: null, kind: 'single', seriesTouched: false,
      sname: '', svol: '', stotal: '', shelfId: sc.shelfId || (S.shelves[0] && S.shelves[0].id) || '', fach: sc.fach || 0, pos: null, posTouched: false
    };
    st.pos = nextPos(st.shelfId, st.fach);
    renderSheet();
    L.lookupIsbn(isbn, { googleKey: S.googleKey }).then(async (r) => {
      if (sheet !== st) return;
      st.data = r; st.dataDone = true;
      if (r.book && !r.book.cover) { try { const c = await findCover(isbn); if (c.url) { r.book.cover = c.url; r.book.sources = (r.book.sources || []).concat(c.source); } } catch (e) { /* optional */ } }
      if (sheet === st) renderSheet();
    });
    L.lookupSeries(isbn).then((m) => {
      if (sheet !== st) return;
      st.marc = m;
      const h = m && m.series[0];
      if (h && !st.seriesTouched) {
        st.kind = 'series'; st.sname = h.name; st.svol = String(h.volume);
        const sr = seriesByName(h.name);
        st.stotal = sr && sr.total ? String(sr.total) : '';
      }
      renderSheet();
    });
  }

  function closeSheet() {
    sheet = null;
    const el = document.getElementById('sheet');
    if (el) el.remove();
  }

  function renderSheet() {
    const st = sheet;
    if (!st) return;
    let el = document.getElementById('sheet');
    if (!el) { el = document.createElement('div'); el.id = 'sheet'; document.body.appendChild(el); }
    const bk = st.data && st.data.book;
    const shelf = shelfById(st.shelfId);
    const sr = st.sname ? seriesByName(st.sname) : null;
    const fake = Object.assign({ title: bk ? bk.title : '', cover: bk ? bk.cover : '' });
    el.innerHTML = '<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Buch erfassen">' +
      '<div class="row" style="align-items:flex-start">' + coverHtml(fake) + '<div class="grow"><div class="book-title">' + esc(bk ? bk.title : 'ISBN ' + L.formatIsbn(st.isbn)) + '</div>' +
      '<div class="muted small">' + esc(bk ? (authorStr(bk) || '–') : (st.dataDone ? (st.data.offline ? 'offline – Daten werden später geholt' : 'keine Daten gefunden') : 'Daten werden geladen …')) + '</div></div></div>' +
      '<div class="seg" role="group" aria-label="Art" style="grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px">' +
      '<button type="button" data-kind="single" aria-pressed="' + (st.kind === 'single') + '">Einzelband</button><button type="button" data-kind="series" aria-pressed="' + (st.kind === 'series') + '">Teil einer Reihe</button></div>' +
      (st.kind === 'series' ? '<div class="form" style="margin-top:12px">' +
        '<label class="field">Reihe<input class="input" data-f="sname" list="serlist2" value="' + esc(st.sname) + '" placeholder="Name der Reihe" autocomplete="off"></label>' +
        '<datalist id="serlist2">' + S.series.map((x) => '<option value="' + esc(x.name) + '">').join('') + '</datalist>' +
        '<div class="row"><label class="field grow">Band<input class="input" data-f="svol" type="number" inputmode="decimal" step="0.5" min="0" value="' + esc(st.svol) + '"></label>' +
        '<label class="field grow">Bände gesamt<input class="input" data-f="stotal" type="number" inputmode="numeric" min="1" max="200" value="' + esc(st.stotal) + '" placeholder="' + (sr && sr.total ? sr.total : 'z. B. 5') + '"></label></div>' +
        (sr ? '<p class="muted small" style="margin:0">Reihe vorhanden' + (sr.total ? ', ' + sr.total + ' Bände' : '') + '.</p>' : (st.sname ? '<p class="muted small" style="margin:0">Neue Reihe wird angelegt.</p>' : '')) +
        '</div>' : '') +
      '<div class="form" style="margin-top:14px"><label class="field">Regal<select class="input" data-f="shelfId">' +
        S.shelves.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === st.shelfId ? ' selected' : '') + '>' + esc(x.name + (x.room && x.room !== x.name ? ' · ' + x.room : '')) + '</option>').join('') + '</select></label>' +
      (shelf && shelf.fachCount ? '<div class="chips" role="group" aria-label="Fach" style="margin:0;padding:0;flex-wrap:wrap">' +
        Array.from({ length: shelf.fachCount + 1 }, (_, i) => '<button type="button" class="chip" data-sfach="' + i + '" aria-pressed="' + (st.fach === i) + '">' + (i ? 'Fach ' + i : 'ohne Fach') + '</button>').join('') + '</div>' : '') +
      '<label class="field">Platz (nächster freier: ' + nextPos(st.shelfId, st.fach) + ')<input class="input" data-f="pos" type="number" inputmode="numeric" min="1" value="' + esc(st.pos || '') + '"></label></div>' +
      '<div class="row" style="margin-top:16px"><button type="button" class="btn ghost" data-sheet="cancel">Verwerfen</button><button type="button" class="btn grow" data-sheet="save">Speichern</button></div></div>';
    const q = (sel) => el.querySelector(sel);
    el.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.kind; st.seriesTouched = true; renderSheet(); }));
    el.querySelectorAll('[data-sfach]').forEach((b) => b.addEventListener('click', () => { st.fach = +b.dataset.sfach; if (!st.posTouched) st.pos = nextPos(st.shelfId, st.fach); renderSheet(); }));
    el.querySelectorAll('[data-f]').forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
      const f = inp.dataset.f;
      if (f === 'shelfId') { st.shelfId = inp.value; st.fach = 0; if (!st.posTouched) st.pos = nextPos(st.shelfId, 0); renderSheet(); return; }
      if (f === 'pos') { st.pos = parseInt(inp.value, 10) || null; st.posTouched = true; return; }
      if (f === 'sname' || f === 'svol' || f === 'stotal') st.seriesTouched = true;
      st[f] = inp.value;
      if (f === 'sname') { const x = seriesByName(inp.value); if (x && x.total && !st.stotal) { st.stotal = String(x.total); const t = q('[data-f="stotal"]'); if (t) t.value = st.stotal; } }
    }));
    q('[data-sheet="cancel"]').addEventListener('click', () => { closeSheet(); });
    q('.sheet-backdrop').addEventListener('click', () => { closeSheet(); });
    q('[data-sheet="save"]').addEventListener('click', saveSheet);
  }

  async function saveSheet() {
    const st = sheet;
    if (!st) return;
    if (!st.shelfId) { toast('Bitte ein Regal wählen'); return; }
    const sc = S.scan;
    const bk = st.data && st.data.book;
    const pos = st.pos || nextPos(st.shelfId, st.fach);
    const b = newBook({ isbn: st.isbn, shelfId: st.shelfId, fach: st.fach, pos, needsLookup: !st.dataDone || (st.data && st.data.offline), seriesHintDone: st.seriesTouched || st.kind === 'series' });
    if (bk) {
      ['title', 'subtitle', 'authors', 'publisher', 'year', 'pages', 'language', 'cover', 'description', 'categories', 'sources']
        .forEach((k) => { if (bk[k] && (!Array.isArray(bk[k]) || bk[k].length)) b[k] = bk[k]; });
    } else if (st.dataDone && !st.data.offline) b.needsReview = true;
    if (!b.pages && st.marc && st.marc.pages) b.pages = st.marc.pages;
    await openGap(b.shelfId, b.fach, b.pos);
    if (st.kind === 'series' && st.sname.trim()) {
      const v = parseFloat(String(st.svol).replace(',', '.'));
      const sr = await assignSeries(b, st.sname, isNaN(v) ? null : v);
      const tot = parseInt(st.stotal, 10);
      if (sr && tot && sr.total !== tot) { sr.total = tot; await saveSeries(sr); }
    } else {
      await saveBook(b);
    }
    await bumpBackupCounter(1);
    sc.shelfId = b.shelfId; sc.fach = b.fach;
    const sh = shelfById(b.shelfId);
    logEntry({ key: 'B' + b.id, state: b.needsLookup ? 'laedt' : 'ok', bookId: b.id, info: shelfLabel(sh) + (b.fach ? ' · Fach ' + b.fach : '') + ' · Platz ' + b.pos });
    closeSheet();
    if (b.needsLookup) Lookup.add(b.id);
    else if (!b.cover && b.isbn) Lookup.addCover(b.id);
  }

  async function startCamera() {
    initAudio();
    const video = qs('#video');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast('Kamera nicht verfügbar. Die App muss über https geöffnet sein.', 4000);
      return;
    }
    try {
      await Scanner.start(video, (text) => handleCode(text, false));
      qs('#startbox').classList.add('hidden');
      qs('#stop').classList.remove('hidden');
      if (Scanner.torchSupported()) qs('#torch').classList.remove('hidden');
    } catch (e) {
      const msg = e && e.name === 'NotAllowedError' ? 'Kamera-Zugriff verweigert. In den iOS-Einstellungen erlauben.' : 'Kamera konnte nicht gestartet werden (' + (e && e.name || e) + ').';
      toast(msg, 4500);
    }
  }

  function flash() {
    const f = qs('#frame');
    if (!f) return;
    f.classList.add('hit');
    setTimeout(() => f.classList.remove('hit'), 400);
  }

  function logEntry(entry) {
    const sc = S.scan;
    if (!sc) return;
    const i = sc.log.findIndex((x) => x.key === entry.key);
    if (i >= 0) sc.log[i] = Object.assign(sc.log[i], entry); else sc.log.unshift(entry);
    sc.log = sc.log.slice(0, 30);
    renderLog();
  }

  function renderLog() {
    const ul = qs('#log');
    if (!ul || !S.scan) return;
    ul.innerHTML = S.scan.log.map((e) => {
      const b = e.bookId ? bookById(e.bookId) : null;
      if (e.bookId && !b) return '<li class="card"><div class="grow muted small">Eintrag gelöscht</div></li>';
      const title = b ? (b.title || 'ISBN ' + L.formatIsbn(b.isbn)) : e.title;
      const pill = { laedt: '<span class="pill">lädt …</span>', ok: '<span class="pill">erfasst</span>', leer: '<span class="pill warn">nicht gefunden – Nacharbeiten</span>',
        offline: '<span class="pill warn">offline – wird nachgeholt</span>', dup: '<span class="pill warn">schon vorhanden</span>', fremd: '<span class="pill warn">kein Buch-Barcode</span>',
        bestand: '<span class="pill">im Bestand</span>', neu: '<span class="pill warn">nicht im Bestand</span>', regal: '<span class="pill">Regal gewählt</span>' }[e.state] || '';
      return '<li class="card">' + (b ? coverHtml(b) : '') + '<div class="grow"><div style="font-weight:700">' + esc(title || '') + '</div><div class="muted small">' + esc(e.info || '') + '</div><div class="book-meta">' + pill + '</div></div>' +
        (e.state === 'dup' && b ? '<button class="btn small ghost" data-plus="' + esc(b.id) + '" data-key="' + esc(e.key) + '">+1 Exemplar</button>' : '') +
        (b && e.state !== 'dup' ? '<a class="linkbtn" href="#/buch/' + esc(b.id) + '" aria-label="Öffnen" style="display:flex;align-items:center">' + ICON.chevron + '</a>' : '') + '</li>';
    }).join('');
    ul.querySelectorAll('.cover img').forEach((img) => img.addEventListener('error', () => img.remove(), { once: true }));
    ul.querySelectorAll('[data-plus]').forEach((btn) => btn.addEventListener('click', async () => {
      const b = bookById(btn.dataset.plus);
      b.copies = (b.copies || 1) + 1;
      await saveBook(b);
      logEntry({ key: btn.dataset.key, state: 'ok', info: b.copies + ' Exemplare' });
    }));
  }

  async function handleCode(raw, manual) {
    const sc = S.scan;
    if (!sc) return;
    const text = String(raw || '').trim();
    if (!text) return;
    if (sheet) return;   // Fenster offen: weitere Scans ignorieren
    // Regal-QR
    if (text.indexOf('BIBREGAL:') === 0) {
      const sh = shelfById(text.slice(9));
      if (!sh) { toast('Unbekanntes Regal-Etikett'); return; }
      beep('shelf'); flash();
      if (sc.mode === 'finden') { Scanner.stop(); location.hash = '#/regal/' + sh.id; return; }
      if (sc.shelfId !== sh.id) {
        sc.shelfId = sh.id; sc.fach = 0;
        logEntry({ key: 'R' + Date.now(), state: 'regal', title: sh.name, info: 'ist jetzt vorgewählt' });
      }
      return;
    }
    const isbn = L.normalizeIsbn(text);
    if (!isbn) {
      if (manual) toast('Ungültige ISBN – bitte prüfen');
      else if (/^\d{13}$/.test(text)) logEntry({ key: 'X' + text, state: 'fremd', title: text, info: 'z. B. Preis- oder Händleretikett, ignoriert' });
      return;
    }
    flash();
    const existing = S.books.filter((b) => b.isbn === isbn);
    if (sc.mode === 'finden') {
      if (existing.length) {
        beep('dup');
        const b = existing[0];
        logEntry({ key: 'F' + isbn, state: 'bestand', bookId: b.id, info: shelfLabel(shelfById(b.shelfId)) + (b.pos ? ' · Platz ' + b.pos : '') });
      } else {
        beep('ok');
        logEntry({ key: 'F' + isbn, state: 'neu', title: 'ISBN ' + L.formatIsbn(isbn), info: 'Daten werden gesucht …' });
        L.lookupIsbn(isbn, { googleKey: S.googleKey }).then((r) => logEntry({ key: 'F' + isbn, title: r.book ? r.book.title : 'ISBN ' + L.formatIsbn(isbn), info: r.book ? authorStr(r.book) : (r.offline ? 'offline' : 'keine Daten gefunden') }));
      }
      return;
    }
    if (existing.length) {
      beep('dup');
      const b = existing[0];
      logEntry({ key: 'D' + isbn + Date.now(), state: 'dup', bookId: b.id, info: 'steht in ' + shelfLabel(shelfById(b.shelfId)) + (b.pos ? ', Platz ' + b.pos : '') });
      return;
    }
    beep('ok');
    openScanSheet(isbn);
  }

  Lookup.listeners.add((id, outcome) => {
    if (S.scan) {
      const e = S.scan.log.find((x) => x.bookId === id && x.state === 'laedt');
      if (e) logEntry({ key: e.key, state: outcome });
    }
    if (/^#\/buch\//.test(location.hash) && location.hash.slice(7) === id) viewBook(id);
  });

  // ---------- Weitere Ansichten ----------
  function viewSearch() {
    setTheme('leseecke'); setTab('home');
    const st = viewSearch.q || '';
    $app.innerHTML = head({ title: 'Suchen' }) +
      '<label class="search">' + ICON.search + '<input id="q" type="search" placeholder="Titel, Autor, ISBN oder Notiz" aria-label="Bücher durchsuchen" value="' + esc(st) + '" autocomplete="off"></label>' +
      '<div id="res" style="margin-top:12px"></div>';
    const run = () => {
      const q = qs('#q').value.trim().toLowerCase();
      viewSearch.q = qs('#q').value;
      const box = qs('#res');
      if (!q) { box.innerHTML = '<p class="muted">' + S.books.length + ' Bücher im Bestand.</p><a class="btn ghost block" href="#/scan/finden">Barcode scannen: „Habe ich das schon?“</a>'; return; }
      const isbn = L.normalizeIsbn(q);
      const hits = S.books.filter((b) => (isbn && b.isbn === isbn) ||
        [b.title, b.subtitle, authorStr(b), b.isbn, b.notes, b.publisher, b.seriesId && seriesById(b.seriesId) ? seriesById(b.seriesId).name : ''].join(' ').toLowerCase().includes(q));
      box.innerHTML = hits.length ? '<ul class="books">' + hits.slice(0, 100).map((b) => bookRow(b, { showShelf: true })).join('') + '</ul>'
        : '<p class="empty">Nicht im Bestand.</p>';
      hookCovers(); hookSwipe();
    };
    qs('#q').addEventListener('input', run);
    run();
    if (!st) setTimeout(() => qs('#q') && qs('#q').focus(), 50);
  }

  // ---------- Reihen ----------
  function seriesBar(info) {
    if (!info.total) return '';
    const pct = (n) => (n / info.total * 100).toFixed(1) + '%';
    return '<div aria-hidden="true" style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--surface2);margin-top:8px">' +
      '<div style="width:' + pct(info.read) + ';background:var(--accent)"></div>' +
      '<div style="width:' + pct(info.owned - info.read) + ';background:var(--accent);opacity:.35"></div></div>';
  }

  const VOL_ICON = {
    read: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6"></path></svg>',
    reading: '<svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="#B26A00" stroke-width="3"></circle><path d="M12 3a9 9 0 0 1 0 18z" fill="#B26A00"></path></svg>',
    owned: '<svg aria-hidden="true" width="8" height="8" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="currentColor"></circle></svg>'
  };
  const VOL_TEXT = { read: 'gelesen', reading: 'angefangen', owned: 'vorhanden, ungelesen', missing: 'noch nicht gekauft' };

  function viewSeriesList() {
    setTheme('leseecke'); setTab('reihen');
    const list = S.series.map((sr) => ({ sr, info: seriesInfo(sr) }))
      .sort((a, b) => (a.sr.author || '\uffff').localeCompare(b.sr.author || '\uffff', 'de') || a.sr.name.localeCompare(b.sr.name, 'de'));
    let html = head({ title: 'Reihen', sub: list.length + (list.length === 1 ? ' Reihe' : ' Reihen') });
    const hints = {};
    S.books.filter((b) => b.seriesHint && !b.seriesId).forEach((b) => { const k = b.seriesHint.name; (hints[k] = hints[k] || []).push(b); });
    const hintNames = Object.keys(hints).sort((a, b) => a.localeCompare(b, 'de'));
    if (hintNames.length) {
      html += '<section class="card" style="padding:12px 16px;margin-bottom:14px;background:var(--warn-bg)"><b>Erkannte Reihen bestätigen</b><div class="stack" style="margin-top:8px;gap:10px">' +
        hintNames.map((n, i) => '<div class="row" style="flex-wrap:wrap"><div class="grow" style="min-width:160px"><b>' + esc(n) + '</b><div class="muted small">' + hints[n].length + (hints[n].length === 1 ? ' Buch' : ' Bücher') + ' · Band ' +
          hints[n].map((b) => fmtVol(b.seriesHint.volume)).sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ') + '</div></div>' +
          '<button class="btn small" data-take="' + i + '">Übernehmen</button><button class="btn small ghost" data-skip="' + i + '">Ignorieren</button></div>').join('') + '</div></section>';
    }
    html += '<div class="vol-legend" aria-hidden="true">' +
      '<span class="vol read">' + VOL_ICON.read + ' gelesen</span><span class="vol reading">' + VOL_ICON.reading + ' angefangen</span>' +
      '<span class="vol owned">' + VOL_ICON.owned + ' ungelesen</span><span class="vol missing">nicht gekauft</span></div>';
    if (!list.length) html += '<p class="empty">Noch keine Reihen. Im Buch unter „Reihe“ zuordnen oder unten anlegen.</p>';
    html += '<ol class="series-list">' + list.map(({ sr, info }) => {
      const chips = info.rows.map((r) => {
        const st = r.read ? 'read' : r.reading ? 'reading' : r.owned ? 'owned' : 'missing';
        const label = 'B' + fmtVol(r.volume);
        const aria = 'Band ' + fmtVol(r.volume) + ': ' + VOL_TEXT[st];
        const inner = label + (VOL_ICON[st] || '');
        if (r.owned) return '<a class="vol ' + st + '" href="#/buch/' + esc(r.books[0].id) + '" aria-label="' + aria + '">' + inner + '</a>';
        const q = encodeURIComponent([sr.name, 'Band ' + fmtVol(r.volume), sr.author].filter(Boolean).join(' '));
        return '<a class="vol missing" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + q + '" aria-label="' + aria + ', im Web suchen">' + inner + '</a>';
      }).join('');
      return '<li class="card series-row"><a class="series-title" href="#/reihe/' + esc(sr.id) + '">' +
        (sr.author ? '<span class="muted">' + esc(sr.author) + ' – </span>' : '') + '<b>' + esc(sr.name) + '</b>' +
        ' <span class="muted small">(' + (info.totalKnown ? info.total : 'mind. ' + info.total) + ' ' + (info.total === 1 ? 'Band' : 'Bände') + ')</span></a>' +
        '<div class="vols">' + chips + (info.noVolume.length ? '<span class="muted small">+ ' + info.noVolume.length + ' ohne Bandnr.</span>' : '') + '</div>' +
        (!info.totalKnown ? '<form class="row total-form" data-sid="' + esc(sr.id) + '" style="margin-top:10px;gap:8px"><label class="muted small grow" for="t-' + esc(sr.id) + '">Wie viele Bände hat die Reihe?</label>' +
          '<input class="input" id="t-' + esc(sr.id) + '" name="total" type="number" inputmode="numeric" min="1" max="200" style="width:72px;min-height:36px;padding:4px 8px">' +
          '<button class="btn small" type="submit">OK</button></form>' : '') + '</li>';
    }).join('') + '</ol>';
    html += '<a class="btn ghost block" href="#/reihe/neu" style="margin-top:14px">+ Reihe von Hand anlegen</a>' +
      '<p class="muted small" style="text-align:center">Für Reihen, von denen noch kein Band im Regal steht.</p>';
    $app.innerHTML = html;
    qsa('.total-form').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const n = parseInt(f.total.value, 10);
      const sr = seriesById(f.dataset.sid);
      if (!n || !sr) return;
      sr.total = n; await saveSeries(sr);
      refresh();
    }));
    on('[data-take]', 'click', async (e) => {
      const n = hintNames[+e.currentTarget.dataset.take];
      for (const b of hints[n]) await assignSeries(b, n, b.seriesHint.volume);
      toast('„' + n + '“ übernommen');
      refresh();
    });
    on('[data-skip]', 'click', async (e) => {
      const n = hintNames[+e.currentTarget.dataset.skip];
      for (const b of hints[n]) { b.seriesHint = null; b.seriesHintDone = true; await saveBook(b); }
      refresh();
    });
  }

  function viewSeries(id) {
    const sr = seriesById(id);
    if (!sr) return notFound();
    setTheme('leseecke'); setTab('home');
    const info = seriesInfo(sr);
    let html = head({ back: '#/reihen', backLabel: 'Reihen', title: sr.name, sub: sr.author || '' });
    html += '<div class="stats" style="grid-template-columns:repeat(4,minmax(0,1fr))">' +
      '<div class="stat"><b>' + (info.totalKnown ? info.total : info.total + '+') + '</b><span>Bände</span></div>' +
      '<div class="stat"><b>' + info.read + '</b><span>gelesen</span></div>' +
      '<div class="stat"><b>' + info.owned + '</b><span>gekauft</span></div>' +
      '<div class="stat"><b>' + info.missing + '</b><span>fehlen</span></div></div>';
    if (!info.totalKnown) html += '<p class="muted small" style="margin:8px 0 0">Gesamtzahl der Bände unbekannt. Unten unter „Reihe bearbeiten“ eintragen, dann zeigt die App auch fehlende Bände am Ende an.</p>';
    html += seriesBar(info);
    html += '<ul class="books" style="margin-top:12px">' + info.rows.map((r) => {
      const b = r.books[0];
      const label = 'Band ' + fmtVol(r.volume);
      if (!r.owned) {
        const q = encodeURIComponent([sr.name, label, sr.author].filter(Boolean).join(' '));
        return '<li class="book" style="opacity:.85"><div class="cover" style="width:40px;height:58px" aria-hidden="true"><span class="ini" style="font-size:14px">' + fmtVol(r.volume) + '</span></div>' +
          '<div class="grow"><div style="font-weight:700">' + label + '</div><div class="book-meta"><span class="pill warn">noch nicht gekauft</span></div></div>' +
          '<a class="linkbtn small" target="_blank" rel="noopener" href="https://www.google.com/search?q=' + q + '">suchen</a></li>';
      }
      const pill = r.read ? '<span class="pill">gelesen</span>' : r.reading ? '<span class="pill">liest gerade</span>' : '<span class="pill">gekauft, ungelesen</span>';
      return '<li><a class="book" href="#/buch/' + esc(b.id) + '">' + coverHtml(b).replace('class="cover"', 'class="cover" style="width:40px;height:58px"') +
        '<div class="grow"><div class="muted small" style="font-weight:700">' + label + '</div><div style="font-weight:700">' + esc(b.title || 'ISBN ' + L.formatIsbn(b.isbn)) + '</div>' +
        '<div class="book-meta">' + pill + ratingHtml(b.rating) + '<span class="muted small">' + esc(shelfLabel(shelfById(b.shelfId))) + '</span></div></div></a></li>';
    }).join('') + '</ul>';
    if (info.noVolume.length) {
      html += '<p class="muted small" style="margin:14px 0 4px">Ohne Bandnummer (im Buch unter „Reihe“ eintragen):</p><ul class="books">' + info.noVolume.map((b) => bookRow(b)).join('') + '</ul>';
    }
    html += '<details class="card" style="margin-top:16px"><summary>Reihe bearbeiten</summary><form class="form" id="sredit" style="padding-bottom:16px">' +
      '<label class="field">Name<input class="input" name="name" required value="' + esc(sr.name) + '"></label>' +
      '<label class="field">Autor<input class="input" name="author" value="' + esc(sr.author || '') + '"></label>' +
      '<label class="field">Anzahl Bände (leer = unbekannt)<input class="input" name="total" type="number" inputmode="numeric" min="1" max="200" value="' + (sr.total || '') + '"></label>' +
      '<button class="btn block" type="submit">Speichern</button>' +
      '<button class="btn danger block" type="button" data-act="delseriesall">Reihe mit allen Büchern löschen</button>' +
      '<button class="btn ghost block" type="button" data-act="delseries">Nur Reihe auflösen, Bücher behalten</button></form></details>';
    $app.innerHTML = html;
    hookCovers();
    qs('#sredit').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      sr.name = f.name.value.trim() || sr.name;
      sr.author = f.author.value.trim();
      sr.total = parseInt(f.total.value, 10) || null;
      await saveSeries(sr);
      toast('Gespeichert');
      viewSeries(id);
    });
    on('[data-act="delseriesall"]', 'click', async () => {
      const own = S.books.filter((x) => x.seriesId === id);
      if (!confirm('Reihe „' + sr.name + '“ und ' + own.length + (own.length === 1 ? ' Buch' : ' Bücher') + ' endgültig löschen?')) return;
      for (const b of own) await deleteBook(b.id);
      await DB.del('series', id);
      S.series = S.series.filter((x) => x.id !== id);
      toast('Reihe und ' + own.length + ' Bücher gelöscht');
      location.hash = '#/reihen';
    });
    on('[data-act="delseries"]', 'click', async () => {
      if (!confirm('Reihe „' + sr.name + '“ auflösen? Die Bücher bleiben in der Bibliothek.')) return;
      for (const b of S.books.filter((x) => x.seriesId === id)) { b.seriesId = null; b.volume = null; b.seriesHintDone = true; await saveBook(b); }
      await DB.del('series', id);
      S.series = S.series.filter((x) => x.id !== id);
      location.hash = '#/reihen';
    });
  }

  function viewSeriesNew() {
    setTheme('leseecke'); setTab('home');
    $app.innerHTML = head({ back: '#/reihen', backLabel: 'Reihen', title: 'Neue Reihe' }) +
      '<form class="form card" id="srnew" style="padding:16px">' +
      '<label class="field">Name<input class="input" name="name" required placeholder="z. B. Dreams in Rome"></label>' +
      '<label class="field">Autor<input class="input" name="author"></label>' +
      '<label class="field">Anzahl Bände (leer = unbekannt)<input class="input" name="total" type="number" inputmode="numeric" min="1" max="200"></label>' +
      '<button class="btn block" type="submit">Anlegen</button></form>' +
      '<p class="muted small">Bücher ordnest du danach in der Buchansicht unter „Reihe“ zu. Beim Scannen schlägt die App die Reihe oft selbst vor.</p>';
    qs('#srnew').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const name = f.name.value.trim();
      if (!name) return;
      if (seriesByName(name)) { toast('Diese Reihe gibt es schon'); return; }
      const sr = await saveSeries({ id: uid() + uid(), name, author: f.author.value.trim(), total: parseInt(f.total.value, 10) || null, createdAt: now() });
      location.hash = '#/reihe/' + sr.id;
    });
  }

  // ---------- Lesestatistik ----------
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const monthLabel = (ym) => MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
  /** Gelesene Bücher eines Monats (ym = "2026-11") oder Jahres (ym = "2026"). */
  const readIn = (ym) => S.books.filter((b) => b.status === 'gelesen' && b.finishedAt && b.finishedAt.indexOf(ym) === 0);

  function viewStats(yearArg) {
    setTheme('leseecke'); setTab('home');
    const done = S.books.filter((b) => b.status === 'gelesen' && b.finishedAt);
    const undated = S.books.filter((b) => b.status === 'gelesen' && !b.finishedAt);
    const years = Array.from(new Set(done.map((b) => b.finishedAt.slice(0, 4)).concat([todayIso().slice(0, 4)]))).sort().reverse();
    const year = years.includes(yearArg) ? yearArg : years[0];
    const yBooks = readIn(year);
    const yPages = yBooks.reduce((n, b) => n + (b.pages || 0), 0);
    const yNoPages = yBooks.filter((b) => !b.pages).length;
    const months = MONTHS.map((_, i) => {
      const ym = year + '-' + String(i + 1).padStart(2, '0');
      const list = readIn(ym).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
      return { ym, list, pages: list.reduce((n, b) => n + (b.pages || 0), 0) };
    });
    const maxPages = Math.max(1, ...months.map((m) => m.pages));
    const nowYm = todayIso().slice(0, 7);

    let html = head({ back: '#/', backLabel: 'Bibliothek', title: 'Lesestatistik' });
    html += '<div class="chips" role="group" aria-label="Jahr">' + years.map((y) => '<a class="chip" style="display:inline-flex;align-items:center;text-decoration:none" href="#/statistik/' + y + '" aria-pressed="' + (y === year) + '">' + y + '</a>').join('') + '</div>';
    html += '<div class="stats"><div class="stat"><b>' + yBooks.length + '</b><span>Bücher</span></div><div class="stat"><b>' + fmtNum(yPages) + '</b><span>Seiten</span></div><div class="stat"><b>' + (yBooks.length - yNoPages ? fmtNum(Math.round(yPages / (yBooks.length - yNoPages))) : '–') + '</b><span>Ø Seiten</span></div></div>';
    if (yNoPages) html += '<p class="muted small" style="margin:8px 0 0">Bei ' + yNoPages + (yNoPages === 1 ? ' Buch fehlt' : ' Büchern fehlt') + ' die Seitenzahl. Im Buch unter „Daten bearbeiten“ nachtragen.</p>';
    html += '<div class="stack" style="margin-top:16px">';
    months.slice().reverse().forEach((m) => {
      if (m.ym > nowYm) return;
      if (!m.list.length) { html += '<div class="row muted small" style="padding:2px 16px"><span class="grow">' + MONTHS[+m.ym.slice(5) - 1] + '</span><span>–</span></div>'; return; }
      const w = Math.round(m.pages / maxPages * 100);
      html += '<section class="card" style="padding:12px 16px"><div class="row"><b class="grow" style="font-family:var(--font-title)">' + MONTHS[+m.ym.slice(5) - 1] + '</b>' +
        '<span class="muted small">' + m.list.length + (m.list.length === 1 ? ' Buch' : ' Bücher') + ' · ' + fmtNum(m.pages) + ' Seiten</span></div>' +
        '<div aria-hidden="true" style="height:6px;border-radius:3px;background:var(--surface2);margin:8px 0 ' + (m.list.length ? '6px' : '0') + '"><div style="height:100%;width:' + w + '%;border-radius:3px;background:var(--accent)"></div></div>' +
        (m.list.length ? '<ul class="books">' + m.list.map((b) => '<li><a class="book" href="#/buch/' + esc(b.id) + '" style="padding:8px 0">' + coverHtml(b).replace('class="cover"', 'class="cover" style="width:36px;height:52px"') +
          '<div class="grow"><div style="font-weight:700">' + esc(b.title || ('ISBN ' + L.formatIsbn(b.isbn))) + '</div><div class="muted small">' + esc(authorStr(b) || '–') + ' · ' + (b.pages ? fmtNum(b.pages) + ' S.' : 'Seiten fehlen') + ' · ' + fmtDate(b.finishedAt) + '</div></div>' + ratingHtml(b.rating) + '</a></li>').join('') + '</ul>' : '') +
        '</section>';
    });
    html += '</div>';
    if (undated.length) {
      html += '<section class="card" style="padding:12px 16px;margin-top:16px"><b>Gelesen, ohne Datum (' + undated.length + ')</b><p class="muted small" style="margin:4px 0 8px">Im Buch „Gelesen am“ eintragen, dann zählt es im richtigen Monat.</p><ul class="books">' +
        undated.map((b) => '<li><a class="book" href="#/buch/' + esc(b.id) + '" style="padding:8px 0"><div class="grow"><div style="font-weight:700">' + esc(b.title || b.isbn) + '</div><div class="muted small">' + esc(authorStr(b) || '–') + '</div></div>' + ICON.chevron + '</a></li>').join('') + '</ul></section>';
    }
    $app.innerHTML = html;
    hookCovers();
  }

  /** Alle Bücher über alle Regale, mit Statusfilter und Sortierung. */
  function viewBooks(filter) {
    setTheme('leseecke'); setTab('buecher');
    const FILTERS = [['alle', 'Alle'], ['ungelesen', 'Ungelesen'], ['liest', 'Liest gerade'], ['gelesen', 'Gelesen'], ['abgebrochen', 'Abgebrochen']];
    const f = FILTERS.some(([k]) => k === filter) ? filter : 'alle';
    const sort = viewBooks.sort || 'titel';
    const sorters = {
      titel: (a, b) => (a.title || '').localeCompare(b.title || '', 'de'),
      autor: (a, b) => authorStr(a).localeCompare(authorStr(b), 'de') || (a.title || '').localeCompare(b.title || '', 'de'),
      regal: (a, b) => shelfLabel(shelfById(a.shelfId)).localeCompare(shelfLabel(shelfById(b.shelfId)), 'de', { numeric: true }) || (a.fach || 0) - (b.fach || 0) || (a.pos || 1e9) - (b.pos || 1e9),
      neu: (a, b) => (b.addedAt || '').localeCompare(a.addedAt || '')
    };
    const list = S.books.filter((b) => f === 'alle' || b.status === f).sort(sorters[sort] || sorters.titel);
    const count = (k) => k === 'alle' ? S.books.length : S.books.filter((b) => b.status === k).length;
    const title = { alle: 'Alle Bücher', ungelesen: 'Ungelesen', liest: 'Liest gerade', gelesen: 'Gelesen', abgebrochen: 'Abgebrochen' }[f];
    let html = head({ title, sub: list.length + (list.length === 1 ? ' Buch' : ' Bücher') });
    html += '<div class="chips" role="group" aria-label="Lesestatus">' + FILTERS.map(([k, l]) => '<a class="chip" style="display:inline-flex;align-items:center;text-decoration:none" href="#/buecher/' + k + '" aria-pressed="' + (k === f) + '">' + l + ' <span style="opacity:.7;margin-left:6px">' + count(k) + '</span></a>').join('') + '</div>';
    html += '<div class="row" style="margin:12px 0 6px;justify-content:flex-end"><label class="sr-only" for="bsort">Sortierung</label><select id="bsort" class="input" style="width:auto;min-height:36px;padding:4px 10px;font-size:14px">' +
      [['titel', 'Titel'], ['autor', 'Autor'], ['regal', 'Regal'], ['neu', 'Zuletzt erfasst']].map(([v, l]) => '<option value="' + v + '"' + (sort === v ? ' selected' : '') + '>' + l + '</option>').join('') + '</select></div>';
    html += list.length ? '<ul class="books">' + list.map((b) => bookRow(b, { showShelf: true })).join('') + '</ul>' : '<p class="empty">Keine Bücher mit diesem Status.</p>';
    $app.innerHTML = html;
    hookCovers(); hookSwipe();
    on('#bsort', 'change', (e) => { viewBooks.sort = e.currentTarget.value; refresh(); });
  }

  function viewReview() {
    setTheme('leseecke'); setTab('mehr');
    const list = S.books.filter((b) => b.needsReview || b.needsLookup);
    $app.innerHTML = head({ back: '#/', backLabel: 'Bibliothek', title: 'Nacharbeiten' }) +
      (list.some((b) => b.needsLookup) ? '<button class="btn ghost block" data-act="retry" style="margin-bottom:12px">Fehlende Daten erneut abfragen</button>' : '') +
      (list.length ? '<ul class="books">' + list.map((b) => bookRow(b, { showShelf: true })).join('') + '</ul>' : '<p class="empty">Alles erledigt.</p>');
    hookCovers(); hookSwipe();
    on('[data-act="retry"]', 'click', () => { Lookup.retryPending(); toast('Wird abgefragt …'); });
  }

  async function viewMore() {
    setTheme('leseecke'); setTab('mehr');
    const lastBackup = await DB.getMeta('lastBackupAt', null);
    const since = await DB.getMeta('booksSinceBackup', 0);
    let persisted = null;
    try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { persisted = null; }
    const review = S.books.filter((b) => b.needsReview || b.needsLookup).length;
    const noCover = S.books.filter((b) => !b.cover && b.isbn).length;
    const noSeriesCheck = S.books.filter((b) => b.isbn && !b.seriesId && !b.seriesHint && !b.seriesHintDone && !b.seriesChecked).length;
    $app.innerHTML = head({ title: 'Mehr' }) +
      '<div class="stack">' +
      '<section class="card" style="padding:16px"><h2 style="font-family:var(--font-title);font-size:18px">Sicherung</h2>' +
      '<p class="muted small">Letzte Sicherung: ' + (lastBackup ? fmtDate(lastBackup) : 'noch nie') + ' · seitdem ' + since + ' neue Bücher.<br>Beim Sichern „In Dateien sichern“ → <b>iCloud Drive</b> wählen.</p>' +
      '<div class="stack"><button class="btn block" data-act="export">Jetzt sichern</button>' +
      '<label class="btn ghost block" style="cursor:pointer">Sicherung wiederherstellen<input type="file" id="imp" accept="application/json,.json" class="sr-only"></label></div></section>' +
      '<section class="card" style="padding:16px"><h2 style="font-family:var(--font-title);font-size:18px">Google Books</h2>' +
      '<p class="muted small">Ohne eigenen Schlüssel ist Google Books fast immer gesperrt (Kontingent erschöpft). Der Schlüssel bleibt nur auf diesem Gerät.</p>' +
      '<form class="row" id="gkey"><label class="sr-only" for="gk">Google-API-Schlüssel</label><input class="input grow" id="gk" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="API-Schlüssel einfügen" value="' + esc(S.googleKey) + '"><button class="btn small" type="submit">Speichern</button></form>' +
      '</section>' +
      '<section class="card" style="padding:16px"><h2 style="font-family:var(--font-title);font-size:18px">Cover</h2>' +
      '<p class="muted small">Fehlt ein Cover, sucht die App automatisch weiter: Google-Bild (ohne Schlüssel), dann Open Library.</p>' +
      '<p class="muted small">Findet keine Quelle ein Cover: in der Buchansicht „Im Web suchen“, Bild lange drücken → „Kopieren“, zurück in die App → „Cover einfügen“.</p>' +
      (noCover ? '<button class="btn ghost block" data-act="covers" style="margin-top:12px">Fehlende Cover nachladen (' + noCover + ')</button>' : '<p class="muted small" style="margin-bottom:0">Alle Bücher mit ISBN haben ein Cover.</p>') + '</section>' +
      '<a class="card row" href="#/nacharbeiten" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Nacharbeiten</span><span class="pill' + (review ? ' warn' : '') + '">' + review + '</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/buch/neu" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Buch ohne ISBN hinzufügen</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/etiketten" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Regal-Etiketten (QR) drucken</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/statistik" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Lesestatistik</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/reihen" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Reihen</span>' + ICON.chevron + '</a>' +
      (noSeriesCheck ? '<button class="btn ghost block" data-act="detectseries">Reihen erkennen für vorhandene Bücher (' + noSeriesCheck + ')</button>' : '') +
      '<a class="card row" href="#/diagnose" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Datenquellen testen</span>' + ICON.chevron + '</a>' +
      '<p class="muted small">Speicher dauerhaft: ' + (persisted === null ? 'unbekannt' : persisted ? 'ja' : 'nein') + ' · Version ' + APP_VERSION + ' · ' + S.books.length + ' Einträge</p></div>';
    on('[data-act="export"]', 'click', exportData);
    qs('#gkey').addEventListener('submit', async (e) => {
      e.preventDefault();
      S.googleKey = qs('#gk').value.trim();
      await DB.setMeta('googleKey', S.googleKey);
      toast(S.googleKey ? 'Schlüssel gespeichert – jetzt „Datenquellen testen“' : 'Schlüssel entfernt');
    });
    on('[data-act="detectseries"]', 'click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      const list = S.books.filter((b) => b.isbn && !b.seriesId && !b.seriesHint && !b.seriesHintDone && !b.seriesChecked);
      let found = 0, done = 0;
      for (const b of list) {
        btn.textContent = 'Prüfe ' + (++done) + ' von ' + list.length + ' …';
        const m = await L.lookupSeries(b.isbn);
        if (m === null) continue;   // nicht erreichbar: später erneut
        b.seriesChecked = true;
        if (!b.pages && m.pages) b.pages = m.pages;
        const hint = m.series[0];
        if (hint) {
          found++;
          const sr = seriesByName(hint.name);
          if (sr) { b.seriesId = sr.id; b.volume = hint.volume; } else b.seriesHint = hint;
        }
        await saveBook(b);
      }
      toast(found ? found + ' Bücher gehören zu einer Reihe. Vorschläge im jeweiligen Buch bestätigen.' : 'Keine Reihen gefunden', 4500);
      if (location.hash === '#/mehr') viewMore();
    });
    on('[data-act="covers"]', 'click', () => {
      const list = S.books.filter((b) => !b.cover && b.isbn);
      list.forEach((b) => Lookup.addCover(b.id));
      toast(list.length + ' Bücher werden abgefragt …', 3500);
      let left = list.length;
      const ids = new Set(list.map((b) => b.id));
      const fn = (id) => { if (ids.has(id) && --left === 0) { Lookup.listeners.delete(fn); const n = list.filter((b) => bookById(b.id) && bookById(b.id).cover).length; toast(n + ' von ' + list.length + ' Covern gefunden', 4000); if (location.hash === '#/mehr') viewMore(); } };
      Lookup.listeners.add(fn);
    });
    qs('#imp').addEventListener('change', importData);
  }

  function qrSvg(text, cell) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: cell || 6, margin: 2, scalable: true });
  }

  function viewLabels() {
    setTheme('leseecke'); setTab('mehr');
    $app.innerHTML = '<div class="noprint">' + head({ back: '#/mehr', backLabel: 'Mehr', title: 'Regal-Etiketten' }) +
      '<p class="muted small">Drucken oder je Etikett als SVG für den Laser laden. Mindestens 2–3 cm Kantenlänge. Gescannt wird nur in der App.</p>' +
      '<button class="btn block" data-act="print" style="margin-bottom:14px">Drucken / als PDF sichern</button></div>' +
      (S.shelves.length ? '<div class="labels">' + S.shelves.map((s) => '<div class="label">' + qrSvg('BIBREGAL:' + s.id) +
        '<b>' + esc(s.name) + '</b><span>' + esc(s.room || '') + '</span><button class="btn small ghost noprint" data-svg="' + esc(s.id) + '">SVG laden</button></div>').join('') + '</div>'
        : '<p class="empty">Noch keine Regale.</p>');
    on('[data-act="print"]', 'click', () => window.print());
    on('[data-svg]', 'click', (e) => {
      const s = shelfById(e.currentTarget.dataset.svg);
      let svg = qrSvg('BIBREGAL:' + s.id, 10);
      if (!/xmlns=/.test(svg)) svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      download(new Blob([svg], { type: 'image/svg+xml' }), 'etikett-' + s.name.replace(/[^\w-]+/g, '_') + '.svg');
    });
  }

  async function viewDiag() {
    setTheme('leseecke'); setTab('mehr');
    const last = await DB.getMeta('lastSourceStatus', null);
    const label = { ok: 'erreichbar, Treffer', leer: 'erreichbar, kein Treffer', fehler: 'nicht erreichbar (Netz oder CORS)' };
    const table = (st, er) => '<dl class="kv">' + ['dnb', 'google', 'openlibrary'].map((k) => '<dt>' + ({ dnb: 'DNB', google: 'Google Books', openlibrary: 'Open Library' }[k]) + '</dt><dd>' + esc(label[st[k]] || '–') + (er && er[k] ? ' <span class="muted small">(' + esc(er[k]) + ')</span>' : '') + '</dd>').join('') + '</dl>' +
      '<p class="muted small">Google-Schlüssel: ' + (S.googleKey ? 'eingetragen' : 'keiner') + '</p>';
    $app.innerHTML = head({ back: '#/mehr', backLabel: 'Mehr', title: 'Datenquellen' }) +
      '<div class="card" style="padding:16px"><p class="muted small" style="margin-top:0">Fragt eine Test-ISBN bei allen drei Quellen ab. „nicht erreichbar“ bei der DNB, während die anderen gehen, heißt: Die DNB erlaubt keinen Zugriff aus dem Browser (CORS).</p>' +
      '<label class="field">Test-ISBN<input class="input" id="tisbn" inputmode="numeric" value="9783551354013"></label>' +
      '<button class="btn block" data-act="test" style="margin-top:12px">Test starten</button><div id="out" style="margin-top:14px"></div></div>' +
      (last ? '<div class="card" style="padding:16px;margin-top:14px"><b>Letzte echte Abfrage</b><p class="muted small">' + esc(L.formatIsbn(last.isbn)) + ' · ' + new Date(last.at).toLocaleString('de-DE') + '</p>' + table(last.status, last.errors) + '</div>' : '');
    on('[data-act="test"]', 'click', async () => {
      const isbn = L.normalizeIsbn(qs('#tisbn').value);
      const out = qs('#out');
      if (!isbn) { out.textContent = 'ISBN ungültig.'; return; }
      out.innerHTML = '<p class="muted">Frage ab …</p>';
      const t0 = performance.now();
      const r = await L.lookupIsbn(isbn, { googleKey: S.googleKey });
      out.innerHTML = table(r.status, r.errors) + '<p class="small muted">Dauer: ' + Math.round(performance.now() - t0) + ' ms</p>' +
        (r.book ? '<p><b>' + esc(r.book.title) + '</b><br>' + esc(authorStr(r.book)) + '</p>' : '<p>Kein Treffer.</p>') +
        '<div id="covtest"><p class="muted small">Cover-Suche läuft …</p></div>';
      const c = await findCover(isbn);
      const lab = { ok: 'Cover gefunden', kein: 'kein Cover', fehler: 'nicht erreichbar', aus: 'ausgeschaltet' };
      const box = qs('#covtest');
      if (box) box.innerHTML = '<p style="margin:12px 0 6px"><b>Cover-Quellen</b>' + (r.book && r.book.cover ? ' <span class="muted small">(Datenquelle liefert schon eins)</span>' : '') + '</p><dl class="kv">' +
        Object.keys(COVER_LABEL).map((k) => '<dt>' + COVER_LABEL[k] + '</dt><dd>' + esc(lab[c.tried[k]] || 'nicht nötig') + '</dd>').join('') + '</dl>' +
        (c.url ? '<div class="row" style="margin-top:10px">' + coverHtml({ title: '?', cover: c.url }) + '<span class="muted small">' + esc(COVER_LABEL[c.source]) + '</span></div>' : '');
      hookCovers();
    });
  }

  function notFound() {
    setTheme('leseecke');
    $app.innerHTML = head({ back: '#/', backLabel: 'Bibliothek', title: 'Nicht gefunden' }) + '<p class="muted">Diesen Eintrag gibt es nicht (mehr).</p>';
  }

  // ---------- Sicherung ----------
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function exportData() {
    const data = { app: 'bibliothek', version: 2, exportedAt: now(), shelves: S.shelves, books: S.books, series: S.series };
    const name = 'bibliothek-' + new Date().toISOString().slice(0, 10) + '.json';
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    let done = false;
    try {
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Bibliothek-Sicherung' });
        done = true;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') { toast('Sicherung abgebrochen'); return; }
    }
    if (!done) { download(blob, name); done = true; }
    await DB.setMeta('lastBackupAt', now());
    await DB.setMeta('booksSinceBackup', 0);
    toast('Sicherung erstellt (' + S.books.length + ' Bücher)');
    route();
  }

  async function importData(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (err) { toast('Datei ist keine gültige Sicherung'); return; }
    if (!data || data.app !== 'bibliothek' || !Array.isArray(data.books) || !Array.isArray(data.shelves)) { toast('Datei ist keine Bibliothek-Sicherung'); return; }
    if (!confirm('Aktuellen Bestand (' + S.books.length + ' Bücher) durch die Sicherung vom ' + fmtDate(data.exportedAt) + ' (' + data.books.length + ' Bücher) ersetzen?')) return;
    await DB.clear('books'); await DB.clear('shelves'); await DB.clear('series');
    if (Array.isArray(data.series)) await DB.putMany('series', data.series);
    await DB.putMany('shelves', data.shelves);
    await DB.putMany('books', data.books);
    await DB.setMeta('booksSinceBackup', 0);
    await load();
    toast('Wiederhergestellt: ' + S.books.length + ' Bücher');
    location.hash = '#/';
  }

  // ---------- Router ----------
  function route(keepScroll) {
    const h = location.hash || '#/';
    if (!/^#\/scan/.test(h)) { Scanner.stop(); closeSheet(); }
    const p = h.slice(2).split('/');
    if (keepScroll !== true) window.scrollTo(0, 0);
    if (!p[0]) return viewHome();
    if (p[0] === 'regal' && p[1] === 'neu') return viewShelfForm(null);
    if (p[0] === 'regal' && p[2] === 'bearbeiten') return viewShelfForm(p[1]);
    if (p[0] === 'regal' && p[1]) return viewShelf(p[1]);
    if (p[0] === 'buch' && p[1] === 'neu') return viewManualAdd(p[2] || '');
    if (p[0] === 'buch' && p[1]) return viewBook(p[1]);
    if (p[0] === 'scan') return viewScan(p[1] === 'finden' ? 'finden' : 'erfassen', p[1] === 'regal' ? p[2] : '');
    if (p[0] === 'suche') return viewSearch();
    if (p[0] === 'buecher') return viewBooks(p[1] || 'alle');
    if (p[0] === 'statistik') return viewStats(p[1] || '');
    if (p[0] === 'reihen') return viewSeriesList();
    if (p[0] === 'reihe' && p[1] === 'neu') return viewSeriesNew();
    if (p[0] === 'reihe' && p[1]) return viewSeries(p[1]);
    if (p[0] === 'verliehen') { location.replace('#/buecher/alle'); return; }
    if (p[0] === 'nacharbeiten') return viewReview();
    if (p[0] === 'mehr') return viewMore();
    if (p[0] === 'etiketten') return viewLabels();
    if (p[0] === 'diagnose') return viewDiag();
    return notFound();
  }

  window.addEventListener('hashchange', () => route());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Scanner.stop(); else if (/^#\/scan/.test(location.hash) && S.scan) route(); });

  (async function init() {
    try {
      await load();
    } catch (e) {
      $app.innerHTML = '<p class="empty">Speicher nicht verfügbar (' + esc(e && e.message) + '). Privates Surfen deaktivieren.</p>';
      return;
    }
    DB.persist();
    route();
    Lookup.retryPending();
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => { /* egal */ });
    }
  })();

  // Für Tests
  window.__bib = { S, handleCode, Lookup, Scanner, load, route };
})();
