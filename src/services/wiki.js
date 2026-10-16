// Vikipedi'den yazar ve yayınevi özeti getirir (önce Türkçe, bulunamazsa İngilizce).
// İçerik CC BY-SA lisanslıdır; ekranda kaynak ve bağlantı gösterilir.

import { normalizeText } from '../lib/util.js';
import { repo } from '../data/repo.js';

const DAY = 24 * 3600 * 1000;

const SUFFIX = {
  author: { tr: 'yazar', en: 'author' },
  publisher: { tr: 'yayınevi', en: 'publisher' },
};

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

// Başlıkta aranan adın anlamlı sözcüklerinden en az biri (yazarlarda soyadı) geçmeli
function plausible(title, name, kind) {
  const t = normalizeText(title);
  const words = normalizeText(name).split(' ').filter((w) => w.length > 2);
  if (!words.length) return false;
  if (kind === 'author') {
    const last = words[words.length - 1];
    return t.includes(last);
  }
  return words.some((w) => t.includes(w));
}

async function trySearch(lang, name, kind) {
  const q = `${name} ${SUFFIX[kind][lang]}`;
  const search = await getJson(
    `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=4&format=json&origin=*`
  );
  const hits = search?.query?.search || [];
  const pick = hits.find((h) => plausible(h.title, name, kind));
  if (!pick) return null;
  const s = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pick.title)}`);
  if (!s?.extract) return null;
  return {
    lang,
    title: s.title,
    description: s.description || '',
    extract: s.extract,
    image: s.thumbnail?.source || '',
    url: s.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pick.title)}`,
  };
}

// kind: 'author' | 'publisher'. Bulunamazsa null.
export async function wikiInfo(name, kind) {
  const n = String(name || '').trim();
  if (!n) return null;
  const key = `wiki:${kind}:${normalizeText(n)}`;
  const hit = await repo.cacheGet(key, 30 * DAY).catch(() => undefined);
  if (hit !== undefined) return hit;
  let result = null;
  for (const lang of ['tr', 'en']) {
    try {
      result = await trySearch(lang, n, kind);
    } catch {
      /* diğer dili dene */
    }
    if (result) break;
  }
  // Başarısız aramayı önbelleğe alma: ağ hatası olabilir
  if (result) repo.cacheSet(key, result).catch(() => {});
  return result;
}
