import { useMemo, useState } from 'react';
import { useBooks } from '../hooks.js';
import { useSettings, updateSettings } from '../settings.js';
import { go } from '../router.js';
import { normalizeText } from '../lib/util.js';
import { DEMO } from '../env.js';
import { loadSamples } from '../demoData.js';
import { SkeletonGrid, Cover, EmptyState, Icon, Spinner, StatusBadge, STATUS, STATUS_KEYS, Stars } from '../components/ui.jsx';

const SORTS = [
  { value: 'added', label: 'Eklenme' },
  { value: 'title', label: 'Kitap adı' },
  { value: 'author', label: 'Yazar' },
  { value: 'rating', label: 'Puan' },
];

function sortBooks(list, sort) {
  const tr = (a, b) => String(a || '').localeCompare(String(b || ''), 'tr');
  const copy = [...list];
  if (sort === 'title') copy.sort((a, b) => tr(a.title, b.title));
  else if (sort === 'author') copy.sort((a, b) => tr(a.author, b.author) || tr(a.title, b.title));
  else if (sort === 'rating') copy.sort((a, b) => (b.rating || 0) - (a.rating || 0) || tr(a.title, b.title));
  else copy.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return copy;
}

export default function Library() {
  const books = useBooks();
  const { view, sort } = useSettings();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { all: 0, toRead: 0, reading: 0, read: 0 };
    (books || []).forEach((b) => {
      c.all++;
      c[b.status] = (c[b.status] || 0) + 1;
    });
    return c;
  }, [books]);

  const readThisYear = useMemo(() => {
    const y = String(new Date().getFullYear());
    return (books || []).filter((b) => b.status === 'read' && (b.endDate || '').startsWith(y)).length;
  }, [books]);

  const shown = useMemo(() => {
    if (!books) return [];
    const nq = normalizeText(q);
    let list = books.filter((b) => filter === 'all' || b.status === filter);
    if (nq) {
      list = list.filter((b) =>
        normalizeText([b.title, b.subtitle, b.author, b.publisher, b.isbn, b.shelf, (b.tags || []).join(' ')].join(' ')).includes(nq)
      );
    }
    return sortBooks(list, sort);
  }, [books, q, filter, sort]);

  if (books === null) {
    return (
      <div className="screen">
        <EmptyState icon="x" title="Kitaplık açılamadı">
          Bu tarayıcı veri saklamaya izin vermiyor (gizli pencere ya da engellenmiş site verisi olabilir). Normal bir pencerede yeniden açmayı deneyin.
        </EmptyState>
      </div>
    );
  }
  if (!books) {
    return (
      <div className="screen">
        <header className="hero-head">
          <h1 className="brand">Kitaplık</h1>
        </header>
        <SkeletonGrid />
      </div>
    );
  }

  return (
    <div className="screen">
      <header className="hero-head">
        <div>
          <h1 className="brand">Kitaplık</h1>
          <p className="muted">
            {counts.all} kitap{readThisYear ? ` · bu yıl ${readThisYear} kitap okudunuz` : ''}
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label={view === 'grid' ? 'Liste görünümü' : 'Izgara görünümü'}
          onClick={() => updateSettings({ view: view === 'grid' ? 'list' : 'grid' })}
        >
          <Icon name={view === 'grid' ? 'list' : 'grid'} />
        </button>
      </header>

      {DEMO ? (
        <div className="demo-banner">
          <Icon name="zap" size={18} />
          <span>
            <b>Demo sürümü</b>
            Kayıtlar yalnızca bu tarayıcıda tutulur. Canlı kamera, otomatik kitap bilgisi, yazar/yayınevi bilgisi ve fotoğraftan yazı okuma bu önizlemede kapalıdır. Barkodu fotoğraftan okuma, notlar, fotoğraflar, puan, yorum ve tema denenebilir.
          </span>
        </div>
      ) : null}

      {counts.all > 0 && (
        <>
          <div className="searchbox">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Ad, yazar, yayınevi, ISBN, etiket, raf…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Kitaplıkta ara"
            />
          </div>

          <div className="chips" role="tablist">
            {[['all', 'Tümü'], ...STATUS_KEYS.map((k) => [k, STATUS[k].label])].map(([k, label]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
                {label} <b>{counts[k] || 0}</b>
              </button>
            ))}
          </div>

          <div className="sortrow">
            <span className="muted">Sırala:</span>
            <select value={sort} onChange={(e) => updateSettings({ sort: e.target.value })} aria-label="Sıralama">
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {counts.all === 0 ? (
        <EmptyState
          title="Kitaplığınız henüz boş"
          action={
            <div className="stack" style={{ maxWidth: 300 }}>
              <button className="btn primary" onClick={() => go('/add')}>
                <Icon name="plus" size={18} /> İlk kitabı ekle
              </button>
              {DEMO ? (
                <button className="btn ghost" onClick={() => loadSamples()}>
                  <Icon name="book" size={18} /> Örnek kitaplarla dene
                </button>
              ) : null}
            </div>
          }
        >
          Barkodu okutun ya da kapağı fotoğraflayın; kitap bilgileri kendiliğinden gelsin.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState icon="search" title="Sonuç bulunamadı">
          Aramayı ya da filtreyi değiştirmeyi deneyin.
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid">
          {shown.map((b, i) => (
            <button key={b.id} className="grid-item rise" style={{ '--i': Math.min(i, 14) }} onClick={() => go(`/book/${b.id}`)}>
              <Cover book={b} />
              <span className="gi-title">{b.title}</span>
              <span className="gi-author">{b.author}</span>
              <StatusBadge status={b.status} />
            </button>
          ))}
        </div>
      ) : (
        <ul className="list">
          {shown.map((b, i) => (
            <li key={b.id} className="rise" style={{ '--i': Math.min(i, 14) }}>
              <button className="list-item" onClick={() => go(`/book/${b.id}`)}>
                <Cover book={b} className="small" />
                <span className="li-text">
                  <span className="li-title">{b.title}</span>
                  <span className="li-author">{b.author || 'Yazar belirtilmemiş'}</span>
                  <span className="li-meta">
                    <StatusBadge status={b.status} />
                    {b.rating ? <Stars value={b.rating} size={14} /> : null}
                  </span>
                </span>
                <Icon name="right" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
