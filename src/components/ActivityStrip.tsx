import React from 'react';
import { useBackgroundJobs } from '../store/jobRegistry';

export const ActivityStrip: React.FC = () => {
  const jobs = useBackgroundJobs();
  const runningJobs = jobs.filter((j) => j.status === 'running');

  if (runningJobs.length === 0) {
    return null;
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-brand bg-brand-soft px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-brand" />
        <span className="font-medium text-ink">Working in the background</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {runningJobs.map((job) => (
          <span key={job.id} className="text-ink/70">
            {job.title}: {job.completedCount} of {job.totalCount} ready ({job.completedCount}/{job.totalCount})
          </span>
        ))}
      </div>
    </div>
  );
};
