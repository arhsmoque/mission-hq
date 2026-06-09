import { useEffect, useState } from 'react';
import {
  isCompanionFresh,
  subscribeLocalCompanions,
  type LocalCompanionStatus,
} from '@/lib/localCompanionStatus';

function relativeTime(ts?: number): string {
  if (!ts) return 'never';
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function stateLabel(row: LocalCompanionStatus): string {
  if (!isCompanionFresh(row)) return 'stale';
  return row.state;
}

function stateClass(row: LocalCompanionStatus): string {
  const state = stateLabel(row);
  if (state === 'idle') return 'bg-green/10 text-green border-green/30';
  if (state === 'running') return 'bg-accent/10 text-accent border-accent/30';
  if (state === 'starting') return 'bg-accent/10 text-accent border-accent/30';
  if (state === 'error') return 'bg-red/10 text-red border-red/30';
  return 'bg-bg-2 text-text-3 border-border';
}

export default function LocalCompanionStatusPanel() {
  const [companions, setCompanions] = useState<LocalCompanionStatus[]>([]);

  useEffect(() => subscribeLocalCompanions(setCompanions), []);

  if (companions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-2 p-3 text-xs text-text-3">
        No local Gemini companion heartbeat found. Start it with <code>npm run companion:gemini</code> on your desktop.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {companions.slice(0, 3).map((row) => (
        <div key={row.companionId} className="rounded-xl border border-border bg-bg-2 p-3 text-xs text-text-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-text truncate">{row.companionId}</p>
              <p className="text-text-3">
                {row.platform ?? 'unknown platform'} · {row.geminiBin ?? 'gemini'} · heartbeat {relativeTime(row.heartbeatAt)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 font-semibold ${stateClass(row)}`}>
              {stateLabel(row)}
            </span>
          </div>

          {row.activeJob && (
            <div className="mt-2 rounded-lg bg-surface p-2 text-text-2">
              Running <span className="font-semibold">{row.activeJob.kind}</span> job since {relativeTime(row.activeJob.startedAt)}
            </div>
          )}

          {row.error && (
            <div className="mt-2 rounded-lg border border-red/30 bg-red/10 p-2 text-red">
              {row.error}
            </div>
          )}

          <div className="mt-2 flex gap-3 text-text-3">
            <span>{row.completedJobs ?? 0} done</span>
            <span>{row.failedJobs ?? 0} failed</span>
            {row.pid && <span>pid {row.pid}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
