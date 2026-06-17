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

import { LESSON_ACTIVITY_TYPES } from '@/types';
import type { TeachingMethod } from '@/types';
import { methodRegistry } from '@/adapters';

const SEED_DONE_KEY = 'mhq_methods_seeded_v2'; // bumped to v2 to re-seed CPA + 5E on existing deployments

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
            type: { type: 'string', enum: [...LESSON_ACTIVITY_TYPES] },
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

const CPA_APPROACH: Omit<TeachingMethod, 'createdAt'> = {
  methodId: 'cpa_approach',
  name: 'Concrete-Pictorial-Abstract (CPA)',
  description:
    'A Singapore Math-aligned three-phase approach. Students first explore with physical objects (Concrete), then represent with diagrams and bar models (Pictorial), then work with symbols and equations (Abstract). Highly effective for primary maths.',
  framework: 'constructivist',
  ageRange: { min: 6, max: 13 },
  applicableSubjects: ['maths'],
  phases: [
    {
      id: 'concrete',
      label: 'Concrete',
      description: 'Use physical objects to model the problem',
      verbExamples: ['count', 'group', 'arrange', 'build', 'share'],
      activityTypes: ['manipulative', 'real_world_object'],
      promptGuidance:
        'Ask the student to find household objects (coins, beans, Lego bricks, paper clips) to physically model the numbers or groups in the problem. Describe the activity in exact, child-friendly steps.',
    },
    {
      id: 'pictorial',
      label: 'Pictorial',
      description: 'Draw bar models, dots, or diagrams',
      verbExamples: ['draw', 'sketch', 'model', 'represent', 'show'],
      activityTypes: ['bar_model', 'diagram', 'number_line'],
      promptGuidance:
        'Guide the student to draw a bar model, dots, or part-whole diagram representing the concrete objects they just used. Be explicit: "Draw a long bar for the whole, divide it into parts…"',
    },
    {
      id: 'abstract',
      label: 'Abstract',
      description: 'Translate to numbers, symbols, and equations',
      verbExamples: ['write', 'calculate', 'solve', 'express', 'record'],
      activityTypes: ['equation', 'number_sentence', 'algorithm'],
      promptGuidance:
        'Ask the student to convert their diagram into a number sentence or equation (e.g. 3 + 4 = 7). The transition from drawing to symbols should feel natural, not abrupt.',
    },
  ],
  systemPrompt: `You are a Singapore Math curriculum designer applying the Concrete-Pictorial-Abstract (CPA) framework.
For the given content section, generate exactly THREE activities — one per phase: Concrete, Pictorial, Abstract.

CRITICAL RULES:
- NEVER give the answer directly. Each activity must guide the student to discover it.
- The Concrete phase must name specific household objects the child can find right now.
- The Pictorial phase must give step-by-step drawing instructions (bar model, number line, or dots).
- The Abstract phase converts the drawing to a number sentence or equation.
- Language must be simple and appropriate for primary school ages 7–12.
- Every activity must have a Socratic hint and clear success criteria.

Return ONLY a valid JSON object matching the provided schema. No markdown, no explanation.`,
  outputSchema: {
    type: 'object',
    required: ['sectionId', 'title', 'learningObjective', 'prerequisiteKnowledge', 'activities', 'commonMisconceptions'],
    properties: {
      sectionId: { type: 'string' },
      title: { type: 'string' },
      learningObjective: { type: 'string', description: 'Starts with: By the end, students can...' },
      prerequisiteKnowledge: { type: 'string' },
      activities: {
        type: 'array',
        minItems: 3,
        maxItems: 3,
        items: {
          type: 'object',
          required: ['type', 'instruction', 'hint', 'successCriteria'],
          properties: {
            type: { type: 'string', enum: [...LESSON_ACTIVITY_TYPES] },
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
    { id: 'three_phases', check: 'Are there exactly three activities (Concrete, Pictorial, Abstract) in sequence?', required: true },
    { id: 'concrete_uses_objects', check: 'Does the Concrete activity name specific physical objects the child can find at home?', required: true },
    { id: 'pictorial_has_drawing_steps', check: 'Does the Pictorial activity give step-by-step drawing instructions?', required: true },
    { id: 'abstract_has_equation', check: 'Does the Abstract activity ask for a number sentence or equation?', required: true },
    { id: 'no_direct_answers', check: 'No activity gives away the direct answer?', required: true },
    { id: 'age_appropriate', check: 'Is language and difficulty appropriate for primary school?', required: true },
  ],
  isActive: true,
  version: '1.0.0',
};

const FIVE_E_INQUIRY: Omit<TeachingMethod, 'createdAt'> = {
  methodId: 'five_e_inquiry',
  name: '5E Inquiry Model',
  description:
    'A science and language comprehension framework structuring lessons into five phases: Engage (hook curiosity), Explore (hands-on investigation), Explain (define concepts), Elaborate (extend to new situations), Evaluate (self-check). Particularly effective for KBSR/KSSR science and comprehension passages.',
  framework: 'inquiry',
  ageRange: { min: 7, max: 14 },
  applicableSubjects: ['science', 'english', 'malay', 'history', 'geography'],
  phases: [
    {
      id: 'engage',
      label: 'Engage',
      description: 'Hook curiosity with a puzzling question or scenario',
      verbExamples: ['wonder', 'question', 'predict', 'notice', 'ask'],
      activityTypes: ['riddle', 'scenario', 'observation'],
      promptGuidance:
        'Open with a puzzling real-world scenario, riddle, or question that connects to the section topic and sparks genuine curiosity. Do not explain — just provoke.',
    },
    {
      id: 'explore',
      label: 'Explore',
      description: 'Hands-on or text-based investigation',
      verbExamples: ['search', 'investigate', 'find', 'observe', 'discover'],
      activityTypes: ['text_hunt', 'observation', 'experiment_steps'],
      promptGuidance:
        'Direct the child to search the page text or diagram for specific clues, or perform a simple home experiment. Give precise steps. No answers yet.',
    },
    {
      id: 'explain',
      label: 'Explain',
      description: 'Define the concept in the student\'s own words',
      verbExamples: ['define', 'describe', 'explain', 'summarise', 'state'],
      activityTypes: ['definition', 'paraphrase', 'summary'],
      promptGuidance:
        'Use a Socratic question to guide the student to state the concept in their own words. Avoid echo questions ("Is photosynthesis…?") — use open prompts ("What do you think is happening when…?").',
    },
    {
      id: 'elaborate',
      label: 'Elaborate',
      description: 'Apply concept to a new, slightly different situation',
      verbExamples: ['apply', 'extend', 'connect', 'predict', 'transfer'],
      activityTypes: ['application', 'prediction', 'connection'],
      promptGuidance:
        'Present a situation that is related to the concept but different from the example in the source text. Ask the student to predict or explain what would happen.',
    },
    {
      id: 'evaluate',
      label: 'Evaluate',
      description: 'Quick self-check of understanding',
      verbExamples: ['check', 'review', 'reflect', 'assess', 'confirm'],
      activityTypes: ['self_check', 'reflection', 'exit_ticket'],
      promptGuidance:
        'Provide a simple self-check question or reflection prompt the student can answer without assistance. This should be achievable after completing the previous four phases.',
    },
  ],
  systemPrompt: `You are a primary-school curriculum designer applying the 5E Inquiry Model.
For the given content section, generate exactly FIVE activities — one per phase: Engage, Explore, Explain, Elaborate, Evaluate. The phases must appear in order.

CRITICAL RULES:
- NEVER provide direct answers. Every phase should guide, not tell.
- Engage must open with curiosity — a riddle, a real-world puzzle, or a provocative question. No explanations yet.
- Explore must give the child something concrete to do: search the text, observe something, or do a simple home experiment.
- Explain must use a Socratic question so the child defines the concept themselves.
- Elaborate must use a NEW situation not covered in the source material.
- Evaluate must be achievable without further help — a simple self-check.
- Language must be simple and appropriate for ages 7–14.
- Every activity must have a Socratic hint and clear success criteria.

Return ONLY a valid JSON object matching the provided schema. No markdown, no explanation.`,
  outputSchema: {
    type: 'object',
    required: ['sectionId', 'title', 'learningObjective', 'prerequisiteKnowledge', 'activities', 'commonMisconceptions'],
    properties: {
      sectionId: { type: 'string' },
      title: { type: 'string' },
      learningObjective: { type: 'string', description: 'Starts with: By the end, students can...' },
      prerequisiteKnowledge: { type: 'string' },
      activities: {
        type: 'array',
        minItems: 5,
        maxItems: 5,
        items: {
          type: 'object',
          required: ['type', 'instruction', 'hint', 'successCriteria'],
          properties: {
            type: { type: 'string', enum: [...LESSON_ACTIVITY_TYPES] },
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
    { id: 'five_phases_in_order', check: 'Are there exactly five activities in Engage→Explore→Explain→Elaborate→Evaluate order?', required: true },
    { id: 'engage_is_hook', check: 'Does Engage open with curiosity (riddle, puzzle, or provocative question) without explaining the concept?', required: true },
    { id: 'explore_is_active', check: 'Does Explore give a hands-on or text-search task with concrete steps?', required: true },
    { id: 'explain_uses_socratic', check: 'Does Explain use a Socratic question so the child defines the concept themselves?', required: true },
    { id: 'elaborate_uses_new_situation', check: 'Does Elaborate present a situation not found in the source material?', required: true },
    { id: 'evaluate_is_self_checkable', check: 'Is Evaluate achievable without further help after completing the other phases?', required: true },
    { id: 'no_direct_answers', check: 'No phase gives away a direct answer?', required: true },
    { id: 'age_appropriate', check: 'Is language and difficulty appropriate for primary school?', required: true },
  ],
  isActive: true,
  version: '1.0.0',
};

export const SEED_METHODS: Array<Omit<TeachingMethod, 'createdAt'>> = [
  BLOOMS_TAXONOMY,
  CPA_APPROACH,
  FIVE_E_INQUIRY,
];

export async function seedMethodsIfEmpty(): Promise<void> {
  if (localStorage.getItem(SEED_DONE_KEY)) return;
  const existing = await methodRegistry.getAllMethods();
  if (existing.length > 0) {
    localStorage.setItem(SEED_DONE_KEY, '1');
    return;
  }
  await Promise.all(SEED_METHODS.map((m) => methodRegistry.createMethod(m)));
  localStorage.setItem(SEED_DONE_KEY, '1');
}
