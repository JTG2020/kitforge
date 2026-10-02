import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ProductSpec, Face, BrandKit, FaceState } from '../../types/product';
import { RectMM } from '../../types/geometry';
import { mmToPx } from '../../utils/geometry';
import { layoutText } from '../../utils/textLayout';
import { sanitizeWinAnsiText } from '../../utils/textSafety';
import { resolveCopyFieldValue } from '../../utils/copyResolution';

interface CanvasPreviewProps {
  spec: ProductSpec;
  face: Face;
  faceState?: FaceState;
  brandKit: BrandKit;
  headingFontOverride?: string;
  copyIndex?: number;
  showGuides?: boolean;
  isEditable?: boolean;
  selectedElementId?: string | null;
  onSelectElement?: (elementId: string | null) => void;
  onUpdateElementRect?: (elementId: string, rect: RectMM) => void;
}

type ResizeHandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  spec,
  face,
  faceState,
  brandKit,
  headingFontOverride,
  copyIndex = 0,
  showGuides = true,
  isEditable = true,
  selectedElementId,
  onSelectElement,
  onUpdateElementRect,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [artworkImg, setArtworkImg] = useState<HTMLImageElement | null>(null);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);

  // Interaction dragging/resizing state
  const dragRef = useRef<{
    active: boolean;
    elementId: string;
    mode: 'move' | ResizeHandleType;
    startX: number;
    startY: number;
    origRect: RectMM;
  } | null>(null);

  const selectedArtworkUrl =
    faceState?.finalDataUrl ||
    faceState?.variations?.find((v) => v.id === faceState.selectedId)?.dataUrl ||
    faceState?.variations?.[0]?.dataUrl;

  // Load Artwork Image
  useEffect(() => {
    if (!selectedArtworkUrl) {
      setArtworkImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = selectedArtworkUrl;
    img.onload = () => setArtworkImg(img);
    img.onerror = () => setArtworkImg(null);
  }, [selectedArtworkUrl]);

  // Load Logo Image
  useEffect(() => {
    if (!brandKit.logoDataUrl) {
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = brandKit.logoDataUrl;
    img.onload = () => setLogoImg(img);
    img.onerror = () => setLogoImg(null);
  }, [brandKit.logoDataUrl]);

  // Helper to get element rect in mm (custom or default)
  const getElementRect = useCallback(
    (elementId: string): RectMM | null => {
      if (elementId === 'logo') {
        if (!face.logoSlot) return null;
        return faceState?.customLayout?.logoSlot || face.logoSlot;
      }
      const field = face.textFields.find((f) => f.id === elementId);
      if (!field) return null;
      return (
        faceState?.customLayout?.textFields?.[elementId] || {
          x: field.x,
          y: field.y,
          w: field.w,
          h: field.h,
        }
      );
    },
    [face, faceState]
  );

  // Redraw Canvas on changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bleedWmm = spec.trimW + spec.bleed * 2;
    const bleedHmm = spec.trimH + spec.bleed * 2;

    const canvasW = Math.round(mmToPx(bleedWmm, 300));
    const canvasH = Math.round(mmToPx(bleedHmm, 300));

    canvas.width = canvasW;
    canvas.height = canvasH;

    const pxPerMm = canvasW / bleedWmm;
    const pxPerPt = pxPerMm * (25.4 / 72);

    // 1. Fill Paper Background
    ctx.fillStyle = brandKit.colors.paper || '#f8f6f0';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. Draw Artwork (Cover Fit)
    if (artworkImg && artworkImg.complete && artworkImg.naturalWidth > 0) {
      const imgW = artworkImg.naturalWidth;
      const imgH = artworkImg.naturalHeight;
      const scale = Math.max(canvasW / imgW, canvasH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = (canvasW - drawW) / 2;
      const drawY = (canvasH - drawH) / 2;

      ctx.drawImage(artworkImg, drawX, drawY, drawW, drawH);
    }

    // 3. Draw Logo Slot
    if (logoImg && logoImg.complete && face.logoSlot) {
      const logoRect = getElementRect('logo') || face.logoSlot;
      const slotX = (logoRect.x + spec.bleed) * pxPerMm;
      const slotY = (logoRect.y + spec.bleed) * pxPerMm;
      const slotW = logoRect.w * pxPerMm;
      const slotH = logoRect.h * pxPerMm;

      const imgW = logoImg.naturalWidth;
      const imgH = logoImg.naturalHeight;
      const scale = Math.min(slotW / imgW, slotH / imgH);
      const drawW = imgW * scale;
      const drawH = imgH * scale;
      const drawX = slotX + (slotW - drawW) / 2;
      const drawY = slotY + (slotH - drawH) / 2;

      ctx.drawImage(logoImg, drawX, drawY, drawW, drawH);
    }

    // 4. Draw Vector Text Fields
    const copyVals = faceState?.copies?.[copyIndex];
    const isHeadingSerif = (headingFontOverride || brandKit.fonts.heading).toLowerCase().includes('serif');
    const isHeadingScript = (headingFontOverride || brandKit.fonts.heading) === 'Dancing Script';
    const isBodySerif = brandKit.fonts.body.toLowerCase().includes('serif');

    for (const field of face.textFields) {
      const rawVal = resolveCopyFieldValue(field, copyIndex, copyVals);
      if (!rawVal) continue;

      const fieldRect = getElementRect(field.id) || {
        x: field.x,
        y: field.y,
        w: field.w,
        h: field.h,
      };

      const { sanitized } = sanitizeWinAnsiText(rawVal);

      const fontFamily =
        field.role === 'heading'
          ? isHeadingScript
            ? '"Dancing Script", cursive'
            : isHeadingSerif
            ? 'Georgia, serif'
            : headingFontOverride || 'ui-sans-serif, system-ui, sans-serif'
          : isBodySerif
          ? 'Georgia, serif'
          : 'ui-sans-serif, system-ui, sans-serif';

      const fontWeight = field.role === 'heading' && !isHeadingScript ? 'bold' : 'normal';

      const boxX = (fieldRect.x + spec.bleed) * pxPerMm;
      const boxY = (fieldRect.y + spec.bleed) * pxPerMm;
      const boxW = fieldRect.w * pxPerMm;
      const boxH = fieldRect.h * pxPerMm;

      // Measurer function using exact ctx font string
      const measureFn = (t: string, sizePt: number) => {
        const sizePx = sizePt * pxPerPt;
        ctx.font = `${fontWeight} ${sizePx}px ${fontFamily}`;
        return ctx.measureText(t).width;
      };

      const layout = layoutText({
        text: sanitized,
        boxW,
        boxH,
        sizePt: field.sizePt,
        leading: field.leading,
        align: field.align,
        measure: (t, sizePt) => measureFn(t, sizePt),
      });

      const actualSizePx = layout.sizePt * pxPerPt;
      const actualLeadingPx = (layout.leading / layout.sizePt) * actualSizePx;

      ctx.font = `${fontWeight} ${actualSizePx}px ${fontFamily}`;

      let fillHex = brandKit.colors.ink || '#16181d';
      if (field.color === 'primary') fillHex = brandKit.colors.primary || '#1f5f5b';
      else if (field.color === 'secondary') fillHex = brandKit.colors.secondary || '#b47b48';
      else if (field.color === 'muted') fillHex = brandKit.colors.muted || '#7a7672';

      ctx.fillStyle = fillHex;
      ctx.textBaseline = 'top';

      const totalH = layout.lines.length * actualLeadingPx;
      let startY = boxY;

      if (!field.multiline && layout.lines.length === 1 && boxH > totalH) {
        startY = boxY + (boxH - totalH) / 2;
      }

      for (let i = 0; i < layout.lines.length; i++) {
        const line = layout.lines[i];
        if (!line) {
          startY += actualLeadingPx;
          continue;
        }

        const lineW = ctx.measureText(line).width;
        let lineX = boxX;
        if (field.align === 'center') {
          lineX = boxX + (boxW - lineW) / 2;
        } else if (field.align === 'right') {
          lineX = boxX + boxW - lineW;
        }

        ctx.fillText(line, lineX, startY);
        startY += actualLeadingPx;
      }
    }

    // 5. Draw Guides if enabled
    if (showGuides) {
      const bleedPx = spec.bleed * pxPerMm;
      const safePx = spec.safe * pxPerMm;

      // Bleed Area Border (outermost)
      ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 0.5, canvasW - 1, canvasH - 1);

      // Trim Line (3mm inside bleed)
      ctx.strokeStyle = 'rgba(31, 95, 91, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(bleedPx, bleedPx, canvasW - bleedPx * 2, canvasH - bleedPx * 2);

      // Safe Margin (5mm inside trim)
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.strokeRect(
        bleedPx + safePx,
        bleedPx + safePx,
        canvasW - (bleedPx + safePx) * 2,
        canvasH - (bleedPx + safePx) * 2
      );
      ctx.setLineDash([]);
    }

    // 6. Interactive Visual Editor Overlay: Highlight hovered & selected elements
    if (isEditable) {
      // Hovered Outline
      if (hoveredElementId && hoveredElementId !== selectedElementId) {
        const hRect = getElementRect(hoveredElementId);
        if (hRect) {
          const hx = (hRect.x + spec.bleed) * pxPerMm;
          const hy = (hRect.y + spec.bleed) * pxPerMm;
          const hw = hRect.w * pxPerMm;
          const hh = hRect.h * pxPerMm;

          ctx.strokeStyle = 'rgba(31, 95, 91, 0.6)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(hx, hy, hw, hh);
          ctx.setLineDash([]);
        }
      }

      // Selected Outline & Resize Handles
      if (selectedElementId) {
        const sRect = getElementRect(selectedElementId);
        if (sRect) {
          const sx = (sRect.x + spec.bleed) * pxPerMm;
          const sy = (sRect.y + spec.bleed) * pxPerMm;
          const sw = sRect.w * pxPerMm;
          const sh = sRect.h * pxPerMm;

          // Solid selection bounding box
          ctx.strokeStyle = '#1f5f5b';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(sx, sy, sw, sh);

          // Subtle tinted fill over selected area
          ctx.fillStyle = 'rgba(31, 95, 91, 0.08)';
          ctx.fillRect(sx, sy, sw, sh);

          // Draw 8 Resize Handles
          const handleSize = 10;
          const halfHandle = handleSize / 2;
          const handles = [
            { x: sx, y: sy }, // NW
            { x: sx + sw / 2, y: sy }, // N
            { x: sx + sw, y: sy }, // NE
            { x: sx + sw, y: sy + sh / 2 }, // E
            { x: sx + sw, y: sy + sh }, // SE
            { x: sx + sw / 2, y: sy + sh }, // S
            { x: sx, y: sy + sh }, // SW
            { x: sx, y: sy + sh / 2 }, // W
          ];

          for (const h of handles) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(h.x - halfHandle, h.y - halfHandle, handleSize, handleSize);
            ctx.strokeStyle = '#1f5f5b';
            ctx.lineWidth = 2;
            ctx.strokeRect(h.x - halfHandle, h.y - halfHandle, handleSize, handleSize);
          }

          // Coordinate Tooltip badge at top-left
          const label =
            selectedElementId === 'logo'
              ? 'Brand Logo'
              : face.textFields.find((f) => f.id === selectedElementId)?.label || 'Text Field';
          const hudText = `${label}: X=${sRect.x.toFixed(1)}mm Y=${sRect.y.toFixed(1)}mm W=${sRect.w.toFixed(1)}mm H=${sRect.h.toFixed(1)}mm`;

          ctx.font = 'bold 20px ui-sans-serif, system-ui, sans-serif';
          const textMetric = ctx.measureText(hudText);
          const badgeW = textMetric.width + 16;
          const badgeH = 28;
          const badgeX = Math.max(8, Math.min(canvasW - badgeW - 8, sx));
          const badgeY = sy > 40 ? sy - badgeH - 6 : sy + sh + 6;

          ctx.fillStyle = 'rgba(22, 24, 29, 0.9)';
          ctx.beginPath();
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 6);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.textBaseline = 'middle';
          ctx.fillText(hudText, badgeX + 8, badgeY + badgeH / 2);
        }
      }
    }
  }, [
    spec,
    face,
    faceState,
    brandKit,
    copyIndex,
    artworkImg,
    logoImg,
    showGuides,
    isEditable,
    selectedElementId,
    hoveredElementId,
    getElementRect,
  ]);

  // Convert mouse event coordinates on DOM canvas to exact mm on face
  const getPointerMm = (e: React.PointerEvent<HTMLCanvasElement>): { xMm: number; yMm: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { xMm: 0, yMm: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const bleedWmm = spec.trimW + spec.bleed * 2;
    const bleedHmm = spec.trimH + spec.bleed * 2;

    const xMm = (clientX / rect.width) * bleedWmm - spec.bleed;
    const yMm = (clientY / rect.height) * bleedHmm - spec.bleed;

    return { xMm, yMm };
  };

  // Find handle under pointer
  const getHandleUnderPointer = (
    pointerMm: { xMm: number; yMm: number },
    elementRect: RectMM
  ): ResizeHandleType | null => {
    const hitToleranceMm = 3.5;
    const x = elementRect.x;
    const y = elementRect.y;
    const w = elementRect.w;
    const h = elementRect.h;

    const handles: Array<{ type: ResizeHandleType; x: number; y: number }> = [
      { type: 'nw', x: x, y: y },
      { type: 'n', x: x + w / 2, y: y },
      { type: 'ne', x: x + w, y: y },
      { type: 'e', x: x + w, y: y + h / 2 },
      { type: 'se', x: x + w, y: y + h },
      { type: 's', x: x + w / 2, y: y + h },
      { type: 'sw', x: x, y: y + h },
      { type: 'w', x: x, y: y + h / 2 },
    ];

    for (const hand of handles) {
      const dist = Math.hypot(pointerMm.xMm - hand.x, pointerMm.yMm - hand.y);
      if (dist <= hitToleranceMm) {
        return hand.type;
      }
    }
    return null;
  };

  // Find element under pointer
  const getElementUnderPointer = (pointerMm: { xMm: number; yMm: number }): string | null => {
    // Check text fields in reverse order
    for (let i = face.textFields.length - 1; i >= 0; i--) {
      const f = face.textFields[i];
      const r = getElementRect(f.id) || { x: f.x, y: f.y, w: f.w, h: f.h };
      if (
        pointerMm.xMm >= r.x &&
        pointerMm.xMm <= r.x + r.w &&
        pointerMm.yMm >= r.y &&
        pointerMm.yMm <= r.y + r.h
      ) {
        return f.id;
      }
    }

    // Check logo slot
    if (face.logoSlot) {
      const r = getElementRect('logo') || face.logoSlot;
      if (
        pointerMm.xMm >= r.x &&
        pointerMm.xMm <= r.x + r.w &&
        pointerMm.yMm >= r.y &&
        pointerMm.yMm <= r.y + r.h
      ) {
        return 'logo';
      }
    }

    return null;
  };

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditable) return;
    const ptMm = getPointerMm(e);

    // If an element is already selected, check if user clicked on one of its resize handles
    if (selectedElementId) {
      const sRect = getElementRect(selectedElementId);
      if (sRect) {
        const handle = getHandleUnderPointer(ptMm, sRect);
        if (handle) {
          dragRef.current = {
            active: true,
            elementId: selectedElementId,
            mode: handle,
            startX: ptMm.xMm,
            startY: ptMm.yMm,
            origRect: { ...sRect },
          };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    // Check if clicked inside any element
    const hitId = getElementUnderPointer(ptMm);
    if (hitId) {
      onSelectElement?.(hitId);
      const hitRect = getElementRect(hitId);
      if (hitRect) {
        dragRef.current = {
          active: true,
          elementId: hitId,
          mode: 'move',
          startX: ptMm.xMm,
          startY: ptMm.yMm,
          origRect: { ...hitRect },
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    } else {
      // Clicked on empty canvas background
      onSelectElement?.(null);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isEditable) return;
    const ptMm = getPointerMm(e);

    // If currently dragging / resizing
    if (dragRef.current && dragRef.current.active) {
      const { elementId, mode, startX, startY, origRect } = dragRef.current;
      const dx = ptMm.xMm - startX;
      const dy = ptMm.yMm - startY;

      let newX = origRect.x;
      let newY = origRect.y;
      let newW = origRect.w;
      let newH = origRect.h;

      const minDimMm = 8;

      if (mode === 'move') {
        newX = Math.round((origRect.x + dx) * 2) / 2; // snap to 0.5mm
        newY = Math.round((origRect.y + dy) * 2) / 2;
      } else {
        // Handle resizing
        if (mode.includes('e')) {
          newW = Math.max(minDimMm, Math.round((origRect.w + dx) * 2) / 2);
        }
        if (mode.includes('s')) {
          newH = Math.max(minDimMm, Math.round((origRect.h + dy) * 2) / 2);
        }
        if (mode.includes('w')) {
          const desiredW = Math.max(minDimMm, Math.round((origRect.w - dx) * 2) / 2);
          const actualDx = origRect.w - desiredW;
          newX = Math.round((origRect.x + actualDx) * 2) / 2;
          newW = desiredW;
        }
        if (mode.includes('n')) {
          const desiredH = Math.max(minDimMm, Math.round((origRect.h - dy) * 2) / 2);
          const actualDy = origRect.h - desiredH;
          newY = Math.round((origRect.y + actualDy) * 2) / 2;
          newH = desiredH;
        }
      }

      onUpdateElementRect?.(elementId, {
        x: newX,
        y: newY,
        w: newW,
        h: newH,
      });
      return;
    }

    // Update cursor and hover state
    if (selectedElementId) {
      const sRect = getElementRect(selectedElementId);
      if (sRect) {
        const handle = getHandleUnderPointer(ptMm, sRect);
        if (handle) {
          const cursorMap: Record<ResizeHandleType, string> = {
            nw: 'nwse-resize',
            se: 'nwse-resize',
            ne: 'nesw-resize',
            sw: 'nesw-resize',
            n: 'ns-resize',
            s: 'ns-resize',
            e: 'ew-resize',
            w: 'ew-resize',
          };
          if (canvasRef.current) canvasRef.current.style.cursor = cursorMap[handle];
          return;
        }
      }
    }

    const hit = getElementUnderPointer(ptMm);
    setHoveredElementId(hit);
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hit ? 'move' : 'default';
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current && dragRef.current.active) {
      dragRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  // Keyboard Nudge Support (Arrow keys to nudge 0.5mm, Shift+Arrow 2mm)
  useEffect(() => {
    if (!isEditable || !selectedElementId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // Prevent scrolling
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
          return;
        }
        e.preventDefault();
        const sRect = getElementRect(selectedElementId);
        if (!sRect) return;

        const step = e.shiftKey ? 2.0 : 0.5;
        let newX = sRect.x;
        let newY = sRect.y;

        if (e.key === 'ArrowLeft') newX -= step;
        if (e.key === 'ArrowRight') newX += step;
        if (e.key === 'ArrowUp') newY -= step;
        if (e.key === 'ArrowDown') newY += step;

        onUpdateElementRect?.(selectedElementId, {
          ...sRect,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
        });
      } else if (e.key === 'Escape') {
        onSelectElement?.(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditable, selectedElementId, getElementRect, onUpdateElementRect, onSelectElement]);

  return (
    <div ref={containerRef} className="flex flex-col items-center justify-center overflow-x-auto p-2">
      <div className="relative rounded-lg border border-line bg-panel p-2 shadow-xs max-w-full">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            maxWidth: '100%',
            height: 'auto',
            maxHeight: '520px',
            objectFit: 'contain',
            aspectRatio: `${spec.trimW + spec.bleed * 2} / ${spec.trimH + spec.bleed * 2}`,
            touchAction: 'none',
          }}
          className="rounded-sm block select-none"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink/60">
        <span>
          Trim: {spec.trimW} × {spec.trimH} mm (+3mm bleed)
        </span>
        {isEditable && (
          <>
            <span>•</span>
            <span className="text-brand font-medium">
              💡 Click &amp; drag any text or logo to reposition • Drag corner handles to resize
            </span>
          </>
        )}
      </div>
    </div>
  );
};
