import { useEffect, useState, useCallback } from 'react';
import { repo, onChange } from './data/repo.js';

// Veriyi yükler ve depo değiştiğinde otomatik yeniler
export function useRepoValue(loader, deps = []) {
  const [value, setValue] = useState(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => onChange(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    let alive = true;
    loader().then(
      (v) => alive && setValue(v),
      () => alive && setValue(null)
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);
  return value;
}

export const useBooks = () => useRepoValue(() => repo.listBooks());
export const useBook = (id) => useRepoValue(() => repo.getBook(id), [id]);
export const useNotes = (bookId) => useRepoValue(() => repo.listNotes(bookId), [bookId]);
export const useNoteCounts = () => useRepoValue(() => repo.countNotes());

// Blob için nesne adresi üretir ve temizler
export function useObjectUrl(blob) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      setUrl('');
      return undefined;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

// Asenkron işlem durumu: { run, loading, error }
export function useAsync() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (fn) => {
    setLoading(true);
    setError('');
    try {
      return await fn();
    } catch (e) {
      setError(e?.message || 'Bir hata oluştu');
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);
  return { run, loading, error, setError };
}
