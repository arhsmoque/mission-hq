/**
 * Seed data for the teaching method registry.
 *
 * seedMethodsIfEmpty() is called once at app startup. It checks whether
 * the registry is empty and if so writes the default methods. Safe to call
 * on every startup — it's a no-op if methods already exist.
 *
 * To add a new teaching method: add a TeachingMethod entry to SEED_METHODS
 * below. The next time a fresh Firebase project is initialised, it will be
 * included. For existing deployments, call createMethod() directly via the
 * admin panel (Stage 4).
 */

import type { TeachingMethod } from '@/types';
import { methodRegistry } from '@/adapters';

const BLOOMS_TAXONOMY: Omit<TeachingMethod, 'createdAt'> = {
  methodId: 'blooms_taxonomy',
  name: "Bloom's Taxonomy",
  description:
    'A hierarchical cognitive framework that sequences learning from recall through to creation. Activities are assigned a Bloom level (1–6) and designed to develop progressively deeper understanding.',
  framework: 'cognitive',
  ageRange: { min: 6, max: 18 },
  applicableSubjects: ['maths', 'science', 'english', 'malay', 'chinese', 'history', 'geography', 'mixed'],
  phases: [
    {
      id: 'remember',
      label: 'Remember',
      description: 'Recall facts and basic concepts',
      verbExamples: ['list', 'recall', 'identify', 'name', 'define'],
      activityTypes: ['flashcard', 'fill_in_blank', 'matching'],
      promptGuidance:
        'Create activities that test recall of key facts, definitions, or sequences from the content. No inference required.',
    },
    {
      id: 'understand',
      label: 'Understand',
      description: 'Explain ideas or concepts in own words',
      verbExamples: ['explain', 'summarise', 'describe', 'paraphrase', 'classify'],
      activityTypes: ['paraphrase', 'summary', 'explanation'],
      promptGuidance:
        'Create activities where the student explains concepts in their own words without copying the source text.',
    },
    {
      id: 'apply',
      label: 'Apply',
      description: 'Use information in a new situation',
      verbExamples: ['solve', 'use', 'demonstrate', 'calculate', 'show'],
      activityTypes: ['practice_problem', 'worked_example', 'scenario'],
      promptGuidance:
        'Create practice problems that apply the concept to a situation different from the worked example in the source.',
    },
    {
      id: 'analyse',
      label: 'Analyse',
      description: 'Draw connections, find patterns, break down information',
      verbExamples: ['compare', 'contrast', 'break down', 'examine', 'categorise'],
      activityTypes: ['comparison', 'pattern_finding', 'categorisation'],
      promptGuidance:
        'Create activities that ask the student to compare two things, find patterns, or break a complex problem into its parts.',
    },
    {
      id: 'evaluate',
      label: 'Evaluate',
      description: 'Justify a decision or course of action',
      verbExamples: ['justify', 'critique', 'argue', 'assess', 'decide'],
      activityTypes: ['justification', 'self_assessment', 'error_finding'],
      promptGuidance:
        'Create activities where the student defends their answer, checks whether a given solution is correct, or argues for an approach.',
    },
    {
      id: 'create',
      label: 'Create',
      description: 'Produce something new using knowledge',
      verbExamples: ['design', 'compose', 'construct', 'create', 'plan'],
      activityTypes: ['open_ended', 'project', 'creative_writing'],
      promptGuidance:
        'Create open-ended tasks where the student applies knowledge in an original way. No single correct answer.',
    },
  ],
  systemPrompt: `You are a primary-school curriculum designer applying Bloom's Taxonomy.
For the given content section, determine the appropriate Bloom's level (1–6) and generate structured learning activities.
Activities must match the cognitive demand of the assigned Bloom level.

CRITICAL RULES:
- NEVER provide direct answers to solvable problems.
- Every activity must have a Socratic hint that guides without solving.
- Every activity must have clear success criteria the student can self-check.
- Language must be simple and appropriate for ages 7–12.

Return ONLY a valid JSON object matching the provided schema. No markdown, no explanation.`,
  outputSchema: {
    type: 'object',
    required: ['sectionId', 'title', 'learningObjective', 'bloomLevel', 'prerequisiteKnowledge', 'activities', 'commonMisconceptions'],
    properties: {
      sectionId: { type: 'string' },
      title: { type: 'string' },
      learningObjective: { type: 'string', description: 'Starts with: By the end, students can...' },
      bloomLevel: { type: 'integer', minimum: 1, maximum: 6 },
      prerequisiteKnowledge: { type: 'string' },
      activities: {
        type: 'array',
        minItems: 2,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['type', 'instruction', 'hint', 'successCriteria'],
          properties: {
            type: { type: 'string', enum: ['recall', 'guided_practice', 'independent_practice', 'reflection', 'creative'] },
            instruction: { type: 'string' },
            hint: { type: 'string' },
            successCriteria: { type: 'string' },
          },
        },
      },
      commonMisconceptions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    },
  },
  evaluationRubric: [
    { id: 'objective_match', check: 'Does the learning objective match the source content?', required: true },
    { id: 'bloom_alignment', check: 'Are all activities at the stated Bloom level?', required: true },
    { id: 'age_appropriate', check: 'Is language and difficulty appropriate for primary school?', required: true },
    { id: 'no_direct_answers', check: 'No activity gives away a direct answer?', required: true },
    { id: 'has_hints', check: 'Every activity has a Socratic hint?', required: true },
    { id: 'has_success_criteria', check: 'Every activity has clear success criteria?', required: false },
  ],
  isActive: true,
  version: '1.0.0',
};

export const SEED_METHODS: Array<Omit<TeachingMethod, 'createdAt'>> = [
  BLOOMS_TAXONOMY,
];

export async function seedMethodsIfEmpty(): Promise<void> {
  const existing = await methodRegistry.getAllMethods();
  if (existing.length > 0) return;
  await Promise.all(SEED_METHODS.map((m) => methodRegistry.createMethod(m)));
}
