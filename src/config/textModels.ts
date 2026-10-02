export const FREE_GEMINI_TEXT_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash' },
  { id: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (legacy access)' },
  { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (legacy access)' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (legacy access)' },
] as const;

export type GeminiTextModel = (typeof FREE_GEMINI_TEXT_MODELS)[number]['id'];

export const DEFAULT_GEMINI_TEXT_MODEL: GeminiTextModel = 'gemini-3.8-flash';

export function resolveGeminiTextModel(value: unknown): GeminiTextModel {
  return FREE_GEMINI_TEXT_MODELS.find((model) => model.id === value)?.id || DEFAULT_GEMINI_TEXT_MODEL;
}