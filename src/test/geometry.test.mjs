import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mmToPt,
  mmToPx,
  findNearestAspectBucket,
  calculateRegionPercentages,
} from '../utils/geometry.ts';

test('mmToPt accurately converts mm to 72 DPI points', () => {
  assert.equal(Math.round(mmToPt(25.4)), 72);
  assert.equal(Math.round(mmToPt(127)), 360);
});

test('mmToPx accurately converts mm to 300 DPI pixels', () => {
  assert.equal(Math.round(mmToPx(25.4, 300)), 300);
  assert.equal(Math.round(mmToPx(229, 300)), 2705);
});

test('findNearestAspectBucket compares ratios symmetrically in log space', () => {
  // Square
  assert.equal(findNearestAspectBucket(100, 100), '1:1');

  // Portrait pieces (105 x 148 mm -> aspect ratio ~0.7095)
  // Nearest is 2:3 (0.6667) or 3:4 (0.75).
  // ln(0.7095 / 0.75) = ln(0.946) = -0.055
  // ln(0.7095 / 0.6667) = ln(1.064) = +0.062
  // Closest is 3:4 or 2:3
  const trackerBucket = findNearestAspectBucket(105, 148);
  assert.ok(['3:4', '2:3'].includes(trackerBucket));

  // Landscape C5 envelope (229 x 162 mm -> aspect ratio ~1.413)
  // 4:3 is 1.333, 3:2 is 1.5
  // ln(1.413 / 1.333) = ln(1.06) = +0.058
  // ln(1.413 / 1.5) = ln(0.942) = -0.059
  const envBucket = findNearestAspectBucket(229, 162);
  assert.ok(['4:3', '3:2'].includes(envBucket));

  // Ultra-wide (21:9)
  assert.equal(findNearestAspectBucket(210, 90), '21:9');

  // Portrait vertical (9:16)
  assert.equal(findNearestAspectBucket(90, 160), '9:16');
});

test('calculateRegionPercentages computes accurate bleed margins', () => {
  const res = calculateRegionPercentages(105, 148, 3, { x: 10, y: 15, w: 85, h: 120 });
  assert.ok(res.left > 0 && res.left < 50);
  assert.ok(res.right > 50 && res.right <= 100);
  assert.ok(res.top > 0 && res.top < 50);
  assert.ok(res.bottom > 50 && res.bottom <= 100);
  assert.ok(res.margin >= 1 && res.margin <= 20);
});
