/**
 * Daily agenda engine.
 *
 * Responsibilities:
 *   1. Build today's agenda from active campaigns for a profile
 *   2. Schedule sessions across a campaign's deadline window
 *   3. Generate AI content (review guide, practice Qs, quiz) for a session
 *      — cached in Firebase so it's only generated once per session
 */

import { campaignStorage, sessionContent, getPageSlice } from '@/adapters';
import { aiAdapter } from '@/adapters';
import { newCampaignId } from '@/adapters/storage/firebase-campaigns-adapter';
import type {
  Campaign,
  CampaignSession,
  CampaignScope,
  DailyAgenda,
  AgendaItem,
  SessionContent,
  PracticeQuestion,
  QuizQuestion,
  Subject,
} from '@/types';
import { PROFILES } from '@/features/profile/profiles';

const AI_MODEL = 'gemini-2.5-flash';

// ── Date helpers ───────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfDay(dateStr: string): number {
  return new Date(dateStr + 'T00:00:00').getTime();
}

function addDays(base: number, days: number): number {
  return base + days * 86_400_000;
}

// ── Session scheduler ──────────────────────────────────────────────────────

/**
 * Given a campaign's scope sections and deadline, produce a list of sessions
 * with evenly-spread target dates. The last section always lands before the deadline.
 * If daysRemaining > sections+2, a mixed-review session is appended 2 days before deadline.
 */
export function scheduleSessions(
  scopeSections: CampaignScope[],
  deadline: number,
  startFrom: number = Date.now(),
): CampaignSession[] {
  const msPerDay    = 86_400_000;
  const daysLeft    = Math.max(1, Math.ceil((deadline - startFrom) / msPerDay));
  const n           = scopeSections.length;
  const spacing     = Math.max(1, Math.floor((daysLeft - 1) / n));

  const sessions: CampaignSession[] = scopeSections.map((sec, i) => ({
    sessionIdx:    i,
    sectionId:     sec.sectionId,
    sectionTitle:  sec.title,
    pageStart:     sec.pageStart,
    pageEnd:       sec.pageEnd,
    targetDate:    addDays(startOfDay(todayStr()), i * spacing),
    activityTypes: ['review', 'practice', 'quiz'],
    status:        'pending',
  }));

  // Add a mixed-review session if there's enough time
  if (daysLeft > n + 2) {
    sessions.push({
      sessionIdx:    n,
      sectionId:     'review_all',
      sectionTitle:  'Mixed Review — All Sections',
      pageStart:     scopeSections[0].pageStart,
      pageEnd:       scopeSections[n - 1].pageEnd,
      targetDate:    deadline - 2 * msPerDay,
      activityTypes: ['practice', 'quiz'],
      status:        'pending',
    });
  }

  return sessions;
}

// ── Campaign factory ───────────────────────────────────────────────────────

export function buildCampaign(opts: {
  profileId: string;
  type: Campaign['type'];
  label: string;
  deadline: number;
  resourceId?: string;
  resourceLabel?: string;
  subject?: Subject;
  scopeSections: CampaignScope[];
}): Campaign {
  const sessions = scheduleSessions(opts.scopeSections, opts.deadline);
  const id = newCampaignId();
  return {
    campaignId:    id,
    profileId:     opts.profileId,
    type:          opts.type,
    label:         opts.label,
    deadline:      opts.deadline,
    resourceId:    opts.resourceId,
    resourceLabel: opts.resourceLabel,
    subject:       opts.subject,
    scopeSections: opts.scopeSections,
    sessions,
    sessionsTotal: sessions.length,
    sessionsDone:  0,
    status:        'active',
    createdAt:     Date.now(),
  };
}

// ── Daily agenda builder ───────────────────────────────────────────────────

export async function buildDailyAgenda(profileId: string): Promise<DailyAgenda> {
  const campaigns = await campaignStorage.getCampaignsByProfile(profileId);
  const active    = campaigns.filter((c) => c.status === 'active');

  const today     = todayStr();
  const todayMs   = startOfDay(today);
  const day3Ms    = addDays(todayMs, 2);

  const items: AgendaItem[]     = [];
  const upcoming: AgendaItem[]  = [];

  for (const campaign of active) {
    for (const session of campaign.sessions) {
      if (session.status !== 'pending') continue;
      const t = session.targetDate;
      if (t <= todayMs + 86_400_000) {
        items.push({ campaign, session, isOverdue: t < todayMs });
      } else if (t < day3Ms + 86_400_000) {
        upcoming.push({ campaign, session, isOverdue: false });
      }
    }
  }

  // Sort: overdue first, then by targetDate
  items.sort((a, b) =>
    (b.isOverdue ? 1 : 0) - (a.isOverdue ? 1 : 0) ||
    a.session.targetDate - b.session.targetDate,
  );

  return { profileId, date: today, items, upcomingItems: upcoming };
}

// ── AI content generation (cached) ────────────────────────────────────────

