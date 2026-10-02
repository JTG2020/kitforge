import React, { useState, useEffect, useRef } from 'react';
import { SettingsState, KeyStatus } from '../types/project';
import { generateGeminiTextCall, validateApiKeyStage1, validateApiKeyStage2 } from '../services/gemini';
import { FREE_GEMINI_TEXT_MODELS } from '../config/textModels';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsState;
  onUpdateSettings: (updates: Partial<SettingsState>) => void;
  onRecordCost: (rupees: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onRecordCost,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [textApiKeyInput, setTextApiKeyInput] = useState(settings.textApiKey);
  const [metaImageApiKeyInput, setMetaImageApiKeyInput] = useState(settings.metaImageApiKey);
  const [showKey, setShowKey] = useState(false);
  const [showTextKey, setShowTextKey] = useState(false);
  const [showMetaImageKey, setShowMetaImageKey] = useState(false);
  const [isCheckingStage1, setIsCheckingStage1] = useState(false);
  const [isCheckingStage2, setIsCheckingStage2] = useState(false);
  const [isCheckingTextKey, setIsCheckingTextKey] = useState(false);
  const [textKeyMessage, setTextKeyMessage] = useState('');

  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    setApiKeyInput(settings.apiKey);
  }, [settings.apiKey]);

  useEffect(() => {
    setTextApiKeyInput(settings.textApiKey);
  }, [settings.textApiKey]);

  useEffect(() => {
    setMetaImageApiKeyInput(settings.metaImageApiKey);
  }, [settings.metaImageApiKey]);

  // Stage 1 Auto-validation on key change debounced ~600ms
  const handleKeyChange = (newKey: string) => {
    const textKeyMatchesImageKey = !!newKey.trim() && newKey.trim() === textApiKeyInput.trim();
    setApiKeyInput(newKey);
    if (textKeyMatchesImageKey) {
      setTextApiKeyInput('');
      setTextKeyMessage('Use separate API keys for image generation and text models.');
    }
    onUpdateSettings({
      apiKey: newKey,
      ...(textKeyMatchesImageKey ? { textApiKey: '' } : {}),
      verification: {
        status: newKey.trim() ? 'unchecked' : 'invalid',
        message: newKey.trim() ? 'Key changed. Testing image-model access...' : 'No image-generation key set. Add one in Settings.',
      },
    });

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!newKey.trim()) {
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsCheckingStage1(true);
      const res = await validateApiKeyStage1(newKey);
      setIsCheckingStage1(false);

      let status: KeyStatus = 'invalid';
      if (res.valid && res.imageModelAvailable) {
        status = 'valid';
      } else if (res.valid && !res.imageModelAvailable) {
        status = 'amber';
      }

      onUpdateSettings({
        verification: {
          status,
          message: res.message,
          lastTestedAt: Date.now(),
          activationUrl: res.activationUrl,
          imageModelAvailable: res.imageModelAvailable,
        },
      });
    }, 600);
  };

  const handleTextKeyChange = (newKey: string) => {
    if (newKey.trim() && newKey.trim() === apiKeyInput.trim()) {
      setTextApiKeyInput('');
      setTextKeyMessage('Use separate API keys for image generation and text models.');
      onUpdateSettings({ textApiKey: '' });
      return;
    }
    setTextApiKeyInput(newKey);
    setTextKeyMessage('');
    onUpdateSettings({ textApiKey: newKey });
  };

  const handleRunTextKeyCheck = async () => {
    if (!textApiKeyInput.trim() || textApiKeyInput.trim() === apiKeyInput.trim()) {
      setTextKeyMessage('Enter a text API key that is different from the image-generation key.');
      return;
    }
    setIsCheckingTextKey(true);
    setTextKeyMessage('');
    try {
      await generateGeminiTextCall(textApiKeyInput, 'Reply with only OK.', undefined, settings.textModel);
      setTextKeyMessage(`Text request succeeded with ${settings.textModel}.`);
    } catch (error) {
      setTextKeyMessage(error instanceof Error ? error.message : 'Text model request failed.');
    } finally {
      setIsCheckingTextKey(false);
    }
  };

  const handleRunStage1 = async () => {
    setIsCheckingStage1(true);
    const res = await validateApiKeyStage1(apiKeyInput);
    setIsCheckingStage1(false);

    let status: KeyStatus = 'invalid';
    if (res.valid && res.imageModelAvailable) {
      status = 'valid';
    } else if (res.valid && !res.imageModelAvailable) {
      status = 'amber';
    }

    onUpdateSettings({
      verification: {
        status,
        message: res.message,
        lastTestedAt: Date.now(),
        activationUrl: res.activationUrl,
        imageModelAvailable: res.imageModelAvailable,
      },
    });
  };

  const handleRunStage2 = async () => {
    setIsCheckingStage2(true);
    const res = await validateApiKeyStage2(apiKeyInput);
    setIsCheckingStage2(false);

    if (res.success) {
      onRecordCost(6);
      onUpdateSettings({
        verification: {
          status: 'valid',
          message: 'Valid key & test image generation confirmed.',
          lastTestedAt: Date.now(),
          imageModelAvailable: true,
        },
      });
    } else {
      onUpdateSettings({
        verification: {
          status: 'invalid',
          message: res.message,
          lastTestedAt: Date.now(),
          activationUrl: res.activationUrl,
        },
      });
    }
  };

  if (!isOpen) return null;

  const currentStatus = settings.verification.status;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-line bg-panel shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">AI API Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink/50 hover:text-ink text-sm font-medium transition"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          <div className="rounded-lg border border-line bg-shell p-3 text-xs text-ink/80 space-y-1">
            <p className="font-medium text-ink">Direct REST Endpoint & Key Isolation</p>
            <p>
              Calls are made directly via client-side <code className="font-mono bg-panel px-1 py-0.5 rounded text-ink">fetch</code> with <code className="font-mono bg-panel px-1 py-0.5 rounded text-ink">credentials: "omit"</code>.
              Keys stay in your browser and are sent directly to their provider. Text-model selection and credentials are separate from image providers.
            </p>
            <p className="text-amber-800 font-medium pt-1">
              Keep text and image provider keys separate. Gemini and Meta image generation may incur charges from their respective accounts.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gemini-text-model" className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
              Free-tier text model
            </label>
            <select
              id="gemini-text-model"
              value={settings.textModel}
              onChange={(event) => onUpdateSettings({ textModel: event.target.value as SettingsState['textModel'] })}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              {FREE_GEMINI_TEXT_MODELS.map((model) => (
                <option key={model.id} value={model.id}>{model.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-ink/60">
              Free-tier quotas apply, and Google may use submitted content to improve its products. Gemini 2.5 options may be unavailable to new API projects.
            </p>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="gemini-text-api-key" className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
              Text-model API key (free-tier project)
            </label>
            <div className="relative flex items-center">
              <input
                id="gemini-text-api-key"
                type={showTextKey ? 'text' : 'password'}
                value={textApiKeyInput}
                onChange={(event) => handleTextKeyChange(event.target.value)}
                placeholder="Separate key for free text requests"
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 pr-16 text-sm text-ink focus:border-brand focus:outline-none font-mono"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowTextKey(!showTextKey)}
                className="absolute right-2.5 text-xs text-ink/50 hover:text-ink font-medium px-1 py-0.5"
              >
                {showTextKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleRunTextKeyCheck}
                disabled={isCheckingTextKey || !textApiKeyInput.trim()}
                className="rounded border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-shell disabled:opacity-45"
              >
                {isCheckingTextKey ? 'Testing text key...' : 'Test text key'}
              </button>
              <span className="text-[11px] text-ink/60">Sends one short request using the selected free-tier model.</span>
            </div>
            {textKeyMessage && <p role="status" className="text-xs text-ink/70">{textKeyMessage}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="thank-you-image-provider" className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
              Thank You page image provider
            </label>
            <select
              id="thank-you-image-provider"
              value={settings.thankYouImageProvider}
              onChange={(event) => onUpdateSettings({ thankYouImageProvider: event.target.value as SettingsState['thankYouImageProvider'] })}
              className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="gemini">Gemini</option>
              <option value="meta-muse">Meta Muse Image</option>
            </select>
            <p className="text-[11px] text-ink/60">This choice applies only to Thank You Letter backgrounds and Muse edits. Look and Pieces continue using Gemini.</p>
          </div>

          {settings.thankYouImageProvider === 'meta-muse' && (
            <div className="space-y-1.5">
              <label htmlFor="meta-image-api-key" className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
                Meta Muse API key
              </label>
              <div className="relative flex items-center">
                <input
                  id="meta-image-api-key"
                  type={showMetaImageKey ? 'text' : 'password'}
                  value={metaImageApiKeyInput}
                  onChange={(event) => {
                    setMetaImageApiKeyInput(event.target.value);
                    onUpdateSettings({ metaImageApiKey: event.target.value });
                  }}
                  placeholder="Meta Model API key"
                  className="w-full rounded-lg border border-line bg-panel px-3 py-2 pr-16 text-sm text-ink focus:border-brand focus:outline-none font-mono"
                  autoComplete="off"
                  spellCheck="false"
                />
                <button
                  type="button"
                  onClick={() => setShowMetaImageKey(!showMetaImageKey)}
                  className="absolute right-2.5 px-1 py-0.5 text-xs font-medium text-ink/50 hover:text-ink"
                >
                  {showMetaImageKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[11px] text-ink/60">Used only for Thank You page image generation and prompt-guided edits.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="gemini-image-api-key" className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
              Gemini image API key (Look, Pieces, and Thank You with Gemini)
            </label>
            <div className="relative flex items-center">
              <input
                id="gemini-image-api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKeyInput}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full rounded-lg border border-line bg-panel px-3 py-2 pr-16 text-sm text-ink focus:border-brand focus:outline-none font-mono"
                autoComplete="off"
                spellCheck="false"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 text-xs text-ink/50 hover:text-ink font-medium px-1 py-0.5"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          {/* Status Line with Dot */}
          <div className="flex items-start gap-2.5 rounded-lg border border-line p-3 text-xs bg-panel">
            <span
              className={`mt-1 size-2.5 rounded-full shrink-0 ${
                currentStatus === 'valid'
                  ? 'bg-teal-600'
                  : currentStatus === 'amber'
                  ? 'bg-amber-500'
                  : currentStatus === 'invalid'
                  ? 'bg-red-500'
                  : 'bg-stone-300'
              }`}
            />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-medium text-ink">
                {currentStatus === 'valid' && 'Gemini image key valid & ready'}
                {currentStatus === 'amber' && 'Gemini key valid (image model unavailable)'}
                {currentStatus === 'invalid' && 'Gemini key invalid or billing required'}
                {currentStatus === 'unchecked' && 'Gemini image key not verified'}
              </div>
              <p className="text-ink/70 break-words">{settings.verification.message}</p>
              {settings.verification.activationUrl && (
                <a
                  href={settings.verification.activationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-brand underline font-medium mt-1"
                >
                  Enable Service / Check Billing in Google Cloud Console ↗
                </a>
              )}
            </div>
          </div>

          {/* Verification Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleRunStage1}
              disabled={isCheckingStage1 || !apiKeyInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink hover:bg-shell transition disabled:opacity-45"
            >
              {isCheckingStage1 ? 'Checking Gemini image model...' : 'Check Gemini image access'}
            </button>

            <button
              type="button"
              onClick={handleRunStage2}
              disabled={isCheckingStage2 || !apiKeyInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
            >
              {isCheckingStage2 ? 'Generating Gemini test...' : 'Test Gemini key (one small image, about ₹6)'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-brand px-4 py-2 text-xs font-medium text-white hover:opacity-90 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
