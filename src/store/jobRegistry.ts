import { useSyncExternalStore } from 'react';

export type JobType = 'style-batch' | 'piece-batch' | 'piece-final' | 'revision';

export interface BackgroundJob {
  id: string;
  type: JobType;
  targetId: string; // 'style' or face.id
  title: string;
  tab: 'look' | 'pieces';
  totalCount: number;
  completedCount: number;
  status: 'running' | 'completed' | 'failed';
  error?: string;
  startedAt: number;
}

class JobRegistry {
  private jobs = new Map<string, BackgroundJob>();
  private listeners = new Set<() => void>();
  private snapshot: BackgroundJob[] = [];

  private notify() {
    this.snapshot = Array.from(this.jobs.values());
    this.listeners.forEach((l) => l());
  }

  public subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): BackgroundJob[] => {
    return this.snapshot;
  };

  public addJob(job: BackgroundJob) {
    this.jobs.set(job.id, { ...job });
    this.notify();
  }

  public updateJob(id: string, updates: Partial<BackgroundJob>) {
    const existing = this.jobs.get(id);
    if (!existing) return;
    this.jobs.set(id, { ...existing, ...updates });
    this.notify();
  }

  public incrementCompleted(id: string) {
    const existing = this.jobs.get(id);
    if (!existing) return;
    const completedCount = existing.completedCount + 1;
    const status = completedCount >= existing.totalCount ? 'completed' : 'running';
    this.jobs.set(id, { ...existing, completedCount, status });
    this.notify();

    if (status === 'completed') {
      setTimeout(() => {
        this.jobs.delete(id);
        this.notify();
      }, 5000);
    }
  }

  public failJob(id: string, errorMsg: string) {
    const existing = this.jobs.get(id);
    if (!existing) return;
    this.jobs.set(id, { ...existing, status: 'failed', error: errorMsg });
    this.notify();
  }

  public removeJob(id: string) {
    if (this.jobs.delete(id)) {
      this.notify();
    }
  }

  public isTargetRunning(targetId: string): boolean {
    for (const job of this.jobs.values()) {
      if (job.targetId === targetId && job.status === 'running') {
        return true;
      }
    }
    return false;
  }

  public getPendingCountForTarget(targetId: string): number {
    for (const job of this.jobs.values()) {
      if (job.targetId === targetId && job.status === 'running') {
        return Math.max(0, job.totalCount - job.completedCount);
      }
    }
    return 0;
  }
}

export const jobRegistry = new JobRegistry();

export function useBackgroundJobs(): BackgroundJob[] {
  return useSyncExternalStore(jobRegistry.subscribe, jobRegistry.getSnapshot, () => []);
}

export function useIsTabRunning(tab: 'look' | 'pieces'): boolean {
  const jobs = useBackgroundJobs();
  return jobs.some((j) => j.tab === tab && j.status === 'running');
}

export function useTargetJob(targetId: string): BackgroundJob | undefined {
  const jobs = useBackgroundJobs();
  return jobs.find((j) => j.targetId === targetId && j.status === 'running');
}
