import { PDFDocument, rgb, StandardFonts, PDFPage } from 'pdf-lib';
import { ProductSpec } from '../types/product';
import { ProjectState } from '../types/project';
import { DEFAULT_PRODUCT_SPECS } from '../config/products';
import { mmToPt } from '../utils/geometry';
import { layoutText } from '../utils/textLayout';
import { sanitizeWinAnsiText, TextSubstitution } from '../utils/textSafety';
import { resolveCopyFieldValue } from '../utils/copyResolution';

export interface PreExportReport {
  substitutions: TextSubstitution[];
  overflows: Array<{
    pieceName: string;
    faceLabel: string;
    copyIndex: number;
    copyLabel: string;
    fieldLabel: string;
    text: string;
    sizePt: number;
    originalSizePt: number;
  }>;
  totalPages: number;
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(match[1], 16) / 255,
    g: parseInt(match[2], 16) / 255,
    b: parseInt(match[3], 16) / 255,
  };
}

/**
 * Draws standard trim / crop marks in the 3mm bleed margin outside the trim line.
 */
function drawCropMarks(page: PDFPage, bleedWpt: number, bleedHpt: number, bleedMm = 3) {
  const bleedPt = mmToPt(bleedMm);
  const markLengthPt = mmToPt(2.2); // length of crop mark line
  const markOffsetPt = mmToPt(0.6); // space from trim line to mark start
  const strokeColor = rgb(0.1, 0.1, 0.1);
  const strokeWidth = 0.5;

  const trimLeft = bleedPt;
  const trimRight = bleedWpt - bleedPt;
  const trimBottom = bleedPt;
  const trimTop = bleedHpt - bleedPt;

  // Top-Left corner
  // Horizontal line extending left
  page.drawLine({
    start: { x: trimLeft - markOffsetPt, y: trimTop },
    end: { x: trimLeft - markOffsetPt - markLengthPt, y: trimTop },
    thickness: strokeWidth,
    color: strokeColor,
  });
  // Vertical line extending up
  page.drawLine({
    start: { x: trimLeft, y: trimTop + markOffsetPt },
    end: { x: trimLeft, y: trimTop + markOffsetPt + markLengthPt },
    thickness: strokeWidth,
    color: strokeColor,
  });

  // Top-Right corner
  // Horizontal line extending right
  page.drawLine({
    start: { x: trimRight + markOffsetPt, y: trimTop },
    end: { x: trimRight + markOffsetPt + markLengthPt, y: trimTop },
    thickness: strokeWidth,
    color: strokeColor,
  });
  // Vertical line extending up
  page.drawLine({
    start: { x: trimRight, y: trimTop + markOffsetPt },
    end: { x: trimRight, y: trimTop + markOffsetPt + markLengthPt },
    thickness: strokeWidth,
    color: strokeColor,
  });

  // Bottom-Left corner
  // Horizontal line extending left
  page.drawLine({
    start: { x: trimLeft - markOffsetPt, y: trimBottom },
    end: { x: trimLeft - markOffsetPt - markLengthPt, y: trimBottom },
    thickness: strokeWidth,
    color: strokeColor,
  });
  // Vertical line extending down
  page.drawLine({
    start: { x: trimLeft, y: trimBottom - markOffsetPt },
    end: { x: trimLeft, y: trimBottom - markOffsetPt - markLengthPt },
    thickness: strokeWidth,
    color: strokeColor,
  });

  // Bottom-Right corner
  // Horizontal line extending right
  page.drawLine({
    start: { x: trimRight + markOffsetPt, y: trimBottom },
    end: { x: trimRight + markOffsetPt + markLengthPt, y: trimBottom },
    thickness: strokeWidth,
    color: strokeColor,
  });
  // Vertical line extending down
  page.drawLine({
    start: { x: trimRight, y: trimBottom - markOffsetPt },
    end: { x: trimRight, y: trimBottom - markOffsetPt - markLengthPt },
    thickness: strokeWidth,
    color: strokeColor,
  });
}

/**
 * Pre-scans the entire project for WinAnsi substitutions and text overflows.
 */
