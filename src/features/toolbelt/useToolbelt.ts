export const GADGETS = [
  {
    id: 'hint_machine',
    name: 'Hint Machine',
    icon: '💡',
    description: 'Provides subtle nudges when stuck',
    unlockAt: 0, // unlocked from start
  },
  {
    id: 'vocab_definer',
    name: 'Vocab Definer',
    icon: '📖',
    description: 'Explains unknown words instantly',
    unlockAt: 3, // after 3 missions
  },
  {
    id: 'first_sentence_starter',
    name: 'First Sentence Starter',
    icon: '✍️',
    description: 'Helps with writing blocks',
    unlockAt: 5,
  },
  {
    id: 'error_spotter',
    name: 'Error Spotter',
    icon: '🔍',
    description: 'Points out mistakes without fixing them',
    unlockAt: 8,
  },
  {
    id: 'joke_break',
    name: 'Joke Break',
    icon: '😄',
    description: 'A quick funny break to reset your brain',
    unlockAt: 12,
  },
  {
    id: 'fun_fact',
    name: 'Fun Fact',
    icon: '🤯',
    description: 'Interesting facts related to the topic',
    unlockAt: 15,
  },
] as const;

export type GadgetId = typeof GADGETS[number]['id'];

export const PERSONALITIES = [
  { id: 'encourager', name: 'Encourager', description: 'Cheerful and supportive' },
  { id: 'step_by_step', name: 'Step-by-Step Guide', description: 'Methodical and clear' },
  { id: 'socratic', name: 'Socratic', description: 'Asks guiding questions' },
] as const;

export function getGadgetContext(gadgetId: string): string {
  switch (gadgetId) {
    case 'hint_machine':
      return 'Provide a subtle hint. Do NOT give the answer. Guide the child toward discovering it themselves.';
    case 'vocab_definer':
      return 'Explain any difficult words simply. Use Malay or English examples if helpful.';
    case 'first_sentence_starter':
      return 'Help the child start their answer by suggesting the first sentence or first few words only.';
    case 'error_spotter':
      return 'Point out where a mistake might be, but do NOT correct it. Ask the child to find and fix it.';
    case 'joke_break':
      return 'Tell a short, clean, age-appropriate joke related to the subject. Then gently return to the task.';
    case 'fun_fact':
      return 'Share one interesting fun fact related to the topic. Keep it under 2 sentences.';
    default:
      return '';
  }
}
