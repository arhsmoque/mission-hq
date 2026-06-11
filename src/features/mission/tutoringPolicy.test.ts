import { describe, expect, it } from 'vitest';
import {
  applyRapidAttemptBlock,
  classifyTutorIntent,
  getRevealEligibility,
  recordWrongAttempt,
} from './tutoringPolicy';

describe('tutoring policy', () => {
  it('classifies answer requests, give-up messages, and wrong attempts', () => {
    expect(classifyTutorIntent('show me the answer')).toBe('answer_request');
    expect(classifyTutorIntent("I don't know")).toBe('give_up');
    expect(classifyTutorIntent('my answer was wrong')).toBe('wrong_attempt');
    expect(classifyTutorIntent('can you help me understand?')).toBe('normal');
  });

  it('allows reveal after three spaced wrong attempts', () => {
    let state = { wrongAttemptTimestamps: [] as number[] };
    state = recordWrongAttempt(state, 0);
    state = recordWrongAttempt(state, 16000);
    state = recordWrongAttempt(state, 33000);

    expect(getRevealEligibility(state, 33000).canReveal).toBe(true);
  });

  it('blocks reveal when three wrong attempts are too fast', () => {
    let state = { wrongAttemptTimestamps: [] as number[] };
    state = recordWrongAttempt(state, 0);
    state = recordWrongAttempt(state, 2000);
    state = recordWrongAttempt(state, 4000);

    const eligibility = getRevealEligibility(state, 4000);
    expect(eligibility.canReveal).toBe(false);
    expect(eligibility.mode).toBe('blocked_rapid_attempts');
  });

  it('sets a cooldown after rapid attempts are detected', () => {
    const blocked = applyRapidAttemptBlock(2000);
    const eligibility = getRevealEligibility(blocked, 3000);

    expect(eligibility.canReveal).toBe(false);
    expect(eligibility.waitMs).toBeGreaterThan(0);
  });
});
