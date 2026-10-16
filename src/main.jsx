import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme } from './settings.js';
import { requestPersistence } from './data/repo.js';

applyTheme();
createRoot(document.getElementById('root')).render(<App />);

requestPersistence();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* çevrimdışı önbellek olmadan da çalışır */
    });
  });
}
