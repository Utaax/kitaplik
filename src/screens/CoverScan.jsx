import { useState } from 'react';
import { back } from '../router.js';
import { Cover, Field, Icon, Spinner, TopBar } from '../components/ui.jsx';
import { pickImage, resizeImage } from '../services/images.js';
import { readCover } from '../services/ocr.js';
import { searchBooks } from '../services/lookup.js';
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
  const [vals, setVals] = useState({ title: '', author: '', publisher: '' });
  const [active, setActive] = useState('title');
  const [progress, setProgress] = useState(null); // { p, text }
  const [results, setResults] = useState(null);
  const [usePhoto, setUsePhoto] = useState(true);
  const [ocrFailed, setOcrFailed] = useState('');
  const { run, loading, error } = useAsync();

  const choose = async (camera) => {
    const file = await pickImage({ camera });
    if (!file) return;
    setResults(null);
    setOcrFailed('');
    const { blob } = await resizeImage(file, 1600, 0.85);
    setPhoto(blob);
    setProgress({ p: 0, text: 'Kapak okunuyor…' });
    try {
      const r = await readCover(blob, (p, text) => setProgress({ p, text }));
      setLines(r.lines);
      setVals((v) => ({ ...v, title: r.title || '', author: r.author || '' }));
    } catch {
      setOcrFailed(DEMO ? 'Kapaktan yazı okuma demo sürümünde kapalıdır. Fotoğrafı kapak olarak kullanıp bilgileri elle girebilirsiniz.' : 'Metin okuma yüklenemedi (ilk kullanımda internet gerekir). Fotoğrafı kapak olarak kullanıp bilgileri elle girebilirsiniz.');
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
          <p>Kitabın ön kapağını düz ve iyi ışıkta fotoğraflayın. Başlık ve yazar otomatik algılanır; sonra düzeltebilirsiniz.</p>
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
              {ocrFailed ? <p className="error">{ocrFailed}</p> : <p className="muted">Algılanan bilgileri düzeltin. Aşağıdaki kutucuklara dokunarak seçili alana ekleyebilirsiniz.</p>}
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
                  { title: vals.title, author: vals.author, publisher: vals.publisher },
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
              <ul className="list">
                {results.map((b, i) => (
                  <li key={i}>
                    <button className="list-item" onClick={() => startFromInfo(b, { coverBlob: usePhoto ? photo : null })}>
                      <Cover book={b} className="small" />
                      <span className="li-text">
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
