// Kitap bilgisi servisleri: Google Books (öncelikli) ve Open Library (yedek).
// Anahtar gerektirmez. Sunucu hata verirse boş sonuç döner; uygulama elle girişe devam eder.

import { toIsbn13, cleanIsbn } from '../lib/isbn.js';
import { normalizeText, yearOf } from '../lib/util.js';
import { probeImage } from './images.js';
import { repo } from '../data/repo.js';
import { DEMO, DEMO_OFF_MSG } from '../env.js';

const GB = 'https://www.googleapis.com/books/v1/volumes';
const DAY = 24 * 3600 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sunucu yoğunsa (429/503) kısa bir bekleme ile bir kez daha dener; hatayı anlaşılır Türkçeyle verir
async function getJson(url, timeoutMs = 9000, retries = 1) {
  if (DEMO) throw new Error(DEMO_OFF_MSG);
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal });
    } catch (e) {
      clearTimeout(t);
      if (attempt < retries) {
        await sleep(800);
        continue;
      }
      throw new Error(e?.name === 'AbortError' ? 'Kitap arama servisi yanıt vermedi. Yeniden deneyin.' : 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip yeniden deneyin.');
    }
    clearTimeout(t);
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < retries) {
      await sleep(1500 * (attempt + 1));
      continue;
    }
    if (res.status === 429 || res.status === 403) {
      const err = new Error('Kitap arama servisi şu an çok yoğun. Birkaç saniye sonra yeniden deneyin.');
      err.busy = true;
      throw err;
    }
    throw new Error(`Kitap arama servisi hata verdi (${res.status}). Yeniden deneyin.`);
  }
}

