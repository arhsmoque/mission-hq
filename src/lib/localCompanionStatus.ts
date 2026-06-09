import { onValue, ref } from 'firebase/database';
import type { Unsubscribe } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

export type LocalCompanionState = 'starting' | 'idle' | 'running' | 'offline' | 'error';

export interface LocalCompanionStatus {
  companionId: string;
  state: LocalCompanionState;
  pid?: number;
  nodeVersion?: string;
  platform?: string;
  geminiBin?: string;
  outputFormat?: string;
  jobsRoot?: string;
  activeJob?: {
    uid: string;
    jobId: string;
    kind: string;
    startedAt: number;
  } | null;
  completedJobs?: number;
  failedJobs?: number;
  startedAt?: number;
  heartbeatAt?: number;
  updatedAt?: number;
  offlineAt?: number;
  error?: string;
}

const COMPANIONS_ROOT = 'mission_hq/aiCompanions';

export function subscribeLocalCompanions(
  onChange: (companions: LocalCompanionStatus[]) => void
): Unsubscribe {
  return onValue(ref(rtdb, COMPANIONS_ROOT), (snap) => {
    if (!snap.exists()) {
      onChange([]);
      return;
    }

    const rows = Object.entries(snap.val() as Record<string, LocalCompanionStatus>)
      .map(([companionId, value]) => ({ ...value, companionId }))
      .sort((a, b) => (b.heartbeatAt ?? 0) - (a.heartbeatAt ?? 0));

    onChange(rows);
  });
}

export function isCompanionFresh(status: LocalCompanionStatus, maxAgeMs = 45_000): boolean {
  const heartbeatAt = status.heartbeatAt ?? status.updatedAt ?? 0;
  return status.state !== 'offline' && Date.now() - heartbeatAt <= maxAgeMs;
}
