import test from 'node:test';
import assert from 'node:assert/strict';
import { extractKeywords, cleanToken, scoreCandidate, rankCandidates, buildQueries, levenshtein } from '../src/lib/match.js';

// Gerçekçi, hatalı bir OCR çıktısı: büyük başlık, küçük yazar, yayınevi ve gürültü
const words = [
  { text: 'KÜRK', confidence: 88, h: 120 },
  { text: 'MANTOLV', confidence: 61, h: 118 },
  { text: 'MAD0NNA', confidence: 57, h: 121 },
  { text: 'Sabahattin', confidence: 80, h: 40 },
  { text: 'Ali', confidence: 85, h: 40 },
  { text: 'YAPI', confidence: 70, h: 20 },
  { text: 'KREDİ', confidence: 66, h: 20 },
  { text: 'YAYINLARI', confidence: 75, h: 20 },
  { text: '~*', confidence: 20, h: 10 },
  { text: 'ıııı', confidence: 30, h: 8 },
];

test('OCR hataları düzeltilir ve anahtar kelimeler büyük yazıdan önce gelir', () => {
  assert.equal(cleanToken('MAD0NNA'), 'madonna');
  const kw = extractKeywords(words);
  const ws = kw.map((k) => k.w);
  assert.equal(ws[0], 'kurk');
  for (const w of ['madonna', 'mantolv']) assert.ok(ws.slice(0, 4).includes(w), `${w} ilk dörtte olmalı: ${ws}`);
  assert.ok(!ws.includes('yayinlari'), 'yayınevi eki durdurma sözcüğü olmalı');
  assert.ok(ws.includes('sabahattin'));
});

test('Bulanık eşleştirme: doğru kitap en üstte', () => {
  const kw = extractKeywords(words);
  const lists = [
    [
      { title: 'Madonna: Bir Biyografi', author: 'Lucy O’Brien', publisher: 'Epsilon' },
      { title: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali', publisher: 'Yapı Kredi Yayınları', isbn: '9789753638029' },
    ],
    [
      { title: 'İçimizdeki Şeytan', author: 'Sabahattin Ali', publisher: 'Yapı Kredi Yayınları', isbn: '9789750800036' },
      { title: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali', publisher: 'Yapı Kredi Yayınları', isbn: '9789753638029' },
    ],
  ];
  const ranked = rankCandidates(kw, lists);
  assert.equal(ranked.length, 3, 'aynı ISBN tekrar etmemeli');
  assert.equal(ranked[0].title, 'Kürk Mantolu Madonna');
  assert.ok(ranked[0].matchScore > 1, `puan yüksek olmalı: ${ranked[0].matchScore}`);
  assert.ok(ranked[0].matchScore > ranked[1].matchScore + 0.4);
});

test('Sorgular üretilir ve tekrar etmez', () => {
  const kw = extractKeywords(words);
  const qs = buildQueries(kw, { title: 'KÜRK MANTOLV MAD0NNA', author: 'Sabahattin Ali' });
  assert.ok(qs.length >= 2 && qs.length <= 4);
  assert.equal(new Set(qs).size, qs.length);
});

test('Levenshtein sınırı', () => {
  assert.equal(levenshtein('mantolv', 'mantolu', 2), 1);
  assert.ok(levenshtein('abc', 'xyzxyz', 2) > 2);
  assert.equal(scoreCandidate([], { title: 'x' }), 0);
});
