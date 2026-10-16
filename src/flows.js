// Ekleme akışları: taramadan / aramadan forma geçiş
import { repo } from './data/repo.js';
import { toIsbn13, looksLikeIsbn } from './lib/isbn.js';
import { lookupByIsbn } from './services/lookup.js';
import { go, setDraft } from './router.js';
import { askConfirm } from './components/ui.jsx';

// Form taslağı: { fields: Kitap alanları, coverBlob?: Blob, found: bool, batch: bool }
export function openForm(fields, { coverBlob = null, found = true, batch = false } = {}) {
  setDraft({ fields, coverBlob, found, batch });
  go('/new');
}

export async function startFromIsbn(raw, { batch = false } = {}) {
  const isbn = toIsbn13(raw);
  if (!isbn) throw new Error('Geçerli bir ISBN değil. ISBN 10 ya da 13 hanelidir (ör. 978 ile başlar).');
  const dup = await repo.findByIsbn(isbn);
  if (dup && !(await askConfirm(`“${dup.title}” zaten kitaplığınızda kayıtlı. Yine de yeni bir kayıt eklensin mi?`, { ok: 'Yeni kayıt ekle', cancel: 'Kayda git' }))) {
    go(`/book/${dup.id}`);
    return 'duplicate';
  }
  const info = await lookupByIsbn(isbn);
  openForm(info ? { ...info } : { isbn }, { found: !!info, batch });
  return info ? 'found' : 'notfound';
}

export async function startFromInfo(info, { batch = false, coverBlob = null } = {}) {
  if (info.isbn) {
    const dup = await repo.findByIsbn(info.isbn);
    if (dup && !(await askConfirm(`“${dup.title}” zaten kitaplığınızda kayıtlı. Yine de yeni bir kayıt eklensin mi?`, { ok: 'Yeni kayıt ekle', cancel: 'Kayda git' }))) {
      go(`/book/${dup.id}`);
      return;
    }
  }
  openForm({ ...info }, { coverBlob, batch });
}

export { looksLikeIsbn };