export async function generatePreExportReport(
  project: ProjectState,
  specs: ProductSpec[] = DEFAULT_PRODUCT_SPECS
): Promise<PreExportReport> {
  const substitutions: TextSubstitution[] = [];
  const overflows: PreExportReport['overflows'] = [];
  let totalPages = 0;

  // Create temporary PDF doc to accurately measure standard fonts
  const tempDoc = await PDFDocument.create();
  const fontRegular = await tempDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await tempDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSerif = await tempDoc.embedFont(StandardFonts.TimesRoman);
  const fontSerifBold = await tempDoc.embedFont(StandardFonts.TimesRomanBold);

  const isHeadingSerif = project.brandKit.fonts.heading.toLowerCase().includes('serif');
  const isBodySerif = project.brandKit.fonts.body.toLowerCase().includes('serif');

  for (const spec of specs) {
    for (let copyIdx = 0; copyIdx < spec.qty; copyIdx++) {
      const copyLabel = spec.copyLabels?.[copyIdx] || `Copy ${copyIdx + 1}`;

      for (const face of spec.faces) {
        totalPages++;
        const faceState = project.faceStates[face.id];
        const copyVals = faceState?.copies?.[copyIdx];

        for (const field of face.textFields) {
          const rawVal = resolveCopyFieldValue(field, copyIdx, copyVals);
          if (!rawVal) continue;

          // Check WinAnsi substitutions
          const { sanitized, substitutions: fieldSubs } = sanitizeWinAnsiText(rawVal, {
            fieldId: field.id,
            fieldLabel: field.label,
            pieceName: spec.name,
            copyIndex: copyIdx,
          });

          for (const s of fieldSubs) {
            substitutions.push(s);
          }

          // Measure layout using custom or default field rect
          const fieldRect = faceState?.customLayout?.textFields?.[field.id] || {
            x: field.x,
            y: field.y,
            w: field.w,
            h: field.h,
          };

          const font =
            field.role === 'heading'
              ? isHeadingSerif
                ? fontSerifBold
                : fontBold
              : isBodySerif
              ? fontSerif
              : fontRegular;

          const boxWpt = mmToPt(fieldRect.w);
          const boxHpt = mmToPt(fieldRect.h);

          const layoutResult = layoutText({
            text: sanitized,
            boxW: boxWpt,
            boxH: boxHpt,
            sizePt: field.sizePt,
            leading: field.leading,
            align: field.align,
            measure: (t, size) => font.widthOfTextAtSize(t, size),
          });

          if (layoutResult.overflow) {
            overflows.push({
              pieceName: spec.name,
              faceLabel: face.label,
              copyIndex: copyIdx,
              copyLabel,
              fieldLabel: field.label,
              text: sanitized,
              sizePt: layoutResult.sizePt,
              originalSizePt: layoutResult.originalSizePt,
            });
          }
        }
      }
    }
  }

  return { substitutions, overflows, totalPages };
}

/**
 * Builds and downloads the 15-page print-ready PDF document.
 */
