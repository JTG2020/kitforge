import React from 'react';
import { ProjectState } from '../types/project';

interface HeaderProps {
  currentProject: ProjectState;
  projects: Record<string, ProjectState>;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: (id: string) => void;
  onOpenSettings: () => void;
  hasApiKey: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onNewProject,
  onDuplicateProject,
  onOpenSettings,
  hasApiKey,
}) => {
  const projectList = Object.values(projects);

  return (
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
      {/* Left side: Logo / App Name & Project Controls */}
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="size-6 rounded-md bg-brand flex items-center justify-center text-white font-bold text-xs">
            KF
          </div>
          <span className="text-lg font-semibold tracking-tight text-ink">KitForge</span>
        </div>

        <div className="h-4 w-px bg-line" />

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-2 min-w-0">
          <select
            value={currentProject.id}
            onChange={(e) => onSelectProject(e.target.value)}
            className="rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink focus:border-brand focus:outline-none max-w-[200px] truncate"
            title={currentProject.name}
          >
            {projectList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink hover:bg-shell transition"
            title="Create new welcome kit project"
          >
            + New
          </button>

          <button
            type="button"
            onClick={() => onDuplicateProject(currentProject.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink/70 hover:bg-shell hover:text-ink transition"
            title="Duplicate this project"
          >
            Duplicate
          </button>
        </div>
      </div>

      {/* Right side: Estimated Cost & Settings */}
      <div className="flex items-center gap-3">
        {currentProject.estimatedCostRupees > 0 && (
          <div className="text-xs font-medium text-ink/60 bg-shell px-2.5 py-1 rounded-md border border-line">
            API Cost: <span className="text-ink font-semibold">₹{currentProject.estimatedCostRupees}</span>
          </div>
        )}

        <button
          type="button"
          onClick={onOpenSettings}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            !hasApiKey
              ? 'border-amber-300 bg-amber-50 text-amber-900 animate-pulse'
              : 'border-line bg-panel text-ink hover:bg-shell'
          }`}
        >
          <span className={`size-2 rounded-full ${hasApiKey ? 'bg-teal-600' : 'bg-amber-500'}`} />
          Settings
        </button>
      </div>
    </header>
  );
};
