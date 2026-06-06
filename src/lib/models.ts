export interface LlmModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
}

export const AVAILABLE_MODELS: LlmModel[] = [
  {
    id: 'deepseek/deepseek-v4-flash:free',
    name: 'DeepSeek V4 Flash (Free)',
    provider: 'DeepSeek',
    description: 'Fast, highly capable — great default for homework help.',
    contextWindow: 1048576,
  },
  {
    id: 'anthropic/claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description: 'Best for complex reasoning and module generation.',
    contextWindow: 200000,
  },
  {
    id: 'google/gemma-4-31b-it:free',
    name: 'Gemma 4 31B (Free)',
    provider: 'Google',
    description: 'Strong vision and reasoning, completely free.',
    contextWindow: 128000,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Compact and efficient for everyday tasks.',
    contextWindow: 128000,
  },
  {
    id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    name: 'Nemotron 3 Nano Omni (Free)',
    provider: 'NVIDIA',
    description: 'Multimodal reasoning — text, image, audio. Free tier.',
    contextWindow: 300000,
  },
];

export const DEFAULT_MODEL_ID = 'deepseek/deepseek-v4-flash:free';
