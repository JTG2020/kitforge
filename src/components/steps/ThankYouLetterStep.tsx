import React, { useMemo, useRef, useState } from 'react';
import { ArtworkVariation } from '../../types/product';
import {
  DEFAULT_THANK_YOU_LETTER_INTAKE,
  ProjectState,
  ThankYouLetterIntake,
} from '../../types/project';
import { DEFAULT_PRODUCT_SPECS } from '../../config/products';
import {
  generateGeminiTextCall,
  generateThankYouBackgroundCall,
} from '../../services/gemini';
import {
  exportKitPdf,
  generatePreExportReport,
  PreExportReport,
} from '../../services/pdf';
import { resolveCopyFieldValue } from '../../utils/copyResolution';
import { findNearestAspectBucket } from '../../utils/geometry';
import { CanvasPreview } from '../preview/CanvasPreview';
import { PreExportModal } from '../PreExportModal';
import { FONT_OPTIONS } from './BrandStep';
import { GeminiTextModel } from '../../config/textModels';

type LetterStage = 'intake' | 'copy' | 'prompt' | 'review';

interface ThankYouLetterStepProps {
  imageApiKey: string;
  textApiKey: string;
  textModel: GeminiTextModel;
  project: ProjectState;
  onUpdateIntake: (updates: Partial<ThankYouLetterIntake>) => void;
  onUpdateCopyValue: (faceId: string, copyIndex: number, fieldId: string, value: string) => void;
  onAddArtworkVariation: (faceId: string, variation: ArtworkVariation) => void;
  onSetFaceSelectedId: (faceId: string, variationId: string) => void;
  onUpdateElementRect: (faceId: string, elementId: string, rect: { x: number; y: number; w: number; h: number }) => void;
  onRecordCost: (rupees: number) => void;
  onOpenSettings: () => void;
}

const LETTER_SPEC = DEFAULT_PRODUCT_SPECS.find((spec) => spec.id === 'spec-thank-you')!;
const LETTER_FACE = LETTER_SPEC.faces[0];

const CATEGORIES = [
  'Public Speaking',
  'Leadership',
  'Career/Business',
  'Wellness/Mindfulness',
  'Fitness/Health',
  'Life/Personal Growth',
  'Parenting/Relationships',
  'Other',
];

const CATEGORY_EXAMPLES: Record<string, string> = {
  'Public Speaking': 'A spotlight on an empty stage, a microphone, or an engaged audience',
  Leadership: 'A mountain summit, compass, rising path, or lighthouse',
  'Career/Business': 'An open road, city skyline, or stepping stones',
  'Wellness/Mindfulness': 'Sunrise, calm water, open sky, or soft morning light',
  'Fitness/Health': 'A sunrise run, open trail, or movement in motion',
  'Life/Personal Growth': 'A path opening toward light, a growing tree, or a new horizon',
  'Parenting/Relationships': 'A welcoming home, connected hands, or a shared path',
};

function parseModelJson<T>(response: string, model: GeminiTextModel): T {
  const start = response.indexOf('{');
  const end = response.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error(`${model}: The text model returned invalid structured content.`);
  try {
    return JSON.parse(response.slice(start, end + 1)) as T;
  } catch (error) {
    throw new Error(`${model}: The text model returned invalid structured content.`, { cause: error });
  }
}

