import { useEffect, useState } from 'react';
import { ACCENTS, RADII, resetSettings, updateSettings, useSettings } from '../settings.js';
import { repo, requestPersistence } from '../data/repo.js';
import { Icon, Segmented, TopBar, toast, askConfirm } from '../components/ui.jsx';
import { back } from '../router.js';
import { saveFile } from '../services/images.js';
import { csvEscape, todayISO, friendlyError } from '../lib/util.js';
import { STATUS } from '../components/ui.jsx';

const fmtMB = (n) => (n / 1048576).toFixed(1) + ' MB';

export default function Settings() {
  const s = useSettings();
  const [usage, setUsage] = useState(null);
  const [persisted, setPersisted] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bookCount, setBookCount] = useState(null);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(e)).catch(() => {});
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
    repo.listBooks().then((b) => setBookCount(b.length)).catch(() => setBookCount(-1));
  }, []);

  const exportJson = async () => {
    setBusy(true);
    try {
      const data = await repo.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const r = await saveFile(blob, `kitaplik-yedek-${todayISO()}.json`);
      if (r !== 'cancelled') toast(`${data.books.length} kitap ve ${data.notes.length} not yedeklendi`);
    } catch (e) {
      toast(friendlyError(e, 'Yedek alınamadı. Lütfen yeniden deneyin.'));
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    const books = await repo.listBooks();
    const head = ['Kitap adı', 'Yazar', 'Yayınevi', 'ISBN', 'Durum', 'Puan', 'Başlangıç', 'Bitiş', 'Sayfa', 'Raf', 'Etiketler', 'Yorum'];
    const rows = books.map((b) =>
      [b.title, b.author, b.publisher, b.isbn, STATUS[b.status]?.label, b.rating || '', b.startDate, b.endDate, b.pageCount || '', b.shelf, (b.tags || []).join(' | '), b.review]
        .map(csvEscape)
        .join(';')
    );
    const blob = new Blob(['﻿' + [head.join(';'), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    await saveFile(blob, `kitaplik-${todayISO()}.csv`);
  };

  const importJson = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const r = await repo.importAll(data);
      toast(`İçe aktarıldı: ${r.addedBooks} yeni kitap, ${r.addedNotes} yeni not`);
    } catch (err) {
      toast('İçe aktarılamadı: ' + (err?.message || 'dosya okunamadı'));
    } finally {
      setBusy(false);
    }
  };

  const wipe = async () => {
    const ok = await askConfirm('Tüm kitaplar, notlar ve fotoğraflar bu cihazdan kalıcı olarak silinsin mi? Bu işlem geri alınamaz; önce yedek aldığınızdan emin olun.', { ok: 'Hepsini sil', danger: true });
    if (!ok) return;
    await repo.clearAll();
    toast('Tüm veriler silindi');
  };

  const makePersistent = async () => setPersisted(await requestPersistence());

  return (
    <div className="screen">
      <TopBar title="Ayarlar" onBack={() => back('/')} />

      {!standalone ? (
        <section className="card tip">
          <b>Ana ekrana ekleyin</b>
          <p>
            iPhone’da Safari’de <i>Paylaş</i> simgesine dokunup <i>Ana Ekrana Ekle</i>’yi seçin; Android’de Chrome menüsünden <i>Uygulamayı yükle</i>’yi seçin. Uygulama tam ekran açılır ve çevrimdışı da çalışır.
          </p>
        </section>
      ) : null}

      <section className="card">
        <h3>Görünüm</h3>
        <p className="field-label">Tema</p>
        <Segmented
          value={s.mode}
          onChange={(mode) => updateSettings({ mode })}
          options={[
            { value: 'auto', label: 'Otomatik' },
            { value: 'light', label: 'Açık' },
            { value: 'dark', label: 'Koyu' },
          ]}
        />
        <p className="field-label">Vurgu rengi</p>
        <div className="swatches">
          {ACCENTS.map((a) => (
            <button
              key={a.value}
              className={'swatch' + (s.accent === a.value ? ' on' : '')}
              style={{ background: a.value }}
              onClick={() => updateSettings({ accent: a.value })}
              aria-label={a.name}
              title={a.name}
            />
          ))}
          <label className="swatch custom" title="Özel renk">
            <input type="color" value={s.accent} onChange={(e) => updateSettings({ accent: e.target.value })} aria-label="Özel renk" />
            <Icon name="plus" size={16} />
          </label>
        </div>
        <p className="field-label">Yazı boyutu</p>
        <input
          type="range"
          min="0.9"
          max="1.35"
          step="0.05"
          value={s.fontScale}
          onChange={(e) => updateSettings({ fontScale: Number(e.target.value) })}
          aria-label="Yazı boyutu"
        />
        <p className="field-label">Köşeler</p>
        <Segmented
          value={s.radius}
          onChange={(radius) => updateSettings({ radius })}
          options={Object.keys(RADII).map((k) => ({ value: k, label: { sharp: 'Keskin', soft: 'Yumuşak', round: 'Yuvarlak' }[k] }))}
        />
        <p className="field-label">Kitaplık görünümü</p>
        <Segmented
          value={s.view}
          onChange={(view) => updateSettings({ view })}
          options={[
            { value: 'grid', label: 'Izgara' },
            { value: 'list', label: 'Liste' },
          ]}
        />
        <button className="btn link" onClick={resetSettings}>
          Varsayılan görünüme dön
        </button>
      </section>

      <section className="card">
        <h3>Yedekleme ve veri</h3>
        <p className="muted">
          Verileriniz şimdilik yalnızca bu cihazda saklanır. Telefon değiştirmeden önce ve düzenli olarak yedek almanız önerilir.
        </p>
        <div className="stack">
          <button className="btn primary wide" onClick={exportJson} disabled={busy}>
            <Icon name="download" size={18} /> Yedek al (JSON)
          </button>
          <label className="btn ghost wide file-btn">
            <Icon name="upload" size={18} /> Yedekten geri yükle
            <input type="file" accept="application/json,.json" onChange={importJson} disabled={busy} />
          </label>
          <button className="btn ghost wide" onClick={exportCsv}>
            <Icon name="list" size={18} /> Tablo olarak dışa aktar (CSV)
          </button>
        </div>
        <p className="muted small diag">
          {bookCount === -1 ? 'Kayıtlar okunamadı' : bookCount != null ? `Bu cihazda kayıtlı: ${bookCount} kitap` : ''}
          {' · '}
          {standalone ? 'Ana ekran uygulaması' : 'Tarayıcı (Safari/Chrome)'}
          <br />
          {usage ? `Kullanılan alan: ${fmtMB(usage.usage || 0)}` : ''}
          {persisted === false ? ' · Kalıcı depolama kapalı' : persisted ? ' · Kalıcı depolama açık' : ''}
        </p>
        {persisted === false ? (
          <button className="btn link" onClick={makePersistent}>
            Verilerin tarayıcı tarafından silinmesini engellemeyi dene
          </button>
        ) : null}
      </section>

      <section className="card cloud">
        <Icon name="cloud" size={28} />
        <div>
          <h3>Bulut yedekleme ve paylaşım</h3>
          <p className="muted">Yakında: hesapla birden çok cihazda eşitleme, kitaplığınızı paylaşma ve otomatik yedek.</p>
        </div>
      </section>

      <section className="card">
        <h3>Hakkında</h3>
        <p className="muted small">
          Kitap bilgileri Google Books ve Open Library’den, yazar ve yayınevi özetleri Vikipedi’den (CC BY-SA) alınır. Barkod okuma için ZXing, metin tanıma için Tesseract.js kullanılır.
        </p>
        <button className="btn link danger" onClick={wipe}>
          Tüm verileri sil…
        </button>
      </section>
    </div>
  );
}
