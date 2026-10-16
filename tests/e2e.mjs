// Uçtan uca duman testi: gerçek Chromium + sahte ağ yanıtları.
// Çalıştırma: node build.mjs && node tests/e2e.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const require = createRequire('/opt/npm-tools/node_modules/');
const { chromium } = require('playwright');

const PORT = 8123;
const OUT = process.env.SHOTS || '/tmp/kitaplik-shots';
mkdirSync(OUT, { recursive: true });

const server = spawn('node', ['serve.mjs', String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) failures++;
};

const gbItem = (o) => ({
  volumeInfo: {
    title: o.title, authors: [o.author], publisher: o.publisher, publishedDate: o.date, pageCount: o.pages,
    industryIdentifiers: [{ type: 'ISBN_13', identifier: o.isbn }], language: 'tr',
    description: 'Deneme açıklaması.', ratingsCount: o.rc || 0,
    imageLinks: { thumbnail: 'http://books.google.com/cover-' + o.isbn + '.jpg' },
  },
});
const BOOK = { title: 'Kar', author: 'Orhan Pamuk', publisher: 'İletişim Yayınları', date: '2002', pages: 436, isbn: '9789750500152' };

// 1x1 değil, yeterince büyük bir PNG üret
const sharp = require('sharp');
const png = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#7a3' } })
  .composite([{ input: Buffer.from('<svg width="200" height="300"><text x="20" y="150" font-size="40" fill="white">KAR</text><circle cx="100" cy="230" r="40" fill="#fff8"/></svg>') }])
  .png().toBuffer();

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'tr-TR', permissions: [] });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|net::ERR/.test(m.text()) && errors.push(m.text()));

const hits = [];
await ctx.route(/googleapis\.com\/books/, (route) => {
  const u = decodeURIComponent(route.request().url());
  hits.push(u);
  let items = [];
  if (/isbn:9789750500152/.test(u)) items = [gbItem(BOOK)];
  else if (/inauthor:"Orhan Pamuk"/.test(u))
    items = [gbItem(BOOK), gbItem({ ...BOOK, title: 'Masumiyet Müzesi', isbn: '9789750500169' }), gbItem({ ...BOOK, title: 'Benim Adım Kırmızı', isbn: '9789750500176' })];
  else if (/inpublisher:"İletişim Yayınları"/.test(u))
    items = [gbItem({ ...BOOK, title: 'Az Popüler', isbn: '9789750500183', rc: 1 }), gbItem({ ...BOOK, title: 'Çok Popüler', isbn: '9789750500190', rc: 90 })];
  else if (/Sefiller/.test(u)) items = [gbItem({ title: 'Sefiller', author: 'Victor Hugo', publisher: 'Can Yayınları', date: '2010', pages: 1200, isbn: '9789750719387' })];
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items }) });
});
await ctx.route(/wikipedia\.org/, (route) => {
  const u = decodeURIComponent(route.request().url());
  if (/list=search/.test(u)) {
    const title = /Pamuk/.test(u) ? 'Orhan Pamuk' : 'İletişim Yayınları';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: { search: [{ title }] } }) });
  }
  const title = /Orhan/.test(u) ? 'Orhan Pamuk' : 'İletişim Yayınları';
  route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ title, description: 'Türk yazar', extract: title + ' hakkında örnek özet metni. '.repeat(3), content_urls: { desktop: { page: 'https://tr.wikipedia.org/wiki/' + title } } }),
  });
});
await ctx.route(/books\.google\.com\/cover|covers\.openlibrary/, (route) => route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: png }));

const base = `http://localhost:${PORT}/`;
await page.goto(base);
await page.waitForSelector('.brand');
check('Boş kitaplık görünür', await page.locator('text=Kitaplığınız henüz boş').count() === 1);
await page.screenshot({ path: `${OUT}/01-bos.png` });

// ISBN ile ekleme
await page.click('text=İlk kitabı ekle');
await page.fill('input[placeholder^="9789750719387"]', '978-975-05-0015-2');
await page.click('form button[type=submit]:text-is("Ara")');
await page.waitForSelector('text=Bilgiler otomatik dolduruldu');
check('Form otomatik doldu: ad', (await page.inputValue('input[placeholder="Kitabın adı"]')) === 'Kar');
check('Form otomatik doldu: yayınevi', (await page.locator('label:has-text("Yayınevi") input').inputValue()) === 'İletişim Yayınları');
await page.screenshot({ path: `${OUT}/02-form.png`, fullPage: true });

