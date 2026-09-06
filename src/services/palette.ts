export interface ExtractedPaletteResult {
  primary: string;
  secondary: string;
  ink: string;
  paper: string;
  muted: string;
  logoTone: 'light' | 'dark' | 'mixed';
  warning?: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return match
    ? {
        r: parseInt(match[1], 16),
        g: parseInt(match[2], 16),
        b: parseInt(match[3], 16),
      }
    : null;
}

export function getLuminance(hexOrRgb: string | { r: number; g: number; b: number }): number {
  const rgb = typeof hexOrRgb === 'string' ? hexToRgb(hexOrRgb) : hexOrRgb;
  if (!rgb) return 0.5;
  return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
}

/**
 * Extracts a refined brand palette and determines logo light/dark/mixed tone from a logo image.
 */
export async function extractPaletteFromImage(
  imageSource: string | HTMLImageElement
): Promise<ExtractedPaletteResult> {
  return new Promise((resolve) => {
    const img = typeof imageSource === 'string' ? new Image() : imageSource;
    if (typeof imageSource === 'string') {
      img.crossOrigin = 'Anonymous';
      img.src = imageSource;
    }

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxDim = 120;
      let w = img.naturalWidth || img.width || maxDim;
      let h = img.naturalHeight || img.height || maxDim;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h / w) * maxDim);
          w = maxDim;
        } else {
          w = Math.round((w / h) * maxDim);
          h = maxDim;
        }
      }
      canvas.width = Math.max(1, w);
      canvas.height = Math.max(1, h);

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(getDefaultPalette('dark'));
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      let lightCount = 0;
      let darkCount = 0;
      let validOpaquePixels = 0;

      // 5-bit color cube (32 x 32 x 32)
      const colorBuckets = new Map<
        number,
        { rSum: number; gSum: number; bSum: number; count: number; sat: number }
      >();

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 32) continue; // Ignore transparent pixels

        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        validOpaquePixels++;

        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        if (lum > 0.68) lightCount++;
        if (lum < 0.32) darkCount++;

        // Discard near-white and near-black from dominant color ranking
        if (lum > 0.94 || lum < 0.05) continue;

        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC === 0 ? 0 : (maxC - minC) / maxC;

        const r5 = r >> 3;
        const g5 = g >> 3;
        const b5 = b >> 3;
        const key = (r5 << 10) | (g5 << 5) | b5;

        const existing = colorBuckets.get(key);
        if (existing) {
          existing.rSum += r;
          existing.gSum += g;
          existing.bSum += b;
          existing.count += 1;
        } else {
          colorBuckets.set(key, { rSum: r, gSum: g, bSum: b, count: 1, sat });
        }
      }

      const lightShare = validOpaquePixels > 0 ? lightCount / validOpaquePixels : 0;
      const darkShare = validOpaquePixels > 0 ? darkCount / validOpaquePixels : 0;

      let logoTone: 'light' | 'dark' | 'mixed' = 'dark';
      let warning: string | undefined;

      if (lightShare > 0.18 && darkShare > 0.18) {
        logoTone = 'mixed';
        warning =
          'Logo contains significant light and dark elements. No single background suits it uniformly.';
      } else if (lightShare > 0.55) {
        logoTone = 'light';
      } else {
        logoTone = 'dark';
      }

      // Rank buckets by count * (saturation + 0.1)
      const rankedBuckets = Array.from(colorBuckets.values()).sort((a, b) => {
        const scoreA = a.count * (a.sat + 0.15);
        const scoreB = b.count * (b.sat + 0.15);
        return scoreB - scoreA;
      });

      let primaryHex = '#1f5f5b';
      let secondaryHex = '#8c593b';

      if (rankedBuckets.length > 0) {
        const top = rankedBuckets[0];
        primaryHex = rgbToHex(top.rSum / top.count, top.gSum / top.count, top.bSum / top.count);
      }

      if (rankedBuckets.length > 1) {
        // Find a distinct second color
        const topRgb = hexToRgb(primaryHex)!;
        const second = rankedBuckets.find((b) => {
          const r = b.rSum / b.count;
          const g = b.gSum / b.count;
          const bl = b.bSum / b.count;
          const dist = Math.hypot(r - topRgb.r, g - topRgb.g, bl - topRgb.b);
          return dist > 45;
        });

        if (second) {
          secondaryHex = rgbToHex(second.rSum / second.count, second.gSum / second.count, second.bSum / second.count);
        } else {
          // Complementary fallback
          secondaryHex = '#b47b48';
        }
      }

      resolve({
        primary: primaryHex,
        secondary: secondaryHex,
        ink: '#16181d',
        paper: '#f8f6f0',
        muted: '#7a7672',
        logoTone,
        warning,
      });
    };

    img.onerror = () => {
      resolve(getDefaultPalette('dark'));
    };
  });
}

export function getDefaultPalette(tone: 'light' | 'dark' | 'mixed' = 'dark'): ExtractedPaletteResult {
  return {
    primary: '#1f5f5b',
    secondary: '#b47b48',
    ink: '#16181d',
    paper: '#f8f6f0',
    muted: '#7a7672',
    logoTone: tone,
  };
}
