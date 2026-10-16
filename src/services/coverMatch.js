// Ücretsiz kapak eşleştirme: OCR kelimeleri -> birkaç arama -> örtüşmeye göre sıralama
import { searchBooks } from './lookup.js';
import { extractKeywords, buildQueries, rankCandidates } from '../lib/match.js';

export async function matchCover(words, guess = {}) {
  const keywords = extractKeywords(words);
  const queries = buildQueries(keywords, guess);
  if (!queries.length) return { keywords, ranked: [] };
  const settled = await Promise.allSettled(queries.map((q) => searchBooks(q, { limit: 15 })));
  const lists = settled.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  if (!lists.length && settled.length) throw settled[0].reason;
  const ranked = rankCandidates(keywords, lists).slice(0, 8);
  return { keywords, ranked };
}
