import { useEffect, useState } from 'react';
import { back, go } from '../router.js';
import { repo } from '../data/repo.js';
import { useBook, useNotes } from '../hooks.js';
import { BlobImg, Cover, Icon, Segmented, Sheet, Spinner, STATUS, STATUS_KEYS, Stars, TopBar, toast, askConfirm } from '../components/ui.jsx';
import NoteEditor from '../components/NoteEditor.jsx';
import Discover from '../components/Discover.jsx';
import { formatDate, formatDateTime, todayISO, yearOf, clamp, friendlyError } from '../lib/util.js';

function Progress({ book, onSave }) {
  const total = book.pageCount || 0;
  const cur = book.currentPage || 0;
  const pct = total ? clamp(Math.round((cur / total) * 100), 0, 100) : 0;
  const [val, setVal] = useState(book.currentPage ?? '');
  useEffect(() => setVal(book.currentPage ?? ''), [book.currentPage]);
  const commit = () => {
    const next = val === '' ? null : Math.max(0, Number(val));
    if (next !== (book.currentPage ?? null)) onSave({ currentPage: next });
  };
  return (
    <div className="progress-block">
      <div className="progress-row">
        <label className="field grow">
          <span className="field-label">Şu an kaçıncı sayfadasınız?</span>
          <input
            type="number"
            inputMode="numeric"
            min="0"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
        <span className="of-total">{total ? `/ ${total}` : ''}</span>
      </div>
      {total ? (
        <>
          <div className="bar" aria-label={`%${pct} tamamlandı`}>
            <span style={{ width: pct + '%' }} />
          </div>
          <p className="muted small">%{pct} tamamlandı</p>
        </>
      ) : (
        <p className="muted small">Sayfa sayısı girilirse ilerleme çubuğu görünür (düzenle ekranından).</p>
      )}
    </div>
  );
}

function NoteCard({ i = 0, note, onEdit, onDelete, onZoom }) {
  return (
    <li className="note rise" style={{ '--i': Math.min(i, 10) }}>
      <div className="note-head">
        {note.page ? <span className="page-pill">Sayfa {note.page}</span> : <span className="page-pill none">Sayfa yok</span>}
        <span className="muted small">{formatDateTime(note.createdAt)}</span>
        <span className="grow" />
        <button className="icon-btn" onClick={onEdit} aria-label="Notu düzenle">
          <Icon name="edit" size={18} />
        </button>
        <button className="icon-btn" onClick={onDelete} aria-label="Notu sil">
          <Icon name="trash" size={18} />
        </button>
      </div>
      {note.photo ? <BlobImg blob={note.photo} alt="Sayfa fotoğrafı" className="note-thumb" onClick={onZoom} /> : null}
      {note.text ? <p className="note-text">{note.text}</p> : null}
    </li>
  );
}

