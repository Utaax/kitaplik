# Kitaplık — Kitaplığın, cebinde. (PWA, v0.2)

Evdeki kitaplarınızı barkod/QR okutarak ya da kapağı fotoğraflayarak dijitale taşıyan,
iPhone ve Android'de çalışan web uygulaması. Veriler şimdilik yalnızca telefonda saklanır.

## Telefonda denemek (en kolay yol, kurulum gerektirmez)

Kamera yalnızca **HTTPS** adreslerde çalışır, bu yüzden `dist` klasörünü ücretsiz bir statik barındırmaya yükleyin:

1. Bilgisayarda https://app.netlify.com/drop adresini açın (ücretsiz hesap).
2. Bu paketteki **`dist`** klasörünü sayfaya sürükleyip bırakın. Size `https://…netlify.app` gibi bir adres verilir.
3. iPhone'da bu adresi **Safari** ile açın → *Paylaş* → **Ana Ekrana Ekle**.
   Android'de Chrome → menü → **Uygulamayı yükle**.
4. Simgeye dokunun; uygulama tam ekran açılır. İlk taramada kamera izni isteyecektir.

Alternatifler: GitHub Pages, Cloudflare Pages, Vercel (hepsi ücretsiz ve HTTPS).

> İlk barkod taramasında ve ilk OCR kullanımında gerekli kütüphaneler internetten indirilir
> (OCR için Türkçe+İngilizce dil verisi ~15 MB). Sonrasında önbellekten çalışır.

## Özellikler

| Alan | Durum |
|---|---|
| Barkod (EAN-13/ISBN) ve QR okuma | ✅ Canlı kamera; Android'de yerleşik okuyucu, iOS'ta ZXing |
| ISBN'den otomatik bilgi (ad, yazar, yayınevi, yıl, sayfa, kapak) | ✅ Google Books → Open Library yedeği |
| Kapak: otomatik / kamera / galeri | ✅ Kayıtta kapak telefona kopyalanır (çevrimdışı görünür) |
| Kapağı tarayıp ad/yazar doldurma (OCR) | ✅ Algılanan satırlar dokunarak alanlara eklenebilir, ardından eşleşen kitap aranır |
| Kayıt öncesi ve sonrası düzenleme | ✅ |
| Notlar: sayfa fotoğrafı + sayfa no + metin | ✅ Sayfa numarası fotoğraftan otomatik algılanır, sayfadaki yazı nota aktarılabilir |
| Yazar hakkında + diğer kitapları | ✅ Vikipedi (TR, yoksa EN) + Google Books; “Yanlış mı?” ile düzeltilebilir |
| Yayınevi hakkında + öne çıkan kitapları | ✅ |
| Yorum, 5 yıldızlı puan, okuma tarih aralığı | ✅ |
| Okundu / Okunuyor / Okunacak | ✅ Tarihler otomatik önerilir |
| **Ek öneriler (eklendi)** | Seri tarama modu, sayfa ilerleme çubuğu, raf/konum, ödünç verilen kişi, etiketler, arama/sıralama, “Okunacak” listesine tek dokunuşla öneri ekleme, mükerrer ISBN uyarısı |
| Tema (sade siyah-beyaz; açık/koyu, yazı boyutu) | ✅ Ayarlar ekranından |
| Kapak okuma için kendi yapay zeka anahtarı (Claude / ChatGPT / Gemini) | ✅ Anahtar yalnızca cihazda; model otomatik seçilir |
| Yedekleme | ✅ JSON yedek/geri yükleme (fotoğraflar dahil), CSV (Excel) dışa aktarma |
| Çevrimdışı çalışma | ✅ Service worker |

## Geliştirici notları

```
node build.mjs              # src → dist
node serve.mjs 8080         # yerel sunucu (kamera için telefonda HTTPS gerekir)
node --test tests/*.test.js # birim testleri
node tests/e2e.mjs          # Chromium ile uçtan uca test (ağ sahte yanıtlarla)
```
Gereken paketler: `react`, `react-dom`, `esbuild` (`npm install`). Dış kütüphaneler (ZXing, Tesseract.js) çalışma anında CDN'den yüklenir.

### Klasör yapısı
```
src/
  data/db.js, data/repo.js   ← TÜM veri erişimi burada (buluta geçişte değişecek tek katman)
  services/                  ← lookup (Google Books/Open Library), wiki, scan (barkod), ocr, images
  lib/                       ← saf fonksiyonlar: ISBN, OCR çözümleme, yardımcılar (testli)
  screens/, components/      ← arayüz
  settings.js, styles.css    ← tema (CSS değişkenleri)
```

## Yol haritası

**Buluta geçiş (paylaşma ve saklama için).** Her kayıtta zaten `id` (UUID), `updatedAt` ve silinme işareti (`deletedAt`) var.
Önerilen altyapı **Supabase** (Postgres + giriş + dosya depolama, Avrupa sunucusu seçilebilir — KVKK açısından önemli) ya da Firebase.
`repo.js` içine aynı yöntemlere sahip bir `CloudRepository` yazılır; ekranlar değişmez. Eşitleme: yerel önce yazılır, arka planda gönderilir,
çakışmada en son güncelleyen kazanır.

**Gerçek mobil uygulamaya geçiş.** İki seçenek:
1. **Capacitor** (en hızlı): bu kod aynen iOS/Android uygulamasına sarılır; kamera, barkod (ML Kit) ve OCR yerel eklentilerle hızlanır. 2–4 hafta.
2. **React Native / Expo** (en iyi his): servisler, `lib/` ve veri modeli taşınır, ekranlar yeniden yazılır. iOS'ta Apple Vision ile çok daha iyi OCR. 6–10 hafta.

Tavsiye: test aşamasından sonra önce Capacitor ile mağazaya çıkın, kullanıcı geri bildirimine göre Expo'ya geçişi değerlendirin.
App Store için Apple Developer hesabı (yıllık 99 USD), Play Store için tek seferlik 25 USD gerekir.

## Bilinen sınırlamalar
- iOS'ta Safari web uygulaması verilerini, uygulama uzun süre (yaklaşık 7 hafta) açılmazsa silebilir; ana ekrana eklenmiş uygulamalarda bu risk düşer. Düzenli **Yedek al** önerilir — bulut geçişiyle tamamen çözülecek.
- Türkçe kitapların bir kısmı Google Books/Open Library'de eksik ya da kapaksız olabilir; bu durumda bilgiler elle girilir. İleride Türk kaynaklarıyla (yasal izinli bir veri sağlayıcı) zenginleştirme önerilir.
- OCR doğruluğu ışık ve odakla değişir; sonuç her zaman düzenlenebilir.
- “Öne çıkan yayınevi kitapları” Google Books ilgi/okur puanı sayısına dayanır, satış listesi değildir.
