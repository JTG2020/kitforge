import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutText } from '../utils/textLayout.ts';

// Deterministic character width mock measurer (e.g. 6px per char at 10pt -> 0.6 * sizePt)
const mockMeasure = (t, sizePt) => t.length * sizePt * 0.6;

test('layoutText wraps long paragraphs greedily', () => {
  const text = 'The quick brown fox jumps over the lazy dog';
  // boxW = 100, at 10pt size -> 6px per char -> ~16 chars per line
  const result = layoutText({
    text,
    boxW: 100,
    boxH: 80,
    sizePt: 10,
    leading: 12,
    measure: mockMeasure,
  });

  assert.equal(result.overflow, false);
  assert.ok(result.lines.length >= 3);
  for (const line of result.lines) {
    assert.ok(mockMeasure(line, result.sizePt) <= 100);
  }
});

test('layoutText breaks long unbreakable tokens character by character', () => {
  const text = 'https://example.com/very/long/unbreakable/url/path/token/1234567890';
  const result = layoutText({
    text,
    boxW: 80,
    boxH: 100,
    sizePt: 10,
    leading: 12,
    measure: mockMeasure,
  });

  assert.equal(result.overflow, false);
  assert.ok(result.lines.length >= 4);
  for (const line of result.lines) {
    assert.ok(mockMeasure(line, result.sizePt) <= 80);
  }
});

test('layoutText shrinks font down to 75% floor when height is tight', () => {
  const text = 'Line 1\nLine 2\nLine 3\nLine 4';
  // boxH only fits 3 lines at 10pt (leading 12 -> 36 < 40 < 48)
  const result = layoutText({
    text,
    boxW: 150,
    boxH: 38,
    sizePt: 10,
    leading: 12,
    measure: mockMeasure,
  });

  assert.ok(result.shrunk);
  assert.ok(result.sizePt < 10);
  assert.ok(result.sizePt >= 7.5); // Floor is 7.5pt (75% of 10)
  assert.equal(result.overflow, false);
});

test('layoutText reports overflow past the 75% floor without silently hiding it', () => {
  const text = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8';
  // boxH is tiny: 20
  const result = layoutText({
    text,
    boxW: 150,
    boxH: 20,
    sizePt: 10,
    leading: 12,
    measure: mockMeasure,
  });

  assert.equal(result.overflow, true);
  assert.equal(result.sizePt, 7.5); // hit floor
});