function BookView({ book }) {
  const notes = useNotes(book.id);
  const [tab, setTab] = useState('general');
  const [review, setReview] = useState(book.review || '');
  const [editor, setEditor] = useState(null); // { note } | null
  const [zoom, setZoom] = useState(null);
  const [noteSort, setNoteSort] = useState('date');

  const update = (patch) =>
    repo.saveBook({ ...book, ...patch }).catch((e) => {
      toast(friendlyError(e, 'Değişiklik kaydedilemedi.'), 'error');
    });

  const changeStatus = (status) => {
    const patch = { status };
    if (status === 'reading' && !book.startDate) patch.startDate = todayISO();
    if (status === 'read') {
      if (!book.endDate) patch.endDate = todayISO();
      if (book.pageCount) patch.currentPage = book.pageCount;
    }
    update(patch);
    toast(`${STATUS[status].label} olarak işaretlendi`, 'success');
  };

  const remove = async () => {
    if (!(await askConfirm(`“${book.title}” ve tüm notları silinsin mi? Bu işlem geri alınamaz.`, { ok: 'Sil', danger: true }))) return;
    await repo.deleteBook(book.id);
    toast('Kitap silindi');
    go('/', { replace: true });
  };

  const removeNote = async (n) => {
    if (!(await askConfirm('Bu not silinsin mi?', { ok: 'Sil', danger: true }))) return;
    await repo.deleteNote(n.id);
    toast('Not silindi');
  };

  const sortedNotes = [...(notes || [])].sort((a, b) =>
    noteSort === 'page'
      ? (a.page ?? 1e9) - (b.page ?? 1e9) || (a.createdAt || '').localeCompare(b.createdAt || '')
      : (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const rows = [
    ['ISBN', book.isbn],
    ['Yayın tarihi', book.publishedDate],
    ['Sayfa sayısı', book.pageCount],
    ['Raf / konum', book.shelf],
    ['Ödünç verildi', book.lentTo],
    ['Etiketler', (book.tags || []).join(', ')],
    ['Kitaplığa eklendi', formatDate((book.createdAt || '').slice(0, 10))],
  ].filter(([, v]) => v);

  return (
    <div className="screen">
      <TopBar
        title=""
        onBack={() => back('/')}
        right={
          <>
            <button className="icon-btn" onClick={() => go(`/book/${book.id}/edit`)} aria-label="Düzenle">
              <Icon name="edit" />
            </button>
            <button className="icon-btn" onClick={remove} aria-label="Sil">
              <Icon name="trash" />
            </button>
          </>
        }
      />

      <section className="detail-hero">
        <Cover book={book} className="large" />
        <div className="dh-text">
          <h2>{book.title}</h2>
          {book.subtitle ? <p className="muted">{book.subtitle}</p> : null}
          <p className="dh-author">{book.author || 'Yazar belirtilmemiş'}</p>
          <p className="muted small">{[book.publisher, yearOf(book.publishedDate)].filter(Boolean).join(' · ')}</p>
          <Stars value={book.rating || 0} onChange={(rating) => update({ rating })} />
        </div>
      </section>

      <Segmented
        value={book.status}
        onChange={changeStatus}
        options={STATUS_KEYS.map((k) => ({ value: k, label: STATUS[k].label }))}
        className="status-seg"
      />

      <div className="tabs" role="tablist" style={{ '--idx': ['general', 'notes', 'discover'].indexOf(tab) }}>
        <span className="tabs-ink" aria-hidden="true" />
        {[
          ['general', 'Genel'],
          ['notes', `Notlar${notes && notes.length ? ` (${notes.length})` : ''}`],
          ['discover', 'Keşfet'],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'general' ? (
        <div className="tab-panel" key="general">
          <section className="card">
            <h3>Okuma</h3>
            {book.status !== 'toRead' ? <Progress book={book} onSave={update} /> : null}
            <div className="two">
              <label className="field">
                <span className="field-label">Başlangıç tarihi</span>
                <input type="date" value={book.startDate || ''} onChange={(e) => update({ startDate: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">Bitiş tarihi</span>
                <input type="date" value={book.endDate || ''} min={book.startDate || undefined} onChange={(e) => update({ endDate: e.target.value })} />
              </label>
            </div>
            <p className="muted small">Tarihler isteğe bağlıdır; durumu değiştirdiğinizde otomatik önerilir, istediğiniz gibi değiştirebilirsiniz.</p>
          </section>

          <section className="card">
            <h3>Yorumum</h3>
            <textarea
              rows={6}
              value={review}
              placeholder="Kitap hakkındaki genel duygu ve düşünceleriniz…"
              onChange={(e) => setReview(e.target.value)}
              onBlur={() => review !== (book.review || '') && update({ review })}
            />
            <p className="muted small">Alandan çıktığınızda otomatik kaydedilir.</p>
          </section>

          {rows.length ? (
            <section className="card">
              <h3>Kitap bilgileri</h3>
              <dl className="facts">
                {rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {book.description ? (
            <details className="card">
              <summary>Açıklama</summary>
              <p className="desc">{book.description.replace(/<[^>]+>/g, ' ')}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      {tab === 'notes' ? (
        <section className="tab-panel" key="notes">
          <div className="notes-bar">
            <button className="btn primary" onClick={() => setEditor({ note: null })}>
              <Icon name="plus" size={18} /> Not ekle
            </button>
            <select value={noteSort} onChange={(e) => setNoteSort(e.target.value)} aria-label="Not sıralaması">
              <option value="date">Tarihe göre</option>
              <option value="page">Sayfaya göre</option>
            </select>
          </div>
          {!notes ? (
            <Spinner />
          ) : notes.length === 0 ? (
            <p className="muted center-text">
              Henüz not yok. Bir sayfanın fotoğrafını çekin; sayfa numarası otomatik algılanır.
            </p>
          ) : (
            <ul className="notes">
              {sortedNotes.map((n, i) => (
                <NoteCard i={i} key={n.id} note={n} onEdit={() => setEditor({ note: n })} onDelete={() => removeNote(n)} onZoom={() => setZoom(n.photo)} />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === 'discover' ? (
        <div className="tab-panel" key="discover">
          <Discover book={book} />
        </div>
      ) : null}

      {editor ? <NoteEditor book={book} note={editor.note} onClose={() => setEditor(null)} /> : null}
      {zoom ? (
        <Sheet title="Sayfa fotoğrafı" onClose={() => setZoom(null)}>
          <BlobImg blob={zoom} alt="Sayfa fotoğrafı" className="zoom-img" />
        </Sheet>
      ) : null}
    </div>
  );
}

export default function BookDetail({ id }) {
  const book = useBook(id);
  if (book === undefined) return <Spinner />;
  if (book === null) {
    return (
      <div className="screen">
        <TopBar title="Kitap bulunamadı" onBack={() => go('/', { replace: true })} />
      </div>
    );
  }
  return <BookView key={book.id} book={book} />;
}
