import { useState } from 'react';
import { back, go } from '../router.js';
import { Cover, Field, Icon, Spinner, TopBar } from '../components/ui.jsx';
import { pickImage, resizeImage } from '../services/images.js';
import { readCover } from '../services/ocr.js';
import { searchBooks, searchByTitleAuthor, lookupByIsbn } from '../services/lookup.js';
import { getAi, useAi, readCoverWithAi, PROVIDERS } from '../services/ai.js';
import { toIsbn13 } from '../lib/isbn.js';
import { matchCover } from '../services/coverMatch.js';
import { openForm, startFromInfo } from '../flows.js';
import { useAsync, useObjectUrl } from '../hooks.js';
import { DEMO } from '../env.js';

const FIELDS = [
  ['title', 'Kitap adı'],
  ['author', 'Yazar'],
  ['publisher', 'Yayınevi'],
];

export default function CoverScan() {
  const [photo, setPhoto] = useState(null);
  const photoUrl = useObjectUrl(photo);
  const [lines, setLines] = useState([]);
  const [vals, setVals] = useState({ title: '', author: '', publisher: '', subtitle: '', isbn: '' });
  const [readBy, setReadBy] = useState(''); // hangi yöntemle okundu
  const ai = useAi();
  const [active, setActive] = useState('title');
  const [progress, setProgress] = useState(null); // { p, text }
  const [results, setResults] = useState(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [ocrFailed, setOcrFailed] = useState('');
  const { run, loading, error } = useAsync();

  const autoSearch = async (v) => {
    try {
      const isbn = toIsbn13(v.isbn);
      if (isbn) {
        const hit = await lookupByIsbn(isbn);
        if (hit) {
          setResults([hit]);
          return;
        }
      }
      if (!v.title) return;
      let list = await searchByTitleAuthor(v.title, v.author);
      if (!list.length) list = await searchBooks([v.title, v.author].filter(Boolean).join(' '));
      if (list.length) setResults(list.slice(0, 6));
    } catch {
      /* arama başarısızsa kullanıcı elle devam eder */
    }
  };

  const runLocalOcr = async (blob) => {
    const r = await readCover(blob, (p, text) => setProgress({ p, text }));
    setLines(r.lines);
    const v = { title: r.title || '', author: r.author || '', publisher: '', subtitle: '', isbn: '' };
    setVals(v);
    setReadBy('Telefonda okundu (ücretsiz)');
    // Okunan tüm kelimelerle ara ve örtüşmeye göre sırala
    setProgress({ p: 0, text: 'Okunan kelimelerle kitap aranıyor…' });
    try {
      const { ranked } = await matchCover(r.words || [], r);
      if (ranked.length) {
        setResults(ranked);
        const top = ranked[0];
        if (top.matchScore >= 0.9) setVals({ title: top.title, author: top.author, publisher: top.publisher, subtitle: top.subtitle || '', isbn: top.isbn || '' });
      }
    } catch {
      /* arama başarısız: kullanıcı elle düzeltir */
    }
    return { ...v, matched: true };
  };

  const choose = async (camera) => {
    const file = await pickImage({ camera });
    if (!file) return;
    setResults(null);
    setOcrFailed('');
    setLines([]);
    const { blob } = await resizeImage(file, 1600, 0.85);
    setPhoto(blob);
    const cfg = getAi();
    let v = null;
    if (cfg) {
      setProgress({ p: 0, text: `${PROVIDERS[cfg.provider].label} kapağı okuyor…` });
      try {
        const r = await readCoverWithAi(blob, cfg);
        v = { title: r.title, author: r.author, publisher: r.publisher, subtitle: r.subtitle, isbn: r.isbn };
        setVals(v);
        setReadBy(`${PROVIDERS[cfg.provider].label} ile okundu`);
      } catch (e) {
        setOcrFailed(`${PROVIDERS[cfg.provider].label} ile okunamadı: ${e.message} Telefonda metin tanıma deneniyor.`);
      }
    }
    if (!v) {
      setProgress({ p: 0, text: 'Kapak okunuyor…' });
      try {
        v = await runLocalOcr(blob);
      } catch {
        setOcrFailed(DEMO ? 'Kapaktan yazı okuma demo sürümünde kapalıdır. Fotoğrafı kapak olarak kullanıp bilgileri elle girebilirsiniz.' : 'Metin okuma yüklenemedi (ilk kullanımda internet gerekir). Fotoğrafı kapak olarak kullanıp bilgileri elle girebilirsiniz.');
      }
    }
    if (v && !v.matched) {
      setProgress({ p: 0, text: 'Eşleşen kitaplar aranıyor…' });
      await autoSearch(v);
    }
    setProgress(null);
  };

  const addChip = (text) =>
    setVals((v) => ({ ...v, [active]: (v[active] ? v[active] + ' ' : '') + text }));

  const search = () =>
    run(async () => {
      const query = [vals.title, vals.author].filter(Boolean).join(' ') || lines.slice(0, 3).join(' ');
      if (!query.trim()) throw new Error('Aramak için en az bir sözcük girin.');
      const list = await searchBooks(query);
      if (!list.length) throw new Error('Eşleşen kitap bulunamadı. Sözcükleri düzeltip yeniden deneyin ya da bu bilgilerle devam edin.');
      setResults(list);
    });

  return (
    <div className="screen">
      <TopBar title="Kapaktan oku" onBack={() => back('/add')} />

      {!photo && !progress ? (
        <div className="card center">
          <Icon name="camera" size={40} />
          <p>Kitabın ön kapağını düz ve iyi ışıkta fotoğraflayın. Başlık, yazar ve yayınevi otomatik algılanır; sonra düzeltebilirsiniz.</p>
          {ai ? (
            <p className="ai-badge">
              <span className="ai-dot" aria-hidden="true" /> {PROVIDERS[ai.provider].label} ile okunacak
            </p>
          ) : (
            <button className="btn link" onClick={() => go('/settings')}>
              Daha doğru okuma için yapay zeka hesabınızı bağlayın
            </button>
          )}
          <div className="stack">
            <button className="btn primary wide" onClick={() => choose(true)}>
              <Icon name="camera" size={18} /> Fotoğraf çek
            </button>
            <button className="btn ghost wide" onClick={() => choose(false)}>
              <Icon name="image" size={18} /> Galeriden seç
            </button>
          </div>
        </div>
      ) : null}

      {progress ? (
        <div className="card center">
          {photoUrl ? <img className="preview-cover" src={photoUrl} alt="Çekilen kapak" /> : null}
          <Spinner label={`${progress.text}${progress.p ? ` %${Math.round(progress.p * 100)}` : ''}`} />
        </div>
      ) : null}

      {photo && !progress ? (
        <>
          <div className="card row-top">
            {photoUrl ? <img className="preview-cover small" src={photoUrl} alt="Çekilen kapak" /> : null}
            <div className="grow">
              {readBy ? <p className="ai-badge">{readBy}</p> : null}
              {ocrFailed ? <p className="error">{ocrFailed}</p> : <p className="muted">Bilgileri kontrol edin, gerekirse düzeltin.</p>}
              <button className="btn ghost small" onClick={() => choose(true)}>
                Yeniden çek
              </button>
            </div>
          </div>

          <div className="card">
            {FIELDS.map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  value={vals[key]}
                  onFocus={() => setActive(key)}
                  onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
                  className={active === key ? 'active-field' : ''}
                />
              </Field>
            ))}
            {lines.length ? (
              <>
                <p className="field-label">Algılanan metinler → “{FIELDS.find((f) => f[0] === active)[1]}” alanına ekle</p>
                <div className="chips wrap">
                  {lines.map((l, i) => (
                    <button key={i} type="button" className="chip" onClick={() => addChip(l)}>
                      {l}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {error ? <p className="error">{error}</p> : null}
          <div className="stack">
            <button className="btn primary wide" onClick={search} disabled={loading || DEMO}>
              <Icon name="search" size={18} /> Eşleşen kitapları ara
            </button>
            <button
              className="btn ghost wide"
              onClick={() =>
                openForm(
                  { title: vals.title, subtitle: vals.subtitle, author: vals.author, publisher: vals.publisher, isbn: toIsbn13(vals.isbn) || '' },
                  { coverBlob: photo, found: false }
                )
              }
            >
              Bu bilgilerle devam et
            </button>
          </div>

          {loading ? <Spinner label="Aranıyor…" /> : null}

          {results ? (
            <>
              <label className="check">
                <input type="checkbox" checked={usePhoto} onChange={(e) => setUsePhoto(e.target.checked)} />
                Kapak olarak benim fotoğrafımı kullan
              </label>
              <p className="field-label">
                {results[0]?.matchScore != null && results[0].matchScore < 0.6
                  ? 'Kesin eşleşme bulunamadı. Doğru kitap listede yoksa bilgileri düzeltip yeniden arayın.'
                  : 'Doğru kitabı seçin'}
              </p>
              <ul className="list">
                {results.map((b, i) => (
                  <li key={(b.isbn || b.title) + i} className="rise" style={{ '--i': i }}>
                    <button
                      className={'list-item' + (i === 0 && (b.matchScore == null || b.matchScore >= 0.6) ? ' best-match' : '')}
                      onClick={() => {
                        const { matchScore, ratingsCount, averageRating, source, ...info } = b;
                        startFromInfo(info, { coverBlob: usePhoto ? photo : null });
                      }}
                    >
                      <Cover book={b} className="small" />
                      <span className="li-text">
                        {i === 0 && (b.matchScore == null || b.matchScore >= 0.6) ? <span className="best-tag">En olası eşleşme</span> : null}
                        <span className="li-title">{b.title}</span>
                        <span className="li-author">{b.author || '—'}</span>
                        <span className="li-meta muted">{[b.publisher, (b.publishedDate || '').slice(0, 4)].filter(Boolean).join(' · ')}</span>
                      </span>
                      <Icon name="right" size={18} />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
