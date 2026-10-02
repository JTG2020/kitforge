import React, { useState } from 'react';
import { useKitForgeStore } from './store/projectStore';
import { useIsTabRunning } from './store/jobRegistry';
import { Header } from './components/Header';
import { ActivityStrip } from './components/ActivityStrip';
import { SettingsModal } from './components/SettingsModal';
import { BrandStep } from './components/steps/BrandStep';
import { LookStep } from './components/steps/LookStep';
import { PiecesStep } from './components/steps/PiecesStep';
import { ExportStep } from './components/steps/ExportStep';
import { ThankYouLetterStep } from './components/steps/ThankYouLetterStep';

type TabId = 'brand' | 'look' | 'pieces' | 'thank-you-letter' | 'export';

export const App: React.FC = () => {
  const {
    isHydrated,
    projects,
    currentProject,
    settings,
    setActiveProjectId,
    createNewProject,
    duplicateProject,
    updateBrandKit,
    addStyleBoard,
    setChosenStyleId,
    setConfirmedStyleId,
    addArtworkVariation,
    setFaceSelectedId,
    setFaceFinalData,
    updateCopyValue,
    updateElementRect,
    resetCustomLayout,
    recordCostRupees,
    updateSettings,
    updateThankYouLetterIntake,
  } = useKitForgeStore();

  const [activeTab, setActiveTab] = useState<TabId>('brand');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const isLookRunning = useIsTabRunning('look');
  const isPiecesRunning = useIsTabRunning('pieces');

  const hasImageApiKey = !!settings.apiKey && settings.apiKey.trim().length > 0;

  if (!isHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-shell">
        <div className="flex items-center gap-3 text-xs font-medium text-ink/70">
          <span className="size-2 animate-pulse rounded-full bg-brand" />
          Loading KitForge workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-shell text-ink">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-4">
        {/* Top Header */}
        <Header
          currentProject={currentProject}
          projects={projects}
          onSelectProject={setActiveProjectId}
          onNewProject={() => createNewProject()}
          onDuplicateProject={duplicateProject}
          onOpenSettings={() => setIsSettingsOpen(true)}
          hasApiKey={hasImageApiKey}
        />

        {/* Global Activity Strip for in-flight background jobs */}
        <ActivityStrip />

        {/* No API Key Banner */}
        {!hasImageApiKey && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
            <span>
              ⚠️ <strong>No Gemini image-generation key set.</strong> Add it in Settings for Look and Pieces. Thank You can use Gemini or Meta Muse. Text features use a separate key.
            </span>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="rounded bg-amber-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-950 transition"
            >
              Open Settings
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex gap-1 rounded-lg border border-line bg-panel p-1">
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'brand' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-shell'
            }`}
          >
            Brand
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('look')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'look' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-shell'
            }`}
          >
            Look {isLookRunning && '…'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pieces')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'pieces' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-shell'
            }`}
          >
            Pieces {isPiecesRunning && '…'}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'export' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-shell'
            }`}
          >
            Export
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('thank-you-letter')}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === 'thank-you-letter' ? 'bg-brand text-white' : 'text-ink/80 hover:bg-shell'
            }`}
          >
            Thank You Letter
          </button>
        </nav>

        {/* Step Content */}
        <main className="pt-2">
          {activeTab === 'brand' && (
            <BrandStep
              brandKit={currentProject.brandKit}
              onUpdateBrandKit={updateBrandKit}
              onProceedToLook={() => setActiveTab('look')}
            />
          )}

          {activeTab === 'look' && (
            <LookStep
              apiKey={settings.apiKey}
              brandKit={currentProject.brandKit}
              styleBoards={currentProject.styleBoards}
              chosenStyleId={currentProject.chosenStyleId}
              confirmedStyleId={currentProject.confirmedStyleId}
              onAddStyleBoard={addStyleBoard}
              onSetChosenStyleId={setChosenStyleId}
              onSetConfirmedStyleId={setConfirmedStyleId}
              onRecordCost={recordCostRupees}
              onProceedToPieces={() => setActiveTab('pieces')}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'pieces' && (
            <PiecesStep
              apiKey={settings.apiKey}
              brandKit={currentProject.brandKit}
              styleBoards={currentProject.styleBoards}
              confirmedStyleId={currentProject.confirmedStyleId}
              faceStates={currentProject.faceStates}
              onAddArtworkVariation={addArtworkVariation}
              onSetFaceSelectedId={setFaceSelectedId}
              onSetFaceFinalData={setFaceFinalData}
              onUpdateCopyValue={updateCopyValue}
              onUpdateElementRect={updateElementRect}
              onResetCustomLayout={resetCustomLayout}
              onRecordCost={recordCostRupees}
              onProceedToExport={() => setActiveTab('export')}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'thank-you-letter' && (
            <ThankYouLetterStep
              imageApiKey={settings.apiKey}
              imageProvider={settings.thankYouImageProvider}
              metaImageApiKey={settings.metaImageApiKey}
              textApiKey={settings.textApiKey}
              textModel={settings.textModel}
              project={currentProject}
              onUpdateIntake={updateThankYouLetterIntake}
              onUpdateCopyValue={updateCopyValue}
              onAddArtworkVariation={addArtworkVariation}
              onSetFaceSelectedId={setFaceSelectedId}
              onUpdateElementRect={updateElementRect}
              onRecordCost={recordCostRupees}
              onOpenSettings={() => setIsSettingsOpen(true)}
            />
          )}

          {activeTab === 'export' && <ExportStep project={currentProject} />}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={updateSettings}
        onRecordCost={recordCostRupees}
      />
    </div>
  );
};
