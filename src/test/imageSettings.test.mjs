import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_GEMINI_TEXT_MODEL } from '../config/textModels.ts';
import { loadSettings, saveSettings } from '../services/storage.ts';

function withMockLocalStorage(run) {
  const originalStorage = globalThis.localStorage;
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  });

  try {
    run(values);
  } finally {
    if (originalStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  }
}

test('legacy settings default the Thank You image provider to Gemini', () => {
  withMockLocalStorage((values) => {
    values.set('kitforge_user_settings_v1', JSON.stringify({
      apiKey: 'gemini-key',
      textApiKey: 'text-key',
      textModel: DEFAULT_GEMINI_TEXT_MODEL,
      verification: { status: 'unchecked', message: 'Not checked yet.' },
    }));

    const settings = loadSettings();
    assert.equal(settings.thankYouImageProvider, 'gemini');
    assert.equal(settings.metaImageApiKey, '');
  });
});

test('Thank You provider and Meta key persist independently from Gemini and text keys', () => {
  withMockLocalStorage(() => {
    const settings = {
      apiKey: 'gemini-image-key',
      textApiKey: 'gemini-text-key',
      textModel: DEFAULT_GEMINI_TEXT_MODEL,
      thankYouImageProvider: 'meta-muse',
      metaImageApiKey: 'meta-key',
      verification: { status: 'unchecked', message: 'Not checked yet.' },
    };

    saveSettings(settings);
    const loaded = loadSettings();
    assert.equal(loaded.thankYouImageProvider, 'meta-muse');
    assert.equal(loaded.metaImageApiKey, 'meta-key');
    assert.equal(loaded.apiKey, 'gemini-image-key');
    assert.equal(loaded.textApiKey, 'gemini-text-key');
  });
});