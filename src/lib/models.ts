export interface LlmModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
}

export const AVAILABLE_MODELS: LlmModel[] = [
  {
    id:            'gemini-2.5-flash',
    name:          'Gemini 2.5 Flash',
    provider:      'Google',
    description:   'Fast, multimodal — great default for homework help.',
    contextWindow: 1_000_000,
  },
  {
    id:            'gemini-2.5-pro',
    name:          'Gemini 2.5 Pro',
    provider:      'Google',
    description:   'Most capable — best for complex reasoning and module generation.',
    contextWindow: 1_000_000,
  },
  {
    id:            'gemini-2.0-flash',
    name:          'Gemini 2.0 Flash',
    provider:      'Google',
    description:   'Fastest response — efficient for routine chat tasks.',
    contextWindow: 1_000_000,
  },
  {
    id:            'gemini-2.5-pro-preview',
    name:          'Gemini 2.5 Pro',
    provider:      'Google',
    description:   'Most capable on AI Studio — best for complex reasoning.',
    contextWindow: 1_000_000,
  },
];

export const DEFAULT_MODEL_ID = 'gemini-2.5-flash';
