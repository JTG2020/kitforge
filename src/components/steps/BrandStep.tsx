import React, { useRef } from 'react';
import { BrandKit } from '../../types/product';
import { extractPaletteFromImage } from '../../services/palette';

interface BrandStepProps {
  brandKit: BrandKit;
  onUpdateBrandKit: (updates: Partial<BrandKit>) => void;
  onProceedToLook: () => void;
}

const FONT_OPTIONS = [
  {
    name: 'Classic Editorial Serif',
    heading: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    name: 'Modern Executive Sans',
    heading: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    body: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    name: 'Literary & Academic',
    heading: 'ui-serif, "Palatino Linotype", "Book Antiqua", Palatino, serif',
    body: 'ui-serif, Georgia, serif',
  },
];

export const BrandStep: React.FC<BrandStepProps> = ({
  brandKit,
  onUpdateBrandKit,
  onProceedToLook,
}) => {
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const refInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const palette = await extractPaletteFromImage(dataUrl);

      onUpdateBrandKit({
        logoDataUrl: dataUrl,
        logoTone: palette.logoTone,
        colors: {
          primary: palette.primary,
          secondary: palette.secondary,
          ink: palette.ink,
          paper: palette.paper,
          muted: palette.muted,
        },
      });
    };
    reader.readAsDataURL(file);
  };

  const handleReferenceUpload = (files: FileList | null) => {
    if (!files) return;
    const currentRefs = [...(brandKit.references || [])];
    const availableSlots = 3 - currentRefs.length;
    if (availableSlots <= 0) return;

    Array.from(files)
      .slice(0, availableSlots)
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result) {
            onUpdateBrandKit({
              references: [...(brandKit.references || []), reader.result as string],
            });
          }
        };
        reader.readAsDataURL(file);
      });
  };

  const removeReference = (index: number) => {
    const updated = (brandKit.references || []).filter((_, i) => i !== index);
    onUpdateBrandKit({ references: updated });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Panel 1: Coach & Program Identity */}
        <div className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">The coach</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Coach / Mentor Name
              </label>
              <input
                type="text"
                value={brandKit.coachName}
                onChange={(e) => onUpdateBrandKit({ coachName: e.target.value })}
                placeholder="e.g. Aria Sterling"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Programme / Container Title
              </label>
              <input
                type="text"
                value={brandKit.programName}
                onChange={(e) => onUpdateBrandKit({ programName: e.target.value })}
                placeholder="e.g. Executive Mastery Container"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Client Style Direction
              </label>
              <textarea
                rows={3}
                value={brandKit.styleNote}
                onChange={(e) => onUpdateBrandKit({ styleNote: e.target.value })}
                placeholder="Describe how the visual ornament should feel: line weight, architectural details, certificate flourishes..."
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none resize-none"
              />
              <p className="text-[11px] text-ink/50">
                Prompt tip: Describe the character and linework rather than depicting specific objects.
              </p>
            </div>
          </div>
        </div>

        {/* Panel 2: Logo and Auto Palette Extraction */}
        <div className="rounded-xl border border-line bg-panel">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Logo and colours</h2>
            {brandKit.logoTone && (
              <span className="text-[11px] font-medium text-ink/60 capitalize bg-shell px-2 py-0.5 rounded border border-line">
                Tone: {brandKit.logoTone}
              </span>
            )}
          </div>
          <div className="p-4 space-y-4">
            {/* Logo Drop Area */}
            <div>
              <input
                type="file"
                ref={logoInputRef}
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                className="hidden"
              />
              <div
                onClick={() => logoInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-line bg-shell/50 p-4 text-center hover:border-ink/30 transition"
              >
                {brandKit.logoDataUrl ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={brandKit.logoDataUrl}
                      alt="Brand Logo"
                      className="max-h-12 max-w-32 object-contain rounded"
                    />
                    <div className="text-left">
                      <div className="text-xs font-medium text-ink">Click to replace logo</div>
                      <div className="text-[11px] text-ink/50">Palette extracted via 5-bit color cube</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-medium text-ink">Upload Brand Logo (PNG / JPG)</div>
                    <div className="text-[11px] text-ink/50 mt-0.5">
                      Palette & light/dark tone are automatically extracted
                    </div>
                  </div>
                )}
              </div>

              {brandKit.logoTone === 'mixed' && (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  ⚠️ Logo contains significant light and dark shares (&gt;18%). No single background suits it uniformly.
                </div>
              )}
            </div>

            {/* Color Palette Grid */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Palette Swatches
              </label>
              <div className="grid grid-cols-5 gap-2">
                {(['primary', 'secondary', 'ink', 'paper', 'muted'] as const).map((key) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={brandKit.colors[key]}
                        onChange={(e) =>
                          onUpdateBrandKit({
                            colors: { ...brandKit.colors, [key]: e.target.value },
                          })
                        }
                        className="size-5 rounded border border-line cursor-pointer p-0 bg-transparent"
                      />
                      <span className="text-[10px] font-semibold uppercase text-ink/70 truncate">{key}</span>
                    </div>
                    <input
                      type="text"
                      value={brandKit.colors[key]}
                      onChange={(e) =>
                        onUpdateBrandKit({
                          colors: { ...brandKit.colors, [key]: e.target.value },
                        })
                      }
                      className="w-full rounded border border-line px-1.5 py-1 text-[11px] font-mono text-ink uppercase focus:border-brand focus:outline-none"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Typography Stack */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Typography Stack
              </label>
              <div className="space-y-2">
                {FONT_OPTIONS.map((f, idx) => (
                  <label
                    key={idx}
                    className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition ${
                      brandKit.fonts.heading === f.heading
                        ? 'border-brand bg-brand-soft/30'
                        : 'border-line hover:bg-shell'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="font-option"
                        checked={brandKit.fonts.heading === f.heading}
                        onChange={() =>
                          onUpdateBrandKit({
                            fonts: { heading: f.heading, body: f.body },
                          })
                        }
                        className="text-brand focus:ring-brand"
                      />
                      <div>
                        <div className="text-xs font-semibold text-ink">{f.name}</div>
                        <div
                          style={{ fontFamily: f.heading }}
                          className="text-xs text-ink/80 tracking-wide mt-0.5"
                        >
                          Certificate Wording &amp; Title Preview
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reference Images Upload (Up to 3) */}
      <div className="rounded-xl border border-line bg-panel p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink/70">
              Style Reference Images ({brandKit.references?.length || 0}/3)
            </h3>
            <p className="text-[11px] text-ink/50">
              Upload up to 3 visual reference swatches passed to Gemini during generation.
            </p>
          </div>
          {(brandKit.references?.length || 0) < 3 && (
            <div>
              <input
                type="file"
                ref={refInputRef}
                multiple
                accept="image/*"
                onChange={(e) => handleReferenceUpload(e.target.files)}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => refInputRef.current?.click()}
                className="rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-shell transition"
              >
                + Add Reference Image
              </button>
            </div>
          )}
        </div>

        {brandKit.references && brandKit.references.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {brandKit.references.map((ref, idx) => (
              <div key={idx} className="group relative rounded-lg border border-line overflow-hidden aspect-video bg-shell">
                <img src={ref} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeReference(idx)}
                  className="absolute top-1 right-1 size-5 rounded-full bg-ink/70 text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition"
                  title="Remove reference"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-ink/50 italic py-2">No custom reference images added yet.</div>
        )}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onProceedToLook}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition shadow-xs"
        >
          Next: Explore Visual Directions →
        </button>
      </div>
    </div>
  );
};
