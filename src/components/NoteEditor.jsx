import { useRef, useState } from 'react';
import { BlobImg, Field, Icon, Sheet, toast } from './ui.jsx';
import { pickImage, resizeImage } from '../services/images.js';
import { readPage } from '../services/ocr.js';
import { repo } from '../data/repo.js';
import { DEMO, DEMO_OFF_MSG } from '../env.js';

export default function NoteEditor({ book, note, onClose }) {
  const [text, setText] = useState(note?.text || '');
  const [page, setPage] = useState(note?.page != null ? String(note.page) : '');
  const [photo, setPhoto] = useState(note?.photo || null);
  const [ocr, setOcr] = useState({ busy: false, p: 0, status: '', pageFound: null, text: '', failed: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pageTouched = useRef(!!note?.page);

  const runOcr = async (blob) => {
    setOcr({ busy: true, p: 0, status: 'Okunuyor…', pageFound: null, text: '', failed: '' });
    try {
      const r = await readPage(blob, (p, status) => setOcr((o) => ({ ...o, p, status: status || o.status })));
      if (r.page && !pageTouched.current) setPage(String(r.page));
      setOcr({ busy: false, p: 1, status: '', pageFound: r.page, text: r.text, failed: '' });
    } catch {
      setOcr({
        busy: false,
        p: 0,
        status: '',
        pageFound: null,
        text: '',
        failed: DEMO ? 'Sayfa numarasını fotoğraftan okuma demo sürümünde kapalıdır; elle girebilirsiniz. Fotoğraf nota kaydedildi.' : 'Fotoğraftan okuma yapılamadı (ilk kullanımda internet gerekir). Sayfa numarasını elle girebilirsiniz.',
      });
    }
  };

  const addPhoto = async (camera) => {
    const file = await pickImage({ camera });
    if (!file) return;
    const { blob } = await resizeImage(file, 1600, 0.8);
    setPhoto(blob);
    runOcr(blob);
  };

  const appendOcrText = () => {
    if (!ocr.text) return;
    setText((t) => (t ? t.trimEnd() + '\n\n' : '') + ocr.text);
    setOcr((o) => ({ ...o, text: '' }));
    toast('Sayfa metni nota eklendi');
  };

  const save = async () => {
    setError('');
    const pageNum = page.trim() === '' ? null : Math.max(0, parseInt(page, 10));
    if (!text.trim() && !photo) return setError('Not metni yazın ya da bir fotoğraf ekleyin.');
    if (pageNum != null && Number.isNaN(pageNum)) return setError('Sayfa numarası geçerli bir sayı olmalı.');
    setSaving(true);
    try {
      await repo.saveNote({
        ...(note || {}),
        bookId: book.id,
        text: text.trim(),
        page: pageNum || null,
        photo: photo || null,
      });
      if (book.status === 'reading' && pageNum && pageNum > (book.currentPage || 0)) {
        await repo.saveBook({ ...book, currentPage: pageNum });
      }
      onClose();
    } catch (e) {
      setError(e?.message || 'Not kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={note ? 'Notu düzenle' : 'Yeni not'}
      onClose={onClose}
      footer={
        <button className="btn primary wide" onClick={save} disabled={saving || ocr.busy}>
          <Icon name="check" size={18} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      }
    >
      <div className="two">
        <Field label="Sayfa no">
          <input
            value={page}
            inputMode="numeric"
            onChange={(e) => {
              pageTouched.current = true;
              setPage(e.target.value.replace(/[^\d]/g, ''));
            }}
            placeholder={book.pageCount ? `1–${book.pageCount}` : 'ör. 45'}
          />
        </Field>
        <div className="note-photo-btns">
          <button className="btn ghost" type="button" onClick={() => addPhoto(true)}>
            <Icon name="camera" size={18} /> Sayfa fotoğrafı
          </button>
          <button className="btn link" type="button" onClick={() => addPhoto(false)}>
            Galeriden seç
          </button>
        </div>
      </div>

      {photo ? (
        <div className="note-photo">
          <BlobImg blob={photo} alt="Sayfa fotoğrafı" />
          <button className="icon-btn floating" onClick={() => setPhoto(null)} aria-label="Fotoğrafı kaldır">
            <Icon name="x" size={18} />
          </button>
        </div>
      ) : null}

      {ocr.busy ? (
        <p className="notice">
          Fotoğraf okunuyor {ocr.p ? `%${Math.round(ocr.p * 100)}` : ''} — bu sırada notunuzu yazmaya devam edebilirsiniz.
        </p>
      ) : null}
      {!ocr.busy && photo && ocr.pageFound ? (
        <p className="notice ok">Sayfa {ocr.pageFound} olarak algılandı. Yanlışsa yukarıdan düzeltin.</p>
      ) : null}
      {!ocr.busy && photo && !ocr.pageFound && !ocr.failed && ocr.p === 1 ? (
        <p className="notice warn">Sayfa numarası algılanamadı. Elle girebilirsiniz.</p>
      ) : null}
      {ocr.failed ? <p className="notice warn">{ocr.failed}</p> : null}
      {ocr.text ? (
        <button className="btn ghost small" type="button" onClick={appendOcrText}>
          <Icon name="text" size={16} /> Sayfadaki yazıyı nota ekle
        </button>
      ) : null}
      {photo && !ocr.busy ? (
        <button className="btn link" type="button" onClick={() => runOcr(photo)}>
          Fotoğrafı yeniden oku
        </button>
      ) : null}

      <Field label="Notunuz">
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Bu sayfada dikkatinizi çeken, alıntılamak ya da hatırlamak istediğiniz şey…" />
      </Field>
      {error ? <p className="error">{error}</p> : null}
    </Sheet>
  );
}
