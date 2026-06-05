/**
 * ai.ts — backward-compatibility shim.
 *
 * New code should import from '@/adapters' directly:
 *   import { aiAdapter } from '@/adapters';
 *   await aiAdapter.chat(messages, model);
 *
 * This shim exists so existing callers of callOpenRouter() keep working
 * without changes while the codebase migrates to the adapter pattern.
 */

export type { AIChatMessage as ChatMessage } from '@/ports/ai-port';
import { aiAdapter } from '@/adapters';
import type { AIChatMessage } from '@/ports/ai-port';

export async function callOpenRouter(
  messages: AIChatMessage[],
  model: string,
  temperature = 0.7
): Promise<string> {
  return aiAdapter.chat(messages, model, temperature);
}