export async function exportKitPdf(
  project: ProjectState,
  specs: ProductSpec[] = DEFAULT_PRODUCT_SPECS
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  // Standard WinAnsi font pairs
  const fontHelv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontTimes = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontTimesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

  const isHeadingSerif = project.brandKit.fonts.heading.toLowerCase().includes('serif');
  const isBodySerif = project.brandKit.fonts.body.toLowerCase().includes('serif');

  const headingFont = isHeadingSerif ? fontTimesBold : fontHelvBold;
  const bodyFont = isBodySerif ? fontTimes : fontHelv;

  const colorInk = hexToRgb01(project.brandKit.colors.ink || '#16181d');
  const colorPrimary = hexToRgb01(project.brandKit.colors.primary || '#1f5f5b');
  const colorSecondary = hexToRgb01(project.brandKit.colors.secondary || '#b47b48');
  const colorMuted = hexToRgb01(project.brandKit.colors.muted || '#7a7672');
  const colorPaper = hexToRgb01(project.brandKit.colors.paper || '#f8f6f0');

  // Embed Logo image once if available
  let embeddedLogo: any = null;
  if (project.brandKit.logoDataUrl) {
    try {
      const data = project.brandKit.logoDataUrl;
      if (data.includes('image/png') || data.startsWith('data:image/png')) {
        embeddedLogo = await pdfDoc.embedPng(data);
      } else if (data.includes('image/jpeg') || data.startsWith('data:image/jpeg')) {
        embeddedLogo = await pdfDoc.embedJpg(data);
      }
    } catch (err) {
      console.warn('Could not embed logo image into PDF', err);
    }
  }

  // Iterate all products and copies (Total 15 pages)
  for (const spec of specs) {
    const bleedWmm = spec.trimW + spec.bleed * 2;
    const bleedHmm = spec.trimH + spec.bleed * 2;
    const bleedWpt = mmToPt(bleedWmm);
    const bleedHpt = mmToPt(bleedHmm);

    for (let copyIdx = 0; copyIdx < spec.qty; copyIdx++) {
      for (const face of spec.faces) {
        const page = pdfDoc.addPage([bleedWpt, bleedHpt]);
        // Set MediaBox and BleedBox to full bleed size
        page.setMediaBox(0, 0, bleedWpt, bleedHpt);
        page.setBleedBox(0, 0, bleedWpt, bleedHpt);
        page.setTrimBox(mmToPt(spec.bleed), mmToPt(spec.bleed), mmToPt(spec.trimW), mmToPt(spec.trimH));

        // 1. Paper Background Fill
        page.drawRectangle({
          x: 0,
          y: 0,
          width: bleedWpt,
          height: bleedHpt,
          color: rgb(colorPaper.r, colorPaper.g, colorPaper.b),
        });

        // 2. Artwork raster layer (cover-fitted)
        const faceState = project.faceStates[face.id];
        const artworkDataUrl =
          faceState?.finalDataUrl ||
          faceState?.variations?.find((v) => v.id === faceState.selectedId)?.dataUrl ||
          faceState?.variations?.[0]?.dataUrl;

        if (artworkDataUrl) {
          try {
            let embeddedArt: any = null;
            if (artworkDataUrl.includes('image/png')) {
              embeddedArt = await pdfDoc.embedPng(artworkDataUrl);
            } else {
              embeddedArt = await pdfDoc.embedJpg(artworkDataUrl);
            }

            if (embeddedArt) {
              // Cover fit onto bleed box
              const imgW = embeddedArt.width;
              const imgH = embeddedArt.height;
              const scale = Math.max(bleedWpt / imgW, bleedHpt / imgH);
              const drawW = imgW * scale;
              const drawH = imgH * scale;
              const drawX = (bleedWpt - drawW) / 2;
              const drawY = (bleedHpt - drawH) / 2;

              page.drawImage(embeddedArt, {
                x: drawX,
                y: drawY,
                width: drawW,
                height: drawH,
              });
            }
          } catch (err) {
            console.warn('Could not embed artwork for face', face.id, err);
          }
        }

        // 3. Logo contain-fit layer (respect custom position)
        const logoSlotRect = faceState?.customLayout?.logoSlot || face.logoSlot;
        if (embeddedLogo && logoSlotRect) {
          const slotXpt = mmToPt(logoSlotRect.x + spec.bleed);
          const slotYpt = bleedHpt - mmToPt(logoSlotRect.y + spec.bleed + logoSlotRect.h);
          const slotWpt = mmToPt(logoSlotRect.w);
          const slotHpt = mmToPt(logoSlotRect.h);

          const logoW = embeddedLogo.width;
          const logoH = embeddedLogo.height;
          const scale = Math.min(slotWpt / logoW, slotHpt / logoH);
          const drawW = logoW * scale;
          const drawH = logoH * scale;
          const drawX = slotXpt + (slotWpt - drawW) / 2;
          const drawY = slotYpt + (slotHpt - drawH) / 2;

          page.drawImage(embeddedLogo, {
            x: drawX,
            y: drawY,
            width: drawW,
            height: drawH,
          });
        }

        // 4. Vector Text Fields (respect custom positions)
        const copyVals = faceState?.copies?.[copyIdx];
        for (const field of face.textFields) {
          const rawVal = resolveCopyFieldValue(field, copyIdx, copyVals);
          if (!rawVal) continue;

          const fieldRect = faceState?.customLayout?.textFields?.[field.id] || {
            x: field.x,
            y: field.y,
            w: field.w,
            h: field.h,
          };

          const { sanitized } = sanitizeWinAnsiText(rawVal);
          const font = field.role === 'heading' ? headingFont : bodyFont;

          const boxXpt = mmToPt(fieldRect.x + spec.bleed);
          const boxWpt = mmToPt(fieldRect.w);
          const boxHpt = mmToPt(fieldRect.h);
          // PDF coordinate system origin is bottom-left
          const boxTopYpt = bleedHpt - mmToPt(fieldRect.y + spec.bleed);

          const layout = layoutText({
            text: sanitized,
            boxW: boxWpt,
            boxH: boxHpt,
            sizePt: field.sizePt,
            leading: field.leading,
            align: field.align,
            measure: (t, size) => font.widthOfTextAtSize(t, size),
          });

          let fontColor = rgb(colorInk.r, colorInk.g, colorInk.b);
          if (field.color === 'primary') {
            fontColor = rgb(colorPrimary.r, colorPrimary.g, colorPrimary.b);
          } else if (field.color === 'secondary') {
            fontColor = rgb(colorSecondary.r, colorSecondary.g, colorSecondary.b);
          } else if (field.color === 'muted') {
            fontColor = rgb(colorMuted.r, colorMuted.g, colorMuted.b);
          }

          // Compute starting Y
          const totalTextH = layout.lines.length * layout.leading;
          let startY = boxTopYpt - layout.sizePt * 0.9;

          // If vertical center alignment for single-line display headings
          if (!field.multiline && layout.lines.length === 1 && boxHpt > totalTextH) {
            startY = boxTopYpt - (boxHpt - totalTextH) / 2 - layout.sizePt * 0.9;
          }

          for (let lineIdx = 0; lineIdx < layout.lines.length; lineIdx++) {
            const lineText = layout.lines[lineIdx];
            if (!lineText) {
              startY -= layout.leading;
              continue;
            }

            const lineWidth = font.widthOfTextAtSize(lineText, layout.sizePt);
            let lineX = boxXpt;

            if (field.align === 'center') {
              lineX = boxXpt + (boxWpt - lineWidth) / 2;
            } else if (field.align === 'right') {
              lineX = boxXpt + boxWpt - lineWidth;
            }

            page.drawText(lineText, {
              x: lineX,
              y: startY,
              size: layout.sizePt,
              font,
              color: fontColor,
            });

            startY -= layout.leading;
          }
        }

        // 5. Crop marks in the bleed area
        drawCropMarks(page, bleedWpt, bleedHpt, spec.bleed);
      }
    }
  }

  return await pdfDoc.save({ useObjectStreams: true });
}
