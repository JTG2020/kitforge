import React, { useState } from 'react';
import { FaceState, BrandKit, ArtworkVariation } from '../../types/product';
import { StyleBoard } from '../../types/project';
import { RectMM } from '../../types/geometry';
import { DEFAULT_PRODUCT_SPECS, getAllFaces } from '../../config/products';
import { VARIANT_HINTS } from '../../config/directions';
import { generatePieceArtworkCall, generateRevisionCall } from '../../services/gemini';
import { generateLayoutMaskPng } from '../../services/mask';
import { findNearestAspectBucket, mmToPt } from '../../utils/geometry';
import { layoutText } from '../../utils/textLayout';
import { resolveCopyFieldValue } from '../../utils/copyResolution';
import { CanvasPreview } from '../preview/CanvasPreview';
import { jobRegistry, useTargetJob } from '../../store/jobRegistry';

interface PiecesStepProps {
  apiKey: string;
  brandKit: BrandKit;
  styleBoards: StyleBoard[];
  confirmedStyleId?: string;
  faceStates: Record<string, FaceState>;
  onAddArtworkVariation: (faceId: string, variation: ArtworkVariation) => void;
  onSetFaceSelectedId: (faceId: string, variationId: string) => void;
  onSetFaceFinalData: (faceId: string, variationId: string, finalDataUrl: string) => void;
  onUpdateCopyValue: (faceId: string, copyIndex: number, fieldId: string, value: string) => void;
  onUpdateElementRect: (faceId: string, elementId: string, rect: RectMM) => void;
  onResetCustomLayout: (faceId: string) => void;
  onRecordCost: (rupees: number) => void;
  onProceedToExport: () => void;
  onOpenSettings: () => void;
}

