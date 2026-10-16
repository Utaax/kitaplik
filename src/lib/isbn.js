// ISBN yardımcıları: doğrulama, ISBN-10 → ISBN-13, metinden ISBN ayıklama

export function cleanIsbn(s) {
  return String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
}

export function isValidIsbn10(s) {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const c = s[i];
    const v = c === 'X' ? 10 : Number(c);
    sum += (10 - i) * v;
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(s) {
  if (!/^\d{13}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export function isbn10to13(s10) {
  const core = '978' + s10.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return core + String((10 - (sum % 10)) % 10);
}

// Geçerli bir ISBN ise 13 haneli halini döndürür, değilse null
export function toIsbn13(input) {
  const s = cleanIsbn(input);
  if (s.length === 13 && isValidIsbn13(s) && /^97[89]/.test(s)) return s;
  if (s.length === 10 && isValidIsbn10(s)) return isbn10to13(s);
  return null;
}

// Barkod/QR içeriğinden (düz sayı, URL, tireli ISBN...) ISBN ayıklar
export function extractIsbn(text) {
  const raw = String(text || '');
  const compact = raw.replace(/[\s-]/g, '');
  for (const m of compact.matchAll(/97[89]\d{10}/g)) {
    if (isValidIsbn13(m[0])) return m[0];
  }
  for (const m of compact.matchAll(/\d{9}[\dXx]/g)) {
    const v = m[0].toUpperCase();
    if (isValidIsbn10(v)) return isbn10to13(v);
  }
  return null;
}

// Kullanıcı girdisi ISBN'e benziyor mu? (arama mı ISBN sorgusu mu ayırmak için)
export function looksLikeIsbn(input) {
  const s = cleanIsbn(input);
  const digitsOnly = String(input || '').replace(/[\s-]/g, '');
  return /^[\dXx]+$/.test(digitsOnly) && (s.length === 10 || s.length === 13);
}
