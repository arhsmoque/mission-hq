export interface LlmModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
}

export const AVAILABLE_MODELS: LlmModel[] = [
  {
    id: 'deepseek/deepseek-chat-v3-0324:free',
    name: 'DeepSeek V3 (Free)',
    provider: 'DeepSeek',
    description: 'Fast, capable general chat. Great for homework help.',
    contextWindow: 64000,
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Best for complex reasoning and module generation.',
    contextWindow: 200000,
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    provider: 'Google',
    description: 'Blazing fast, great for quick chat responses.',
    contextWindow: 1000000,
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Compact and efficient for everyday tasks.',
    contextWindow: 128000,
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
    description: 'Open model, strong instruction following.',
    contextWindow: 128000,
  },
];

export const DEFAULT_MODEL_ID = 'deepseek/deepseek-chat-v3-0324:free';
