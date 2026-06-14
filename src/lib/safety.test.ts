import { describe, it, expect } from 'vitest';
import { sanitizeResponse } from './safety';

const REDIRECT = "That's a great question!";
const TRACK    = "You're on the right track!";

describe('sanitizeResponse', () => {
  it('passes through a normal coaching reply unchanged', () => {
    const r = sanitizeResponse('What operation does the problem ask you to use?', '2 + 3 = ?');
    expect(r).toBe('What operation does the problem ask you to use?');
  });

  it('redirects a short reply that echoes an OCR number', () => {
    const r = sanitizeResponse('5', '2 + 3 = 5');
    expect(r).toContain(REDIRECT);
  });

  it('redirects a reply longer than 150 chars that echoes an OCR number', () => {
    // Length does not exempt a response from the OCR-number check — a long reply
    // can still leak the answer
    const reply = 'You already know that 5 is the number of fingers on one hand, right? '
      + 'So think about what happens when you combine two groups of fingers together. '
      + 'What total do you get?';
    expect(reply.length).toBeGreaterThan(150);
    const r = sanitizeResponse(reply, '5 apples');
    expect(r).toContain(REDIRECT);
  });

  it('blocks "The answer is <number>"', () => {
    const r = sanitizeResponse('The answer is 42.', '');
    expect(r).toContain(TRACK);
  });

  it('blocks "It\'s 7"', () => {
    const r = sanitizeResponse("It's 7", '');
    expect(r).toContain(TRACK);
  });

  it('blocks "<number> is the answer"', () => {
    const r = sanitizeResponse('12 is the answer', '');
    expect(r).toContain(TRACK);
  });

  it('is case-insensitive for direct-answer patterns', () => {
    const r = sanitizeResponse('THE ANSWER IS 99', '');
    expect(r).toContain(TRACK);
  });

  it('does not block question labels like "Question 3"', () => {
    const r = sanitizeResponse("Let's look at Question 3 together.", 'Question 3: 5 + 3 = ?');
    expect(r).toBe("Let's look at Question 3 together.");
  });

  it('blocks textual number leaks like "the answer is five"', () => {
    const r = sanitizeResponse('the answer is five', '');
    expect(r).toContain(TRACK);
  });

  it('blocks option letter leaks like "Choose option B"', () => {
    const r = sanitizeResponse('Choose option B', '');
    expect(r).toContain(TRACK);
  });
});
