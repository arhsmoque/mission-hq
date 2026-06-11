export type TutorIntent = 'answer_request' | 'wrong_attempt' | 'give_up' | 'normal';

export type TutorResponseMode =
  | 'light_hint'
  | 'specific_hint'
  | 'guided_step'
  | 'worked_similar_example'
  | 'reveal_with_parent_pin'
  | 'blocked_rapid_attempts';

export interface AttemptPolicyState {
  wrongAttemptTimestamps: number[];
  blockedUntil?: number;
}

export interface RevealEligibility {
  canReveal: boolean;
  mode: TutorResponseMode;
  attempts: number;
  attemptsRemaining: number;
  waitMs: number;
}

const MAX_TRACKED_ATTEMPTS = 5;
const REVEAL_AFTER_ATTEMPTS = 3;
const QUICK_ATTEMPT_MS = 12000;
const MIN_REVEAL_WINDOW_MS = 30000;
const RAPID_BLOCK_MS = 90000;

export const TUTORING_POLICY_TEXT = `GUIDED TUTORING POLICY:
- Keep the learning control predictable while adapting tone and examples to the child.
- First wrong attempt: give a light hint. Do not reveal the final answer.
- Second wrong attempt: give a more specific hint. Do not reveal the final answer.
- Third wrong attempt: move to a guided step or similar worked example. Do not reveal unless PARENT_REVEAL_AUTHORIZED is true.
- If the child gives up, switch from testing to teaching with a similar example, then return to the original question.
- If the child asks directly for the answer, refuse gently unless PARENT_REVEAL_AUTHORIZED is true.
- If rapid wrong attempts are flagged, do not reveal. Slow down, ask the child to explain one step, and keep the tone calm.
- If PARENT_REVEAL_AUTHORIZED is true, you may reveal the answer, but include the reasoning and a similar retry question.`;

export function classifyTutorIntent(text: string): TutorIntent {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return 'normal';

  if (/\b(answer|jawapan|ans)\b/.test(normalized) && /\b(give|show|tell|bagi|nak|want|reveal)\b/.test(normalized)) {
    return 'answer_request';
  }

  if (/\b(i give up|give up|tak tahu|dont know|don't know|i don't know|surrender|cannot|can't do)\b/.test(normalized)) {
    return 'give_up';
  }

  if (/\b(wrong|salah|incorrect|tak betul|not correct|my answer was wrong|i got it wrong)\b/.test(normalized)) {
    return 'wrong_attempt';
  }

  return 'normal';
}

export function getResponseMode(intent: TutorIntent, wrongAttempts: number): TutorResponseMode {
  if (intent === 'answer_request') return 'guided_step';
  if (intent === 'give_up') return 'worked_similar_example';
  if (wrongAttempts <= 1) return 'light_hint';
  if (wrongAttempts === 2) return 'specific_hint';
  return 'guided_step';
}

export function recordWrongAttempt(
  state: AttemptPolicyState,
  now = Date.now()
): AttemptPolicyState {
  const wrongAttemptTimestamps = [...state.wrongAttemptTimestamps, now].slice(-MAX_TRACKED_ATTEMPTS);
  return { ...state, wrongAttemptTimestamps };
}

export function getRevealEligibility(
  state: AttemptPolicyState,
  now = Date.now()
): RevealEligibility {
  const attempts = state.wrongAttemptTimestamps.length;
  const attemptsRemaining = Math.max(0, REVEAL_AFTER_ATTEMPTS - attempts);
  const blockedUntil = state.blockedUntil ?? 0;

  if (blockedUntil > now) {
    return {
      canReveal: false,
      mode: 'blocked_rapid_attempts',
      attempts,
      attemptsRemaining,
      waitMs: blockedUntil - now,
    };
  }

  if (attempts < REVEAL_AFTER_ATTEMPTS) {
    return {
      canReveal: false,
      mode: getResponseMode('wrong_attempt', attempts),
      attempts,
      attemptsRemaining,
      waitMs: 0,
    };
  }

  const recent = state.wrongAttemptTimestamps.slice(-REVEAL_AFTER_ATTEMPTS);
  const intervals = recent.slice(1).map((ts, idx) => ts - recent[idx]);
  const span = recent[recent.length - 1] - recent[0];
  const rapid = intervals.some((gap) => gap < QUICK_ATTEMPT_MS) || span < MIN_REVEAL_WINDOW_MS;

  if (rapid) {
    return {
      canReveal: false,
      mode: 'blocked_rapid_attempts',
      attempts,
      attemptsRemaining: 0,
      waitMs: RAPID_BLOCK_MS,
    };
  }

  return {
    canReveal: true,
    mode: 'reveal_with_parent_pin',
    attempts,
    attemptsRemaining: 0,
    waitMs: 0,
  };
}

export function applyRapidAttemptBlock(now = Date.now()): AttemptPolicyState {
  return {
    wrongAttemptTimestamps: [],
    blockedUntil: now + RAPID_BLOCK_MS,
  };
}

export function buildPolicyContext(options: {
  mode: TutorResponseMode;
  wrongAttempts: number;
  revealAuthorized: boolean;
  rapidAttemptBlocked: boolean;
}): string {
  const { mode, wrongAttempts, revealAuthorized, rapidAttemptBlocked } = options;
  return [
    TUTORING_POLICY_TEXT,
    `CURRENT_RESPONSE_MODE: ${mode}`,
    `WRONG_ATTEMPTS_REPORTED: ${wrongAttempts}`,
    `PARENT_REVEAL_AUTHORIZED: ${revealAuthorized ? 'true' : 'false'}`,
    `RAPID_ATTEMPT_BLOCKED: ${rapidAttemptBlocked ? 'true' : 'false'}`,
  ].join('\n');
}
