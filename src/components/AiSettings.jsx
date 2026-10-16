import { useState } from 'react';
import { PROVIDERS, listModels, setAi, useAi } from '../services/ai.js';
import { Field, Icon, Segmented, askConfirm, toast } from './ui.jsx';
import { friendlyError } from '../lib/util.js';

const mask = (k) => (k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : '••••');

export default function AiSettings() {
  const ai = useAi();
  const [provider, setProvider] = useState(ai?.provider || 'gemini');
  const [key, setKey] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const p = PROVIDERS[provider];

  const connect = async (e) => {
    e.preventDefault();
    setError('');
    const k = key.trim();
    if (!k) return setError('API anahtarını yapıştırın.');
    setBusy(true);
    try {
      const { models, model } = await listModels(provider, k);
      setAi({ provider, key: k, model, models });
      setKey('');
      toast(`${p.label} bağlandı`, 'success');
    } catch (err) {
      setError(friendlyError(err, 'Bağlantı kurulamadı.'));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!(await askConfirm('Yapay zeka bağlantısı kaldırılsın mı? API anahtarı bu cihazdan silinir.', { ok: 'Kaldır', danger: true }))) return;
    setAi(null);
    toast('Bağlantı kaldırıldı');
  };

  if (ai) {
    const cp = PROVIDERS[ai.provider];
    return (
      <section className="card">
        <h3>Yapay zeka ile kapak okuma</h3>
        <div className="ai-connected">
          <span className="ai-dot" aria-hidden="true" />
          <div className="grow">
            <b>{cp.label} bağlı</b>
            <div className="muted small">Anahtar: {mask(ai.key)}</div>
          </div>
        </div>
        <Field label="Model" hint="Otomatik seçildi: hızlı ve görüntü okuyabilen model. İsterseniz değiştirebilirsiniz.">
          <select value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} className="wide-select">
            {(ai.models || [ai.model]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <p className="muted small">
          Kapak fotoğrafı yalnızca “Kapaktan oku” kullandığınızda {cp.company}’a gönderilir. Anahtar yalnızca bu cihazda saklanır ve yedeğe eklenmez.
        </p>
        <button className="btn link danger" onClick={disconnect}>
          Bağlantıyı kaldır
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Yapay zeka ile kapak okuma</h3>
      <p className="muted">
        Kendi yapay zeka hesabınızı bağlarsanız kapak fotoğrafından kitap adı, yazar ve yayınevi çok daha doğru okunur. Bağlamazsanız uygulama telefonda çalışan metin tanımayı kullanır.
      </p>
      <form onSubmit={connect} className="stack">
        <Segmented
          value={provider}
          onChange={(v) => {
            setProvider(v);
            setError('');
          }}
          options={Object.entries(PROVIDERS).map(([value, x]) => ({ value, label: x.label }))}
        />
        <p className="muted small">{p.note}</p>
        <Field label={`${p.label} API anahtarı`}>
          <div className="inline">
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={p.keyHint}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            <button type="button" className="btn ghost small" onClick={() => setShow(!show)}>
              {show ? 'Gizle' : 'Göster'}
            </button>
          </div>
        </Field>
        <a className="src-link" href={p.keyUrl} target="_blank" rel="noreferrer">
          <Icon name="link" size={14} /> Anahtar almak için {p.company} sayfasını aç
        </a>
        {error ? (
          <p className="alert" role="alert">
            <Icon name="x" size={16} /> {error}
          </p>
        ) : null}
        <button className="btn primary wide" type="submit" disabled={busy}>
          {busy ? 'Bağlanıyor…' : 'Bağla ve test et'}
        </button>
      </form>
    </section>
  );
}
