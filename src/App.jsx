import { useEffect } from 'react';
import { go, useRoute } from './router.js';
import { Icon, ToastHost, ConfirmHost } from './components/ui.jsx';
import Library from './screens/Library.jsx';
import Add from './screens/Add.jsx';
import Scanner from './screens/Scanner.jsx';
import CoverScan from './screens/CoverScan.jsx';
import BookForm from './screens/BookForm.jsx';
import BookDetail from './screens/BookDetail.jsx';
import Settings from './screens/Settings.jsx';

function TabBar({ active }) {
  const tabs = [
    { key: 'library', label: 'Kitaplık', icon: 'book', path: '/' },
    { key: 'add', label: 'Ekle', icon: 'plus', path: '/add', primary: true },
    { key: 'settings', label: 'Ayarlar', icon: 'sliders', path: '/settings' },
  ];
  return (
    <nav className="tabbar" aria-label="Ana gezinme">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={(active === t.key ? 'on ' : '') + (t.primary ? 'primary' : '')}
          onClick={() => go(t.path)}
          aria-current={active === t.key ? 'page' : undefined}
        >
          <Icon name={t.icon} size={t.primary ? 26 : 22} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const { parts, query } = useRoute();
  const [a, b, c] = parts;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [a, b, c]);

  let screen;
  let tab = null;
  if (!a) {
    screen = <Library />;
    tab = 'library';
  } else if (a === 'add') {
    screen = <Add />;
    tab = 'add';
  } else if (a === 'scan') {
    return (
      <>
        <Scanner query={query} />
        <ToastHost />
        <ConfirmHost />
      </>
    );
  } else if (a === 'scan-cover') {
    screen = <CoverScan />;
  } else if (a === 'new') {
    screen = <BookForm key="new" />;
  } else if (a === 'book' && b && c === 'edit') {
    screen = <BookForm key={b} id={b} />;
  } else if (a === 'book' && b) {
    screen = <BookDetail id={b} />;
  } else if (a === 'settings') {
    screen = <Settings />;
    tab = 'settings';
  } else {
    screen = <Library />;
    tab = 'library';
  }

  return (
    <div className="app">
      <main>{screen}</main>
      {tab ? <TabBar active={tab} /> : null}
      <ToastHost />
      <ConfirmHost />
    </div>
  );
}
