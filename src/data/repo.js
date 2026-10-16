// Veri deposu (Repository). Ekranlar yalnızca bu arayüzü kullanır.
//
// BULUTA GEÇİŞ: Aynı yöntemleri sunan bir `CloudRepository` yazıp en alttaki
// `export const repo = ...` satırını değiştirmek yeterlidir. Her kayıtta bulunan
// `id` (UUID), `updatedAt` ve `deletedAt` (silinme işareti) alanları, senkronizasyon
// ve çakışma çözümü (en son güncelleyen kazanır) için şimdiden hazırdır.
//
// Kitap: { id, isbn, title, subtitle, author, publisher, publishedDate, pageCount, language,
//          description, categories[], cover(Blob|null), coverUrl, status('toRead'|'reading'|'read'),
//          startDate, endDate, rating(0-5), review, currentPage, shelf, lentTo, tags[],
//          createdAt, updatedAt, deletedAt }
// Not:   { id, bookId, text, page(number|null), photo(Blob|null), createdAt, updatedAt, deletedAt }

import { withTx, reqP } from './db.js';
import { uid, nowISO } from '../lib/util.js';

const listeners = new Set();
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((fn) => fn());

export function newBook(partial = {}) {
  const now = nowISO();
  return {
    id: uid(),
    isbn: '',
    title: '',
    subtitle: '',
    author: '',
    publisher: '',
    publishedDate: '',
    pageCount: null,
    language: '',
    description: '',
    categories: [],
    cover: null,
    coverUrl: '',
    status: 'toRead',
    startDate: '',
    endDate: '',
    rating: 0,
    review: '',
    currentPage: null,
    shelf: '',
    lentTo: '',
    tags: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...partial,
  };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function dataUrlToBlob(url) {
  const res = await fetch(url);
  return res.blob();
}

// iOS Safari bazı sürümlerde Blob'u IndexedDB'ye yazamıyor
// ("Error preparing Blob/File data to be stored in object store").
// Bu yüzden görseller { __img: true, type, buf: ArrayBuffer } biçiminde saklanır
// ve okunurken yeniden Blob'a çevrilir. Ekranlar her zaman Blob görür.
const IMG_FIELDS = { books: 'cover', notes: 'photo' };

function blobToArrayBuffer(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsArrayBuffer(blob);
  });
}

async function pack(store, rec) {
  const f = IMG_FIELDS[store];
  const v = rec[f];
  if (v && typeof Blob !== 'undefined' && v instanceof Blob) {
    const buf = await blobToArrayBuffer(v);
    return { ...rec, [f]: { __img: true, type: v.type || 'image/jpeg', buf } };
  }
  return rec;
}

function unpack(store, rec) {
  if (!rec) return rec;
  const f = IMG_FIELDS[store];
  const v = rec[f];
  if (v && v.__img && v.buf) return { ...rec, [f]: new Blob([v.buf], { type: v.type }) };
  return rec;
}

class LocalRepository {
  async listBooks() {
    const all = await withTx('books', 'readonly', (tx) => reqP(tx.objectStore('books').getAll()));
    return all.filter((b) => !b.deletedAt).map((b) => unpack('books', b));
  }

  async getBook(id) {
    const b = await withTx('books', 'readonly', (tx) => reqP(tx.objectStore('books').get(id)));
    return b && !b.deletedAt ? unpack('books', b) : null;
  }

  async findByIsbn(isbn) {
    if (!isbn) return null;
    const all = await this.listBooks();
    return all.find((b) => b.isbn === isbn) || null;
  }

  async saveBook(book) {
    const rec = { ...book, updatedAt: nowISO() };
    const stored = await pack('books', rec);
    await withTx('books', 'readwrite', (tx) => reqP(tx.objectStore('books').put(stored)));
    emit();
    return rec;
  }

  // Silinen kayıt "mezar taşı" olarak kalır (ileride senkronizasyon için); görseller temizlenir.
  async deleteBook(id) {
    await withTx(['books', 'notes'], 'readwrite', async (tx) => {
      const books = tx.objectStore('books');
      const notes = tx.objectStore('notes');
      const b = await reqP(books.get(id));
      const now = nowISO();
      if (b) await reqP(books.put({ ...b, cover: null, review: '', deletedAt: now, updatedAt: now }));
      const ns = await reqP(notes.index('bookId').getAll(id));
      for (const n of ns) await reqP(notes.put({ ...n, photo: null, text: '', deletedAt: now, updatedAt: now }));
    });
    emit();
  }