// Kayıt öncesi düzenleme + durum
await page.fill('label:has-text("Raf / konum") input', 'Salon 2. raf');
await page.click('button:has-text("Okuyorum"), button:has-text("Okunuyor")');
await page.click('button:has-text("Kaydet"):not(:has-text("sıradakini"))');
await page.waitForSelector('.burst');
check('Kaydedildi animasyonu göründü', (await page.textContent('.burst-card b')) === 'Kaydedildi');
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/02b-kaydedildi.png` });
await page.waitForSelector('.grid-item.just-added');
check('Kaydedince kitaplığa dönüldü ve yeni kitap vurgulandı', page.url().includes('#/?yeni='));
await page.waitForSelector('.burst', { state: 'detached' });
await page.click('.grid-item.just-added');
await page.waitForSelector('.detail-hero');
check('Detay sayfası açıldı', (await page.textContent('.detail-hero h2')) === 'Kar');
check('Okunuyor durumu', await page.locator('.status-seg button.on:has-text("Okunuyor")').count() === 1);
await page.waitForSelector('text=Şu an kaçıncı sayfadasınız?');
check('Başlangıç tarihi otomatik', (await page.inputValue('label:has-text("Başlangıç tarihi") input')).length === 10);
await page.screenshot({ path: `${OUT}/03-detay.png`, fullPage: true });

// Sayfa ilerlemesi
await page.fill('label:has-text("Şu an kaçıncı sayfadasınız?") input', '109');
await page.keyboard.press('Enter');
await page.waitForSelector('text=%25 tamamlandı');
check('İlerleme %25', true);

// Yorum
await page.fill('textarea[placeholder^="Kitap hakkındaki"]', 'Çok etkileyici bir roman.');
await page.click('h3:has-text("Okuma")');
await page.waitForTimeout(300);

// Puan
await page.click('button[aria-label="4 yıldız"]');

// Not ekleme (OCR yok -> elle sayfa no)
await page.click('[role=tab]:has-text("Notlar")');
await page.click('button:has-text("Not ekle")');
await page.fill('label:has-text("Sayfa no") input', '45');
await page.fill('textarea[placeholder^="Bu sayfada"]', 'Kar yağıyordu.');
await page.click('.sheet-foot button:has-text("Kaydet")');
await page.waitForSelector('.page-pill:has-text("Sayfa 45")');
check('Not kaydedildi', await page.locator('.note .note-text:has-text("Kar yağıyordu.")').count() === 1);
await page.screenshot({ path: `${OUT}/04-notlar.png`, fullPage: true });

// Keşfet
await page.click('[role=tab]:has-text("Keşfet")');
await page.waitForSelector('text=Orhan Pamuk hakkında örnek özet');
check('Yazar bilgisi geldi', true);
check('Yazarın diğer kitapları (mevcut kitap hariç)', (await page.locator('.mini-list li:has-text("Masumiyet Müzesi")').count()) === 1 && (await page.locator('.mini-list li:has-text("Benim Adım Kırmızı")').count()) === 1);
await page.waitForSelector('text=Çok Popüler');
const pubTitles = await page.locator('section:has-text("Yayınevi hakkında") .mini-list .li-title').allTextContents();
check('Yayınevi popüler sırası', pubTitles[0] === 'Çok Popüler', pubTitles.join(' | '));
await page.screenshot({ path: `${OUT}/05-kesfet.png`, fullPage: true });

// Okunacaklara ekle
await page.locator('.mini-list li:has-text("Masumiyet Müzesi") button').click();
await page.waitForSelector('.mini-list li:has-text("Masumiyet Müzesi") .badge-read');
check('Önerilen kitap okunacaklara eklendi', true);

// Kitaplık
await page.goto(base + '#/');
await page.waitForSelector('.grid-item');
check('Kitaplıkta 2 kitap', (await page.locator('.grid-item').count()) === 2);
await page.fill('.searchbox input', 'masumiyet');
check('Arama çalışıyor', (await page.locator('.grid-item').count()) === 1);
await page.fill('.searchbox input', '');
await page.screenshot({ path: `${OUT}/06-kitaplik.png` });

// Kitap düzenleme ve kaydedilen yorum kalıcılığı
await page.click('.grid-item:has-text("Kar")');
await page.waitForSelector('.detail-hero');
check('Yorum kalıcı', (await page.inputValue('textarea[placeholder^="Kitap hakkındaki"]')) === 'Çok etkileyici bir roman.');
check('Puan kalıcı', await page.locator('button[aria-label="4 yıldız"].on').count() === 1);
await page.click('button[aria-label="Düzenle"]');
await page.waitForSelector('text=Kitabı düzenle');
await page.fill('input[placeholder="Kitabın adı"]', 'Kar (Düzenlendi)');
await page.click('button:has-text("Kaydet")');
await page.waitForSelector('.detail-hero');
check('Düzenleme kaydedildi', (await page.textContent('.detail-hero h2')) === 'Kar (Düzenlendi)');

// Yedek al / geri yükle
await page.goto(base + '#/settings');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("Yedek al")')]);
const stream = await dl.createReadStream();
let json = '';
for await (const c of stream) json += c;
const backup = JSON.parse(json);
check('Yedek içeriği', backup.books.length === 2 && backup.notes.length === 1, `${backup.books.length} kitap, ${backup.notes.length} not`);
const rawCover = await page.evaluate(() => new Promise((res) => {
  const r = indexedDB.open('kitaplik');
  r.onsuccess = () => {
    const g = r.result.transaction('books').objectStore('books').getAll();
    g.onsuccess = () => {
      const withCover = g.result.find((b) => b.cover);
      res(withCover ? { isBlob: withCover.cover instanceof Blob, packed: !!withCover.cover.__img, isBuf: withCover.cover.buf instanceof ArrayBuffer } : null);
    };
  };
}));
check('Görsel ArrayBuffer olarak saklanıyor (iOS uyumu)', rawCover && rawCover.packed && rawCover.isBuf && !rawCover.isBlob, JSON.stringify(rawCover));
check('Kapak yedeğe gömüldü', backup.books.some((b) => typeof b.cover === 'string' && b.cover.startsWith('data:image')));
await page.screenshot({ path: `${OUT}/07-ayarlar.png`, fullPage: true });

// Tema değişimi
await page.click('button:has-text("Koyu")');
check('Koyu tema uygulandı', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
check('Renk seçenekleri kaldırıldı', (await page.locator('.swatch').count()) === 0);
await page.screenshot({ path: `${OUT}/08-koyu.png`, fullPage: true });

// Tüm veriyi sil ve yedekten geri yükle
page.on('dialog', (d) => d.accept());
await page.click('button:has-text("Tüm verileri sil")');
await page.click('.confirm button:has-text("Hepsini sil")');
await page.waitForTimeout(500);
await page.goto(base + '#/');
await page.waitForSelector('text=Kitaplığınız henüz boş');
await page.goto(base + '#/settings');
await page.setInputFiles('.file-btn input', { name: 'yedek.json', mimeType: 'application/json', buffer: Buffer.from(json) });
await page.waitForSelector('text=İçe aktarıldı');
await page.goto(base + '#/');
await page.waitForSelector('.grid-item');
check('Yedekten geri yüklendi', (await page.locator('.grid-item').count()) === 2);

// Elle ekleme
await page.goto(base + '#/add');
await page.click('text=Bilgileri elle gireceğim');
await page.waitForSelector('text=Yeni kitap');
await page.click('button:has-text("Kaydet")');
check('Boş ad doğrulaması', await page.locator('text=Kitap adı boş olamaz').count() === 1);

// Yapay zeka (Gemini, sahte yanıt) ile kapak okuma
await ctx.route(/generativelanguage\.googleapis\.com/, (route) => {
  const u = route.request().url();
  if (/\/models\?/.test(u)) {
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ models: [
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.8-pro', supportedGenerationMethods: ['generateContent'] },
    ] }) });
  }
  const body = JSON.parse(route.request().postData() || '{}');
  const hasImage = !!body.contents?.[0]?.parts?.some((p) => p.inline_data?.data?.length > 100);
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ title: hasImage ? 'Sefiller' : '', author: 'Victor Hugo', publisher: 'Can Yayınları' }) }] } }] }) });
});
await page.goto(base + '#/settings');
await page.click('.segmented button:has-text("Gemini")');
await page.fill('input[placeholder="AIza…"]', 'AIza-test-anahtari-123456');
await page.click('button:has-text("Bağla ve test et")');
await page.waitForSelector('text=Gemini (ücretsiz) bağlı');
check('Gemini bağlandı ve Flash modeli seçildi', (await page.inputValue('.wide-select')) === 'gemini-3.8-flash');
await page.screenshot({ path: `${OUT}/10-ai-ayar.png`, fullPage: true });
await page.goto(base + '#/scan-cover');
await page.waitForSelector('text=Gemini (ücretsiz) ile okunacak');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.click('button:has-text("Galeriden seç")')]);
await chooser.setFiles({ name: 'kapak.png', mimeType: 'image/png', buffer: png });
await page.waitForSelector('text=Gemini (ücretsiz) ile okundu');
check('Kapak yapay zeka ile okundu', (await page.locator('label:has-text("Kitap adı") input').inputValue()) === 'Sefiller' && (await page.locator('label:has-text("Yayınevi") input').inputValue()) === 'Can Yayınları');
await page.waitForSelector('.list .li-title:has-text("Sefiller")');
check('Okunan kapakla eşleşen kitap bulundu', true);
await page.screenshot({ path: `${OUT}/11-ai-kapak.png`, fullPage: true });

// Tarayıcı ekranı: kamera olmayan ortamda zarif hata
await page.goto(base + '#/scan');
await page.waitForSelector('.scanner-panel');
await page.waitForTimeout(1200);
check('Kamera yokken elle ISBN alanı çalışır', await page.locator('.scanner-panel input').count() === 1);
await page.screenshot({ path: `${OUT}/09-tarama.png` });

// Service worker kaydı
await page.goto(base + '#/');
await page.waitForTimeout(1500);
const sw = await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
check('Service worker kayıtlı', sw);

check('Konsolda beklenmeyen hata yok', errors.length === 0, errors.slice(0, 3).join(' || '));
console.log(failures ? `\n${failures} test BAŞARISIZ` : '\nTüm uçtan uca kontroller geçti');
await browser.close();
server.kill();
process.exit(failures ? 1 : 0);
