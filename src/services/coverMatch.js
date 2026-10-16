// Ücretsiz kapak eşleştirme: OCR kelimeleri -> birkaç arama -> örtüşmeye göre sıralama
import { searchBooks } from './lookup.js';
import { extractKeywords, buildQueries, rankCandidates } from '../lib/match.js';

export async function matchCover(words, guess = {}) {
  const keywords = extractKeywords(words);
  const queries = buildQueries(keywords, guess);
  if (!queries.length) return { keywords, ranked: [] };
  // Sırayla ara (servisi yormamak için); güçlü eşleşme bulununca dur
  const lists = [];
  let lastErr = null;
  let ranked = [];
  for (const q of queries.slice(0, 3)) {
    try {
      lists.push(await searchBooks(q, { limit: 15 }));
    } catch (e) {
      lastErr = e;
      continue;
    }
    ranked = rankCandidates(keywords, lists).slice(0, 8);
    if (ranked[0] && ranked[0].matchScore >= 1.1) break;
  }
  if (!lists.length && lastErr) throw lastErr;
  return { keywords, ranked };
}
