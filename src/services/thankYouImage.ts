import type { ThankYouImageProvider } from '../types/project';
import type { ProductSpec } from '../types/product';
import { editMetaMuseImage, generateMetaMuseImage } from './metaMuse.ts';

function getMuseSize(spec: ProductSpec): string {
  const width = spec.trimW + spec.bleed * 2;
  const height = spec.trimH + spec.bleed * 2;
  const longEdge = 1536;

  return width >= height
    ? `${longEdge}x${Math.round(longEdge * height / width)}`
    : `${Math.round(longEdge * width / height)}x${longEdge}`;
}

export function generateThankYouBackgroundWithProvider(
  provider: ThankYouImageProvider,
  metaApiKey: string,
  approvedBrief: string,
  referenceImages: string[],
  spec: ProductSpec,
  generateWithGemini: () => Promise<string>
): Promise<string> {
  if (provider === 'meta-muse') {
    return generateMetaMuseImage(metaApiKey, approvedBrief, referenceImages, getMuseSize(spec));
  }

  return generateWithGemini();
}

export function editThankYouBackgroundWithMuse(
  apiKey: string,
  sourceImageDataUrl: string,
  instruction: string,
  spec: ProductSpec
): Promise<string> {
  const prompt = `${instruction.trim()}\n\nApply the requested change to the background only. Preserve the calm, light, low-contrast central copy area. Do not add words, letters, numbers, logos, borders, or paper mockups.`;
  return editMetaMuseImage(apiKey, sourceImageDataUrl, prompt, getMuseSize(spec));
}