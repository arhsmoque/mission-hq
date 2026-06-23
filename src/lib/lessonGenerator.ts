/**
 * Teaching Method Engine — two-pass Gemini lesson generation.
 *
 * Pass 1 (generate, temp 0.3): section Markdown + method system prompt → activities JSON
 * Pass 2 (evaluate, temp 0.1): activities JSON + rubric → { overallPass, issues }
 *
 * On evaluation failure: retries Pass 1 with issues as extra constraints (max MAX_RETRIES).
 * On persistent failure: marks section status as 'needs_review' for parent inspection.
 */

import { aiAdapter, lessonStorage } from '@/adapters';
import { getCachedMethod, selectBestMethod } from './methodRegistry';
import { buildLessonActivityPrompt, buildEvaluationPrompt } from './prompts';
import { z } from 'zod';
import { LESSON_ACTIVITY_TYPES } from '@/types';
import type { ResourceEntry, TeachingMethod, LessonSection, LessonTocEntry, LessonActivity, EvaluationAttempt } from '@/types';

const GEN_MODEL   = 'gemini-2.5-flash';
const EVAL_MODEL  = 'gemini-2.5-pro';
const MAX_RETRIES = 2;

// ── Zod schema for generated section output ──────────────────────────────────

const LessonActivitySchema = z.object({
  type: z.enum(LESSON_ACTIVITY_TYPES),
  instruction: z.string().min(1, 'instruction is required'),
  hint: z.string(),
  successCriteria: z.string().min(1, 'successCriteria is required'),
});

const LessonSectionOutputSchema = z.object({
  bloomLevel: z.number().optional(),
  learningObjective: z.string().optional(),
  prerequisiteKnowledge: z.string().optional(),
  activities: z.array(LessonActivitySchema).optional(),
  commonMisconceptions: z.array(z.string()).optional(),
});

export interface LessonGenerationProgress {
  phase: 'preparing' | 'generating' | 'done';
  sectionsDone: number;
  sectionsTotal: number;
  currentSection?: string;
}