export const PiecesStep: React.FC<PiecesStepProps> = ({
  apiKey,
  brandKit,
  styleBoards,
  confirmedStyleId,
  faceStates,
  onAddArtworkVariation,
  onSetFaceSelectedId,
  onSetFaceFinalData,
  onUpdateCopyValue,
  onUpdateElementRect,
  onResetCustomLayout,
  onRecordCost,
  onProceedToExport,
  onOpenSettings,
}) => {
  const allFacesList = getAllFaces();
  const [selectedFaceId, setSelectedFaceId] = useState<string>(allFacesList[0]?.face.id || '');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeCopyIndex, setActiveCopyIndex] = useState<number>(0);
  const [revisionText, setRevisionText] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [isRenderingFinal, setIsRenderingFinal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirmedBoard = styleBoards.find((b) => b.id === confirmedStyleId);

  // Find active spec and face
  const activeItem =
    allFacesList.find((item) => item.face.id === selectedFaceId) || allFacesList[0];
  const spec = activeItem.spec;
  const face = activeItem.face;
  const faceState = faceStates[face.id] || { variations: [], copies: {} };

  const faceJob = useTargetJob(face.id);
  const isGeneratingDrafts = faceJob?.status === 'running';
  const pendingCount = isGeneratingDrafts ? faceJob.totalCount - faceJob.completedCount : 0;

  const currentSelectedVariation =
    faceState.variations.find((v) => v.id === faceState.selectedId) || faceState.variations[0];

  // Currently selected element rect (logo or text field)
  const selectedElementRect: RectMM | null = (() => {
    if (!selectedElementId) return null;
    if (selectedElementId === 'logo') {
      if (!face.logoSlot) return null;
      return faceState.customLayout?.logoSlot || face.logoSlot;
    }
    const f = face.textFields.find((tf) => tf.id === selectedElementId);
    if (!f) return null;
    return faceState.customLayout?.textFields?.[selectedElementId] || {
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    };
  })();

  const handleGenerate4Drafts = async () => {
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }
    if (!confirmedBoard) {
      setErrorMessage('Please confirm a Style Board in the Look step before generating pieces.');
      return;
    }

    setErrorMessage(null);
    const jobId = `piece_job_${face.id}_${Date.now()}`;
    jobRegistry.addJob({
      id: jobId,
      type: 'piece-batch',
      targetId: face.id,
      title: `${spec.name}`,
      tab: 'pieces',
      totalCount: 4,
      completedCount: 0,
      status: 'running',
      startedAt: Date.now(),
    });

    const mask = generateLayoutMaskPng(spec, face);
    const nearestBucket = findNearestAspectBucket(
      spec.trimW + spec.bleed * 2,
      spec.trimH + spec.bleed * 2
    );

    // Pick 4 cycled variant hints
    const startIndex = (faceState.variations.length || 0) % VARIANT_HINTS.length;
    const selectedHints = [
      VARIANT_HINTS[startIndex % VARIANT_HINTS.length],
      VARIANT_HINTS[(startIndex + 1) % VARIANT_HINTS.length],
      VARIANT_HINTS[(startIndex + 2) % VARIANT_HINTS.length],
      VARIANT_HINTS[(startIndex + 3) % VARIANT_HINTS.length],
    ];

    const promises = selectedHints.map(async (hint) => {
      try {
        const dataUrl = await generatePieceArtworkCall(
          apiKey,
          spec,
          face,
          brandKit,
          confirmedBoard.dataUrl,
          mask.dataUrl,
          hint.promptText,
          '2K'
        );

        const newVariation: ArtworkVariation = {
          id: `var_${face.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: Date.now(),
          dataUrl,
          resolution: '2K',
          aspectRatio: nearestBucket,
          directionName: hint.name,
        };

        onAddArtworkVariation(face.id, newVariation);
        onRecordCost(12); // ~₹12 per 2K piece draft
        jobRegistry.incrementCompleted(jobId);
      } catch (err: any) {
        console.error('Failed generating piece draft', face.id, hint.name, err);
        setErrorMessage(err.message || 'Generation failed.');
        jobRegistry.incrementCompleted(jobId);
      }
    });

    await Promise.allSettled(promises);
  };

  const handleRevisePiece = async () => {
    if (!currentSelectedVariation || !revisionText.trim()) return;
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }

    setIsRevising(true);
    setErrorMessage(null);

    try {
      const dataUrl = await generateRevisionCall(
        apiKey,
        currentSelectedVariation.dataUrl,
        revisionText,
        currentSelectedVariation.aspectRatio,
        '2K'
      );

      const revisedVariation: ArtworkVariation = {
        id: `var_rev_${face.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        dataUrl,
        resolution: '2K',
        aspectRatio: currentSelectedVariation.aspectRatio,
        directionName: `${currentSelectedVariation.directionName || 'Draft'} (Revised)`,
        instruction: revisionText,
        parentVariationId: currentSelectedVariation.id,
      };

      onAddArtworkVariation(face.id, revisedVariation);
      onSetFaceSelectedId(face.id, revisedVariation.id);
      onRecordCost(12);
      setRevisionText('');
    } catch (err: any) {
      console.error('Failed to revise piece artwork', err);
      setErrorMessage(err.message || 'Failed to revise artwork.');
    } finally {
      setIsRevising(false);
    }
  };

  const handleRenderFinal4K = async () => {
    if (!currentSelectedVariation) return;
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }
    if (!confirmedBoard) return;

    setIsRenderingFinal(true);
    setErrorMessage(null);

    const mask = generateLayoutMaskPng(spec, face);
    const hint = VARIANT_HINTS[0].promptText;

    try {
      const dataUrl = await generatePieceArtworkCall(
        apiKey,
        spec,
        face,
        brandKit,
        confirmedBoard.dataUrl,
        mask.dataUrl,
        hint,
        '4K'
      );

      onSetFaceFinalData(face.id, currentSelectedVariation.id, dataUrl);
      onRecordCost(25); // ~₹25 for 4K ultra-res final render
    } catch (err: any) {
      console.error('Failed 4K final render', err);
      setErrorMessage(err.message || 'Failed 4K render.');
    } finally {
      setIsRenderingFinal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Anchor Style Reference Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3">
        <div className="flex items-center gap-3 min-w-0">
          {confirmedBoard ? (
            <div className="flex items-center gap-2.5">
              <img
                src={confirmedBoard.dataUrl}
                alt="Confirmed Anchor"
                className="size-10 rounded-md object-cover border border-line shadow-2xs shrink-0"
              />
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-brand">
                  Visual Language Anchor
                </div>
                <div className="text-xs font-semibold text-ink truncate">
                  {confirmedBoard.directionName}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-amber-800 font-medium">
              ⚠️ No Style Board confirmed yet. Visit the Look tab first.
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate4Drafts}
            disabled={isGeneratingDrafts || !confirmedBoard}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
          >
            {isGeneratingDrafts
              ? 'Generating 4 drafts in background...'
              : `Generate 4 in ${confirmedBoard?.directionName || 'Visual Style'}`}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="font-medium underline ml-2 hover:text-red-950"
          >
            Check key settings
          </button>
        </div>
      )}

      {/* 9 Faces Horizontal Selector Bar */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1.5 min-w-max border-b border-line pb-2">
          {allFacesList.map(({ face: f }) => {
            const fState = faceStates[f.id];
            const hasFinal = !!fState?.finalDataUrl;
            const draftCount = fState?.variations?.length || 0;
            const isSelected = f.id === selectedFaceId;

            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  setSelectedFaceId(f.id);
                  setSelectedElementId(null);
                  setActiveCopyIndex(0);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  isSelected
                    ? 'border-brand bg-brand-soft text-brand font-semibold'
                    : 'border-line bg-panel text-ink hover:bg-shell'
                }`}
              >
                <span>{f.label}</span>
                {hasFinal ? (
                  <span className="size-1.5 rounded-full bg-teal-600" title="4K Final Rendered" />
                ) : draftCount > 0 ? (
                  <span className="rounded bg-shell px-1 text-[10px] text-ink/60 border border-line">
                    {draftCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Left is Canvas Preview & Copy Editor, Right is Drafts & Layout Inspector */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Canvas Preview & Live Copy Editor */}
        <div className="lg:col-span-7 space-y-4">
          {/* Canvas Preview Card */}
          <div className="rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-semibold text-ink">{spec.name} — Interactive Layout</h3>
                <p className="text-[11px] text-ink/50">{face.artBrief}</p>
              </div>
              <div className="flex items-center gap-2">
                {faceState.customLayout && (
                  <button
                    type="button"
                    onClick={() => onResetCustomLayout(face.id)}
                    className="rounded border border-line bg-panel px-2 py-1 text-[11px] font-medium text-ink/70 hover:bg-shell transition"
                    title="Reset element positions to template defaults"
                  >
                    Reset Layout
                  </button>
                )}
                {faceState.finalDataUrl ? (
                  <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-800 border border-teal-200">
                    4K Final Render
                  </span>
                ) : currentSelectedVariation ? (
                  <button
                    type="button"
                    onClick={handleRenderFinal4K}
                    disabled={isRenderingFinal}
                    className="rounded-lg border border-brand text-brand hover:bg-brand-soft px-2.5 py-1 text-xs font-semibold transition disabled:opacity-45"
                  >
                    {isRenderingFinal ? 'Rendering 4K...' : 'Render final at 4K (~₹25)'}
                  </button>
                ) : null}
              </div>
            </div>

            <CanvasPreview
              spec={spec}
              face={face}
              faceState={faceState}
              brandKit={brandKit}
              copyIndex={activeCopyIndex}
              isEditable={true}
              selectedElementId={selectedElementId}
              onSelectElement={setSelectedElementId}
              onUpdateElementRect={(elemId, rect) => onUpdateElementRect(face.id, elemId, rect)}
            />
          </div>

          {/* Copy Editor Per Printed Copy */}
          {face.textFields.length > 0 && (
            <div className="rounded-xl border border-line bg-panel p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/70">
                    Vector Typography &amp; Copy Editor
                  </h4>
                  <p className="text-[11px] text-ink/50">
                    Text is rendered as crisp vector type in PDF. Click a field to select and reposition.
                  </p>
                </div>

                {/* Copy Tabs if qty > 1 */}
                {spec.qty > 1 && (
                  <div className="flex gap-1 bg-shell p-1 rounded-lg border border-line">
                    {Array.from({ length: spec.qty }).map((_, cIdx) => {
                      const label = spec.copyLabels?.[cIdx] || `Copy ${cIdx + 1}`;
                      return (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => setActiveCopyIndex(cIdx)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                            activeCopyIndex === cIdx
                              ? 'bg-brand text-white'
                              : 'text-ink/70 hover:text-ink'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Text Fields Input List */}
              <div className="space-y-3.5">
                {face.textFields.map((field) => {
                  const currentVal = resolveCopyFieldValue(
                    field,
                    activeCopyIndex,
                    faceState.copies?.[activeCopyIndex]
                  );

                  const maxChars = field.maxChars || 80;
                  const charCount = currentVal.length;
                  const isCharLimitExceeded = charCount > maxChars;
                  const isFieldSelected = selectedElementId === field.id;

                  // Test layout measurement using effective position
                  const fieldRect = faceState.customLayout?.textFields?.[field.id] || {
                    x: field.x,
                    y: field.y,
                    w: field.w,
                    h: field.h,
                  };

                  const boxWpt = mmToPt(fieldRect.w);
                  const boxHpt = mmToPt(fieldRect.h);
                  const isHeadingSerif = brandKit.fonts.heading.toLowerCase().includes('serif');
                  const isBodySerif = brandKit.fonts.body.toLowerCase().includes('serif');

                  const fontAvgWidth =
                    (field.role === 'heading'
                      ? isHeadingSerif
                        ? 0.52
                        : 0.54
                      : isBodySerif
                      ? 0.5
                      : 0.52) * 1.0;

                  const layout = layoutText({
                    text: currentVal,
                    boxW: boxWpt,
                    boxH: boxHpt,
                    sizePt: field.sizePt,
                    leading: field.leading,
                    align: field.align,
                    measure: (t, sizePt) => t.length * sizePt * fontAvgWidth,
                  });

                  const hasOverflow = layout.overflow;
                  const wasShrunk = layout.shrunk && !hasOverflow;

                  return (
                    <div
                      key={field.id}
                      onClick={() => setSelectedElementId(field.id)}
                      className={`space-y-1 p-2 rounded-lg transition ${
                        isFieldSelected ? 'bg-brand-soft/40 border border-brand/40' : 'bg-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-semibold uppercase tracking-wide text-ink/70 cursor-pointer">
                          {field.label} ({field.sizePt}pt, {fieldRect.w}×{fieldRect.h}mm at X:{fieldRect.x}, Y:{fieldRect.y})
                        </label>
                        <span
                          className={`font-mono text-[11px] ${
                            isCharLimitExceeded ? 'text-amber-800 font-bold' : 'text-ink/50'
                          }`}
                        >
                          {charCount} / {maxChars}
                        </span>
                      </div>

                      {field.multiline ? (
                        <textarea
                          rows={3}
                          value={currentVal}
                          maxLength={maxChars + 15}
                          onChange={(e) =>
                            onUpdateCopyValue(face.id, activeCopyIndex, field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className={`w-full rounded-lg border bg-panel px-3 py-2 text-sm text-ink focus:outline-none resize-none ${
                            hasOverflow
                              ? 'border-amber-400 bg-amber-50/30 focus:border-amber-500'
                              : wasShrunk
                              ? 'border-amber-300 focus:border-brand'
                              : 'border-line focus:border-brand'
                          }`}
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentVal}
                          maxLength={maxChars + 10}
                          onChange={(e) =>
                            onUpdateCopyValue(face.id, activeCopyIndex, field.id, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className={`w-full rounded-lg border bg-panel px-3 py-2 text-sm text-ink focus:outline-none ${
                            hasOverflow
                              ? 'border-amber-400 bg-amber-50/30 focus:border-amber-500'
                              : wasShrunk
                              ? 'border-amber-300 focus:border-brand'
                              : 'border-line focus:border-brand'
                          }`}
                        />
                      )}

                      {/* Shrink / Overflow Status Badges */}
                      {hasOverflow && (
                        <p className="text-[11px] text-amber-800 font-medium">
                          ⚠️ Too long for this space and will be cut in print (at floor {layout.sizePt.toFixed(1)}pt).
                        </p>
                      )}
                      {wasShrunk && (
                        <p className="text-[11px] text-amber-700">
                          ℹ️ Shrunk to fit: shown at {layout.sizePt.toFixed(1)}pt instead of {field.sizePt}pt.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Fine-Tuning Layout Inspector, Draft Variations & Revision Tool */}
        <div className="lg:col-span-5 space-y-4">
          {/* Element Fine-Tuning Position & Size Inspector */}
          {selectedElementId && selectedElementRect && (
            <div className="rounded-xl border border-brand bg-panel p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-brand">
                  Selected: {selectedElementId === 'logo' ? 'Brand Logo Slot' : face.textFields.find((f) => f.id === selectedElementId)?.label || 'Text Field'}
                </h4>
                <button
                  type="button"
                  onClick={() => setSelectedElementId(null)}
                  className="text-ink/50 hover:text-ink text-xs font-medium"
                >
                  Deselect ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-ink/70 mb-1">
                    Position X (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElementRect.x}
                    onChange={(e) =>
                      onUpdateElementRect(face.id, selectedElementId, {
                        ...selectedElementRect,
                        x: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-line bg-panel px-2.5 py-1 text-xs font-mono text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-ink/70 mb-1">
                    Position Y (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElementRect.y}
                    onChange={(e) =>
                      onUpdateElementRect(face.id, selectedElementId, {
                        ...selectedElementRect,
                        y: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-line bg-panel px-2.5 py-1 text-xs font-mono text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-ink/70 mb-1">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElementRect.w}
                    onChange={(e) =>
                      onUpdateElementRect(face.id, selectedElementId, {
                        ...selectedElementRect,
                        w: Math.max(5, parseFloat(e.target.value) || 5),
                      })
                    }
                    className="w-full rounded border border-line bg-panel px-2.5 py-1 text-xs font-mono text-ink focus:border-brand focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold uppercase text-ink/70 mb-1">
                    Height (mm)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedElementRect.h}
                    onChange={(e) =>
                      onUpdateElementRect(face.id, selectedElementId, {
                        ...selectedElementRect,
                        h: Math.max(5, parseFloat(e.target.value) || 5),
                      })
                    }
                    className="w-full rounded border border-line bg-panel px-2.5 py-1 text-xs font-mono text-ink focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              {/* Fast Alignment Shortcuts */}
              <div className="flex items-center gap-2 pt-1 border-t border-line">
                <span className="text-[10px] uppercase font-semibold text-ink/60">Align:</span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateElementRect(face.id, selectedElementId, {
                      ...selectedElementRect,
                      x: Math.round(((spec.trimW - selectedElementRect.w) / 2) * 2) / 2,
                    })
                  }
                  className="rounded border border-line bg-shell px-2 py-0.5 text-[10px] font-medium text-ink hover:bg-panel"
                >
                  Center Horizontally
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateElementRect(face.id, selectedElementId, {
                      ...selectedElementRect,
                      y: Math.round(((spec.trimH - selectedElementRect.h) / 2) * 2) / 2,
                    })
                  }
                  className="rounded border border-line bg-shell px-2 py-0.5 text-[10px] font-medium text-ink hover:bg-panel"
                >
                  Center Vertically
                </button>
              </div>
            </div>
          )}

          {/* Drafts Grid */}
          <div className="rounded-xl border border-line bg-panel p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/70">
                Artwork Drafts ({faceState.variations.length})
              </h4>
              <button
                type="button"
                onClick={handleGenerate4Drafts}
                disabled={isGeneratingDrafts || !confirmedBoard}
                className="rounded border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink hover:bg-shell transition disabled:opacity-45"
              >
                + Generate 4 More
              </button>
            </div>

            {faceState.variations.length === 0 && !isGeneratingDrafts ? (
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-line p-8 text-center bg-shell/30">
                <p className="text-xs text-ink/55">Nothing yet. Four drafts cost about ₹48.</p>
                <button
                  type="button"
                  onClick={handleGenerate4Drafts}
                  disabled={!confirmedBoard}
                  className="mt-3 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
                >
                  Generate 4 Drafts
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {faceState.variations.map((v) => {
                  const isSelected = (faceState.selectedId || faceState.variations[0]?.id) === v.id;
                  return (
                    <div
                      key={v.id}
                      onClick={() => onSetFaceSelectedId(face.id, v.id)}
                      className={`cursor-pointer overflow-hidden rounded-lg bg-shell transition ${
                        isSelected ? 'border-2 border-brand' : 'border-2 border-line hover:border-ink/25'
                      }`}
                    >
                      <div className="aspect-square w-full">
                        <img src={v.dataUrl} alt="Variation" className="h-full w-full object-cover" />
                      </div>
                      <div className="p-1.5 bg-panel border-t border-line text-[10px]">
                        <div className="font-semibold text-ink truncate">
                          {v.directionName || 'Draft Variation'}
                        </div>
                        <div className="text-ink/50">{v.resolution}</div>
                      </div>
                    </div>
                  );
                })}

                {/* In-Flight Draft Placeholders */}
                {Array.from({ length: pendingCount }).map((_, idx) => (
                  <div
                    key={`draft_pending_${idx}`}
                    className="aspect-square animate-pulse rounded-lg border-2 border-dashed border-line bg-shell flex flex-col items-center justify-center p-2 text-center"
                  >
                    <span className="size-2 rounded-full bg-brand/60 animate-ping mb-1.5" />
                    <span className="text-[10px] font-medium text-ink/60">Generating draft...</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revision Tool */}
          {currentSelectedVariation && (
            <div className="rounded-xl border border-line bg-panel p-4 space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-ink/70">
                Revise Selected Artwork
              </h4>
              <p className="text-xs text-ink/60">
                Provide instructions to tweak the current design while maintaining layout and character.
              </p>
              <div className="space-y-2">
                <textarea
                  rows={2}
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  placeholder="e.g. increase corner ornament density and soften the paper texture..."
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-xs text-ink focus:border-brand focus:outline-none resize-none"
                  disabled={isRevising}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleRevisePiece}
                    disabled={isRevising || !revisionText.trim()}
                    className="rounded-lg border border-line bg-panel px-3.5 py-1.5 text-xs font-medium text-ink hover:bg-shell transition disabled:opacity-45"
                  >
                    {isRevising ? 'Revising...' : 'Revise Draft (~₹12)'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-ink/60">
          Total 9 pieces configured ({DEFAULT_PRODUCT_SPECS.reduce((a, s) => a + s.qty * s.faces.length, 0)} printed pages).
        </div>
        <button
          type="button"
          onClick={onProceedToExport}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition shadow-xs"
        >
          Next: Pre-Export Audit &amp; PDF Download →
        </button>
      </div>
    </div>
  );
};
