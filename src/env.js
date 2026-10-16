// Derleme sırasında belirlenir: DEMO=1 iken Claude içindeki önizleme sürümü üretilir.
/* global __DEMO__ */
export const DEMO = typeof __DEMO__ !== 'undefined' && __DEMO__ === true;
export const DEMO_OFF_MSG = 'Bu özellik Claude içindeki demo sürümünde kapalıdır; yayınlanan tam sürümde çalışır.';