export interface GenerateLessonOptions {
  resource:    ResourceEntry;
  uid:         string;
  profileId:   string;
  methodId?:   string;
  onProgress?: (p: LessonGenerationProgress) => void;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function generateLesson(opts: GenerateLessonOptions): Promise<string> {
  const { resource, uid, profileId, onProgress } = opts;

  if (!resource.extractedContent?.fullText) {
    throw new Error('Resource has no extracted content. Run extraction first.');
  }

  const methodId = opts.methodId ?? await selectBestMethod(resource.subject);
  const method   = await getCachedMethod(methodId);
  if (!method) throw new Error(`Teaching method "${methodId}" not found in registry.`);

  onProgress?.({ phase: 'preparing', sectionsDone: 0, sectionsTotal: 0 });

  const { tocEntries, sections } = buildSections(
    resource.extractedContent.toc,
    resource.extractedContent.fullText,
    resource.pageCount ?? 0,
    methodId,
  );

  if (sections.length === 0) {
    throw new Error('No sections found in the resource TOC. Try re-extracting the resource.');
  }

  const lessonId = `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now      = Date.now();

  await lessonStorage.createLesson(uid, lessonId, {
    profileId,
    title:          resource.label,
    subject:        resource.subject,
    pdfStoragePath: resource.url,
    pageCount:      resource.pageCount ?? 0,
    toc:            tocEntries,
    sections,
    defaultMethodId: methodId,
    status:         'processing',
    parentReviewed: false,
    createdAt:      now,
    updatedAt:      now,
  });

  let sectionsDone = 0;
  onProgress?.({ phase: 'generating', sectionsDone: 0, sectionsTotal: sections.length });
  await Promise.allSettled(
    sections.map(async (section) => {
      await generateAndSaveSection(method, section, uid, lessonId);
      onProgress?.({
        phase: 'generating',
        sectionsDone: ++sectionsDone,
        sectionsTotal: sections.length,
        currentSection: section.title,
      });
    })
  );

  await lessonStorage.updateLesson(uid, lessonId, {
    status:    'ready',
    updatedAt: Date.now(),
  });

  onProgress?.({ phase: 'done', sectionsDone: sections.length, sectionsTotal: sections.length });
  return lessonId;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function sliceSectionMarkdown(fullText: string, pageStart: number, pageEnd: number): string {
  if (pageStart < 1) return '';  // extractor emits markers starting at 1; 0 is not a valid page
  const startRe = new RegExp(`---\\s*PAGE\\s+${pageStart}\\s*---`);
  const endRe   = new RegExp(`---\\s*PAGE\\s+${pageEnd + 1}\\s*---`);

  const si = fullText.search(startRe);
  if (si === -1) return '';

  const sub = fullText.slice(si);
  const ei  = sub.search(endRe);
  return ei === -1 ? sub : sub.slice(0, ei);
}

function buildSections(
  toc: Array<{ title: string; level: number; pageStart: number }>,
  fullText: string,
  pageCount: number,
  methodId: string,
): { tocEntries: LessonTocEntry[]; sections: LessonSection[] } {
  const sorted     = [...toc].sort((a, b) => a.pageStart - b.pageStart);
  const sectionToc = sorted.filter((t) => t.level <= 2);  // chapters + topics only

  const tocEntries: LessonTocEntry[] = sectionToc.map((t, i) => ({
    sectionId: `section_${i}`,
    title:     t.title,
    level:     t.level,
    pageStart: t.pageStart,
  }));

  const sections: LessonSection[] = sectionToc.map((t, i) => {
    const pageStart = t.pageStart;
    const pageEnd   = (sectionToc[i + 1]?.pageStart ?? pageCount + 1) - 1;
    const markdown  = sliceSectionMarkdown(fullText, pageStart, pageEnd);

    return {
      sectionId: `section_${i}`,
      title:     t.title,
      pageStart,
      pageEnd,
      markdown,
      methodId,
      status:    'raw',
    };
  });

  return { tocEntries, sections };
}

async function generateAndSaveSection(
  method: TeachingMethod,
  section: LessonSection,
  uid: string,
  lessonId: string,
): Promise<void> {
  let activitiesJson       = '';
  let parsedActivities: Record<string, unknown> = {};
  let overallPass          = false;
  let extraConstraints: string | undefined;
  const evalLog: EvaluationAttempt[] = [];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Pass 1: generate
      const systemPrompt = extraConstraints
        ? `${method.systemPrompt}\n\nADDITIONAL CONSTRAINTS:\n${extraConstraints}`
        : method.systemPrompt;

      const genMessages = buildLessonActivityPrompt({
        systemPrompt,
        sectionTitle:    section.title,
        sectionId:       section.sectionId,
        sectionMarkdown: section.markdown,
        outputSchema:    method.outputSchema,
      });

      const raw = await aiAdapter.chat(genMessages, GEN_MODEL, 0.3);
      activitiesJson = raw.trim().replace(/^```(?:json)?|```$/gm, '').trim();

      // Validate JSON structure
      try {
        const jsonMatch = activitiesJson.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : activitiesJson;
        parsedActivities = JSON.parse(cleanJson) as Record<string, unknown>;
      } catch {
        extraConstraints = 'Your previous response was not valid JSON. Return ONLY valid JSON.';
        evalLog.push({ attempt, pass: false, issues: ['Generation JSON parse failed'], timestamp: Date.now() });
        continue;
      }

      // Zod schema validation
      const zodResult = LessonSectionOutputSchema.safeParse(parsedActivities);
      if (!zodResult.success) {
        const zodIssues = zodResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
        extraConstraints = `Schema validation failed:\n${zodIssues.join('\n')}\n\nFix these issues and return valid JSON matching the schema exactly.`;
        evalLog.push({ attempt, pass: false, issues: zodIssues, timestamp: Date.now() });
        continue;
      }

      // Pass 2: evaluate
      const evalMessages = buildEvaluationPrompt({
        rubric:        method.evaluationRubric,
        activitiesJson,
        sectionTitle:  section.title,
      });

      const evalRaw     = await aiAdapter.chat(evalMessages, EVAL_MODEL, 0.1);
      const evalCleaned = evalRaw.trim().replace(/^```(?:json)?|```$/gm, '').trim();

      let issues: string[] = [];
      try {
        const jsonMatch = evalCleaned.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : evalCleaned;
        const evalParsed = JSON.parse(cleanJson) as { overallPass?: boolean; issues?: unknown };
        overallPass  = Boolean(evalParsed.overallPass);
        issues       = Array.isArray(evalParsed.issues) ? (evalParsed.issues as string[]) : [];
      } catch {
        overallPass = false;
        issues = ['Evaluation response was invalid JSON. Return valid JSON with overallPass and issues fields.'];
      }

      evalLog.push({ attempt, pass: overallPass, issues, timestamp: Date.now() });

      if (overallPass) break;
      extraConstraints = issues.join('\n');

    } catch (err) {
      evalLog.push({ attempt, pass: false, issues: [`Unexpected error: ${String(err)}`], timestamp: Date.now() });
      break; // network or unexpected error — save what we have
    }
  }

  await lessonStorage.updateSection(uid, lessonId, section.sectionId, {
    status:                overallPass ? 'generated' : 'needs_review',
    bloomLevel:            parsedActivities.bloomLevel             as number | undefined,
    learningObjective:     parsedActivities.learningObjective      as string | undefined,
    prerequisiteKnowledge: parsedActivities.prerequisiteKnowledge  as string | undefined,
    activities:            parsedActivities.activities              as LessonActivity[] | undefined,
    commonMisconceptions:  parsedActivities.commonMisconceptions    as string[] | undefined,
    generatedAt:           Date.now(),
    evaluationLog:         evalLog,
  });
}

// ── Public regenerate API ─────────────────────────────────────────────────────

export async function regenerateSection(
  uid: string,
  lessonId: string,
  section: LessonSection,
  methodId?: string,
): Promise<void> {
  const method = await getCachedMethod(methodId ?? section.methodId);
  if (!method) throw new Error(`Teaching method "${methodId ?? section.methodId}" not found in registry.`);

  // Reset section to raw so UI shows it is being regenerated
  await lessonStorage.updateSection(uid, lessonId, section.sectionId, {
    status: 'raw',
    generatedAt: undefined,
    reviewedAt: undefined,
    evaluationLog: undefined,
    parentNotes: undefined,
  });

  await generateAndSaveSection(method, section, uid, lessonId);
}