  async listNotes(bookId) {
    const ns = await withTx('notes', 'readonly', (tx) => reqP(tx.objectStore('notes').index('bookId').getAll(bookId)));
    return ns.filter((n) => !n.deletedAt).map((n) => unpack('notes', n));
  }

  async countNotes() {
    const ns = await withTx('notes', 'readonly', (tx) => reqP(tx.objectStore('notes').getAll()));
    const counts = {};
    for (const n of ns) if (!n.deletedAt) counts[n.bookId] = (counts[n.bookId] || 0) + 1;
    return counts;
  }

  async saveNote(note) {
    const now = nowISO();
    const rec = { createdAt: now, deletedAt: null, ...note, id: note.id || uid(), updatedAt: now };
    const stored = await pack('notes', rec);
    await withTx('notes', 'readwrite', (tx) => reqP(tx.objectStore('notes').put(stored)));
    emit();
    return rec;
  }

  async deleteNote(id) {
    await withTx('notes', 'readwrite', async (tx) => {
      const s = tx.objectStore('notes');
      const n = await reqP(s.get(id));
      const now = nowISO();
      if (n) await reqP(s.put({ ...n, photo: null, text: '', deletedAt: now, updatedAt: now }));
    });
    emit();
  }

  // Basit önbellek (yazar/yayınevi bilgileri gibi ağdan gelen veriler için)
  async cacheGet(key, maxAgeMs) {
    const rec = await withTx('cache', 'readonly', (tx) => reqP(tx.objectStore('cache').get(key)));
    if (!rec) return undefined;
    if (maxAgeMs && Date.now() - rec.at > maxAgeMs) return undefined;
    return rec.value;
  }
  async cacheSet(key, value) {
    await withTx('cache', 'readwrite', (tx) => reqP(tx.objectStore('cache').put({ key, value, at: Date.now() })));
  }

  // Yedekleme: görseller data URL olarak gömülür
  async exportAll() {
    const [books, notes] = await withTx(['books', 'notes'], 'readonly', async (tx) => [
      await reqP(tx.objectStore('books').getAll()),
      await reqP(tx.objectStore('notes').getAll()),
    ]);
    const conv = async (rec, field) => ({ ...rec, [field]: rec[field] ? await blobToDataUrl(rec[field]) : null });
    return {
      app: 'kitaplik',
      version: 1,
      exportedAt: nowISO(),
      books: await Promise.all(books.filter((b) => !b.deletedAt).map((b) => conv(unpack('books', b), 'cover'))),
      notes: await Promise.all(notes.filter((n) => !n.deletedAt).map((n) => conv(unpack('notes', n), 'photo'))),
    };
  }

  // Birleştirerek içe aktarır: aynı id varsa güncelleme tarihi yeni olan kalır
  async importAll(data) {
    if (!data || data.app !== 'kitaplik' || !Array.isArray(data.books)) throw new Error('Geçersiz yedek dosyası');
    const books = await Promise.all(
      data.books.map(async (b) => pack('books', { ...b, cover: typeof b.cover === 'string' ? await dataUrlToBlob(b.cover) : null }))
    );
    const notes = await Promise.all(
      (data.notes || []).map(async (n) => pack('notes', { ...n, photo: typeof n.photo === 'string' ? await dataUrlToBlob(n.photo) : null }))
    );
    let addedBooks = 0;
    let addedNotes = 0;
    await withTx(['books', 'notes'], 'readwrite', async (tx) => {
      const bs = tx.objectStore('books');
      const ns = tx.objectStore('notes');
      for (const b of books) {
        const cur = await reqP(bs.get(b.id));
        if (!cur || (b.updatedAt || '') > (cur.updatedAt || '')) {
          await reqP(bs.put(b));
          if (!cur) addedBooks++;
        }
      }
      for (const n of notes) {
        const cur = await reqP(ns.get(n.id));
        if (!cur || (n.updatedAt || '') > (cur.updatedAt || '')) {
          await reqP(ns.put(n));
          if (!cur) addedNotes++;
        }
      }
    });
    emit();
    return { addedBooks, addedNotes };
  }

  async clearAll() {
    await withTx(['books', 'notes', 'cache'], 'readwrite', async (tx) => {
      await reqP(tx.objectStore('books').clear());
      await reqP(tx.objectStore('notes').clear());
      await reqP(tx.objectStore('cache').clear());
    });
    emit();
  }
}

export const repo = new LocalRepository();

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* desteklenmiyor */
  }
  return false;
}
