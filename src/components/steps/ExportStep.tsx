import React, { useState } from 'react';
import { ProjectState } from '../../types/project';
import { DEFAULT_PRODUCT_SPECS } from '../../config/products';
import { exportKitPdf, generatePreExportReport, PreExportReport } from '../../services/pdf';
import { PreExportModal } from '../PreExportModal';
import { CanvasPreview } from '../preview/CanvasPreview';

interface ExportStepProps {
  project: ProjectState;
}

export const ExportStep: React.FC<ExportStepProps> = ({ project }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [report, setReport] = useState<PreExportReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStartExportAudit = async () => {
    setIsAuditing(true);
    try {
      const rep = await generatePreExportReport(project, DEFAULT_PRODUCT_SPECS);
      setReport(rep);
      setIsModalOpen(true);
    } catch (err) {
      console.error('Audit failed', err);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleConfirmDownload = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await exportKitPdf(project, DEFAULT_PRODUCT_SPECS);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_print_ready_kit.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsModalOpen(false);
    } catch (err) {
      console.error('Export failed', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Export print-ready PDF</h2>
          <p className="text-xs text-ink/60">
            Compiles 15 physical pages (MediaBox = trim + 6mm bleed with vector crop marks, 300 DPI equivalent).
          </p>
        </div>

        <button
          type="button"
          onClick={handleStartExportAudit}
          disabled={isAuditing || isExporting}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition disabled:opacity-45 shadow-xs"
        >
          {isAuditing
            ? 'Auditing Print Geometry...'
            : isExporting
            ? 'Compiling 15-Page PDF...'
            : 'Pre-Export Audit & Download PDF'}
        </button>
      </div>

      {/* Overview Grid of all 15 printed pages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">
            Complete 15-Page Production Run Overview
          </span>
          <span className="text-xs text-ink/50">
            15 pages across 9 face designs
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
          {DEFAULT_PRODUCT_SPECS.map((spec) => {
            return spec.faces.map((face) => {
              const faceState = project.faceStates[face.id];
              return Array.from({ length: spec.qty }).map((_, cIdx) => {
                const copyLabel = spec.copyLabels?.[cIdx] || (spec.qty > 1 ? `Copy ${cIdx + 1}` : 'Single Copy');
                const pageNumber =
                  DEFAULT_PRODUCT_SPECS.slice(0, DEFAULT_PRODUCT_SPECS.indexOf(spec)).reduce(
                    (a, s) => a + s.qty * s.faces.length,
                    0
                  ) +
                  spec.faces.indexOf(face) * spec.qty +
                  cIdx +
                  1;

                return (
                  <div
                    key={`${spec.id}_${face.id}_${cIdx}`}
                    className="rounded-xl border border-line bg-panel p-3 flex flex-col justify-between space-y-2 shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-xs border-b border-line pb-1.5">
                      <span className="font-semibold text-ink truncate max-w-[140px]" title={spec.name}>
                        {spec.name}
                      </span>
                      <span className="text-[10px] font-mono text-ink/50 bg-shell px-1.5 py-0.5 rounded border border-line">
                        Page {pageNumber} / 15
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-center p-1 bg-shell/40 rounded-lg overflow-hidden">
                      <CanvasPreview
                        spec={spec}
                        face={face}
                        faceState={faceState}
                        brandKit={project.brandKit}
                        copyIndex={cIdx}
                        showGuides={false}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-ink/70 pt-1">
                      <span className="font-medium text-brand">{copyLabel}</span>
                      <span>
                        {spec.trimW} × {spec.trimH} mm
                      </span>
                    </div>
                  </div>
                );
              });
            });
          })}
        </div>
      </div>

      {/* Pre-Export Modal */}
      <PreExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirmExport={handleConfirmDownload}
        report={report}
        isExporting={isExporting}
      />
    </div>
  );
};
