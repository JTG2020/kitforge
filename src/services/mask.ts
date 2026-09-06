import { Face, ProductSpec } from '../types/product';

export const MASK_PROMPT_INSTRUCTION = `LAYOUT REFERENCE: the attached greyscale image maps this panel.
Grey blocks mark where printed text will be laid on top afterwards.
Under every grey block the artwork stays pale, even and quiet, so dark
type reads cleanly over it. The white areas are yours: that is where the
ornament, colour and detail belong.
The black block marks where a brand mark is placed. It stays an even,
unbroken field of a single tone.
Treat the mask as a layout guide only. Its greys and blacks are not
colours to copy into the design.`;

/**
 * Generates a greyscale PNG layout mask on a 640px long edge canvas.
 * TextField boxes filled #808080, logoSlot filled #000000, rest white (#ffffff).
 */
export function generateLayoutMaskPng(
  spec: ProductSpec,
  face: Face
): { dataUrl: string; base64: string; mimeType: 'image/png' } {
  const bleedW = spec.trimW + spec.bleed * 2;
  const bleedH = spec.trimH + spec.bleed * 2;

  const maxDim = 640;
  let canvasW: number;
  let canvasH: number;

  if (bleedW >= bleedH) {
    canvasW = maxDim;
    canvasH = Math.round((bleedH / bleedW) * maxDim);
  } else {
    canvasH = maxDim;
    canvasW = Math.round((bleedW / bleedH) * maxDim);
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, canvasW);
  canvas.height = Math.max(1, canvasH);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to create 2d canvas context for layout mask');
  }

  const scaleX = canvasW / bleedW;
  const scaleY = canvasH / bleedH;

  // Background is pure white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Text fields filled #808080
  ctx.fillStyle = '#808080';
  for (const field of face.textFields) {
    const bleedX = field.x + spec.bleed;
    const bleedY = field.y + spec.bleed;
    const x = Math.round(bleedX * scaleX);
    const y = Math.round(bleedY * scaleY);
    const w = Math.round(field.w * scaleX);
    const h = Math.round(field.h * scaleY);
    ctx.fillRect(x, y, w, h);
  }

  // Logo slot filled #000000
  if (face.logoSlot) {
    ctx.fillStyle = '#000000';
    const bleedX = face.logoSlot.x + spec.bleed;
    const bleedY = face.logoSlot.y + spec.bleed;
    const x = Math.round(bleedX * scaleX);
    const y = Math.round(bleedY * scaleY);
    const w = Math.round(face.logoSlot.w * scaleX);
    const h = Math.round(face.logoSlot.h * scaleY);
    ctx.fillRect(x, y, w, h);
  }

  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1] || '';

  return {
    dataUrl,
    base64,
    mimeType: 'image/png',
  };
}
