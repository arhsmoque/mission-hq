import type { ChatMessage } from '../openrouter';

export function buildChatPrompt(options: {
  ocrText: string;
  moduleTitle?: string;
  moduleGoal?: string;
  gadgetContext?: string;
  lastMessages: Array<{ role: string; content: string }>;
}): ChatMessage[] {
  const { ocrText, moduleTitle, moduleGoal, gadgetContext, lastMessages } = options;

  let systemPrompt = `You are a primary-school teaching assistant named Mission HQ. You help children aged 7-10 with their homework.

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
