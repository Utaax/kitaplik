// Düşük seviyeli IndexedDB erişimi. Uygulamanın geri kalanı bunu doğrudan kullanmaz;
// yalnızca repo.js üzerinden erişir (bulut geçişinde sadece repo değişecek).

const DB_NAME = 'kitaplik';
const DB_VERSION = 1;
let dbPromise;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('books')) db.createObjectStore('books', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('notes')) {
        const notes = db.createObjectStore('notes', { keyPath: 'id' });
        notes.createIndex('bookId', 'bookId');
      }
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export const reqP = (r) =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

// Tek bir işlemde (transaction) birden çok depoya erişir.
// fn(tx) içinde yalnızca IndexedDB istekleri beklenmelidir (fetch vb. beklenmez).
export async function withTx(storeNames, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    let result;
    Promise.resolve(fn(tx)).then(
      (r) => {
        result = r;
      },
      (e) => {
        try {
          tx.abort();
        } catch {
          /* zaten kapanmış */
        }
        reject(e);
      }
    );
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('İşlem iptal edildi'));
  });
}
