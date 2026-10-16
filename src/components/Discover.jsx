import { useEffect, useMemo, useState } from 'react';
import { wikiInfo } from '../services/wiki.js';
import { authorBooks, publisherBooks } from '../services/lookup.js';
import { repo, newBook } from '../data/repo.js';
import { useBooks } from '../hooks.js';
import { Cover, Icon, Spinner, toast } from './ui.jsx';
import { normalizeText, splitAuthors, truncate, yearOf } from '../lib/util.js';
import { DEMO } from '../env.js';

function InfoCard({ info, kind }) {
  const [open, setOpen] = useState(false);
  if (!info) {
    return (
      <p className="muted">
        {kind === 'author' ? 'Bu yazar için Vikipedi’de uygun bir sayfa bulunamadı.' : 'Bu yayınevi için Vikipedi’de uygun bir sayfa bulunamadı.'}
      </p>
    );
  }
  const long = info.extract.length > 420;
  return (
    <div className="info-card">
      {info.image ? <img src={info.image} alt={info.title} loading="lazy" /> : null}
      <div>
        <b>{info.title}</b>
        {info.description ? <div className="muted small">{info.description}</div> : null}
        <p>{open || !long ? info.extract : truncate(info.extract, 420)}</p>
        {long ? (
          <button className="btn link" onClick={() => setOpen(!open)}>
            {open ? 'Daha az göster' : 'Devamını göster'}
          </button>
        ) : null}
        <a className="src-link" href={info.url} target="_blank" rel="noreferrer">
          <Icon name="link" size={14} /> Vikipedi ({info.lang === 'tr' ? 'Türkçe' : 'İngilizce'}) · CC BY-SA
        </a>
      </div>
    </div>
  );
}

function MiniBooks({ list, library, excludeIsbn, excludeTitle }) {
  const have = useMemo(() => {
    const isbns = new Set(library.map((b) => b.isbn).filter(Boolean));
    const titles = new Set(library.map((b) => normalizeText(b.title)));
    return (b) => (b.isbn && isbns.has(b.isbn)) || titles.has(normalizeText(b.title));
  }, [library]);
  const [added, setAdded] = useState({});

  const add = async (b) => {
    const rec = newBook({ ...b, status: 'toRead' });
    delete rec.ratingsCount;
    delete rec.averageRating;
    delete rec.source;
    await repo.saveBook(rec);
    setAdded((a) => ({ ...a, [b.title]: true }));
    toast(`“${b.title}” okunacaklara eklendi`);
  };

  const shown = list.filter((b) => !(excludeIsbn && b.isbn === excludeIsbn) && normalizeText(b.title) !== normalizeText(excludeTitle));
  if (!shown.length) return <p className="muted">Listelenecek başka kitap bulunamadı.</p>;
  return (
    <ul className="mini-list">
      {shown.map((b, i) => {
        const owned = have(b) || added[b.title];
        return (
          <li key={i}>
            <Cover book={b} className="tiny" />
            <span className="li-text">
              <span className="li-title">{b.title}</span>
              <span className="li-meta muted">{[b.author, yearOf(b.publishedDate)].filter(Boolean).join(' · ')}</span>
            </span>
            {owned ? (
              <span className="badge badge-read">Kitaplıkta</span>
            ) : (
              <button className="btn ghost small" onClick={() => add(b)}>
                <Icon name="plus" size={14} /> Okunacak
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Block({ kind, name, book }) {
  const library = useBooks() || [];
  const [query, setQuery] = useState(name);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    setQuery(name);
    setDraft(name);
  }, [name]);

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    const booksFn = kind === 'author' ? authorBooks : publisherBooks;
    Promise.allSettled([wikiInfo(query, kind), booksFn(query)]).then(([w, b]) => {
      if (!alive) return;
      if (w.status === 'rejected' && b.status === 'rejected') {
        setState({ status: 'error' });
      } else {
        setState({
          status: 'ok',
          info: w.status === 'fulfilled' ? w.value : null,
          books: b.status === 'fulfilled' ? b.value : [],
          booksFailed: b.status === 'rejected',
        });
      }
    });
    return () => {
      alive = false;
    };
  }, [query, kind]);

  return (
    <section className="card">
      <div className="card-head">
        <h3>{kind === 'author' ? 'Yazar hakkında' : 'Yayınevi hakkında'}</h3>
        <button className="btn link" onClick={() => setEditing(!editing)}>
          Yanlış mı?
        </button>
      </div>
      <p className="card-sub">{query}</p>

      {editing ? (
        <form
          className="inline"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.trim()) setQuery(draft.trim());
            setEditing(false);
          }}
        >
          <input value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Arama adı" />
          <button className="btn primary" type="submit">
            Ara
          </button>
        </form>
      ) : null}

      {state.status === 'loading' ? <Spinner label="Bilgiler getiriliyor…" /> : null}
      {state.status === 'error' ? <p className="error">Bilgiler alınamadı. İnternet bağlantınızı kontrol edip yeniden deneyin.</p> : null}
      {state.status === 'ok' ? (
        <>
          <InfoCard info={state.info} kind={kind} />
          <h4>{kind === 'author' ? 'Diğer kitapları' : 'Öne çıkan kitapları'}</h4>
          {state.booksFailed ? (
            <p className="muted">Kitap listesi şu an alınamadı.</p>
          ) : (
            <MiniBooks list={state.books} library={library} excludeIsbn={book.isbn} excludeTitle={book.title} />
          )}
          {kind === 'publisher' ? (
            <p className="muted small">“Öne çıkan” sıralaması Google Books’taki ilgi ve okur puanı sayısına dayanır; satış listesi değildir.</p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export default function Discover({ book }) {
  if (DEMO) {
    return (
      <section className="card">
        <h3>Keşfet</h3>
        <p className="muted">
          Tam sürümde bu sekmede yazar hakkında Vikipedi özeti ve yazarın diğer kitapları, yayınevi hakkında bilgi ve yayınevinin öne çıkan kitapları gösterilir. Önerilen kitapları tek dokunuşla “Okunacak” listenize ekleyebilirsiniz.
        </p>
        <p className="muted small">Claude içindeki demo sürümü dış sitelere bağlanamadığı için bu bilgiler burada gösterilemiyor.</p>
      </section>
    );
  }
  return <DiscoverLive book={book} />;
}

function DiscoverLive({ book }) {
  const authors = useMemo(() => splitAuthors(book.author), [book.author]);
  const [authorIdx, setAuthorIdx] = useState(0);
  const author = authors[authorIdx] || authors[0];

  return (
    <div>
      {authors.length > 1 ? (
        <div className="chips wrap">
          {authors.map((a, i) => (
            <button key={a} className={'chip' + (i === authorIdx ? ' on' : '')} onClick={() => setAuthorIdx(i)}>
              {a}
            </button>
          ))}
        </div>
      ) : null}
      {author ? <Block key={'a' + author} kind="author" name={author} book={book} /> : <p className="muted card">Yazar bilgisi girilirse burada yazar hakkında bilgi görünür.</p>}
      {book.publisher ? <Block key={'p' + book.publisher} kind="publisher" name={book.publisher} book={book} /> : <p className="muted card">Yayınevi bilgisi girilirse burada yayınevi hakkında bilgi görünür.</p>}
    </div>
  );
}
