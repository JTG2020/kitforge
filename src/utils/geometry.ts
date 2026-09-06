import type { AspectRatioBucket, RectMM } from '../types/geometry.ts';

export const ASPECT_RATIO_BUCKETS: Array<{ str: AspectRatioBucket; ratio: number }> = [
  { str: '1:1', ratio: 1 / 1 },
  { str: '2:3', ratio: 2 / 3 },
  { str: '3:2', ratio: 3 / 2 },
  { str: '3:4', ratio: 3 / 4 },
  { str: '4:3', ratio: 4 / 3 },
  { str: '4:5', ratio: 4 / 5 },
  { str: '5:4', ratio: 5 / 4 },
  { str: '9:16', ratio: 9 / 16 },
  { str: '16:9', ratio: 16 / 9 },
  { str: '21:9', ratio: 21 / 9 },
];

export function mmToPt(mm: number): number {
  return (mm / 25.4) * 72;
}

export function ptToMm(pt: number): number {
  return (pt / 72) * 25.4;
}

export function mmToPx(mm: number, dpi = 300): number {
  return (mm / 25.4) * dpi;
}

/**
 * Finds the nearest aspect ratio bucket using log-space distance |ln(targetRatio / bucketRatio)|.
 * This guarantees symmetric and unbiased matching between portrait and landscape ratios.
 */
export function findNearestAspectBucket(w: number, h: number): AspectRatioBucket {
  if (w <= 0 || h <= 0) return '1:1';
  const targetRatio = w / h;
  let closestBucket: AspectRatioBucket = '1:1';
  let minLogDiff = Infinity;

  for (const bucket of ASPECT_RATIO_BUCKETS) {
    const logDiff = Math.abs(Math.log(targetRatio / bucket.ratio));
    if (logDiff < minLogDiff) {
      minLogDiff = logDiff;
      closestBucket = bucket.str;
    }
  }

  return closestBucket;
}

export interface RegionPercentages {
  left: number;
  right: number;
  top: number;
  bottom: number;
  margin: number;
}

/**
 * Calculates open region percentages and outer ornament margin percentage against the full BLEED canvas.
 */
export function calculateRegionPercentages(
  trimW: number,
  trimH: number,
  bleed = 3,
  clearZone?: RectMM
): RegionPercentages {
  const bleedW = trimW + bleed * 2;
  const bleedH = trimH + bleed * 2;

  if (!clearZone) {
    // Default safe inset if no clear zone specified
    const safeInset = 8;
    const left = Math.round(((safeInset + bleed) / bleedW) * 100);
    const top = Math.round(((safeInset + bleed) / bleedH) * 100);
    const right = Math.round(((bleedW - safeInset - bleed) / bleedW) * 100);
    const bottom = Math.round(((bleedH - safeInset - bleed) / bleedH) * 100);
    const margin = Math.max(1, Math.min(left, top, 100 - right, 100 - bottom));
    return { left, right, top, bottom, margin };
  }

  const clearBleedX = clearZone.x + bleed;
  const clearBleedY = clearZone.y + bleed;
  const clearBleedR = clearBleedX + clearZone.w;
  const clearBleedB = clearBleedY + clearZone.h;

  const left = Math.max(1, Math.min(99, Math.round((clearBleedX / bleedW) * 100)));
  const right = Math.max(left + 1, Math.min(99, Math.round((clearBleedR / bleedW) * 100)));
  const top = Math.max(1, Math.min(99, Math.round((clearBleedY / bleedH) * 100)));
  const bottom = Math.max(top + 1, Math.min(99, Math.round((clearBleedB / bleedH) * 100)));

  const margin = Math.max(1, Math.min(left, top, 100 - right, 100 - bottom));

  return { left, right, top, bottom, margin };
}
