import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeWinAnsiText } from '../utils/textSafety.ts';

test('sanitizeWinAnsiText replaces rupee and euro signs', () => {
  const input = 'Total fee: ₹5,000 or €60';
  const { sanitized, substitutions } = sanitizeWinAnsiText(input, { pieceName: 'Coupon' });

  assert.equal(sanitized, 'Total fee: Rs 5,000 or EUR 60');
  assert.equal(substitutions.length, 2);
  assert.equal(substitutions[0].original, '₹');
  assert.equal(substitutions[0].replacedWith, 'Rs ');
  assert.equal(substitutions[1].original, '€');
  assert.equal(substitutions[1].replacedWith, 'EUR ');
});

test('sanitizeWinAnsiText replaces typographic curly quotes, dashes and ellipsis', () => {
  const input = '“Welcome”—to the coach’s ‘Inner Circle’…';
  const { sanitized, substitutions } = sanitizeWinAnsiText(input);

  assert.equal(sanitized, '"Welcome"--to the coach\'s \'Inner Circle\'...');
  assert.ok(substitutions.length >= 4);
});

test('sanitizeWinAnsiText replaces trademark and special symbols', () => {
  const input = 'KitForge™ Program® • All rights reserved©';
  const { sanitized, substitutions } = sanitizeWinAnsiText(input);

  assert.equal(sanitized, 'KitForge(TM) Program(R) * All rights reserved(C)');
  assert.ok(substitutions.length >= 3);
});
