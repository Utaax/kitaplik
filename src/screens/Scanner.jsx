import { useEffect, useRef, useState } from 'react';
import { back } from '../router.js';
import { Icon, Spinner, toast } from '../components/ui.jsx';
import { createDecoder, decodeFromCanvas } from '../services/scan.js';
import { blobToCanvas, pickImage } from '../services/images.js';
import { extractIsbn } from '../lib/isbn.js';
import { friendlyError } from '../lib/util.js';
import { startFromIsbn } from '../flows.js';
import { DEMO } from '../env.js';

export default function Scanner({ query }) {
  const batch = query.batch === '1';
  const videoRef = useRef(null);
  const handledRef = useRef(false);
  const streamRef = useRef(null);
  const [state, setState] = useState('starting'); // starting | scanning | error | working
  const [msg, setMsg] = useState('');
  const [hint, setHint] = useState('');
  const [torch, setTorch] = useState({ supported: false, on: false });
  const [manual, setManual] = useState('');

  const finish = async (isbn) => {
    if (handledRef.current) return;
    handledRef.current = true;
    if (navigator.vibrate) navigator.vibrate(60);
    setState('working');
    setMsg('Kitap bilgileri getiriliyor…');
    try {
      const r = await startFromIsbn(isbn, { batch });
      if (r === 'notfound') toast('Bu ISBN için bilgi bulunamadı; alanları elle doldurabilirsiniz.');
    } catch (e) {
      handledRef.current = false;
      setState('error');
      setMsg(friendlyError(e));
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer;
    let decoder;
    let busy = false;
    let tick = 0;
    const canvas = document.createElement('canvas');

    async function start() {
      if (DEMO || !navigator.mediaDevices?.getUserMedia) {
        setState('error');
        setMsg(DEMO ? 'Demo sürümünde canlı kamera kapalı. Aşağıdan barkodun fotoğrafını çekin ya da ISBN’i yazın; barkod fotoğraftan okunur.' : 'Bu tarayıcıda kamera erişimi yok. ISBN’i elle yazabilir ya da barkodun fotoğrafını seçebilirsiniz.');
        return;
      }
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch {
        setState('error');
        setMsg(DEMO ? 'Demo sürümünde canlı kamera kapalı. Aşağıdan barkodun fotoğrafını çekin ya da ISBN’i yazın; barkod fotoğraftan okunur.' : 'Kamera izni verilmedi ya da kamera bulunamadı. İzin verip yeniden deneyebilir, ISBN’i elle yazabilir ya da fotoğraftan okuyabilirsiniz.');
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play().catch(() => {});
      try {
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        setTorch({ supported: !!caps.torch, on: false });
        // Sürekli odak ve hafif yakınlaştırma: barkodu yaklaştırmadan net okumaya yardım eder
        const adv = {};
        if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) adv.focusMode = 'continuous';
        if (caps.zoom && caps.zoom.max >= 1.6) adv.zoom = Math.min(2, caps.zoom.max);
        if (Object.keys(adv).length) track.applyConstraints({ advanced: [adv] }).catch(() => {});
      } catch {
        /* el feneri desteklenmiyor */
      }
      try {
        decoder = await createDecoder();
      } catch {
        if (!cancelled) {
          setState('error');
          setMsg('Barkod okuyucu yüklenemedi (ilk kullanımda internet gerekir). ISBN’i elle yazabilirsiniz.');
        }
        return;
      }
      if (cancelled) return;
      setState('scanning');

      timer = setInterval(async () => {
        if (busy || cancelled || handledRef.current || !video.videoWidth) return;
        busy = true;
        try {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          const mode = tick++ % 3;
          if (mode !== 2) {
            // Ortadaki bant (tam çözünürlük): 1B barkodlar için; iki farklı yükseklik dene
            const cw = Math.round(vw * 0.92);
            const ch = Math.round(vh * (mode === 0 ? 0.42 : 0.7));
            canvas.width = cw;
            canvas.height = ch;
            ctx.drawImage(video, Math.round((vw - cw) / 2), Math.round((vh - ch) / 2), cw, ch, 0, 0, cw, ch);
          } else {
            // Tüm kare: QR kodlar için
            const scale = Math.min(1, 1280 / vw);
            canvas.width = Math.round(vw * scale);
            canvas.height = Math.round(vh * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
          const text = await decoder.decode(canvas);
          if (text) {
            const isbn = extractIsbn(text);
            if (isbn) finish(isbn);
            else setHint('Kod okundu ama bir ISBN içermiyor. Kitabın arka kapağındaki barkodu deneyin.');
          }
        } finally {
          busy = false;
        }
      }, 110);
    }

    start();
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTorch = async () => {
    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({ advanced: [{ torch: !torch.on }] });
      setTorch({ supported: true, on: !torch.on });
    } catch {
      toast('El feneri açılamadı.');
    }
  };

  const fromPhoto = async () => {
    const file = await pickImage({ camera: true });
    if (!file) return;
    setHint('Fotoğraf okunuyor…');
    try {
      const canvas = await blobToCanvas(file, 1600);
      const text = await decodeFromCanvas(canvas);
      const isbn = text && extractIsbn(text);
      if (isbn) finish(isbn);
      else setHint('Fotoğrafta okunabilir bir ISBN barkodu bulunamadı. Barkodu daha yakın ve net çekmeyi deneyin.');
    } catch {
      setHint('Barkod okuyucu yüklenemedi. ISBN’i elle yazabilirsiniz.');
    }
  };

  const submitManual = (e) => {
    e.preventDefault();
    finish(manual);
  };

  return (
    <div className="scanner">
      <video ref={videoRef} playsInline muted autoPlay className="scanner-video" />
      <div className="scanner-top">
        <button className="icon-btn on-dark" onClick={() => back('/add')} aria-label="Geri">
          <Icon name="back" />
        </button>
        <span className="scanner-title">{batch ? 'Seri tarama' : 'Barkod / QR tara'}</span>
        {torch.supported ? (
          <button className={'icon-btn on-dark' + (torch.on ? ' lit' : '')} onClick={toggleTorch} aria-label="El feneri">
            <Icon name="zap" />
          </button>
        ) : (
          <span style={{ width: 44 }} />
        )}
      </div>

      {state === 'scanning' || state === 'starting' ? (
        <div className="scanner-frame" aria-hidden="true">
          <span />
        </div>
      ) : null}

      {state === 'working' ? (
        <div className="scanner-overlay">
          <Spinner label={msg} />
        </div>
      ) : null}

      <div className="scanner-panel">
        {state === 'starting' ? <p>Kamera açılıyor…</p> : null}
        {state === 'scanning' ? <p>{hint || 'Kitabın arkasındaki barkodu çerçeveye getirin'}</p> : null}
        {state === 'error' ? <p className="error-on-dark">{msg}</p> : null}
        {state === 'scanning' && !hint ? <p className="small">ISBN barkodu genellikle 978 ile başlar</p> : null}

        <form className="inline" onSubmit={submitManual}>
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="ISBN’i elle yazın"
            inputMode="numeric"
            aria-label="ISBN"
          />
          <button className="btn primary" type="submit" disabled={!manual.trim() || state === 'working'}>
            Getir
          </button>
        </form>
        <button className="btn ghost-dark wide" onClick={fromPhoto} disabled={state === 'working'}>
          <Icon name="image" size={18} /> Barkodun fotoğrafını çek / seç
        </button>
        {batch ? <p className="small">Seri mod: kaydettikten sonra otomatik olarak sıradaki kitaba geçilir.</p> : null}
      </div>
    </div>
  );
}
