// OCR çıktısını yorumlayan saf fonksiyonlar (Tesseract'tan bağımsız, test edilebilir).
// Satır biçimi: { text, confidence, bbox: { x0, y0, x1, y1 } }

const PAGE_ONLY = /^[\s\-–—.·•|~_\[\(\{<«]*(\d{1,4})[\s\-–—.·•|~_\]\)\}>»]*$/;
const NUM_AT_END = /^(.*\D)\s+(\d{1,4})$/;
const NUM_AT_START = /^(\d{1,4})\s+(\D.*)$/;

// Sayfa fotoğrafında sayfa numarasını bulur. Üst ve alt %16'lık bantta arar.
export function parsePageNumber(lines, imageHeight) {
  if (!Array.isArray(lines) || !imageHeight) return null;
  const band = imageHeight * 0.16;
  const candidates = [];

  for (const line of lines) {
    const text = String(line.text || '').trim();
    if (!text || !line.bbox) continue;
    const cy = (line.bbox.y0 + line.bbox.y1) / 2;
    const inTop = cy <= band;
    const inBottom = cy >= imageHeight - band;
    if (!inTop && !inBottom) continue;
    const conf = Number(line.confidence ?? 50);

    let m = text.match(PAGE_ONLY);
    if (m) {
      candidates.push({ page: Number(m[1]), score: 100 + conf, where: inBottom ? 'bottom' : 'top' });
      continue;
    }
    // Koşan başlık + sayfa numarası: "KİTAP ADI 45" ya da "45 BÖLÜM ADI"
    m = text.match(NUM_AT_END);
    if (m && m[1].replace(/\D/g, '').length < m[1].length * 0.3) {
      candidates.push({ page: Number(m[2]), score: 40 + conf / 2, where: inBottom ? 'bottom' : 'top' });
      continue;
    }
    m = text.match(NUM_AT_START);
    if (m) candidates.push({ page: Number(m[1]), score: 40 + conf / 2, where: inBottom ? 'bottom' : 'top' });
  }

  const valid = candidates.filter((c) => c.page > 0 && c.page < 10000);
  if (!valid.length) return null;
  valid.sort((a, b) => b.score - a.score);
  return valid[0];
}

function lineHeight(l) {
  return Math.max(1, (l.bbox?.y1 ?? 0) - (l.bbox?.y0 ?? 0));
}

function looksLikePersonName(text) {
  const t = text.trim();
  if (/\d/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 4) return false;
  return words.every((w) => /^[A-Za-zÇĞİÖŞÜçğıöşüÂâÎîÛû.'’-]{1,20}$/.test(w));
}

// Kapak fotoğrafı satırlarından başlık/yazar tahmini üretir (kullanıcı düzeltebilir).
export function guessCover(lines) {
  const clean = (lines || [])
    .map((l) => ({
      text: String(l.text || '').replace(/\s+/g, ' ').trim(),
      confidence: Number(l.confidence ?? 0),
      bbox: l.bbox,
    }))
    .filter((l) => l.text.length >= 2 && l.confidence >= 40 && /\p{L}{2,}/u.test(l.text))
    .filter((l, i, a) => a.findIndex((x) => x.text.toLowerCase() === l.text.toLowerCase()) === i)
    .map((l) => ({ ...l, h: lineHeight(l) }))
    .sort((a, b) => (a.bbox?.y0 ?? 0) - (b.bbox?.y0 ?? 0));

  if (!clean.length) return { title: '', author: '', lines: [] };

  const maxH = Math.max(...clean.map((l) => l.h));
  const biggest = clean.find((l) => l.h === maxH);
  const idx = clean.indexOf(biggest);

  // Başlık: en büyük satır ve onunla komşu, benzer boyda satırlar
  const titleLines = [biggest];
  for (let i = idx - 1; i >= 0 && clean[i].h >= maxH * 0.7; i--) {
    if (clean[i + 1].bbox.y0 - clean[i].bbox.y1 > maxH * 1.5) break;
    titleLines.unshift(clean[i]);
  }
  for (let i = idx + 1; i < clean.length && clean[i].h >= maxH * 0.7; i++) {
    if (clean[i].bbox.y0 - clean[i - 1].bbox.y1 > maxH * 1.5) break;
    titleLines.push(clean[i]);
  }
  const title = titleLines.map((l) => l.text).join(' ');

  const rest = clean.filter((l) => !titleLines.includes(l));
  const authorLine = rest
    .filter((l) => looksLikePersonName(l.text))
    .sort((a, b) => b.h - a.h)[0];

  return { title, author: authorLine ? authorLine.text : '', lines: clean.map((l) => l.text) };
}
