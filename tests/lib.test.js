import test from 'node:test';
import assert from 'node:assert/strict';
import { toIsbn13, extractIsbn, looksLikeIsbn, isValidIsbn13 } from '../src/lib/isbn.js';
import { parsePageNumber, guessCover } from '../src/lib/ocrParse.js';
import { normalizeText, splitAuthors, parseTags, truncate } from '../src/lib/util.js';

test('ISBN doğrulama ve dönüştürme', () => {
  assert.equal(toIsbn13('9789750719387') === null, !isValidIsbn13('9789750719387'));
  assert.equal(toIsbn13('978-0-306-40615-7'), '9780306406157');
  assert.equal(toIsbn13('0-306-40615-2'), '9780306406157'); // ISBN-10 → 13
  assert.equal(toIsbn13('9780306406158'), null); // hatalı sağlama
  assert.equal(toIsbn13('abc'), null);
});

test('Barkod/QR içeriğinden ISBN ayıklama', () => {
  assert.equal(extractIsbn('9780306406157'), '9780306406157');
  assert.equal(extractIsbn('https://example.com/kitap/9780306406157?x=1'), '9780306406157');
  assert.equal(extractIsbn('ISBN 978-0-306-40615-7'), '9780306406157');
  assert.equal(extractIsbn('0306406152'), '9780306406157');
  assert.equal(extractIsbn('1234567890123'), null);
});

test('ISBN benzeri girdi tespiti', () => {
  assert.equal(looksLikeIsbn('978-0-306-40615-7'), true);
  assert.equal(looksLikeIsbn('Sefiller Victor Hugo'), false);
  assert.equal(looksLikeIsbn('12345'), false);
});

test('Sayfa numarası: altta tek başına sayı', () => {
  const lines = [
    { text: 'Bir zamanlar uzak bir ülkede', confidence: 90, bbox: { x0: 50, y0: 400, x1: 700, y1: 440 } },
    { text: '- 45 -', confidence: 80, bbox: { x0: 350, y0: 1450, x1: 400, y1: 1480 } },
  ];
  const r = parsePageNumber(lines, 1500);
  assert.equal(r.page, 45);
  assert.equal(r.where, 'bottom');
});

test('Sayfa numarası: üstte koşan başlıkla birlikte', () => {
  const lines = [{ text: 'SEFİLLER 128', confidence: 85, bbox: { x0: 50, y0: 40, x1: 700, y1: 80 } }];
  assert.equal(parsePageNumber(lines, 1500).page, 128);
});

test('Sayfa numarası: gövde metnindeki sayılar yok sayılır', () => {
  const lines = [{ text: '1984 yılında', confidence: 90, bbox: { x0: 50, y0: 700, x1: 400, y1: 740 } }];
  assert.equal(parsePageNumber(lines, 1500), null);
});

test('Kapak tahmini: en büyük satır başlık, isim gibi satır yazar', () => {
  const lines = [
    { text: 'Orhan Pamuk', confidence: 90, bbox: { x0: 100, y0: 50, x1: 500, y1: 100 } },
    { text: 'KAR', confidence: 92, bbox: { x0: 100, y0: 400, x1: 700, y1: 560 } },
    { text: 'roman', confidence: 70, bbox: { x0: 100, y0: 900, x1: 300, y1: 930 } },
  ];
  const g = guessCover(lines);
  assert.equal(g.title, 'KAR');
  assert.equal(g.author, 'Orhan Pamuk');
});

test('Türkçe metin sadeleştirme ve yardımcılar', () => {
  assert.equal(normalizeText('ISPARTA Çiçekçi Şöför'), 'isparta cicekci sofor');
  assert.deepEqual(splitAuthors('Ali Veli, Ayşe Fatma & Can Can'), ['Ali Veli', 'Ayşe Fatma', 'Can Can']);
  assert.deepEqual(parseTags('roman, tarih; roman'), ['roman', 'tarih']);
  assert.equal(truncate('kısa', 10), 'kısa');
});
