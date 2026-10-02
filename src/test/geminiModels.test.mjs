import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GEMINI_TEXT_MODEL,
  FREE_GEMINI_TEXT_MODELS,
  resolveGeminiTextModel,
} from '../config/textModels.ts';

test('free-tier text models are supported and old settings get a default', () => {
  const modelIds = FREE_GEMINI_TEXT_MODELS.map((model) => model.id);

  assert.equal(DEFAULT_GEMINI_TEXT_MODEL, 'gemini-3.8-flash');
  assert.ok(modelIds.includes('gemini-3.5-flash-lite'));
  assert.ok(modelIds.includes('gemini-2.5-pro'));
  assert.equal(resolveGeminiTextModel('gemini-3.5-flash-lite'), 'gemini-3.5-flash-lite');
  assert.equal(resolveGeminiTextModel(undefined), DEFAULT_GEMINI_TEXT_MODEL);
  assert.equal(resolveGeminiTextModel('unavailable-model'), DEFAULT_GEMINI_TEXT_MODEL);
});