export const ThankYouLetterStep: React.FC<ThankYouLetterStepProps> = ({
  imageApiKey,
  textApiKey,
  textModel,
  project,
  onUpdateIntake,
  onUpdateCopyValue,
  onAddArtworkVariation,
  onSetFaceSelectedId,
  onUpdateElementRect,
  onRecordCost,
  onOpenSettings,
}) => {
  const hasSeparateTextApiKey = !!textApiKey.trim() && textApiKey.trim() !== imageApiKey.trim();
  const intake = {
    ...DEFAULT_THANK_YOU_LETTER_INTAKE,
    ...project.thankYouLetterIntake,
  };
  const faceState = project.faceStates[LETTER_FACE.id] || { variations: [], copies: {} };
  const copyValues = faceState.copies?.[0] || {};
  const referenceInputRef = useRef<HTMLInputElement | null>(null);

  const [stage, setStage] = useState<LetterStage>('intake');
  const [copyWasDrafted, setCopyWasDrafted] = useState(false);
  const [backgroundPrompt, setBackgroundPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [designApproved, setDesignApproved] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [extractedFields, setExtractedFields] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [report, setReport] = useState<PreExportReport | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  const promptFacts = useMemo(
    () => ({
      category: intake.category === 'Other' ? `Other: ${intake.categoryOther}` : intake.category,
      transformation: intake.transformation,
      desiredFeeling: intake.feelingOverride.trim() || intake.feeling,
      imagery: intake.imagery,
      setting: intake.setting,
      avoid: intake.avoid,
      brandDirection: project.brandKit.styleNote,
      palette: project.brandKit.colors,
    }),
    [intake, project.brandKit.colors, project.brandKit.styleNote]
  );

  const updateIntake = (updates: Partial<ThankYouLetterIntake>) => onUpdateIntake(updates);

  const updateAnswer = (field: 'category' | 'transformation' | 'feeling' | 'imagery' | 'avoid', value: string) => {
    updateIntake({ [field]: value });
    setExtractedFields((current) => {
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  };

  const updateLetterField = (fieldId: string, value: string) => {
    onUpdateCopyValue(LETTER_FACE.id, 0, fieldId, value);
    if (fieldId === 'letter-accent') updateIntake({ accentPhrase: value });
    setDesignApproved(false);
  };

  const handleTypographyChange = (name: string) => {
    const preset = FONT_OPTIONS.find((option) => option.name === name);
    if (!preset) return;
    updateIntake({ typography: preset.name });
  };

  const handleLogoPlacementChange = (value: string) => {
    updateIntake({ logoPlacement: value });
    if (!LETTER_FACE.logoSlot) return;
    if (value === 'Let the design decide') {
      onUpdateElementRect(LETTER_FACE.id, 'logo', LETTER_FACE.logoSlot);
      return;
    }
    const slot = { ...LETTER_FACE.logoSlot };
    const positions: Record<string, { x: number; y: number }> = {
      'Top-left': { x: 18, y: 16 },
      'Top-center': { x: 54, y: 16 },
      'Bottom-right': { x: 90, y: 182 },
    };
    Object.assign(slot, positions[value]);
    onUpdateElementRect(LETTER_FACE.id, 'logo', slot);
  };

  const handleReferenceUpload = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateIntake({ referenceImageDataUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeDiscussion = async () => {
    if (!hasSeparateTextApiKey) {
      onOpenSettings();
      return;
    }
    if (!intake.discussionNotes.trim()) return;

    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const response = await generateGeminiTextCall(
        textApiKey,
        `Extract coaching-intake facts from the notes below. Return only JSON with string keys category, transformation, feeling, imagery, avoid. Use an empty string whenever the notes do not clearly support a field. Evaluate every field independently; do not infer, fill gaps, or guess. category must be one of ${CATEGORIES.join(', ')} or empty.\n\nNOTES:\n${intake.discussionNotes}`,
        'application/json',
        textModel
      );
      const extracted = parseModelJson<Partial<Pick<ThankYouLetterIntake, 'category' | 'transformation' | 'feeling' | 'imagery' | 'avoid'>>>(response, textModel);
      const category = CATEGORIES.includes(extracted.category || '') ? extracted.category : '';
      const updates: Partial<ThankYouLetterIntake> = {};
      const markedFields = new Set<string>();
      const candidates = {
        category,
        transformation: extracted.transformation,
        feeling: extracted.feeling,
        imagery: extracted.imagery,
        avoid: extracted.avoid,
      };
      for (const [field, value] of Object.entries(candidates)) {
        if (typeof value !== 'string' || !value.trim()) continue;
        if (intake[field as keyof typeof candidates]?.trim()) continue;
        Object.assign(updates, { [field]: value });
        markedFields.add(field);
      }
      updateIntake(updates);
      setExtractedFields(markedFields);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `${textModel}: Could not analyze the discussion notes.`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const setSuppliedCopy = () => {
    for (const field of LETTER_FACE.textFields) {
      onUpdateCopyValue(
        LETTER_FACE.id,
        0,
        field.id,
        field.id === 'letter-body'
          ? intake.letterText
          : field.id === 'letter-accent'
          ? intake.accentPhrase
          : ''
      );
    }
  };

  const preparePromptPreview = async () => {
    if (!hasSeparateTextApiKey) {
      onOpenSettings();
      return;
    }
    setIsPreparing(true);
    setErrorMessage(null);
    try {
      const response = await generateGeminiTextCall(
        textApiKey,
        `Write a concise, concrete image-generation brief for a photographic or pictorial background only. Do not include or rewrite letter copy, and do not ask for text or logos in the image. Mention the desired visual mood, scene, setting, exclusions, brand direction, and palette. If a detail is blank, do not invent it. Return only the brief.\n\n${JSON.stringify(promptFacts)}`,
        undefined,
        textModel
      );
      setBackgroundPrompt(response);
      setStage('prompt');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `${textModel}: Could not prepare the background prompt.`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleContinueFromIntake = async () => {
    setErrorMessage(null);
    if (intake.letterText.trim()) {
      setSuppliedCopy();
      setCopyWasDrafted(false);
      if (!intake.accentPhrase.trim()) {
        if (!hasSeparateTextApiKey) {
          onOpenSettings();
          return;
        }
        setIsPreparing(true);
        try {
          const suggestion = await generateGeminiTextCall(
            textApiKey,
            `Suggest one short decorative accent phrase of no more than six words for this thank-you letter. Return only the phrase, with no quotation marks or explanation. Do not rewrite the supplied letter copy.\n\nConfirmed answers: ${JSON.stringify(promptFacts)}`,
            undefined,
            textModel
          );
          const phrase = suggestion.replace(/^['"“”]+|['"“”]+$/g, '').trim();
          updateIntake({ accentPhrase: phrase });
          onUpdateCopyValue(LETTER_FACE.id, 0, 'letter-accent', phrase);
          setCopyWasDrafted(true);
          setStage('copy');
        } catch (error) {
          setErrorMessage(error instanceof Error ? error.message : `${textModel}: Could not suggest an accent phrase.`);
        } finally {
          setIsPreparing(false);
        }
        return;
      }
      await preparePromptPreview();
      return;
    }
    if (!hasSeparateTextApiKey) {
      onOpenSettings();
      return;
    }

    setIsPreparing(true);
    try {
      const response = await generateGeminiTextCall(
        textApiKey,
        `Draft concise, warm thank-you letter copy for a coach's student. Do not invent names, personal events, or promises. Use the coach name only if provided. Return JSON with string fields salutation, body, signoff, coachName, accentPhrase. The body should be 2-3 short paragraphs and fit within about 450 characters. The accentPhrase may be empty.\n\nConfirmed answers: ${JSON.stringify(promptFacts)}\nCoach: ${project.brandKit.coachName}\nProgram: ${project.brandKit.programName}`,
        'application/json',
        textModel
      );
      const draft = parseModelJson<Record<string, unknown>>(response, textModel);
      const fields: Record<string, string> = {
        'letter-salutation': String(draft.salutation || ''),
        'letter-body': String(draft.body || ''),
        'letter-signoff': String(draft.signoff || ''),
        'letter-coach-name': String(draft.coachName || project.brandKit.coachName),
        'letter-accent': intake.accentPhrase.trim() || String(draft.accentPhrase || ''),
      };
      for (const [fieldId, value] of Object.entries(fields)) {
        onUpdateCopyValue(LETTER_FACE.id, 0, fieldId, value);
      }
      updateIntake({ accentPhrase: fields['letter-accent'] });
      setCopyWasDrafted(true);
      setStage('copy');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `${textModel}: Could not draft letter copy.`);
    } finally {
      setIsPreparing(false);
    }
  };

  const handleApproveCopy = () => {
    void preparePromptPreview();
  };

  const handleApprovePromptAndGenerate = async () => {
    if (!backgroundPrompt.trim()) return;
    if (!imageApiKey.trim()) {
      onOpenSettings();
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setDesignApproved(false);
    try {
      const dataUrl = await generateThankYouBackgroundCall(
        imageApiKey,
        LETTER_SPEC,
        project.brandKit,
        backgroundPrompt,
        intake.referenceImageDataUrl ? [intake.referenceImageDataUrl] : []
      );
      const variation: ArtworkVariation = {
        id: `thank_you_${Date.now()}`,
        createdAt: Date.now(),
        dataUrl,
        resolution: '2K',
        aspectRatio: findNearestAspectBucket(
          LETTER_SPEC.trimW + LETTER_SPEC.bleed * 2,
          LETTER_SPEC.trimH + LETTER_SPEC.bleed * 2
        ),
        directionName: 'Photographic Thank You Letter background',
        promptSnippet: backgroundPrompt,
      };
      onAddArtworkVariation(LETTER_FACE.id, variation);
      onSetFaceSelectedId(LETTER_FACE.id, variation.id);
      onRecordCost(25);
      setStage('review');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'gemini-3-pro-image: Background generation failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartAudit = async () => {
    setIsAuditing(true);
    setErrorMessage(null);
    try {
      const nextReport = await generatePreExportReport(project, [LETTER_SPEC]);
      setReport(nextReport);
      setIsAuditModalOpen(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'The print audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      const pdfBytes = await exportKitPdf(project, [LETTER_SPEC]);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_thank_you_letter.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setIsAuditModalOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'PDF export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const renderCopyEditor = (approvedDraft = false) => (
    <div className="space-y-3">
      {LETTER_FACE.textFields.map((field) => (
        <label key={field.id} className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">{field.label}</span>
          {field.multiline || field.id === 'letter-body' ? (
            <textarea
              rows={field.id === 'letter-body' ? 7 : 2}
              value={resolveCopyFieldValue(field, 0, copyValues)}
              onChange={(event) => updateLetterField(field.id, event.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          ) : (
            <input
              type="text"
              value={resolveCopyFieldValue(field, 0, copyValues)}
              onChange={(event) => updateLetterField(field.id, event.target.value)}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          )}
        </label>
      ))}
      {approvedDraft && (
        <p className="text-xs text-ink/60">Review and edit every field before approving this AI-drafted wording.</p>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Thank You Letter</h2>
          <p className="mt-1 text-xs text-ink/60">Intake, copy approval, background generation, and final review.</p>
        </div>
        <span className="rounded border border-line bg-panel px-2.5 py-1 text-[11px] text-ink/70">
          {stage === 'intake' ? '1 · Intake' : stage === 'copy' ? '2 · Copy review' : stage === 'prompt' ? '3 · Prompt review' : '4 · Design review'}
        </span>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          {errorMessage}
        </div>
      )}

      {stage === 'intake' && (
        <div className="space-y-5">
          <section className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/70" htmlFor="letter-notes">
                  Discussion notes (optional)
                </label>
                <textarea
                  id="letter-notes"
                  rows={5}
                  value={intake.discussionNotes}
                  onChange={(event) => updateIntake({ discussionNotes: event.target.value })}
                  placeholder="Paste notes or a call transcript"
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAnalyzeDiscussion}
                  disabled={!intake.discussionNotes.trim() || isAnalyzing}
                  className="mt-2 rounded border border-line bg-panel px-3 py-2 text-xs font-medium text-ink hover:bg-shell disabled:opacity-45"
                >
                  {isAnalyzing ? 'Analyzing…' : 'Analyze discussion'}
                </button>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink/70" htmlFor="letter-source-copy">
                  Letter wording (optional)
                </label>
                <textarea
                  id="letter-source-copy"
                  rows={5}
                  value={intake.letterText}
                  onChange={(event) => updateIntake({ letterText: event.target.value })}
                  placeholder="Paste the wording to use. Leave blank to have Gemini draft it for review."
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Reference image (optional)</span>
                  {intake.referenceImageDataUrl && (
                    <button type="button" onClick={() => updateIntake({ referenceImageDataUrl: undefined })} className="text-xs text-ink/60 underline">
                      Remove
                    </button>
                  )}
                </div>
                <input
                  ref={referenceInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => handleReferenceUpload(event.target.files?.[0])}
                />
                {intake.referenceImageDataUrl ? (
                  <button type="button" onClick={() => referenceInputRef.current?.click()} className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel p-2 text-left">
                    <img src={intake.referenceImageDataUrl} alt="Selected letter reference" className="h-20 w-16 rounded object-cover" />
                    <span className="text-xs text-ink/70">Replace reference image</span>
                  </button>
                ) : (
                  <button type="button" onClick={() => referenceInputRef.current?.click()} className="w-full rounded-lg border border-dashed border-line bg-panel p-4 text-left text-xs text-ink/70 hover:border-ink/30">
                    Choose a reference image
                  </button>
                )}
                {!intake.referenceImageDataUrl && (
                  <p className="mt-1.5 text-[11px] text-ink/50">Without a reference, the background is generated from the approved prompt.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/70">
                  Coaching category {extractedFields.has('category') && <span className="normal-case text-[10px] font-medium text-brand">From notes</span>}
                </span>
                <select value={intake.category} onChange={(event) => updateAnswer('category', event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                  <option value="">Select a category</option>
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              {intake.category === 'Other' && (
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Describe the coaching category</span>
                  <input value={intake.categoryOther} onChange={(event) => updateIntake({ categoryOther: event.target.value })} placeholder="Describe the coaching focus" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
                </label>
              )}
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/70">
                  Transformation {extractedFields.has('transformation') && <span className="normal-case text-[10px] font-medium text-brand">From notes</span>}
                </span>
                <input value={intake.transformation} onChange={(event) => updateAnswer('transformation', event.target.value)} placeholder="What result do students walk away with?" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/70">
                    Desired feeling {extractedFields.has('feeling') && <span className="normal-case text-[10px] font-medium text-brand">From notes</span>}
                  </span>
                  <select value={intake.feeling} onChange={(event) => updateAnswer('feeling', event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                    <option value="">Select a feeling</option>
                    {['Confident & empowered', 'Calm & reflective', 'Energized & motivated', 'Warm & supported', 'Proud & accomplished'].map((feeling) => <option key={feeling}>{feeling}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Setting / time</span>
                  <select value={intake.setting} onChange={(event) => updateIntake({ setting: event.target.value })} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                    <option value="">Select a setting</option>
                    {['Golden hour/sunrise', 'Bright daylight', 'Night/city lights', 'Indoor/cozy', 'Abstract, no literal scene'].map((setting) => <option key={setting}>{setting}</option>)}
                  </select>
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Feeling override (optional)</span>
                <input value={intake.feelingOverride} onChange={(event) => updateIntake({ feelingOverride: event.target.value })} placeholder="Describe a different tone" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/70">
                  Imagery / symbol {extractedFields.has('imagery') && <span className="normal-case text-[10px] font-medium text-brand">From notes</span>}
                </span>
                <textarea value={intake.imagery} onChange={(event) => updateAnswer('imagery', event.target.value)} placeholder={CATEGORY_EXAMPLES[intake.category] || 'Describe an image, symbol, or scene'} rows={2} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
              </label>
              <label className="block space-y-1.5">
                <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink/70">
                  Anything to avoid {extractedFields.has('avoid') && <span className="normal-case text-[10px] font-medium text-brand">From notes</span>}
                </span>
                <input value={intake.avoid} onChange={(event) => updateAnswer('avoid', event.target.value)} placeholder="e.g. faces, crowded scenes, conflicting imagery" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Logo placement</span>
                  <select value={intake.logoPlacement} onChange={(event) => handleLogoPlacementChange(event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                    {['Top-left', 'Top-center', 'Bottom-right', 'Let the design decide'].map((value) => <option key={value}>{value}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Typography stack</span>
                  <select value={intake.typography} onChange={(event) => handleTypographyChange(event.target.value)} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm">
                    {FONT_OPTIONS.map((preset) => <option key={preset.name}>{preset.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink/70">Decorative accent phrase (optional)</span>
                <input value={intake.accentPhrase} onChange={(event) => updateIntake({ accentPhrase: event.target.value })} placeholder="Leave blank for an AI suggestion when copy is drafted" className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm" />
              </label>
            </div>
          </section>
          <div className="flex justify-end border-t border-line pt-4">
            <button type="button" onClick={() => void handleContinueFromIntake()} disabled={isPreparing} className="rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-45">
              {isPreparing ? 'Preparing letter…' : intake.letterText.trim() ? 'Review background prompt' : 'Draft letter wording'}
            </button>
          </div>
        </div>
      )}

      {stage === 'copy' && (
        <section className="max-w-3xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">
              {intake.letterText.trim() ? 'Review AI-suggested accent phrase' : 'Review AI-drafted letter wording'}
            </h3>
            <p className="mt-1 text-xs text-ink/60">AI-proposed wording is not placed in the design until you approve it.</p>
          </div>
          {renderCopyEditor(copyWasDrafted)}
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setStage('intake')} className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium">Back to intake</button>
            <button type="button" onClick={handleApproveCopy} disabled={isPreparing} className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-45">
              {isPreparing ? 'Preparing prompt…' : 'Approve wording and continue'}
            </button>
          </div>
        </section>
      )}

      {stage === 'prompt' && (
        <section className="max-w-3xl space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Approve the background prompt</h3>
            <p className="mt-1 text-xs text-ink/60">The image model will generate the background only. Lettering and logos are added separately.</p>
          </div>
          <textarea value={backgroundPrompt} onChange={(event) => setBackgroundPrompt(event.target.value)} rows={8} className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm leading-relaxed" />
          {intake.referenceImageDataUrl && <p className="text-xs text-ink/60">The selected reference image will be sent with this prompt.</p>}
          <dl className="grid gap-x-4 gap-y-2 border-t border-line pt-3 text-xs sm:grid-cols-2">
            <div><dt className="font-semibold text-ink/70">Letter wording</dt><dd>{copyWasDrafted ? 'AI draft reviewed and approved' : 'Supplied wording'}</dd></div>
            <div><dt className="font-semibold text-ink/70">Logo placement</dt><dd>{intake.logoPlacement}</dd></div>
            <div><dt className="font-semibold text-ink/70">Typography</dt><dd>{intake.typography}</dd></div>
            <div><dt className="font-semibold text-ink/70">Accent phrase</dt><dd>{intake.accentPhrase || 'None'}</dd></div>
          </dl>
          <div className="flex flex-wrap justify-between gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setStage(intake.letterText.trim() ? 'intake' : 'copy')} className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium">Back</button>
            <button type="button" onClick={() => void handleApprovePromptAndGenerate()} disabled={!backgroundPrompt.trim() || isGenerating} className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-45">
              {isGenerating ? 'Generating background…' : 'Approve prompt and generate background'}
            </button>
          </div>
        </section>
      )}

      {stage === 'review' && (
        <section className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Review the generated design</h3>
            <p className="mt-1 text-xs text-ink/60">Select text or the logo on the canvas to reposition it. PDF export stays locked until you approve this design.</p>
          </div>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
            <div className="rounded-lg border border-line bg-panel p-3">
              <CanvasPreview
                spec={LETTER_SPEC}
                face={LETTER_FACE}
                faceState={faceState}
                brandKit={project.brandKit}
                headingFontOverride={FONT_OPTIONS.find((preset) => preset.name === intake.typography)?.heading}
                isEditable
                selectedElementId={selectedElementId}
                onSelectElement={setSelectedElementId}
                onUpdateElementRect={(elementId, rect) => {
                  onUpdateElementRect(LETTER_FACE.id, elementId, rect);
                  setDesignApproved(false);
                }}
              />
            </div>
            <div className="space-y-4">
              {renderCopyEditor()}
              <label className="flex items-start gap-2 border-t border-line pt-4 text-xs text-ink">
                <input type="checkbox" checked={designApproved} onChange={(event) => setDesignApproved(event.target.checked)} className="mt-0.5 accent-brand" />
                <span>I reviewed this generated design and approve it for print export.</span>
              </label>
              <div className="flex flex-wrap justify-between gap-2">
                <button type="button" onClick={() => { setDesignApproved(false); setStage('prompt'); }} className="rounded-lg border border-line bg-panel px-3 py-2 text-xs font-medium">Revise prompt</button>
                <button type="button" onClick={() => void handleStartAudit()} disabled={!designApproved || isAuditing || isExporting} className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white disabled:opacity-45">
                  {isAuditing ? 'Running print audit…' : 'Review and export PDF'}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      <PreExportModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onConfirmExport={() => void handleConfirmExport()}
        report={report}
        isExporting={isExporting}
      />
    </div>
  );
};