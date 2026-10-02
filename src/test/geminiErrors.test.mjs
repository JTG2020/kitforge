import test from 'node:test';
import assert from 'node:assert/strict';
import { formatGeminiModelError, isTemporaryGeminiCapacityError } from '../utils/geminiErrors.ts';

test('identifies temporary Gemini capacity errors without classifying billing errors', () => {
  assert.equal(
    isTemporaryGeminiCapacityError(
      'This model is currently experiencing high demand. Spikes in demand are usually temporary.',
      503
    ),
    true
  );
  assert.equal(isTemporaryGeminiCapacityError('Service temporarily unavailable', 500), true);
  assert.equal(isTemporaryGeminiCapacityError('Project has no billing enabled', 403), false);
});

test('formats errors with the model ID without duplicating an existing prefix', () => {
  assert.equal(formatGeminiModelError('gemini-3.8-flash', 'Request failed'), 'gemini-3.8-flash: Request failed');
  assert.equal(formatGeminiModelError('gemini-3-pro-image', 'gemini-3-pro-image: Busy'), 'gemini-3-pro-image: Busy');
});