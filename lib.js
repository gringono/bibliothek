/* Bibliothek – reine Logik: ISBN, Datenquellen, Zusammenführen. Ohne DOM-Abhängigkeit außer DOMParser (DNB). */
(function (root) {
  'use strict';

  // ---------- ISBN ----------
  function cleanIsbn(raw) {
    return String(raw || '').toUpperCase().replace(/[^0-9X]/g, '');
  }

  function isValidIsbn13(s) {
    if (!/^97[89]\d{10}$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (+s[i]) * (i % 2 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === +s[12];
  }

  function isValidIsbn10(s) {
    if (!/^\d{9}[\dX]$/.test(s)) return false;
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += (s[i] === 'X' ? 10 : +s[i]) * (10 - i);
    return sum % 11 === 0;
  }

  function isbn10to13(s) {
    const core = '978' + s.slice(0, 9);
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += (+core[i]) * (i % 2 ? 3 : 1);
    return core + ((10 - (sum % 10)) % 10);
  }

  /** Liefert gültige ISBN-13 oder null. Akzeptiert ISBN-10 und -13 mit Bindestrichen. */
  function normalizeIsbn(raw) {
    const s = cleanIsbn(raw);
    if (s.length === 13 && isValidIsbn13(s)) return s;
    if (s.length === 10 && isValidIsbn10(s)) return isbn10to13(s);
    return null;
  }

  function formatIsbn(s) {
    return s && s.length === 13 ? s.slice(0, 3) + '-' + s.slice(3) : s || '';
  }

  // ---------- Hilfen ----------
  function yearOf(v) {
    const m = String(v || '').match(/(1[5-9]|20)\d{2}/);
    return m ? m[0] : '';
  }

  function httpsUrl(u) {
    if (!u) return '';
    return String(u).replace(/^http:\/\//, 'https://').replace('&edge=curl', '');
  }

  // "Schätzing, Frank [Verfasser]" -> "Frank Schätzing"
  function flipName(n) {
    n = String(n || '').replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
    const parts = n.split(', ');
    if (parts.length === 2 && !/\d/.test(parts[1])) return parts[1] + ' ' + parts[0];
    return n;
  }

  // ---------- Parser ----------
  function parseGoogle(json) {
    if (!json || !json.items || !json.items.length) return null;
    const v = json.items[0].volumeInfo || {};
    const img = v.imageLinks || {};
    return {
      title: v.title || '',
      subtitle: v.subtitle || '',
      authors: v.authors || [],
      publisher: v.publisher || '',
      year: yearOf(v.publishedDate),
      pages: v.pageCount || null,
      language: v.language || '',
      cover: httpsUrl(img.thumbnail || img.smallThumbnail || ''),
      description: v.description || '',
      categories: v.categories || []
    };
  }

  function parseOpenLibrary(json, isbn) {
    const d = json && json['ISBN:' + isbn];
    if (!d) return null;
    const cover = d.cover || {};
    return {
      title: d.title || '',
      subtitle: d.subtitle || '',
      authors: (d.authors || []).map((a) => a.name).filter(Boolean),
      publisher: ((d.publishers || [])[0] || {}).name || '',
      year: yearOf(d.publish_date),
      pages: d.number_of_pages || null,
      language: '',
      cover: httpsUrl(cover.medium || cover.large || cover.small || ''),
      description: '',
      categories: (d.subjects || []).slice(0, 5).map((s) => s.name).filter(Boolean)
    };
  }

  /** DNB SRU, recordSchema=oai_dc. xmlText -> Treffer oder null. */
  function parseDnb(xmlText, DOMParserImpl) {
    const P = DOMParserImpl || (typeof DOMParser !== 'undefined' ? DOMParser : null);
    if (!P || !xmlText) return null;
    const doc = new P().parseFromString(xmlText, 'application/xml');
    const n = doc.getElementsByTagNameNS('*', 'numberOfRecords')[0];
    if (n && +n.textContent === 0) return null;
    const dc = doc.getElementsByTagNameNS('*', 'dc')[0];
    if (!dc) return null;
    const all = (name) => Array.from(dc.getElementsByTagNameNS('*', name)).map((e) => e.textContent.trim()).filter(Boolean);
    const rawTitle = all('title')[0] || '';
    if (!rawTitle) return null;
    // "Titel : Untertitel / Autor" -> Titel, Untertitel
    const beforeSlash = rawTitle.split(' / ')[0];
    const [title, ...sub] = beforeSlash.split(' : ');
    const creators = all('creator').map(flipName);
    return {
      title: title.trim(),
      subtitle: sub.join(': ').trim(),
      authors: creators,
      publisher: (all('publisher')[0] || '').replace(/^.*?:\s*/, ''),
      year: yearOf(all('date')[0]),
      pages: null,
      language: (all('language')[0] || '').slice(0, 3),
      cover: '',
      description: '',
      categories: []
    };
  }

  /** Bestes aus allen Quellen: Titel/Autor bevorzugt DNB, Cover Google/OL. */
  function mergeResults(r) {
    const order = ['dnb', 'google', 'openlibrary'];
    const coverOrder = ['google', 'openlibrary', 'dnb'];
    const found = order.filter((k) => r[k]);
    if (!found.length) return null;
    const pick = (field, ord) => {
      for (const k of ord || order) {
        const v = r[k] && r[k][field];
        if (Array.isArray(v) ? v.length : v) return v;
      }
      return Array.isArray(r[found[0]][field]) ? [] : '';
    };
    return {
      title: pick('title'),
      subtitle: pick('subtitle'),
      authors: pick('authors'),
      publisher: pick('publisher'),
      year: pick('year'),
      pages: pick('pages', ['google', 'openlibrary', 'dnb']) || null,
      language: pick('language'),
      cover: pick('cover', coverOrder),
      description: pick('description', ['google']),
      categories: pick('categories', ['google', 'openlibrary']),
      sources: found
    };
  }

  // ---------- Abfrage ----------
  const URLS = {
    google: (isbn, key) => 'https://www.googleapis.com/books/v1/volumes?q=isbn:' + isbn + (key ? '&key=' + encodeURIComponent(key) : ''),
    openlibrary: (isbn) => 'https://openlibrary.org/api/books?bibkeys=ISBN:' + isbn + '&format=json&jscmd=data',
    dnb: (isbn) => 'https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D' + isbn + '&recordSchema=oai_dc&maximumRecords=1'
  };

  async function fetchWithTimeout(fetchImpl, url, ms) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;
    try {
      const res = await fetchImpl(url, ctrl ? { signal: ctrl.signal } : undefined);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res;
    } finally {
      if (t) clearTimeout(t);
    }
  }

  /**
   * Fragt alle Quellen parallel ab.
   * Rückgabe: { book|null, status: {google:'ok'|'leer'|'fehler', ...}, offline:boolean }
   */
  async function lookupIsbn(isbn, opts) {
    opts = opts || {};
    const f = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    const ms = opts.timeout || 8000;
    const status = {};
    const errors = {};
    const results = {};
    const tasks = {
      google: async () => parseGoogle(await (await fetchWithTimeout(f, URLS.google(isbn, opts.googleKey), ms)).json()),
      openlibrary: async () => parseOpenLibrary(await (await fetchWithTimeout(f, URLS.openlibrary(isbn), ms)).json(), isbn),
      dnb: async () => parseDnb(await (await fetchWithTimeout(f, URLS.dnb(isbn), ms)).text(), opts.DOMParser)
    };
    const enabled = opts.sources || ['dnb', 'google', 'openlibrary'];
    await Promise.all(enabled.map(async (k) => {
      try {
        results[k] = await tasks[k]();
        status[k] = results[k] ? 'ok' : 'leer';
      } catch (e) {
        results[k] = null;
        status[k] = 'fehler';
        errors[k] = e && e.name === 'AbortError' ? 'Zeitüberschreitung' : (e && e.message) || String(e);
      }
    }));
    const allFailed = enabled.every((k) => status[k] === 'fehler');
    return { book: mergeResults(results), status, errors, offline: allFailed };
  }

  /** Titelsuche für Bücher ohne ISBN (Google + Open Library). */
  async function searchByTitle(q, opts) {
    opts = opts || {};
    const f = opts.fetch || fetch.bind(root);
    const out = [];
    const enc = encodeURIComponent(q);
    await Promise.all([
      (async () => {
        try {
          const j = await (await fetchWithTimeout(f, 'https://www.googleapis.com/books/v1/volumes?maxResults=8&q=' + enc + (opts.googleKey ? '&key=' + encodeURIComponent(opts.googleKey) : ''), 8000)).json();
          (j.items || []).forEach((it) => {
            const r = parseGoogle({ items: [it] });
            const ids = (it.volumeInfo.industryIdentifiers || []);
            const i13 = ids.find((x) => x.type === 'ISBN_13');
            r.isbn = i13 ? i13.identifier : '';
            r.source = 'google';
            out.push(r);
          });
        } catch (e) { /* Quelle nicht erreichbar */ }
      })(),
      (async () => {
        try {
          const j = await (await fetchWithTimeout(f, 'https://openlibrary.org/search.json?limit=8&fields=title,author_name,first_publish_year,isbn,cover_i,publisher&q=' + enc, 8000)).json();
          (j.docs || []).forEach((d) => {
            out.push({
              title: d.title || '', subtitle: '', authors: d.author_name || [],
              publisher: (d.publisher || [])[0] || '', year: d.first_publish_year ? String(d.first_publish_year) : '',
              pages: null, language: '', description: '', categories: [],
              cover: d.cover_i ? 'https://covers.openlibrary.org/b/id/' + d.cover_i + '-M.jpg' : '',
              isbn: ((d.isbn || []).map(normalizeIsbn).find(Boolean)) || '',
              source: 'openlibrary'
            });
          });
        } catch (e) { /* Quelle nicht erreichbar */ }
      })()
    ]);
    return out;
  }

  const api = {
    cleanIsbn, normalizeIsbn, isValidIsbn13, isValidIsbn10, isbn10to13, formatIsbn,
    parseGoogle, parseOpenLibrary, parseDnb, mergeResults, lookupIsbn, searchByTitle,
    flipName, yearOf, URLS
  };
  root.BibLib = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
