/* Bibliothek – Oberfläche */
(function () {
  'use strict';
  const L = window.BibLib;
  const APP_VERSION = '0.1.1';
  const $app = document.getElementById('app');

  const THEMES = { leseecke: 'Leseecke', horror: 'Horror', romantasy: 'Romantasy', fantasy: 'Fantasy' };
  const THEME_COLOR = { leseecke: '#F6EEE3', horror: '#121013', romantasy: '#FBF0EE', fantasy: '#EFE8D6' };
  const SPINES = {
    leseecke: ['#8A5A35', '#B8865B', '#5E3B22', '#C9A37A', '#7A4A2A', '#A0703F', '#4A2E1A', '#D2B48C', '#93623A', '#6B4428', '#BC8F5F', '#55351F'],
    horror: ['#2B1B1E', '#5A1A1A', '#1F2326', '#3A2F2A', '#7A1F1F', '#141414', '#4B3B33', '#2E2124', '#601C1C', '#24282B', '#3D1515', '#1A1A1D'],
    romantasy: ['#D9A3B4', '#B5739A', '#E8C4C8', '#C9A45C', '#9C7BB0', '#F0D4D8', '#7E4E6E', '#D4B5E0', '#C27C93', '#B9A06A', '#E6B9C5', '#8F6AA3'],
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
  const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('de-DE') : '';
  const qs = (sel) => $app.querySelector(sel);
  const qsa = (sel) => Array.from($app.querySelectorAll(sel));
  const on = (sel, ev, fn) => qsa(sel).forEach((el) => el.addEventListener(ev, fn));
  const shelfById = (id) => S.shelves.find((s) => s.id === id);
  const bookById = (id) => S.books.find((b) => b.id === id);
  const booksIn = (shelfId) => S.books.filter((b) => b.shelfId === shelfId);
  const authorStr = (b) => (b.authors || []).join(', ');
  const shelfLabel = (s) => s ? s.name : 'ohne Regal';

  function toast(msg, ms) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.setAttribute('role', 'status');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms || 2600);
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
    back: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>',
    chevron: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>',
    search: '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>',
    star: (filled) => '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"></path></svg>',
    heart: (filled) => '<svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="' + (filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.2 3.4 4.5 7 4.5c2.1 0 3.6 1.1 5 3 1.4-1.9 2.9-3 5-3 3.6 0 6 3.7 4.5 7.3C19.5 16.4 12 21 12 21z"></path></svg>',
    ornament: '<svg class="ornament" aria-hidden="true" width="180" height="16" viewBox="0 0 180 16" fill="none" stroke="#C9A45C" stroke-width="1.3" stroke-linecap="round"><path d="M2 8h64"></path><path d="M114 8h64"></path><path d="M90 2c-6 0-10 6-16 6s-6-4-2-4M90 2c6 0 10 6 16 6s6-4 2-4"></path><path d="M90 14c-6 0-10-6-16-6M90 14c6 0 10-6 16-6"></path><circle cx="90" cy="8" r="2" fill="#C9A45C"></circle></svg>'
  };
  const ratingIcon = (filled, size) => {
    const svg = document.body.dataset.theme === 'romantasy' ? ICON.heart(filled) : ICON.star(filled);
    return size ? svg.replace(/width="26" height="26"/, 'width="' + size + '" height="' + size + '"') : svg;
  };

  // ---------- Daten ----------
  async function load() {
    S.shelves = (await DB.all('shelves')).sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
    S.books = await DB.all('books');
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

  async function deleteBook(id) {
    await DB.del('books', id);
    S.books = S.books.filter((b) => b.id !== id);
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
      shelfId: '', fach: 0, pos: null, status: 'ungelesen', rating: 0, lentTo: '', lentSince: '',
      notes: '', copies: 1, needsLookup: false, needsReview: false, addedAt: now(), updatedAt: now()
    }, fields);
  }

  async function bumpBackupCounter(n) {
    const c = await DB.getMeta('booksSinceBackup', 0);
    await DB.setMeta('booksSinceBackup', c + (n || 1));
  }

  // ---------- Datenabfrage (Warteschlange) ----------
  const Lookup = {
    queue: [], running: 0, listeners: new Set(),
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
      try { r = await L.lookupIsbn(b.isbn); } catch (e) { r = { book: null, status: {}, offline: true }; }
      await DB.setMeta('lastSourceStatus', { at: now(), isbn: b.isbn, status: r.status });
      const cur = bookById(id);
      if (!cur) return;
      let outcome;
      if (r.book) {
        ['title', 'subtitle', 'authors', 'publisher', 'year', 'pages', 'language', 'cover', 'description', 'categories', 'sources']
          .forEach((k) => { if (r.book[k] && (!Array.isArray(r.book[k]) || r.book[k].length)) cur[k] = r.book[k]; });
        cur.needsLookup = false; cur.needsReview = !cur.title;
        outcome = 'ok';
      } else if (r.offline) {
        cur.needsLookup = true; outcome = 'offline';
      } else {
        cur.needsLookup = false; cur.needsReview = true; outcome = 'leer';
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
      (b.cover ? '<img src="' + esc(b.cover) + '" alt="" loading="lazy" style="position:absolute;inset:0">' : '') + '</div>';
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
    if (b.lentTo) pill = '<span class="pill warn">verliehen</span>';
    if (b.needsLookup) pill = '<span class="pill warn">Daten fehlen</span>';
    else if (b.needsReview) pill = '<span class="pill warn">prüfen</span>';
    return '<li><a class="book" href="#/buch/' + esc(b.id) + '">' + coverHtml(b) +
      '<div class="grow"><div class="book-title">' + esc(b.title || ('ISBN ' + L.formatIsbn(b.isbn))) + '</div>' +
      '<div class="muted small">' + esc(authorStr(b) || '–') + (b.copies > 1 ? ' · ' + b.copies + ' Exemplare' : '') + '</div>' +
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
    return '<header class="head">' +
      (opts.back ? '<a class="back" href="' + esc(opts.back) + '">' + ICON.back + esc(opts.backLabel || 'Zurück') + '</a>' : '') +
      (opts.kicker ? '<p class="kicker">' + esc(opts.kicker) + '</p>' : '') +
      '<h1 class="display">' + esc(opts.title) + '</h1>' + ICON.ornament +
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
    const lent = S.books.filter((b) => b.lentTo).length;
    const total = S.books.reduce((n, b) => n + (b.copies || 1), 0);

    let html = head({ kicker: 'Leseecke', title: 'Meine Bibliothek' });
    if (needBackup) {
      html += '<div class="banner" role="status"><div class="grow">' + since + ' neue Bücher seit der letzten Sicherung' +
        (lastBackup ? ' (' + fmtDate(lastBackup) + ')' : '') + '.</div><button class="btn small" data-act="backup">Sichern</button></div>';
    }
    if (review) {
      html += '<a class="banner" href="#/nacharbeiten" style="text-decoration:none"><div class="grow">' + review + (review === 1 ? ' Buch muss' : ' Bücher müssen') + ' nachgearbeitet werden.</div>' + ICON.chevron + '</a>';
    }
    html += '<a class="search" href="#/suche" style="text-decoration:none;color:var(--muted)">' + ICON.search + '<span>Titel, Autor oder ISBN</span></a>';
    html += '<div class="stats"><div class="stat"><b>' + total + '</b><span>Bücher</span></div><div class="stat"><b>' + read + '</b><span>gelesen</span></div><div class="stat"><b>' + lent + '</b><span>verliehen</span></div></div>';
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

    let html = head({ back: '#/', backLabel: 'Bibliothek', title: s.name, sub: [s.room, THEMES[s.theme], total + (total === 1 ? ' Buch' : ' Bücher')].filter(Boolean).join(' · ') });
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
    html += list.length ? '<ul class="books">' + list.map((b) => bookRow(b)).join('') + '</ul>'
      : '<div class="empty">' + (total ? 'In diesem Fach steht noch nichts.' : 'Noch keine Bücher in diesem Regal. Tippe auf „Bücher erfassen“.') + '</div>';
    $app.innerHTML = html;
    hookCovers();
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
      '<label class="btn small ghost" style="cursor:pointer;padding:0 12px">Cover-Foto<input type="file" id="coverfile" accept="image/*" class="sr-only"></label>' +
      (b.cover ? '<button type="button" class="linkbtn small" data-act="nocover" style="min-height:32px">entfernen</button>' : '') + '</div><div class="grow"><h1 class="book-title" style="font-size:24px;-webkit-line-clamp:4">' + esc(b.title || 'ISBN ' + L.formatIsbn(b.isbn)) + '</h1>' +
      (b.subtitle ? '<p class="muted" style="margin:4px 0 0">' + esc(b.subtitle) + '</p>' : '') +
      '<p style="margin:8px 0 0;font-weight:600">' + esc(authorStr(b) || '–') + '</p>' +
      '<p class="muted small" style="margin:4px 0 0">' + esc([b.year, b.pages ? b.pages + ' Seiten' : ''].filter(Boolean).join(' · ')) + '</p>' +
      (b.needsLookup ? '<p class="pill warn" style="margin-top:8px">Daten werden nachgeladen</p>' : b.needsReview ? '<p class="pill warn" style="margin-top:8px">bitte prüfen</p>' : '') +
      '</div></div>';

    html += '<div class="stack" style="margin-top:20px">';
    html += '<div class="seg" role="group" aria-label="Lesestatus">' + STATUS.map(([v, l]) => '<button type="button" data-status="' + v + '" aria-pressed="' + (b.status === v) + '">' + l + '</button>').join('') + '</div>';
    html += '<div class="stars" role="group" aria-label="Bewertung">' + [1, 2, 3, 4, 5].map((i) => '<button type="button" data-rate="' + i + '" aria-label="' + i + ' von 5" aria-pressed="' + (b.rating >= i) + '">' + ratingIcon(b.rating >= i) + '</button>').join('') + '</div>';

    // Ausleihe
    html += '<div class="card" style="padding:14px 16px">' + (b.lentTo
      ? '<div class="row"><div class="grow"><b>Verliehen an ' + esc(b.lentTo) + '</b><div class="muted small">seit ' + fmtDate(b.lentSince) + '</div></div><button class="btn small" data-act="return">Zurück</button></div>'
      : '<form class="row" id="lend"><label class="sr-only" for="lendto">Verleihen an</label><input id="lendto" class="input grow" placeholder="Verleihen an …" maxlength="40"><button class="btn small" type="submit">Verleihen</button></form>') + '</div>';

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
    on('[data-status]', 'click', (e) => upd({ status: e.currentTarget.dataset.status }));
    on('[data-rate]', 'click', (e) => { const r = +e.currentTarget.dataset.rate; upd({ rating: b.rating === r ? 0 : r }); });
    on('[data-act="return"]', 'click', () => upd({ lentTo: '', lentSince: '' }));
    const lend = qs('#lend');
    if (lend) lend.addEventListener('submit', (e) => { e.preventDefault(); const v = qs('#lendto').value.trim(); if (v) upd({ lentTo: v, lentSince: now() }); });
    on('#mv-shelf', 'change', (e) => { const sid = e.currentTarget.value; upd({ shelfId: sid, fach: 0, pos: sid ? nextPos(sid, 0) : null }); });
    on('#mv-fach', 'change', (e) => { const f = +e.currentTarget.value; upd({ fach: f, pos: b.shelfId ? nextPos(b.shelfId, f) : null }); });
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
        isbn: isbn || '', cover: String(fd.get('cover')).trim() || (/^data:/.test(b.cover) ? b.cover : ''), needsReview: !title
      });
      toast('Gespeichert');
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
    const res = await L.searchByTitle(q);
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
    if (shelfId) sc.shelfId = shelfId;
    if (!find && !sc.shelfId && S.shelves.length === 1) sc.shelfId = S.shelves[0].id;
    const shelf = shelfById(sc.shelfId);
    setTheme(shelf && !find ? shelf.theme : 'leseecke');

    let html = head({ back: shelf && !find ? '#/regal/' + shelf.id : '#/', backLabel: shelf && !find ? shelf.name : 'Bibliothek', title: find ? 'Nachschlagen' : 'Bücher erfassen' });
    if (!find && !S.shelves.length) {
      $app.innerHTML = html + '<div class="card empty"><p>Lege zuerst ein Regal an.</p><a class="btn" href="#/regal/neu">Regal anlegen</a></div>';
      return;
    }
    if (!find) {
      html += '<div class="card" style="padding:12px 16px;margin-bottom:12px"><label class="field">Ziel-Regal (oder Regal-QR scannen)<select class="input" id="sc-shelf"><option value="">– Regal wählen –</option>' +
        S.shelves.map((x) => '<option value="' + esc(x.id) + '"' + (x.id === sc.shelfId ? ' selected' : '') + '>' + esc(x.name + (x.room ? ' · ' + x.room : '')) + '</option>').join('') + '</select></label>';
      if (shelf && shelf.fachCount > 0) {
        html += '<div class="chips" role="group" aria-label="Fach" style="margin-top:10px">' + ['ohne Fach'].concat(Array.from({ length: shelf.fachCount }, (_, i) => 'Fach ' + (i + 1)))
          .map((l, i) => '<button type="button" class="chip" data-scfach="' + i + '" aria-pressed="' + (sc.fach === i) + '">' + l + '</button>').join('') + '</div>';
      }
      if (shelf && !shelf.fachCount) html += '<p class="muted small" style="margin:8px 0 0">Ohne Fächer. <a href="#/regal/' + esc(shelf.id) + '/bearbeiten">Fächer einrichten</a></p>';
      if (shelf) html += '<p class="muted small" style="margin:8px 0 0" id="nextpos">Nächstes Buch: Platz ' + nextPos(shelf.id, sc.fach) + ' – immer am selben Ende anfangen.</p>';
      html += '</div>';
    } else {
      html += '<p class="muted" style="margin-top:0">Buch-Barcode scannen: zeigt, ob es schon im Bestand ist. Regal-QR scannen: öffnet das Regal.</p>';
    }
    html += '<div class="scanbox"><video id="video" playsinline muted></video><div class="scanframe" id="frame"></div><div class="scanhint" id="hint">Barcode in den Rahmen halten</div>' +
      '<div class="scanstart" id="startbox"><button class="btn" id="start">Kamera starten</button><span class="small">Beim ersten Mal fragt iOS nach der Kamera-Erlaubnis.</span></div></div>' +
      '<div class="row" style="margin-top:10px"><button class="btn small ghost hidden" id="stop">Kamera stoppen</button><button class="btn small ghost hidden" id="torch">Licht</button></div>' +
      '<form class="row" id="manual" style="margin-top:10px"><label class="sr-only" for="misbn">ISBN von Hand</label><input class="input grow" id="misbn" inputmode="numeric" placeholder="ISBN von Hand eingeben" autocomplete="off"><button class="btn small" type="submit">OK</button></form>' +
      '<ul class="scanlog" id="log"></ul>';
    $app.innerHTML = html;
    renderLog();

    on('#sc-shelf', 'change', (e) => { sc.shelfId = e.currentTarget.value; sc.fach = 0; Scanner.stop(); viewScan(mode); });
    on('[data-scfach]', 'click', (e) => {
      sc.fach = +e.currentTarget.dataset.scfach;
      qsa('[data-scfach]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.scfach === sc.fach)));
      updateNextPos();
    });
    qs('#start').addEventListener('click', startCamera);
    qs('#stop').addEventListener('click', () => { Scanner.stop(); qs('#startbox').classList.remove('hidden'); qs('#stop').classList.add('hidden'); qs('#torch').classList.add('hidden'); });
    let torchOn = false;
    qs('#torch').addEventListener('click', () => { torchOn = !torchOn; Scanner.torch(torchOn); });
    qs('#manual').addEventListener('submit', (e) => { e.preventDefault(); initAudio(); const v = qs('#misbn').value; qs('#misbn').value = ''; handleCode(v, true); });
  }

  function updateNextPos() {
    const el = qs('#nextpos');
    const sc = S.scan;
    if (el && sc && sc.shelfId) el.textContent = 'Nächstes Buch: Platz ' + nextPos(sc.shelfId, sc.fach) + ' – immer am selben Ende anfangen.';
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
    // Regal-QR
    if (text.indexOf('BIBREGAL:') === 0) {
      const sh = shelfById(text.slice(9));
      if (!sh) { toast('Unbekanntes Regal-Etikett'); return; }
      beep('shelf'); flash();
      if (sc.mode === 'finden') { Scanner.stop(); location.hash = '#/regal/' + sh.id; return; }
      if (sc.shelfId !== sh.id) {
        sc.shelfId = sh.id; sc.fach = 0;
        setTheme(sh.theme);
        logEntry({ key: 'R' + Date.now(), state: 'regal', title: sh.name, info: 'Bücher landen ab jetzt hier' });
        const sel = qs('#sc-shelf'); if (sel) sel.value = sh.id;
        const wasRunning = !!Scanner.reader;
        Scanner.stop();
        viewScan('erfassen');
        if (wasRunning) startCamera();
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
        L.lookupIsbn(isbn).then((r) => logEntry({ key: 'F' + isbn, title: r.book ? r.book.title : 'ISBN ' + L.formatIsbn(isbn), info: r.book ? authorStr(r.book) : (r.offline ? 'offline' : 'keine Daten gefunden') }));
      }
      return;
    }
    if (!sc.shelfId) { toast('Bitte zuerst ein Regal wählen oder Regal-QR scannen'); return; }
    if (existing.length) {
      beep('dup');
      const b = existing[0];
      logEntry({ key: 'D' + isbn + Date.now(), state: 'dup', bookId: b.id, info: 'steht in ' + shelfLabel(shelfById(b.shelfId)) + (b.pos ? ', Platz ' + b.pos : '') });
      return;
    }
    beep('ok');
    const b = newBook({ isbn, shelfId: sc.shelfId, fach: sc.fach, pos: nextPos(sc.shelfId, sc.fach), needsLookup: true });
    await saveBook(b);
    await bumpBackupCounter(1);
    logEntry({ key: 'B' + b.id, state: 'laedt', bookId: b.id, info: shelfLabel(shelfById(b.shelfId)) + (b.fach ? ' · Fach ' + b.fach : '') + ' · Platz ' + b.pos });
    updateNextPos();
    Lookup.add(b.id);
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
    setTheme('leseecke'); setTab('suche');
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
        [b.title, b.subtitle, authorStr(b), b.isbn, b.notes, b.publisher].join(' ').toLowerCase().includes(q));
      box.innerHTML = hits.length ? '<ul class="books">' + hits.slice(0, 100).map((b) => bookRow(b, { showShelf: true })).join('') + '</ul>'
        : '<p class="empty">Nicht im Bestand.</p>';
      hookCovers();
    };
    qs('#q').addEventListener('input', run);
    run();
    if (!st) setTimeout(() => qs('#q') && qs('#q').focus(), 50);
  }

  function viewLent() {
    setTheme('leseecke'); setTab('verliehen');
    const list = S.books.filter((b) => b.lentTo).sort((a, b) => (a.lentSince || '').localeCompare(b.lentSince || ''));
    $app.innerHTML = head({ title: 'Verliehen' }) + (list.length
      ? '<ul class="books">' + list.map((b) => bookRow(b, { showShelf: true }).replace('<span class="pill warn">verliehen</span>', '<span class="pill warn">an ' + esc(b.lentTo) + ' seit ' + fmtDate(b.lentSince) + '</span>')).join('') + '</ul>'
      : '<p class="empty">Gerade ist nichts verliehen.</p>');
    hookCovers();
  }

  function viewReview() {
    setTheme('leseecke'); setTab('mehr');
    const list = S.books.filter((b) => b.needsReview || b.needsLookup);
    $app.innerHTML = head({ back: '#/', backLabel: 'Bibliothek', title: 'Nacharbeiten' }) +
      (list.some((b) => b.needsLookup) ? '<button class="btn ghost block" data-act="retry" style="margin-bottom:12px">Fehlende Daten erneut abfragen</button>' : '') +
      (list.length ? '<ul class="books">' + list.map((b) => bookRow(b, { showShelf: true })).join('') + '</ul>' : '<p class="empty">Alles erledigt.</p>');
    hookCovers();
    on('[data-act="retry"]', 'click', () => { Lookup.retryPending(); toast('Wird abgefragt …'); });
  }

  async function viewMore() {
    setTheme('leseecke'); setTab('mehr');
    const lastBackup = await DB.getMeta('lastBackupAt', null);
    const since = await DB.getMeta('booksSinceBackup', 0);
    let persisted = null;
    try { persisted = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (e) { persisted = null; }
    const review = S.books.filter((b) => b.needsReview || b.needsLookup).length;
    $app.innerHTML = head({ title: 'Mehr' }) +
      '<div class="stack">' +
      '<section class="card" style="padding:16px"><h2 style="font-family:var(--font-title);font-size:18px">Sicherung</h2>' +
      '<p class="muted small">Letzte Sicherung: ' + (lastBackup ? fmtDate(lastBackup) : 'noch nie') + ' · seitdem ' + since + ' neue Bücher.<br>Beim Sichern „In Dateien sichern“ → <b>iCloud Drive</b> wählen.</p>' +
      '<div class="stack"><button class="btn block" data-act="export">Jetzt sichern</button>' +
      '<label class="btn ghost block" style="cursor:pointer">Sicherung wiederherstellen<input type="file" id="imp" accept="application/json,.json" class="sr-only"></label></div></section>' +
      '<a class="card row" href="#/nacharbeiten" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Nacharbeiten</span><span class="pill' + (review ? ' warn' : '') + '">' + review + '</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/buch/neu" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Buch ohne ISBN hinzufügen</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/etiketten" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Regal-Etiketten (QR) drucken</span>' + ICON.chevron + '</a>' +
      '<a class="card row" href="#/diagnose" style="padding:14px 16px;text-decoration:none;color:var(--text)"><span class="grow">Datenquellen testen</span>' + ICON.chevron + '</a>' +
      '<p class="muted small">Speicher dauerhaft: ' + (persisted === null ? 'unbekannt' : persisted ? 'ja' : 'nein') + ' · Version ' + APP_VERSION + ' · ' + S.books.length + ' Einträge</p></div>';
    on('[data-act="export"]', 'click', exportData);
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
    const table = (st) => '<dl class="kv">' + ['dnb', 'google', 'openlibrary'].map((k) => '<dt>' + ({ dnb: 'DNB', google: 'Google Books', openlibrary: 'Open Library' }[k]) + '</dt><dd>' + esc(label[st[k]] || '–') + '</dd>').join('') + '</dl>';
    $app.innerHTML = head({ back: '#/mehr', backLabel: 'Mehr', title: 'Datenquellen' }) +
      '<div class="card" style="padding:16px"><p class="muted small" style="margin-top:0">Fragt eine Test-ISBN bei allen drei Quellen ab. „nicht erreichbar“ bei der DNB, während die anderen gehen, heißt: Die DNB erlaubt keinen Zugriff aus dem Browser (CORS).</p>' +
      '<label class="field">Test-ISBN<input class="input" id="tisbn" inputmode="numeric" value="9783551354013"></label>' +
      '<button class="btn block" data-act="test" style="margin-top:12px">Test starten</button><div id="out" style="margin-top:14px"></div></div>' +
      (last ? '<div class="card" style="padding:16px;margin-top:14px"><b>Letzte echte Abfrage</b><p class="muted small">' + esc(L.formatIsbn(last.isbn)) + ' · ' + new Date(last.at).toLocaleString('de-DE') + '</p>' + table(last.status) + '</div>' : '');
    on('[data-act="test"]', 'click', async () => {
      const isbn = L.normalizeIsbn(qs('#tisbn').value);
      const out = qs('#out');
      if (!isbn) { out.textContent = 'ISBN ungültig.'; return; }
      out.innerHTML = '<p class="muted">Frage ab …</p>';
      const t0 = performance.now();
      const r = await L.lookupIsbn(isbn);
      out.innerHTML = table(r.status) + '<p class="small muted">Dauer: ' + Math.round(performance.now() - t0) + ' ms</p>' +
        (r.book ? '<p><b>' + esc(r.book.title) + '</b><br>' + esc(authorStr(r.book)) + '</p>' : '<p>Kein Treffer.</p>');
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
    const data = { app: 'bibliothek', version: 1, exportedAt: now(), shelves: S.shelves, books: S.books };
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
    await DB.clear('books'); await DB.clear('shelves');
    await DB.putMany('shelves', data.shelves);
    await DB.putMany('books', data.books);
    await DB.setMeta('booksSinceBackup', 0);
    await load();
    toast('Wiederhergestellt: ' + S.books.length + ' Bücher');
    location.hash = '#/';
  }

  // ---------- Router ----------
  function route() {
    const h = location.hash || '#/';
    if (!/^#\/scan/.test(h)) { Scanner.stop(); }
    const p = h.slice(2).split('/');
    window.scrollTo(0, 0);
    if (!p[0]) return viewHome();
    if (p[0] === 'regal' && p[1] === 'neu') return viewShelfForm(null);
    if (p[0] === 'regal' && p[2] === 'bearbeiten') return viewShelfForm(p[1]);
    if (p[0] === 'regal' && p[1]) return viewShelf(p[1]);
    if (p[0] === 'buch' && p[1] === 'neu') return viewManualAdd(p[2] || '');
    if (p[0] === 'buch' && p[1]) return viewBook(p[1]);
    if (p[0] === 'scan') return viewScan(p[1] === 'finden' ? 'finden' : 'erfassen', p[1] === 'regal' ? p[2] : '');
    if (p[0] === 'suche') return viewSearch();
    if (p[0] === 'verliehen') return viewLent();
    if (p[0] === 'nacharbeiten') return viewReview();
    if (p[0] === 'mehr') return viewMore();
    if (p[0] === 'etiketten') return viewLabels();
    if (p[0] === 'diagnose') return viewDiag();
    return notFound();
  }

  window.addEventListener('hashchange', route);
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
