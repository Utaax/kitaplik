import { useEffect, useState, useSyncExternalStore } from 'react';
import { useObjectUrl } from '../hooks.js';
import { hashString } from '../lib/util.js';

/* ---------- Simgeler ---------- */
const PATHS = {
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  sliders:
    '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  camera:
    '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  back: '<polyline points="15 18 9 12 15 6"/>',
  right: '<polyline points="9 18 15 12 9 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  barcode: '<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>',
  text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
  link: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
};

export function Icon({ name, size = 22, fill = false, className = '' }) {
  return (
    <svg
      className={'icon ' + className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: PATHS[name] || '' }}
    />
  );
}

/* ---------- Görseller ---------- */
export function BlobImg({ blob, alt = '', className = '', onClick }) {
  const url = useObjectUrl(blob);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} onClick={onClick} />;
}

const COVER_COLORS = ['#2f5d50', '#8c2f39', '#2b4c7e', '#c8643b', '#6b4c9a', '#17717d', '#a67c00', '#3d4451'];

// Kapak: yerel kopya → uzak adres → otomatik üretilen kapak
export function Cover({ book, className = '' }) {
  const [failed, setFailed] = useState(false);
  const url = useObjectUrl(book.cover);
  useEffect(() => setFailed(false), [book.coverUrl]);
  const src = url || (!failed && book.coverUrl) || '';
  if (src) {
    return (
      <div className={'cover ' + className}>
        <img src={src} alt={book.title} loading="lazy" onError={() => setFailed(true)} />
      </div>
    );
  }
  const color = COVER_COLORS[hashString(book.title || 'x') % COVER_COLORS.length];
  return (
    <div className={'cover cover-generated ' + className} style={{ background: color }} aria-label={book.title}>
      <span className="cover-title">{book.title || 'Adsız'}</span>
      {book.author ? <span className="cover-author">{book.author}</span> : null}
    </div>
  );
}

/* ---------- Durum etiketleri ---------- */
export const STATUS = {
  toRead: { label: 'Okunacak', short: 'Okunacak' },
  reading: { label: 'Okunuyor', short: 'Okunuyor' },
  read: { label: 'Okundu', short: 'Okundu' },
};
export const STATUS_KEYS = ['toRead', 'reading', 'read'];

export function StatusBadge({ status }) {
  return <span className={'badge badge-' + status}>{STATUS[status]?.short || ''}</span>;
}

export function Segmented({ value, onChange, options, className = '' }) {
  return (
    <div className={'segmented ' + className} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 26 }) {
  return (
    <div className="stars" role="radiogroup" aria-label="Puan">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={'star' + (n <= value ? ' on' : '')}
          onClick={() => onChange && onChange(value === n ? 0 : n)}
          aria-label={`${n} yıldız`}
          disabled={!onChange}
        >
          <Icon name="star" size={size} fill={n <= value} />
        </button>
      ))}
    </div>
  );
}

/* ---------- Alt sayfa (sheet) ---------- */
export function Sheet({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Kapat">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer ? <div className="sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ---------- Bildirimler (toast) ---------- */
let toastState = { msg: '', id: 0 };
const toastSubs = new Set();
export function toast(msg) {
  toastState = { msg, id: toastState.id + 1 };
  toastSubs.forEach((f) => f());
  setTimeout(() => {
    if (toastState.msg === msg) {
      toastState = { msg: '', id: toastState.id + 1 };
      toastSubs.forEach((f) => f());
    }
  }, 3200);
}
export function ToastHost() {
  const t = useSyncExternalStore(
    (cb) => {
      toastSubs.add(cb);
      return () => toastSubs.delete(cb);
    },
    () => toastState
  );
  if (!t.msg) return null;
  return (
    <div className="toast" role="status">
      {t.msg}
    </div>
  );
}

/* ---------- Küçük parçalar ---------- */
export function Spinner({ label }) {
  return (
    <div className="spinner-wrap">
      <div className="spinner" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

export function EmptyState({ icon = 'book', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={44} />
      <h3>{title}</h3>
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}

export function TopBar({ title, onBack, right }) {
  return (
    <header className="topbar">
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="Geri">
          <Icon name="back" />
        </button>
      ) : (
        <span style={{ width: 44 }} />
      )}
      <h1>{title}</h1>
      <div className="topbar-right">{right}</div>
    </header>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/* ---------- Onay penceresi (tarayıcının confirm() yerine) ---------- */
let confirmState = null;
const confirmSubs = new Set();
const emitConfirm = () => confirmSubs.forEach((f) => f());
export function askConfirm(message, { ok = 'Evet', cancel = 'Vazgeç', danger = false } = {}) {
  return new Promise((resolve) => {
    if (confirmState) confirmState.resolve(false);
    confirmState = { message, ok, cancel, danger, resolve };
    emitConfirm();
  });
}
function closeConfirm(v) {
  const s = confirmState;
  confirmState = null;
  emitConfirm();
  if (s) s.resolve(v);
}
export function ConfirmHost() {
  const s = useSyncExternalStore(
    (cb) => {
      confirmSubs.add(cb);
      return () => confirmSubs.delete(cb);
    },
    () => confirmState
  );
  if (!s) return null;
  return (
    <div className="sheet-backdrop confirm-backdrop" onClick={() => closeConfirm(false)}>
      <div className="confirm" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <p>{s.message}</p>
        <div className="confirm-actions">
          <button className="btn ghost" onClick={() => closeConfirm(false)} autoFocus>
            {s.cancel}
          </button>
          <button className={'btn ' + (s.danger ? 'danger-fill' : 'primary')} onClick={() => closeConfirm(true)}>
            {s.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
