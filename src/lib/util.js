// Küçük yardımcı fonksiyonlar (saf, test edilebilir)

export const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export const nowISO = () => new Date().toISOString();

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y) return String(iso);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Türkçe karakterleri ve aksanları sadeleştirip küçük harfe çevirir (arama için)
export function normalizeText(s) {
  return String(s || '')
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

export function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function splitAuthors(str) {
  return String(str || '')
    .split(/\s*(?:,|;|&|\bve\b|\band\b)\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseTags(str) {
  return String(str || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);
}

export function yearOf(dateStr) {
  const m = String(dateStr || '').match(/\d{4}/);
  return m ? m[0] : '';
}

export function truncate(s, n) {
  s = String(s || '');
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const i = cut.lastIndexOf(' ');
  return (i > n * 0.6 ? cut.slice(0, i) : cut).trimEnd() + '…';
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Teknik hata iletilerini kullanıcıya anlaşılır Türkçeye çevirir
export function friendlyError(e, fallback = 'Bir hata oluştu, lütfen yeniden deneyin.') {
  const name = e?.name || '';
  const msg = String(e?.message || e || '');
  if (name === 'QuotaExceededError') return 'Telefonda yer kalmadı. Bazı fotoğrafları silip yeniden deneyin.';
  if (/Blob|File data|object store/i.test(msg)) return 'Fotoğraf kaydedilemedi. Uygulamayı kapatıp açın ve yeniden deneyin.';
  if (name === 'InvalidStateError' || /database|IndexedDB/i.test(msg)) return 'Kayıt yapılamadı: tarayıcı veri saklamaya izin vermiyor (gizli pencere olabilir).';
  if (/network|fetch|Failed to load/i.test(msg)) return 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip yeniden deneyin.';
  if (/[çğışöüÇĞİŞÖÜ]/.test(msg)) return msg; // zaten Türkçe
  return fallback;
}
