import React, { useState } from 'react';
import { BrandKit } from '../../types/product';
import { StyleBoard } from '../../types/project';
import { STYLE_DIRECTIONS } from '../../config/directions';
import { generateStyleBoardCall, generateRevisionCall } from '../../services/gemini';
import { jobRegistry, useTargetJob } from '../../store/jobRegistry';

interface LookStepProps {
  apiKey: string;
  brandKit: BrandKit;
  styleBoards: StyleBoard[];
  chosenStyleId?: string;
  confirmedStyleId?: string;
  onAddStyleBoard: (board: StyleBoard) => void;
  onSetChosenStyleId: (id?: string) => void;
  onSetConfirmedStyleId: (id?: string) => void;
  onRecordCost: (rupees: number) => void;
  onProceedToPieces: () => void;
  onOpenSettings: () => void;
}

export const LookStep: React.FC<LookStepProps> = ({
  apiKey,
  brandKit,
  styleBoards,
  chosenStyleId,
  confirmedStyleId,
  onAddStyleBoard,
  onSetChosenStyleId,
  onSetConfirmedStyleId,
  onRecordCost,
  onProceedToPieces,
  onOpenSettings,
}) => {
  const [revisionText, setRevisionText] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lookJob = useTargetJob('style');
  const isGeneratingBatch = lookJob?.status === 'running';
  const pendingCount = isGeneratingBatch ? lookJob.totalCount - lookJob.completedCount : 0;

  const chosenBoard =
    styleBoards.find((b) => b.id === chosenStyleId) || styleBoards[0] || undefined;

  const confirmedBoard =
    styleBoards.find((b) => b.id === confirmedStyleId) || undefined;

  const handleGenerateBatch = async () => {
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }

    setErrorMessage(null);
    const jobId = `style_job_${Date.now()}`;
    jobRegistry.addJob({
      id: jobId,
      type: 'style-batch',
      targetId: 'style',
      title: 'Look',
      tab: 'look',
      totalCount: 4,
      completedCount: 0,
      status: 'running',
      startedAt: Date.now(),
    });

    // Pick 4 directions cycling based on existing boards count
    const startIndex = styleBoards.length % STYLE_DIRECTIONS.length;
    const selectedDirections = [
      STYLE_DIRECTIONS[startIndex % STYLE_DIRECTIONS.length],
      STYLE_DIRECTIONS[(startIndex + 1) % STYLE_DIRECTIONS.length],
      STYLE_DIRECTIONS[(startIndex + 2) % STYLE_DIRECTIONS.length],
      STYLE_DIRECTIONS[(startIndex + 3) % STYLE_DIRECTIONS.length],
    ];

    // Launch 4 in parallel, committing each as it lands
    const promises = selectedDirections.map(async (dir) => {
      try {
        const dataUrl = await generateStyleBoardCall(apiKey, brandKit, dir.promptText);
        const newBoard: StyleBoard = {
          id: `sb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          createdAt: Date.now(),
          dataUrl,
          directionName: dir.name,
          prompt: dir.promptText,
        };
        onAddStyleBoard(newBoard);
        onRecordCost(7); // ~₹7 per 1K swatch
        jobRegistry.incrementCompleted(jobId);
      } catch (err: any) {
        console.error('Failed generating style direction', dir.name, err);
        setErrorMessage(err.message || 'Generation failed.');
        jobRegistry.incrementCompleted(jobId);
      }
    });

    await Promise.allSettled(promises);
  };

  const handleReviseSelected = async () => {
    if (!chosenBoard || !revisionText.trim()) return;
    if (!apiKey.trim()) {
      onOpenSettings();
      return;
    }

    setIsRevising(true);
    setErrorMessage(null);

    try {
      const dataUrl = await generateRevisionCall(
        apiKey,
        chosenBoard.dataUrl,
        revisionText,
        '1:1',
        '1K'
      );

      const revisedBoard: StyleBoard = {
        id: `sb_rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        dataUrl,
        directionName: `${chosenBoard.directionName} (Revised)`,
        prompt: chosenBoard.prompt,
        instruction: revisionText,
        parentBoardId: chosenBoard.id,
      };

      onAddStyleBoard(revisedBoard);
      onSetChosenStyleId(revisedBoard.id);
      onRecordCost(7);
      setRevisionText('');
    } catch (err: any) {
      console.error('Revision failed', err);
      setErrorMessage(err.message || 'Failed to revise style board.');
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">The look</h2>
          <p className="text-xs text-ink/60">
            Generate 1:1 visual language reference boards. Pick and confirm one look before designing pieces.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateBatch}
            disabled={isGeneratingBatch}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
          >
            {isGeneratingBatch ? 'Generating 4 swatches in background...' : 'Generate 4 directions (about ₹28)'}
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

      {/* Main Grid & Inspection Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Style Boards Swatches Grid */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">
              Style Directions ({styleBoards.length})
            </span>
            {confirmedBoard && (
              <span className="text-[11px] font-medium text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                ✓ Confirmed: {confirmedBoard.directionName}
              </span>
            )}
          </div>

          {styleBoards.length === 0 && !isGeneratingBatch ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-line p-12 text-center bg-panel">
              <p className="text-sm text-ink/55">Nothing yet. Four directions cost about ₹28.</p>
              <button
                type="button"
                onClick={handleGenerateBatch}
                className="mt-3 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition"
              >
                Generate 4 Directions
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {/* Existing Boards */}
              {styleBoards.map((board) => {
                const isSelected = (chosenBoard?.id || chosenStyleId) === board.id;
                const isConfirmed = confirmedStyleId === board.id;

                return (
                  <div
                    key={board.id}
                    onClick={() => onSetChosenStyleId(board.id)}
                    className={`group relative cursor-pointer overflow-hidden rounded-lg bg-shell transition ${
                      isSelected ? 'border-2 border-brand' : 'border-2 border-line hover:border-ink/25'
                    }`}
                  >
                    <div className="aspect-square w-full">
                      <img
                        src={board.dataUrl}
                        alt={board.directionName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-2 bg-panel border-t border-line text-[11px]">
                      <div className="font-semibold text-ink truncate">{board.directionName}</div>
                      {isConfirmed && (
                        <div className="text-[10px] font-bold text-teal-700 mt-0.5">
                          ✓ CONFIRMED ANCHOR
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* In-Flight Placeholder Tiles */}
              {Array.from({ length: pendingCount }).map((_, idx) => (
                <div
                  key={`pending_${idx}`}
                  className="aspect-square animate-pulse rounded-lg border-2 border-dashed border-line bg-shell flex flex-col items-center justify-center p-3 text-center"
                >
                  <span className="size-2 rounded-full bg-brand/60 animate-ping mb-2" />
                  <span className="text-[11px] font-medium text-ink/60">Generating swatch...</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Board Detail & Revision */}
        <div className="lg:col-span-5">
          {chosenBoard ? (
            <div className="rounded-xl border border-line bg-panel p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{chosenBoard.directionName}</h3>
                  <p className="text-[11px] text-ink/50">1:1 Style Swatch Reference</p>
                </div>
                {confirmedStyleId === chosenBoard.id ? (
                  <span className="rounded bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-800 border border-teal-200">
                    Confirmed Anchor
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSetConfirmedStyleId(chosenBoard.id)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition"
                  >
                    Confirm this visual language
                  </button>
                )}
              </div>

              {/* Big Preview */}
              <div className="aspect-square w-full rounded-lg border border-line overflow-hidden bg-shell">
                <img
                  src={chosenBoard.dataUrl}
                  alt={chosenBoard.directionName}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Revision Tool */}
              <div className="space-y-2 rounded-lg border border-line bg-shell/40 p-3 text-xs">
                <label className="block font-semibold uppercase tracking-wide text-ink/70">
                  Revise this swatch
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                    placeholder="e.g. make the borders thinner and deepen the teal linework..."
                    className="flex-1 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs text-ink focus:border-brand focus:outline-none"
                    disabled={isRevising}
                  />
                  <button
                    type="button"
                    onClick={handleReviseSelected}
                    disabled={isRevising || !revisionText.trim()}
                    className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-shell transition disabled:opacity-45"
                  >
                    {isRevising ? 'Revising...' : 'Revise (~₹7)'}
                  </button>
                </div>
                <p className="text-[11px] text-ink/50">
                  Adds a new swatch beside the original while maintaining character.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-panel p-8 text-center text-xs text-ink/50">
              Select or generate a style board to inspect and confirm.
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-ink/60">
          {!confirmedBoard && 'Note: Confirm a style board to use as reference for your kit pieces.'}
        </div>
        <button
          type="button"
          onClick={onProceedToPieces}
          disabled={!confirmedBoard}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition disabled:opacity-45"
        >
          Next: Generate Kit Pieces ({confirmedBoard ? confirmedBoard.directionName : 'Confirm Look First'}) →
        </button>
      </div>
    </div>
  );
};