// Open Library araması (ücretsiz, anahtarsız): Google sonuç vermezse ya da yoğunsa yedek olarak
async function searchOpenLibrary(q, limit = 10) {
  const fields = 'title,subtitle,author_name,publisher,isbn,first_publish_year,cover_i,number_of_pages_median,language';
  const data = await getJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=${limit}&fields=${fields}`, 12000, 0);
  return (data.docs || [])
    .map((d) => {
      const isbn = (d.isbn || []).map((x) => toIsbn13(x)).find(Boolean) || '';
      return {
        source: 'openlibrary',
        isbn,
        title: d.title || '',
        subtitle: d.subtitle || '',
        author: (d.author_name || []).slice(0, 3).join(', '),
        publisher: (d.publisher || [])[0] || '',
        publishedDate: d.first_publish_year ? String(d.first_publish_year) : '',
        pageCount: d.number_of_pages_median || null,
        language: '',
        description: '',
        categories: [],
        coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : '',
      };
    })
    .filter((b) => b.title);
}

const https = (u) => (u ? u.replace(/^http:/, 'https:').replace('&edge=curl', '') : '');

function mapGoogle(item) {
  const v = item.volumeInfo || {};
  const ids = v.industryIdentifiers || [];
  const i13 = ids.find((i) => i.type === 'ISBN_13')?.identifier;
  const i10 = ids.find((i) => i.type === 'ISBN_10')?.identifier;
  const links = v.imageLinks || {};
  return {
    source: 'google',
    isbn: toIsbn13(i13 || i10 || '') || '',
    title: v.title || '',
    subtitle: v.subtitle || '',
    author: (v.authors || []).join(', '),
    publisher: v.publisher || '',
    publishedDate: v.publishedDate || '',
    pageCount: v.pageCount || null,
    language: v.language || '',
    description: v.description || '',
    categories: v.categories || [],
    coverUrl: https(links.thumbnail || links.smallThumbnail || ''),
    ratingsCount: v.ratingsCount || 0,
    averageRating: v.averageRating || 0,
  };
}

async function openLibraryByIsbn(isbn) {
  const data = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const b = data[`ISBN:${isbn}`];
  if (!b) return null;
  return {
    source: 'openlibrary',
    isbn,
    title: b.title || '',
    subtitle: b.subtitle || '',
    author: (b.authors || []).map((a) => a.name).join(', '),
    publisher: (b.publishers || []).map((p) => p.name)[0] || '',
    publishedDate: b.publish_date || '',
    pageCount: b.number_of_pages || null,
    language: '',
    description: '',
    categories: (b.subjects || []).slice(0, 5).map((s) => s.name),
    coverUrl: https(b.cover?.large || b.cover?.medium || ''),
  };
}

// ISBN ile kitap bilgisi getirir. Bulamazsa null.
export async function lookupByIsbn(input) {
  const isbn = toIsbn13(input) || cleanIsbn(input);
  if (!isbn || DEMO) return null;
  const key = `isbn:${isbn}`;
  const hit = await repo.cacheGet(key, 7 * DAY).catch(() => undefined);
  if (hit) return hit;

  let result = null;
  try {
    const data = await getJson(`${GB}?q=isbn:${isbn}&maxResults=3&printType=books`);
    if (data.items?.length) result = mapGoogle(data.items[0]);
  } catch {
    /* ağ hatası: yedeğe geç */
  }
  if (!result || !result.title) {
    try {
      result = (await openLibraryByIsbn(isbn)) || result;
    } catch {
      /* yok say */
    }
  }
  if (!result) return null;
  result.isbn = result.isbn || isbn;

  // Kapak yoksa Open Library kapağını dene
  if (!result.coverUrl) {
    const ol = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    if (await probeImage(ol)) result.coverUrl = ol;
  }
  repo.cacheSet(key, result).catch(() => {});
  return result;
}

// Serbest metinle arama (kapak OCR sonucu ya da "kitap adı yaz" için)
export async function searchBooks(query, { limit = 10 } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  let googleErr = null;
  try {
    const data = await getJson(`${GB}?q=${encodeURIComponent(q)}&maxResults=${limit}&printType=books`);
    const list = (data.items || []).map(mapGoogle).filter((b) => b.title);
    if (list.length) return list;
  } catch (e) {
    googleErr = e;
  }
  try {
    const ol = await searchOpenLibrary(q, limit);
    if (ol.length || !googleErr) return ol;
  } catch {
    /* yedek de başarısız */
  }
  if (googleErr) throw googleErr;
  return [];
}

export function searchByTitleAuthor(title, author) {
  const parts = [];
  if (title) parts.push(`intitle:${title.replace(/["]/g, '')}`);
  if (author) parts.push(`inauthor:${author.replace(/["]/g, '')}`);
  return searchBooks(parts.join(' '));
}

function dedupeByTitle(list) {
  const seen = new Set();
  return list.filter((b) => {
    const k = normalizeText(b.title);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// Yazarın diğer kitapları
export async function authorBooks(name) {
  const key = `authorBooks:${normalizeText(name)}`;
  const hit = await repo.cacheGet(key, 14 * DAY).catch(() => undefined);
  if (hit) return hit;
  const data = await getJson(
    `${GB}?q=${encodeURIComponent(`inauthor:"${name}"`)}&maxResults=40&orderBy=relevance&printType=books`
  );
  const want = normalizeText(name);
  const books = dedupeByTitle(
    (data.items || [])
      .map(mapGoogle)
      .filter((b) => b.title && normalizeText(b.author).includes(want))
  ).slice(0, 20);
  repo.cacheSet(key, books).catch(() => {});
  return books;
}

// Yayınevinin öne çıkan kitapları (Google Books ilgi sırası + okur puanı sayısına göre)
export async function publisherBooks(name) {
  const key = `publisherBooks:${normalizeText(name)}`;
  const hit = await repo.cacheGet(key, 14 * DAY).catch(() => undefined);
  if (hit) return hit;
  const data = await getJson(
    `${GB}?q=${encodeURIComponent(`inpublisher:"${name}"`)}&maxResults=40&orderBy=relevance&printType=books`
  );
  const want = normalizeText(name);
  const list = dedupeByTitle(
    (data.items || [])
      .map(mapGoogle)
      .filter((b) => b.title && normalizeText(b.publisher).includes(want))
  );
  const popular = list
    .map((b, i) => ({ b, i }))
    .sort((x, y) => y.b.ratingsCount - x.b.ratingsCount || x.i - y.i)
    .map((x) => x.b)
    .slice(0, 12);
  repo.cacheSet(key, popular).catch(() => {});
  return popular;
}

export { yearOf };
