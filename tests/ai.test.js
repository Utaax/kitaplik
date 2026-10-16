import test from 'node:test';
import assert from 'node:assert/strict';
import { pickModel, parseJsonLoose } from '../src/services/ai.js';

test('Model seçimi: Claude için Haiku tercih edilir', () => {
  assert.equal(pickModel('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']), 'claude-haiku-5-5');
  assert.equal(pickModel('anthropic', ['claude-opus-5-5', 'claude-sonnet-5-5']), 'claude-sonnet-5-5');
});

test('Model seçimi: OpenAI için en yeni mini model', () => {
  const ids = ['gpt-4o', 'gpt-4o-mini', 'gpt-5-mini', 'gpt-5', 'gpt-4o-mini-tts', 'gpt-5-mini-2025-08-07', 'gpt-4o-realtime-preview'];
  assert.equal(pickModel('openai', ids), 'gpt-5-mini');
  assert.equal(pickModel('openai', ['gpt-4o', 'gpt-4o-mini']), 'gpt-4o-mini');
});

test('Model seçimi: Gemini için en yeni Flash', () => {
  const ids = ['gemini-3-flash-preview', 'gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-pro', 'gemini-3.1-flash-image-preview'];
  assert.equal(pickModel('gemini', ids), 'gemini-3.8-flash');
});

test('Yapay zeka yanıtı: JSON çevresindeki metin ve boşluklar temizlenir', () => {
  const r = parseJsonLoose('İşte sonuç:\n```json\n{"title":"  Kürk Mantolu   Madonna ","author":"Sabahattin Ali","publisher":"YKY"}\n```');
  assert.equal(r.title, 'Kürk Mantolu Madonna');
  assert.equal(r.author, 'Sabahattin Ali');
  assert.equal(r.isbn, '');
  assert.throws(() => parseJsonLoose('yanıt yok'));
});
