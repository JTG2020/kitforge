import React, { useState, useEffect, useRef } from 'react';
import { SettingsState, KeyStatus } from '../types/project';
import { validateApiKeyStage1, validateApiKeyStage2 } from '../services/gemini';

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
  const [showKey, setShowKey] = useState(false);
  const [isCheckingStage1, setIsCheckingStage1] = useState(false);
  const [isCheckingStage2, setIsCheckingStage2] = useState(false);

  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    setApiKeyInput(settings.apiKey);
  }, [settings.apiKey]);

  // Stage 1 Auto-validation on key change debounced ~600ms
  const handleKeyChange = (newKey: string) => {
    setApiKeyInput(newKey);
    onUpdateSettings({
      apiKey: newKey,
      verification: {
        status: newKey.trim() ? 'unchecked' : 'invalid',
        message: newKey.trim() ? 'Key changed. Testing validity...' : 'No API key set. Add your Gemini key in Settings.',
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
          <h2 className="text-sm font-semibold text-ink">Gemini API Settings</h2>
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
              Your key stays strictly in your browser and is never logged or sent to any proxy.
            </p>
            <p className="text-amber-800 font-medium pt-1">
              Image generation needs a billing-enabled key. A free-tier key will not work.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink/70">
              Gemini API Key
            </label>
            <div className="relative flex items-center">
              <input
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
                {currentStatus === 'valid' && 'Key Valid & Ready'}
                {currentStatus === 'amber' && 'Key Valid (Image Model Unavailable)'}
                {currentStatus === 'invalid' && 'Key Invalid or Billing Required'}
                {currentStatus === 'unchecked' && 'Key Not Verified'}
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
              {isCheckingStage1 ? 'Checking models...' : 'Test key (Free model list)'}
            </button>

            <button
              type="button"
              onClick={handleRunStage2}
              disabled={isCheckingStage2 || !apiKeyInput.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition disabled:opacity-45"
            >
              {isCheckingStage2 ? 'Generating test...' : 'Test key (generates one small image, about ₹6)'}
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
