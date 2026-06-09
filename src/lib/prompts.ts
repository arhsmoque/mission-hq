import type { ChatMessage } from './ai';
import type { AIChatMessage } from '@/ports/ai-port';
import type { EvaluationCriteria } from '@/types';

export function buildChatPrompt(options: {
  ocrText: string;
  moduleTitle?: string;
  moduleGoal?: string;
  gadgetContext?: string;
  lastMessages: Array<{ role: string; content: string }>;
}): ChatMessage[] {
  const { ocrText, moduleTitle, moduleGoal, gadgetContext, lastMessages } = options;

  let systemPrompt = `You are a primary-school teaching assistant named Mission Room. You help children aged 7-10 with their homework.

CRITICAL RULES:
- NEVER give direct answers to solvable academic questions.
- Use Socratic questioning, hints, and step breakdowns only.
- Be encouraging, patient, and use simple language.
- If the child is stuck, break the problem into smaller parts.
- Do not say "As an AI" or "I cannot help with homework".

CURRENT WORKSHEET CONTEXT:
${ocrText.slice(0, 2000)}
`;

  if (moduleTitle && moduleGoal) {
    systemPrompt += `\nCURRENT MODULE: ${moduleTitle}\nMODULE GOAL: ${moduleGoal}\n`;
  }

  if (gadgetContext) {
    systemPrompt += `\nACTIVE GADGET: ${gadgetContext}\n`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ];

  for (const msg of lastMessages.slice(-10)) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  return messages;
}

export function buildModuleGenPrompt(ocrText: string, subjectHint = 'mixed'): ChatMessage[] {
  const systemPrompt = `You are a primary-school teaching assistant. You break homework into small, achievable steps. You NEVER give direct answers. You use encouraging, simple language suitable for a 7-10 year old.

Break the following homework text into logical, numbered modules. Each module must be completable in 5-10 minutes.

Respond ONLY with a JSON object. No markdown, no explanation, no preamble.

JSON format:
{
  "missionTitle": "string",
  "client": "Cikgu",
  "modules": [
    {
      "id": number,
      "title": "string (action-oriented, starts with a verb)",
      "goal": "string (what the child will understand after this step)",
      "hint": "string (subtle nudge, never the answer)",
      "example": "string | null",
      "reflectionPrompt": "string (one question to check understanding)"
    }
  ]
}

CONSTRAINTS:
- NEVER provide the solution to a solvable problem.
- If the worksheet is in Chinese, keep Chinese terms but explain concepts simply.
- Minimum 3 modules, maximum 8 modules.
- Each title must start with a verb.
`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Subject hint: ${subjectHint}\n\nOCR Text:\n${ocrText.slice(0, 3000)}` },
  ];
}

export function buildChinesePrompt(text: string, mode: 'pinyin' | 'translate' | 'both'): ChatMessage[] {
  const instruction =
    mode === 'pinyin'
      ? 'Add pinyin annotation to the following Chinese text using HTML ruby tags (<ruby><rt>...</rt></ruby>). Return ONLY the annotated HTML, no explanation.'
      : mode === 'translate'
      ? 'Translate the following Chinese text into Malay and English. Return ONLY a JSON object: {"malay": "...", "english": "..."}'
      : 'For the following Chinese text: (1) Add pinyin using HTML ruby tags, (2) Provide Malay and English translations. Return ONLY a JSON object: {"pinyinAnnotated": "<ruby>...</ruby>", "translations": {"malay": "...", "english": "..."}}';


  return [
    { role: 'system', content: 'You are a Chinese language tutor for Malaysian primary school students.' },
    { role: 'user', content: `${instruction}\n\nText: ${text}` },
  ];
}

// ── Teaching Method Engine prompts ─────────────────────────────────────────

export function buildLessonActivityPrompt(options: {
  systemPrompt:    string;
  sectionTitle:    string;
  sectionId:       string;
  sectionMarkdown: string;
  outputSchema:    Record<string, unknown>;
}): AIChatMessage[] {
  const { systemPrompt, sectionTitle, sectionId, sectionMarkdown, outputSchema } = options;
  return [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content:
        `Title: ${sectionTitle}\nSection ID: ${sectionId}\n\n` +
        `OUTPUT SCHEMA (return JSON exactly matching this):\n${JSON.stringify(outputSchema, null, 2)}\n\n` +
        `CONTENT (extracted from textbook):\n${sectionMarkdown.slice(0, 5000)}`,
    },
  ];
}

export function buildEvaluationPrompt(options: {
  rubric:        EvaluationCriteria[];
  activitiesJson: string;
  sectionTitle:  string;
}): AIChatMessage[] {
  const { rubric, activitiesJson, sectionTitle } = options;
  const rubricText = rubric
    .map((r, i) => `${i + 1}. [${r.required ? 'REQUIRED' : 'optional'}] ${r.check}`)
    .join('\n');

  return [
    {
      role: 'system',
      content:
        'You are a curriculum quality evaluator for Malaysian primary school materials (ages 7–12).\n' +
        'Evaluate the lesson activities against the rubric.\n' +
        'Return ONLY valid JSON: { "overallPass": boolean, "issues": string[] }\n' +
        'overallPass = true only when ALL required checks pass.\n' +
        'issues = specific problems found (empty array if none).',
    },
    {
      role: 'user',
      content:
        `Section: ${sectionTitle}\n\nRUBRIC:\n${rubricText}\n\nGENERATED ACTIVITIES:\n${activitiesJson}`,
    },
  ];
}
