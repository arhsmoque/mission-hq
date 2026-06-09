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
import type { ResourceEntry, TeachingMethod, LessonSection, LessonTocEntry, LessonActivity } from '@/types';

const GEN_MODEL   = 'gemini-2.5-flash';
const MAX_RETRIES = 2;

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

  for (let i = 0; i < sections.length; i++) {
    onProgress?.({
      phase:          'generating',
      sectionsDone:   i,
      sectionsTotal:  sections.length,
      currentSection: sections[i].title,
    });
    await generateAndSaveSection(method, sections[i], uid, lessonId);
  }

  await lessonStorage.updateLesson(uid, lessonId, {
    status:    'ready',
    updatedAt: Date.now(),
  });

  onProgress?.({ phase: 'done', sectionsDone: sections.length, sectionsTotal: sections.length });
  return lessonId;
}

// ── Internals ─────────────────────────────────────────────────────────────────

function sliceSectionMarkdown(fullText: string, pageStart: number, pageEnd: number): string {
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
  let activitiesJson     = '';
  let overallPass        = false;
  let extraConstraints: string | undefined;

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

      // Validate JSON before sending to evaluator
      JSON.parse(activitiesJson);

      // Pass 2: evaluate
      const evalMessages = buildEvaluationPrompt({
        rubric:        method.evaluationRubric,
        activitiesJson,
        sectionTitle:  section.title,
      });

      const evalRaw     = await aiAdapter.chat(evalMessages, GEN_MODEL, 0.1);
      const evalCleaned = evalRaw.trim().replace(/^```(?:json)?|```$/gm, '').trim();

      let issues: string[] = [];
      try {
        const evalParsed = JSON.parse(evalCleaned) as { overallPass?: boolean; issues?: unknown };
        overallPass  = Boolean(evalParsed.overallPass);
        issues       = Array.isArray(evalParsed.issues) ? (evalParsed.issues as string[]) : [];
      } catch {
        overallPass = true; // evaluation JSON parse fail → treat as pass
      }

      if (overallPass) break;
      extraConstraints = issues.join('\n');

    } catch {
      break; // network or parse error — save what we have
    }
  }

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(activitiesJson) as Record<string, unknown>;
  } catch {
    await lessonStorage.updateSection(uid, lessonId, section.sectionId, {
      status: 'needs_review',
    });
    return;
  }

  await lessonStorage.updateSection(uid, lessonId, section.sectionId, {
    status:                overallPass ? 'generated' : 'needs_review',
    bloomLevel:            parsed.bloomLevel             as number | undefined,
    learningObjective:     parsed.learningObjective      as string | undefined,
    prerequisiteKnowledge: parsed.prerequisiteKnowledge  as string | undefined,
    activities:            parsed.activities              as LessonActivity[] | undefined,
    commonMisconceptions:  parsed.commonMisconceptions    as string[] | undefined,
    generatedAt:           Date.now(),
  });
}
