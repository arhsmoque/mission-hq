import { OpenRouter } from '@openrouter/sdk';

export const orClient = new OpenRouter({
  apiKey: import.meta.env.VITE_OPENROUTER_KEY || '',
  httpReferer: 'https://mission-hq.web.app',
  appTitle: 'Mission HQ',
});
