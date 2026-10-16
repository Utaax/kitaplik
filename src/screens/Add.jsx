import { useState } from 'react';
import { back, go } from '../router.js';
import { Cover, Icon, Spinner, TopBar } from '../components/ui.jsx';
import { searchBooks } from '../services/lookup.js';
import { looksLikeIsbn, startFromIsbn, startFromInfo, openForm } from '../flows.js';
import { useAsync } from '../hooks.js';

export default function Add() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState(null);
  const { run, loading, error, setError } = useAsync();

  const submit = (e) => {
    e.preventDefault();
    const text = q.trim();
    if (!text) return;
    run(async () => {
      setResults(null);
      if (looksLikeIsbn(text)) {
        await startFromIsbn(text);
      } else {
        const list = await searchBooks(text);
        if (!list.length) throw new Error('Eşleşen kitap bulunamadı. Başka bir yazım deneyin ya da elle ekleyin.');
        setResults(list);
      }
    });
  };

  return (
    <div className="screen">
      <TopBar title="Kitap ekle" onBack={() => back('/')} />

      <div className="action-cards">
        <button className="action-card" onClick={() => go('/scan')}>
          <Icon name="barcode" size={30} />
          <b>Barkod / QR tara</b>
          <span>Kitabın arkasındaki barkodu okutun</span>
        </button>
        <button className="action-card" onClick={() => go('/scan-cover')}>
          <Icon name="camera" size={30} />
          <b>Kapaktan oku</b>
          <span>Kapağı fotoğraflayın, ad ve yazar gelsin</span>
        </button>
      </div>

      <form className="card" onSubmit={submit}>
        <label className="field">
          <span className="field-label">ISBN yazın ya da kitap adıyla arayın</span>
          <div className="inline">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setError('');
              }}
              placeholder="9789750719387 ya da “Sefiller Victor Hugo”"
              inputMode="search"
              enterKeyHint="search"
            />
            <button className="btn primary" type="submit" disabled={loading || !q.trim()}>
              Ara
            </button>
          </div>
        </label>
        {error ? <p className="error">{error}</p> : null}
      </form>

      {loading ? <Spinner label="Aranıyor…" /> : null}

      {results ? (
        <ul className="list">
          {results.map((b, i) => (
            <li key={i}>
              <button className="list-item" onClick={() => startFromInfo(b)}>
                <Cover book={b} className="small" />
                <span className="li-text">
                  <span className="li-title">{b.title}</span>
                  <span className="li-author">{b.author || '—'}</span>
                  <span className="li-meta muted">
                    {[b.publisher, (b.publishedDate || '').slice(0, 4)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Icon name="right" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <button className="btn ghost wide" onClick={() => openForm({}, { found: false })}>
        <Icon name="edit" size={18} /> Bilgileri elle gireceğim
      </button>
    </div>
  );
}
