import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCopyFieldValue } from '../utils/copyResolution.ts';

test('resolveCopyFieldValue resolves per-copy placeholders correctly', () => {
  const trackerField = {
    id: 'tracker-title',
    label: 'Tracker Title',
    role: 'heading',
    x: 10,
    y: 20,
    w: 80,
    h: 12,
    sizePt: 14,
    align: 'center',
    leading: 16,
    placeholder: 'Month one',
    copyPlaceholders: ['Month one', 'Month two', 'Month three', 'Month four'],
  };

  // Untouched copy 0 -> Month one
  assert.equal(resolveCopyFieldValue(trackerField, 0, {}), 'Month one');
  // Untouched copy 1 -> Month two
  assert.equal(resolveCopyFieldValue(trackerField, 1, {}), 'Month two');
  // Untouched copy 2 -> Month three
  assert.equal(resolveCopyFieldValue(trackerField, 2, {}), 'Month three');
  // Untouched copy 3 -> Month four
  assert.equal(resolveCopyFieldValue(trackerField, 3, {}), 'Month four');

  const couponField = {
    id: 'ref-code',
    label: 'Voucher Code',
    role: 'heading',
    x: 10,
    y: 30,
    w: 30,
    h: 8,
    sizePt: 9,
    align: 'left',
    leading: 10,
    placeholder: 'REFER-01',
    copyPlaceholders: ['REFER-01', 'REFER-02', 'REFER-03', 'REFER-04'],
  };

  // Copy 2 (3rd copy) -> REFER-03
  assert.equal(resolveCopyFieldValue(couponField, 2, {}), 'REFER-03');

  // Custom typed value overrides default placeholder
  const customValues = { 'ref-code': 'CUSTOM-VIP-2026' };
  assert.equal(resolveCopyFieldValue(couponField, 2, customValues), 'CUSTOM-VIP-2026');

  // An explicit blank removes the default copy instead of restoring it.
  assert.equal(resolveCopyFieldValue(couponField, 2, { 'ref-code': '' }), '');
});
