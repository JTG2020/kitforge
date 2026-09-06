import test from 'node:test';
import assert from 'node:assert/strict';
import { mmToPt, mmToPx } from '../utils/geometry.ts';

test('custom element layout overrides default coordinates and calculates PDF points', () => {
  const defaultField = {
    id: 'recipient-block',
    x: 80,
    y: 75,
    w: 120,
    h: 40,
  };

  const customLayout = {
    textFields: {
      'recipient-block': {
        x: 95.5,
        y: 60.0,
        w: 110.0,
        h: 45.0,
      },
    },
    logoSlot: {
      x: 25.0,
      y: 15.0,
      w: 50.0,
      h: 30.0,
    },
  };

  const effectiveFieldRect = customLayout.textFields[defaultField.id] || defaultField;
  assert.equal(effectiveFieldRect.x, 95.5);
  assert.equal(effectiveFieldRect.y, 60.0);
  assert.equal(effectiveFieldRect.w, 110.0);
  assert.equal(effectiveFieldRect.h, 45.0);

  // Check PDF point conversions
  const bleed = 3;
  const boxXpt = mmToPt(effectiveFieldRect.x + bleed);
  const boxWpt = mmToPt(effectiveFieldRect.w);
  const boxHpt = mmToPt(effectiveFieldRect.h);

  assert.equal(Math.round(boxXpt * 10) / 10, Math.round(mmToPt(98.5) * 10) / 10);
  assert.equal(Math.round(boxWpt * 10) / 10, Math.round(mmToPt(110.0) * 10) / 10);
  assert.equal(Math.round(boxHpt * 10) / 10, Math.round(mmToPt(45.0) * 10) / 10);
});
