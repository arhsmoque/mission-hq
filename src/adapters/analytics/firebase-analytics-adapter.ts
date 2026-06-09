/**
 * Firebase RTDB adapter for analytics session recording.
 *
 * Sessions are per-user; effectiveness aggregates are global (computed
 * from sessions on completion and stored for fast reads).
 *
 * Data paths:
 *   sessions      →  mission_hq/analytics/sessions/{uid}/{sessionId}
 *   effectiveness →  mission_hq/analytics/effectiveness/{methodId}/{subject}
 */

import { ref, set, update, get, push, onValue, query as dbQuery, orderByChild, limitToLast } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { AnalyticsPort } from '@/ports/lesson-port';
import type { AnalyticsSession, MethodEffectiveness } from '@/types';

const SESSIONS_ROOT     = 'mission_hq/analytics/sessions';
const EFFECTIVENESS_ROOT = 'mission_hq/analytics/effectiveness';

export const firebaseAnalyticsAdapter: AnalyticsPort = {
  async startSession(session) {
    const dbRef = ref(rtdb, `${SESSIONS_ROOT}/${session.uid}`);
    const newRef = push(dbRef);
    await set(newRef, {
      ...session,
      chatTurnsUsed: 0,
      hintsRequested: 0,
      completedWithoutHelp: false,
      successIndicator: false,
    });
    return newRef.key ?? '';
  },

  async completeSession(uid, sessionId, outcome) {
    const completedAt = Date.now();
    const sessionRef = ref(rtdb, `${SESSIONS_ROOT}/${uid}/${sessionId}`);

    const snap = await get(sessionRef);
    if (!snap.exists()) return;

    const session = snap.val() as AnalyticsSession;
    const timeToCompleteMs = completedAt - session.startedAt;

    await update(sessionRef, {
      ...outcome,
      completedAt,
      timeToCompleteMs,
    });

    await updateEffectivenessAggregate(session.methodId, session.subject, {
      ...outcome,
      timeToCompleteMs,
    });
  },

  subscribeMethodEffectiveness(methodId, subject, onChange) {
    const dbRef = ref(rtdb, `${EFFECTIVENESS_ROOT}/${methodId}/${subject}`);
    return onValue(dbRef, (snap) => {
      onChange(snap.exists() ? (snap.val() as MethodEffectiveness) : null);
    });
  },

  async getRecentSessions(uid, limit) {
    const q = dbQuery(
      ref(rtdb, `${SESSIONS_ROOT}/${uid}`),
      orderByChild('startedAt'),
      limitToLast(limit)
    );
    const snap = await get(q);
    if (!snap.exists()) return [];
    return Object.entries(snap.val() as Record<string, Omit<AnalyticsSession, 'sessionId'>>)
      .map(([id, data]) => ({ sessionId: id, ...data } as AnalyticsSession))
      .sort((a, b) => b.startedAt - a.startedAt);
  },
};

async function updateEffectivenessAggregate(
  methodId: string,
  subject: string,
  outcome: { completedWithoutHelp: boolean; chatTurnsUsed: number; timeToCompleteMs: number; successIndicator: boolean }
) {
  const effRef = ref(rtdb, `${EFFECTIVENESS_ROOT}/${methodId}/${subject}`);
  const snap = await get(effRef);

  const now = Date.now();

  if (!snap.exists()) {
    const initial: MethodEffectiveness = {
      methodId,
      subject,
      totalSessions: 1,
      completionRate: outcome.successIndicator ? 1 : 0,
      avgChatTurns: outcome.chatTurnsUsed,
      avgTimeToCompleteMs: outcome.timeToCompleteMs,
      unaidedCompletionRate: outcome.completedWithoutHelp ? 1 : 0,
      lastUpdated: now,
    };
    await set(effRef, initial);
    return;
  }

  const existing = snap.val() as MethodEffectiveness;
  const n = existing.totalSessions;

  const updated: MethodEffectiveness = {
    methodId,
    subject,
    totalSessions: n + 1,
    completionRate: rollingAvg(existing.completionRate, outcome.successIndicator ? 1 : 0, n),
    avgChatTurns: rollingAvg(existing.avgChatTurns, outcome.chatTurnsUsed, n),
    avgTimeToCompleteMs: rollingAvg(existing.avgTimeToCompleteMs, outcome.timeToCompleteMs, n),
    unaidedCompletionRate: rollingAvg(existing.unaidedCompletionRate, outcome.completedWithoutHelp ? 1 : 0, n),
    lastUpdated: now,
  };

  await set(effRef, updated);
}

function rollingAvg(current: number, newValue: number, n: number): number {
  return (current * n + newValue) / (n + 1);
}
