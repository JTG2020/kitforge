import React from 'react';
import { PreExportReport } from '../services/pdf';

interface PreExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExport: () => void;
  report: PreExportReport | null;
  isExporting: boolean;
}

export const PreExportModal: React.FC<PreExportModalProps> = ({
  isOpen,
  onClose,
  onConfirmExport,
  report,
  isExporting,
}) => {
  if (!isOpen || !report) return null;

  const hasSubstitutions = report.substitutions.length > 0;
  const hasOverflows = report.overflows.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl border border-line bg-panel shadow-sm max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Pre-Export Quality & Print Audit</h2>
            <p className="text-xs text-ink/60">
              Verifying {report.totalPages} printed {report.totalPages === 1 ? 'page' : 'pages'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/50 hover:text-ink text-sm font-medium transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Summary Status */}
          <div className="flex items-center gap-3 rounded-lg border border-line bg-shell p-3">
            <div className="text-ink font-medium">
              Export summary: <span className="font-semibold text-brand">
                {report.totalPages} total {report.totalPages === 1 ? 'page' : 'pages'}
              </span>
            </div>
            <div className="text-ink/60">
              {hasOverflows ? (
                <span className="text-amber-800 font-medium">⚠️ {report.overflows.length} text overflow warning(s)</span>
              ) : (
                <span className="text-teal-700 font-medium">✓ Zero text overflows</span>
              )}
            </div>
          </div>

          {/* WinAnsi Character Substitutions */}
          {hasSubstitutions ? (
            <div className="space-y-2 rounded-lg border border-line p-3 bg-panel">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink uppercase tracking-wide">
                  Standard Font WinAnsi Character Substitutions ({report.substitutions.length})
                </h3>
              </div>
              <p className="text-ink/70">
                The following non-WinAnsi symbols (e.g. ₹ rupee symbol) have been safely converted to prevent PDF raster crashes:
              </p>
              <div className="max-h-40 overflow-y-auto rounded border border-line bg-shell p-2 space-y-1 font-mono">
                {report.substitutions.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between text-ink/80 text-[11px]">
                    <span>
                      {sub.pieceName} ({sub.fieldLabel}): <span className="text-red-700">'{sub.original}'</span> →{' '}
                      <span className="text-teal-700 font-bold">'{sub.replacedWith}'</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-line p-3 bg-panel text-ink/70">
              ✓ All typography characters conform cleanly to PDF standard vector encoding.
            </div>
          )}

          {/* Text Overflows List */}
          {hasOverflows ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
              <h3 className="font-semibold text-amber-900 uppercase tracking-wide">
                Text Fields Exceeding Safe Print Box ({report.overflows.length})
              </h3>
              <p className="text-amber-800">
                The following copy exceeds its physical container even at minimum 75% shrink-to-fit and will clip on trimmed stock:
              </p>
              <div className="max-h-44 overflow-y-auto rounded border border-amber-200 bg-panel p-2 space-y-1.5 font-mono">
                {report.overflows.map((ov, idx) => (
                  <div key={idx} className="border-b border-line pb-1 text-[11px] text-amber-950">
                    <div className="font-semibold">
                      {ov.pieceName} ({ov.faceLabel}) — {ov.copyLabel} • {ov.fieldLabel}
                    </div>
                    <div className="text-ink/60 truncate" title={ov.text}>
                      "{ov.text}"
                    </div>
                    <div className="text-amber-800 text-[10px]">
                      Shrunk to floor {ov.sizePt.toFixed(1)}pt (originally {ov.originalSizePt}pt) — overflow clipped
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 text-teal-900">
              ✓ Every text line in this export fits comfortably within printable margins.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-panel px-3.5 py-2 text-xs font-medium text-ink hover:bg-shell transition"
          >
            Review & Edit Copy
          </button>
          <button
            type="button"
            onClick={onConfirmExport}
            disabled={isExporting}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
          >
            {isExporting
              ? 'Generating PDF...'
              : `Download Print-Ready PDF (${report.totalPages} ${report.totalPages === 1 ? 'Page' : 'Pages'})`}
          </button>
        </div>
      </div>
    </div>
  );
};
