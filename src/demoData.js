// Demo için örnek kitaplar (gerçek kayıt değildir; "örnek" etiketiyle işaretlenir)
import { repo, newBook } from './data/repo.js';

const SAMPLES = [
  { title: 'Kürk Mantolu Madonna', author: 'Sabahattin Ali', publisher: 'Yapı Kredi Yayınları', publishedDate: '1943', pageCount: 160, status: 'read', rating: 5, startDate: '2026-08-02', endDate: '2026-08-09', review: 'Raif Efendi’nin sessizliği uzun süre aklımdan çıkmadı. Yeniden okunacaklar listemde.', shelf: 'Salon, 1. raf',
    notes: [{ page: 47, text: '“Hayatta her şeyden çok yalnızlıktan korkarım.” Bu cümlenin altını çizdim.' }, { page: 112, text: 'Berlin bölümleri: Maria Puder ile ilk karşılaşma.' }] },
  { title: 'Tutunamayanlar', author: 'Oğuz Atay', publisher: 'İletişim Yayınları', publishedDate: '1972', pageCount: 724, status: 'reading', currentPage: 210, startDate: '2026-10-01', shelf: 'Yatak odası',
    notes: [{ page: 198, text: 'Selim’in defterlerinden bölüm. Dil oyunlarını not almak için ayrı bir etiket açabilirim.' }] },
  { title: 'Saatleri Ayarlama Enstitüsü', author: 'Ahmet Hamdi Tanpınar', publisher: 'Dergâh Yayınları', publishedDate: '1961', pageCount: 382, status: 'toRead', shelf: 'Salon, 2. raf' },
  { title: 'İnce Memed', author: 'Yaşar Kemal', publisher: 'Yapı Kredi Yayınları', publishedDate: '1955', pageCount: 436, status: 'toRead', lentTo: 'Ayşe' },
];

export async function loadSamples() {
  const now = Date.now();
  for (let i = 0; i < SAMPLES.length; i++) {
    const { notes = [], ...b } = SAMPLES[i];
    const created = new Date(now - (SAMPLES.length - i) * 60000).toISOString();
    const book = await repo.saveBook(newBook({ ...b, tags: ['örnek'], createdAt: created }));
    for (const n of notes) await repo.saveNote({ bookId: book.id, photo: null, ...n });
  }
}
