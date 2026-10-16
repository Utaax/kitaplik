// Kapak eşleştirme (ücretsiz, telefonda): OCR'ın okuduğu kelimelerden anahtar kelime çıkarır,
// arama sorguları üretir ve bulunan kitapları okunan kelimelerle örtüşmesine göre puanlar.
// OCR kusurlu olsa bile (ör. "MANTOLV", "MAD0NNA") doğru kitabı bulmak için bulanık eşleştirme yapar.

import { normalizeText } from './util.js';

const STOP = new Set(
  (
    've ile bir bu da de icin gibi ama veya hem cok daha en ne o su ki mi mu dan den nin nun ' +
    'the and of a an to in on for with by from at is are as or ' +
    'roman romani oyku oykuler siir siirler deneme kitap kitabi kitaplari yayin yayinlari yayinevi yayincilik yay ' +
    'cev ceviren cevirmen ceviri translated edition baski basim isbn www com tr cilt kapak ' +
    'klasikleri klasik dizisi dizi seri sayfa'
  ).split(' ')
);

const FIX = { 0: 'o', 1: 'i', 5: 's', 8: 'b', '|': 'i' };

// Tek bir OCR kelimesini aramaya uygun hale getirir
export function cleanToken(raw) {
  const fixed = String(raw || '').replace(/[0158|]/g, (c) => (/[a-zçğıöşü]/i.test(String(raw)) ? FIX[c] : c));
  return normalizeText(fixed);
}

// words: [{ text, confidence, h }] -> [{ w, weight }] (büyük ve güvenilir kelimeler önce)
export function extractKeywords(words, max = 12) {
  const maxH = Math.max(1, ...words.map((x) => x.h || 1));
  const best = new Map();
  for (const x of words) {
    const conf = Number(x.confidence ?? 60);
    if (conf < 35) continue;
    for (const w of cleanToken(x.text).split(' ')) {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) continue;
      if (!/[aeiou]/.test(w) && w.length < 5) continue; // ünlüsüz kısa parçalar çoğunlukla gürültüdür
      const weight = (0.35 + 0.65 * Math.min(1, (x.h || 1) / maxH)) * (0.5 + 0.5 * Math.min(1, conf / 90));
      if (!best.has(w) || best.get(w) < weight) best.set(w, weight);
    }
  }
  return [...best.entries()]
    .map(([w, weight]) => ({ w, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

export function levenshtein(a, b, cap = 3) {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    let rowMin = prev[0];
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
      rowMin = Math.min(rowMin, prev[j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return prev[b.length];
}

// Anahtar kelimenin aday kelimelerden birine benzerliği (0..1)
export function tokenSimilarity(k, tokens) {
  let best = 0;
  for (const t of tokens) {
    if (t === k) return 1;
    if (k.length >= 4 && t.length >= 4 && (t.startsWith(k) || k.startsWith(t))) best = Math.max(best, 0.8);
    const limit = k.length >= 7 ? 2 : k.length >= 4 ? 1 : 0;
    if (limit && levenshtein(k, t, limit) <= limit) best = Math.max(best, 0.7);
  }
  return best;
}

const tokensOf = (s) => normalizeText(s).split(' ').filter((w) => w.length >= 2);

// Bir aday kitabın OCR kelimeleriyle örtüşme puanı (0..~1.5)
export function scoreCandidate(keywords, cand) {
  if (!keywords.length) return 0;
  const all = tokensOf([cand.title, cand.subtitle, cand.author, cand.publisher].join(' '));
  const top = keywords.slice(0, 8);
  const total = top.reduce((s, k) => s + k.weight, 0);
  const hit = top.reduce((s, k) => s + k.weight * tokenSimilarity(k.w, all), 0);
  // Kitap adının kelimeleri kapakta okunduysa güçlü işaret
  const titleWords = tokensOf(cand.title).filter((w) => w.length >= 3 && !STOP.has(w));
  const kw = keywords.map((k) => k.w);
  const covered = titleWords.filter((t) => tokenSimilarity(t, kw) >= 0.7).length;
  const coverage = titleWords.length ? covered / titleWords.length : 0;
  return hit / total + 0.5 * coverage;
}

// Arama sorguları: en büyük kelimeler (genelde başlık), tahmin edilen başlık+yazar, daha geniş kelime kümesi
export function buildQueries(keywords, guess = {}) {
  const ws = keywords.map((k) => k.w);
  const qs = [
    ws.slice(0, 2).join(' '),
    ws.slice(0, 4).join(' '),
    [guess.title, guess.author].filter(Boolean).join(' '),
    ws.slice(0, 6).join(' '),
  ]
    .map((q) => q.trim())
    .filter((q) => q.length >= 3);
  return [...new Set(qs)].slice(0, 4);
}

// Sonuçları birleştir, puanla, sırala
export function rankCandidates(keywords, lists) {
  const seen = new Map();
  for (const b of lists.flat()) {
    if (!b || !b.title) continue;
    const key = b.isbn || normalizeText(b.title + ' ' + b.author);
    if (!seen.has(key)) seen.set(key, b);
  }
  return [...seen.values()]
    .map((b) => ({ ...b, matchScore: scoreCandidate(keywords, b) }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