async function fetchOrGenerate<T>(
  campaignId: string,
  sessionIdx: number,
  field: keyof SessionContent,
  generate: () => Promise<T>,
): Promise<T> {
  const cached = await sessionContent.getSessionContent(campaignId, sessionIdx);
  if (cached?.[field]) return cached[field] as T;

  const result = await generate();

  // Merge into existing cache or create new
  const existing = cached ?? { campaignId, sessionIdx, generatedAt: Date.now() };
  await sessionContent.saveSessionContent({ ...existing, [field]: result, generatedAt: Date.now() } as SessionContent);
  return result;
}

export async function getReviewContent(
  campaignId: string,
  sessionIdx: number,
  session: CampaignSession,
  resourceId: string,
  bookTitle: string,
  profileId: string,
): Promise<string> {
  return fetchOrGenerate(campaignId, sessionIdx, 'reviewMarkdown', async () => {
    const pageSlice = await getPageSlice(resourceId, session.pageStart, session.pageEnd);
    if (!pageSlice) return '*No extracted content found for these pages.*';

    const profile = PROFILES.find((p) => p.id === profileId);
    const yearLevel = profile?.yearLevel ?? 1;

    const prompt = `You are a friendly, encouraging study coach for a Malaysian primary school child (Year ${yearLevel}).
Book: "${bookTitle}"
Chapter: "${session.sectionTitle}" (pages ${session.pageStart}–${session.pageEnd})

Extracted textbook content:
${pageSlice}

Create a concise study guide with these sections:
## Key Points
- 3–5 bullet points of the most important things to remember

## Important Words
- 3–5 vocabulary items with a short child-friendly explanation (skip if none)

## Remember This
- One memorable tip, rhyme, or mnemonic to help the child retain the material

Keep language simple and warm. Format as Markdown. Be encouraging.`;

    return aiAdapter.chat([{ role: 'user', content: prompt }], AI_MODEL, 0.4);
  });
}

export async function getPracticeQuestions(
  campaignId: string,
  sessionIdx: number,
  session: CampaignSession,
  resourceId: string,
  bookTitle: string,
  profileId: string,
): Promise<PracticeQuestion[]> {
  return fetchOrGenerate(campaignId, sessionIdx, 'questions', async () => {
    const pageSlice = await getPageSlice(resourceId, session.pageStart, session.pageEnd);
    const profile   = PROFILES.find((p) => p.id === profileId);
    const yearLevel = profile?.yearLevel ?? 1;

    const prompt = `Generate 5 practice questions for a Year ${yearLevel} Malaysian primary school student.
Book: "${bookTitle}", Chapter: "${session.sectionTitle}"

Content:
${pageSlice}

Return ONLY a JSON array with no markdown fences:
[{"question":"...","answer":"...","hint":"..."}]
Questions must be directly answerable from the content above.`;

    const raw     = await aiAdapter.chat([{ role: 'user', content: prompt }], AI_MODEL, 0.3);
    const cleaned = raw.trim().replace(/^```(?:json)?|```$/gm, '').trim();
    try {
      const parsed = JSON.parse(cleaned) as PracticeQuestion[];
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  });
}

export async function getQuizQuestions(
  campaignId: string,
  sessionIdx: number,
  session: CampaignSession,
  resourceId: string,
  bookTitle: string,
  profileId: string,
): Promise<QuizQuestion[]> {
  return fetchOrGenerate(campaignId, sessionIdx, 'quiz', async () => {
    const pageSlice = await getPageSlice(resourceId, session.pageStart, session.pageEnd);
    const profile   = PROFILES.find((p) => p.id === profileId);
    const yearLevel = profile?.yearLevel ?? 1;

    const prompt = `Generate a 5-question multiple choice quiz for a Year ${yearLevel} Malaysian primary school student.
Book: "${bookTitle}", Chapter: "${session.sectionTitle}"

Content:
${pageSlice}

Return ONLY a JSON array with no markdown fences:
[{"question":"...","options":["A. ...","B. ...","C. ...","D. ..."],"correct":0,"explanation":"..."}]
"correct" is the 0-based index of the right option. Questions must test the content above.`;

    const raw     = await aiAdapter.chat([{ role: 'user', content: prompt }], AI_MODEL, 0.3);
    const cleaned = raw.trim().replace(/^```(?:json)?|```$/gm, '').trim();
    try {
      const parsed = JSON.parse(cleaned) as QuizQuestion[];
      return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
    } catch {
      return [];
    }
  });
}

export async function evaluatePracticeAnswer(
  question: string,
  correctAnswer: string,
  studentAnswer: string,
): Promise<{ correct: boolean; feedback: string }> {
  const prompt = `A student answered a practice question. Evaluate it kindly.
Question: ${question}
Correct answer: ${correctAnswer}
Student's answer: ${studentAnswer}

Reply ONLY with JSON (no fences): {"correct":true/false,"feedback":"1-2 encouraging sentences"}`;

  try {
    const raw     = await aiAdapter.chat([{ role: 'user', content: prompt }], AI_MODEL, 0.2);
    const cleaned = raw.trim().replace(/^```(?:json)?|```$/gm, '').trim();
    return JSON.parse(cleaned) as { correct: boolean; feedback: string };
  } catch {
    // Fallback: simple keyword match
    const correct = studentAnswer.toLowerCase().includes(correctAnswer.toLowerCase().slice(0, 10));
    return { correct, feedback: correct ? 'Great job!' : `The correct answer is: ${correctAnswer}` };
  }
}
