import { ref, push, set, onValue } from 'firebase/database';
import type { Unsubscribe } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { AIChatMessage } from '@/ports/ai-port';

export type LocalCompanionJobKind =
  | 'admin_chat'
  | 'mission_generate'
  | 'ocr_cleanup'
  | 'worksheet_explain'
  | 'quiz_generate'
  | 'hint_generate'
  | 'answer_check'
  | 'parent_summary'
  | 'general';

export type LocalCompanionJobStatus = 'pending' | 'running' | 'done' | 'error';

export interface LocalCompanionJobInput {
  kind: LocalCompanionJobKind;
  messages: AIChatMessage[];
  model: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface LocalCompanionJobResult {
  text: string;
  json?: unknown;
  rawOutput?: string;
}

export interface LocalCompanionJob {
  jobId?: string;
  status: LocalCompanionJobStatus;
  input: LocalCompanionJobInput;
  result?: LocalCompanionJobResult;
  error?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  companionId?: string;
}

const JOBS_ROOT = 'mission_hq/aiJobs';

export async function createLocalCompanionJob(
  uid: string,
  input: LocalCompanionJobInput
): Promise<string> {
  const jobRef = push(ref(rtdb, `${JOBS_ROOT}/${uid}`));
  const now = Date.now();

  await set(jobRef, {
    status: 'pending',
    input,
    createdBy: uid,
    createdAt: now,
    updatedAt: now,
  } satisfies LocalCompanionJob);

  return jobRef.key ?? '';
}

export function subscribeLocalCompanionJob(
  uid: string,
  jobId: string,
  onChange: (job: LocalCompanionJob | null) => void
): Unsubscribe {
  return onValue(ref(rtdb, `${JOBS_ROOT}/${uid}/${jobId}`), (snap) => {
    onChange(snap.exists() ? ({ jobId, ...snap.val() } as LocalCompanionJob) : null);
  });
}

export async function waitForLocalCompanionResult(
  uid: string,
  input: LocalCompanionJobInput,
  timeoutMs = 240_000
): Promise<LocalCompanionJobResult> {
  const jobId = await createLocalCompanionJob(uid, input);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error(`Local companion timed out after ${Math.round(timeoutMs / 1000)}s. Job: ${jobId}`));
    }, timeoutMs);

    const unsubscribe = subscribeLocalCompanionJob(uid, jobId, (job) => {
      if (!job) return;

      if (job.status === 'done') {
        window.clearTimeout(timeout);
        unsubscribe();
        resolve(job.result ?? { text: '' });
      }

      if (job.status === 'error') {
        window.clearTimeout(timeout);
        unsubscribe();
        reject(new Error(job.error ?? `Local companion job failed: ${jobId}`));
      }
    });
  });
}
