import type { Module } from '@/types';

interface RawGeneratedModule {
  id?: number | null;
  title: string;
  goal: string;
  hint: string;
  example?: string | null;
  reflectionPrompt: string;
}

interface RawGeneratedMission {
  missionTitle: string;
  modules: RawGeneratedModule[];
}

function cleanText(value: string | null | undefined, fallback: string, maxLength = 500): string {
  const cleaned = (value ?? '').replace(/\s+/g, ' ').trim();
  return (cleaned || fallback).slice(0, maxLength);
}

function makeModule(input: {
  id: number;
  title: string;
  goal: string;
  hint: string;
  example?: string | null;
  reflectionPrompt: string;
}): Module {
  const mod: Module = {
    id: input.id,
    title: cleanText(input.title, `Step ${input.id}`, 200),
    goal: cleanText(input.goal, 'Understand this part of the worksheet.'),
    hint: cleanText(input.hint, 'Look for the key words before you start.'),
    reflectionPrompt: cleanText(input.reflectionPrompt, 'What did you learn from this step?'),
    isComplete: false,
  };

  const example = input.example?.replace(/\s+/g, ' ').trim();
  if (example) mod.example = example.slice(0, 1000);

  return mod;
}

export function normalizeGeneratedMission(result: RawGeneratedMission): {
  missionTitle: string;
  modules: Module[];
} {
  const modules = result.modules.map((m, idx) =>
    makeModule({
      id: typeof m.id === 'number' && m.id > 0 ? m.id : idx + 1,
      title: m.title,
      goal: m.goal,
      hint: m.hint,
      example: m.example,
      reflectionPrompt: m.reflectionPrompt,
    })
  );

  return {
    missionTitle: cleanText(result.missionTitle, 'Homework Mission', 200),
    modules,
  };
}

export function buildBasicMissionFromOcr(ocrText: string): {
  missionTitle: string;
  modules: Module[];
} {
  const compact = ocrText.replace(/\s+/g, ' ').trim();
  const isChinese = /[\u3400-\u9fff]/.test(compact);
  const isMath = /\b(add|subtract|multiply|divide|sum|total|fraction|number|equation)\b|\d+\s*[+\-x*/=]/i.test(compact);
  const isLanguage = isChinese || /\b(read|write|sentence|grammar|vocabulary|karangan|perkataan|pinyin)\b/i.test(compact);

  let missionTitle = 'Homework Mission';
  if (isChinese) missionTitle = 'Chinese Practice Mission';
  else if (isMath) missionTitle = 'Maths Practice Mission';
  else if (isLanguage) missionTitle = 'Language Practice Mission';

  const keyLine = compact.slice(0, 180);
  const subjectHint = keyLine || 'the worksheet';

  const modules: Module[] = [
    makeModule({
      id: 1,
      title: 'Read the Task',
      goal: `Understand what ${subjectHint} is asking you to do.`,
      hint: 'Read slowly and underline important words, numbers, or instructions.',
      reflectionPrompt: 'What is the task asking for?',
    }),
    makeModule({
      id: 2,
      title: isMath ? 'Choose a Method' : 'Find the Clues',
      goal: isMath
        ? 'Decide which operation or strategy fits the question.'
        : 'Pick out the words, examples, or clues that help you answer.',
      hint: isMath
        ? 'Look for words like total, left, each, more, fewer, or equal.'
        : 'Match each question with the part of the text that gives a clue.',
      reflectionPrompt: isMath
        ? 'Why does this method fit the question?'
        : 'Which clue helped you most?',
    }),
    makeModule({
      id: 3,
      title: 'Try and Check',
      goal: 'Finish the work one step at a time and check that it makes sense.',
      hint: 'After each answer, ask: does this fit the question?',
      reflectionPrompt: 'What did you check before calling it done?',
    }),
  ];

  if (compact.length > 500) {
    modules.splice(2, 0, makeModule({
      id: 3,
      title: 'Break It Into Parts',
      goal: 'Split the worksheet into smaller groups so it feels manageable.',
      hint: 'Do one section first, then move to the next.',
      reflectionPrompt: 'Which part should you finish first?',
    }));
    return {
      missionTitle,
      modules: modules.map((m, idx) => ({ ...m, id: idx + 1 })),
    };
  }

  return { missionTitle, modules };
}
