import { useEffect, useState } from 'react';
import { back, go, takeDraft } from '../router.js';
import { repo, newBook } from '../data/repo.js';
import { Cover, Field, Icon, Segmented, Spinner, STATUS_KEYS, STATUS, TopBar, BlobImg, toast } from '../components/ui.jsx';
import { downloadCover, pickImage, resizeImage } from '../services/images.js';
import { lookupByIsbn } from '../services/lookup.js';
import { toIsbn13 } from '../lib/isbn.js';
import { parseTags, todayISO, friendlyError } from '../lib/util.js';
import { DEMO } from '../env.js';

const textFields = ['title', 'subtitle', 'author', 'publisher', 'publishedDate', 'shelf', 'lentTo', 'description'];

function toForm(b) {
  return {
    ...b,
    pageCount: b.pageCount ?? '',
    tagsText: (b.tags || []).join(', '),
  };
}

export default function BookForm({ id }) {
  const isNew = !id;
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState({ found: true, batch: false, fromDraft: false });
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isNew) {
        const d = takeDraft();
        const base = newBook({ ...(d?.fields || {}), cover: d?.coverBlob || null });
        base.isbn = base.isbn ? toIsbn13(base.isbn) || base.isbn : '';
        if (alive) {
          setForm(toForm(base));
          setMeta({ found: d ? d.found : true, batch: !!d?.batch, fromDraft: !!d });
        }
      } else {
        const b = await repo.getBook(id);
        if (alive) setForm(b ? toForm(b) : null);
        if (alive && !b) go('/', { replace: true });
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, isNew]);

  if (!form) return <Spinner />;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const bind = (key) => ({ value: form[key] ?? '', onChange: (e) => set({ [key]: e.target.value }) });

  const setCoverFile = async (file) => {
    if (!file) return;
    const { blob } = await resizeImage(file, 1200, 0.85);
    set({ cover: blob, coverUrl: '' });
  };

  const fetchInfo = async () => {
    setError('');
    const isbn = toIsbn13(form.isbn);
    if (!isbn) return setError('Önce geçerli bir ISBN girin (10 ya da 13 haneli).');
    setFetching(true);
    try {
      const info = await lookupByIsbn(isbn);
      if (!info) {
        setError(DEMO ? 'Demo sürümünde otomatik bilgi getirme kapalıdır.' : 'Bu ISBN için bilgi bulunamadı.');
        return;
      }
      const patch = { isbn };
      for (const k of textFields) if (!String(form[k] || '').trim() && info[k]) patch[k] = info[k];
      if (!form.pageCount && info.pageCount) patch.pageCount = info.pageCount;
      if (!form.cover && !form.coverUrl && info.coverUrl) patch.coverUrl = info.coverUrl;
      setForm((f) => ({ ...f, ...patch }));
      toast('Boş alanlar dolduruldu');
    } finally {
      setFetching(false);
    }
  };

  const autoCover = async () => {
    const isbn = toIsbn13(form.isbn);
    if (!isbn) return setError('Otomatik kapak için geçerli bir ISBN gerekir.');
    setFetching(true);
    try {
      const info = await lookupByIsbn(isbn);
      if (info?.coverUrl) {
        set({ coverUrl: info.coverUrl, cover: null });
        toast('Kapak bulundu');
      } else {
        setError(DEMO ? 'Demo sürümünde otomatik kapak kapalıdır. Fotoğraf çekebilir ya da galeriden seçebilirsiniz.' : 'Bu kitap için hazır kapak bulunamadı. Fotoğraf çekebilirsiniz.');
      }
    } finally {
      setFetching(false);
    }
  };

  const save = async (thenScan = false) => {
    setError('');
    if (!form.title.trim()) return setError('Kitap adı boş olamaz.');
    setSaving(true);
    try {
      const { tagsText, ...rest } = form;
      const book = {
        ...rest,
        title: form.title.trim(),
        author: form.author.trim(),
        isbn: toIsbn13(form.isbn) || String(form.isbn || '').trim(),
        pageCount: form.pageCount === '' || form.pageCount == null ? null : Math.max(0, Number(form.pageCount)) || null,
        tags: parseTags(tagsText),
      };
      if (isNew) {
        if (book.status === 'reading' && !book.startDate) book.startDate = todayISO();
        if (book.status === 'read' && !book.endDate) book.endDate = todayISO();
        if (!book.cover && book.coverUrl) {
          const blob = await downloadCover(book.coverUrl);
          if (blob) {
            book.cover = blob;
            book.coverUrl = '';
          }
        }
      }
      const saved = await repo.saveBook(book);
      if (isNew && (thenScan || meta.batch)) {
        toast(`“${saved.title}” kaydedildi`, 'success');
        go('/scan?batch=1', { replace: true });
      } else if (isNew) {
        toast('Kitap kitaplığınıza eklendi', 'success');
        go(`/book/${saved.id}`, { replace: true });
      } else {
        toast('Değişiklikler kaydedildi', 'success');
        back(`/book/${saved.id}`);
      }
    } catch (e) {
      setError(friendlyError(e, 'Kitap kaydedilemedi. Lütfen yeniden deneyin.'));
    } finally {
      setSaving(false);
    }
  };

  const hasCover = form.cover || form.coverUrl;

  return (
    <div className="screen">
      <TopBar title={isNew ? 'Yeni kitap' : 'Kitabı düzenle'} onBack={() => back(isNew ? '/add' : `/book/${id}`)} />

      {isNew && meta.fromDraft ? (
        <p className={'notice ' + (meta.found ? 'ok' : 'warn')}>
          {meta.found
            ? 'Bilgiler otomatik dolduruldu. Kaydetmeden önce ya da sonra istediğiniz gibi düzenleyebilirsiniz.'
            : DEMO
              ? 'Barkod okundu. Demo sürümünde kitap bilgileri otomatik getirilemez; alanları elle doldurabilirsiniz.'
              : 'Bu kitap için hazır bilgi bulunamadı. Alanları elle doldurabilirsiniz.'}
        </p>
      ) : null}

      <section className="card cover-edit">
        <div className="cover-preview">
          {form.cover ? (
            <div className="cover">
              <BlobImg blob={form.cover} alt="Kapak" />
            </div>
          ) : (
            <Cover book={form} />
          )}
        </div>
        <div className="stack grow">
          <button className="btn ghost" type="button" onClick={async () => setCoverFile(await pickImage({ camera: true }))}>
            <Icon name="camera" size={18} /> Kapak fotoğrafı çek
          </button>
          <button className="btn ghost" type="button" onClick={async () => setCoverFile(await pickImage())}>
            <Icon name="image" size={18} /> Galeriden seç
          </button>
          <button className="btn ghost" type="button" onClick={autoCover} disabled={fetching}>
            <Icon name="download" size={18} /> Otomatik kapak (ISBN)
          </button>
          {hasCover ? (
            <button className="btn link danger" type="button" onClick={() => set({ cover: null, coverUrl: '' })}>
              Kapağı kaldır
            </button>
          ) : null}
        </div>
      </section>

      <section className="card">
        <Field label="Kitap adı *">
          <input {...bind('title')} autoCapitalize="sentences" placeholder="Kitabın adı" />
        </Field>
        <Field label="Alt başlık">
          <input {...bind('subtitle')} />
        </Field>
        <Field label="Yazar" hint="Birden fazla yazar için virgülle ayırın">
          <input {...bind('author')} autoCapitalize="words" />
        </Field>
        <Field label="Yayınevi">
          <input {...bind('publisher')} autoCapitalize="words" />
        </Field>
        <div className="two">
          <Field label="ISBN">
            <input {...bind('isbn')} inputMode="numeric" placeholder="978…" />
          </Field>
          <Field label="Sayfa sayısı">
            <input {...bind('pageCount')} inputMode="numeric" type="number" min="0" />
          </Field>
        </div>
        <button className="btn ghost small" type="button" onClick={fetchInfo} disabled={fetching}>
          {fetching ? 'Getiriliyor…' : 'ISBN ile boş alanları doldur'}
        </button>
        <div className="two">
          <Field label="Yayın tarihi">
            <input {...bind('publishedDate')} placeholder="2019" />
          </Field>
          <Field label="Raf / konum">
            <input {...bind('shelf')} placeholder="Salon, 2. raf" />
          </Field>
        </div>
      </section>

      <section className="card">
        <p className="field-label">Okuma durumu</p>
        <Segmented
          value={form.status}
          onChange={(status) => set({ status })}
          options={STATUS_KEYS.map((k) => ({ value: k, label: STATUS[k].label }))}
        />
      </section>

      <details className="card">
        <summary>Daha fazla ayrıntı</summary>
        <Field label="Etiketler" hint="Virgülle ayırın: roman, klasik, hediye">
          <input value={form.tagsText} onChange={(e) => set({ tagsText: e.target.value })} />
        </Field>
        <Field label="Ödünç verildi (kime?)">
          <input {...bind('lentTo')} placeholder="Boşsa evde demektir" />
        </Field>
        <Field label="Açıklama / arka kapak yazısı">
          <textarea rows={5} {...bind('description')} />
        </Field>
      </details>

      <div className="sticky-actions">
        {error ? (
          <p className="alert" role="alert">
            <Icon name="x" size={16} /> {error}
          </p>
        ) : null}
        <button className="btn primary wide" onClick={() => save(false)} disabled={saving}>
          <Icon name="check" size={18} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
        {isNew ? (
          <button className="btn ghost wide" onClick={() => save(true)} disabled={saving}>
            <Icon name="barcode" size={18} /> Kaydet ve sıradakini tara
          </button>
        ) : null}
      </div>
    </div>
  );
}
