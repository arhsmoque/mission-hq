import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { aiAdapter, chatStorage } from '@/adapters';
import { buildChatPrompt } from '@/lib/prompts';
import { sanitizeResponse } from '@/lib/safety';
import type { ChatMessage } from '@/types';

/** Subscribe to all chat messages for a mission. Resolves once; mutations invalidate to refresh. */
export function useChatMessages(missionId: string) {
  return useQuery({
    queryKey: ['chatMessages', missionId],
    queryFn: () =>
      new Promise<ChatMessage[]>((resolve) => {
        const unsub = chatStorage.subscribeMessages(missionId, (msgs) => {
          resolve(msgs);
          unsub();
        });
      }),
    staleTime: Infinity,
  });
}

interface SendMessageInput {
  missionId: string;
  moduleId?: number;
  moduleTitle?: string;
  moduleGoal?: string;
  content: string;
  gadgetContext?: string;
  model: string;
  ocrText: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!auth.currentUser) throw new Error('Not authenticated');

      const userMsg: Omit<ChatMessage, 'msgId'> = {
        role:      'user',
        content:   input.content,
        moduleId:  input.moduleId,
        gadgetUsed: input.gadgetContext,
        modelUsed: input.model,
        timestamp: Date.now(),
      };
      await chatStorage.addMessage(input.missionId, userMsg);

      const lastMessages = await chatStorage.getRecentMessages(input.missionId, 10);

      const promptMessages = buildChatPrompt({
        ocrText:     input.ocrText,
        moduleTitle: input.moduleTitle,
        moduleGoal:  input.moduleGoal,
        gadgetContext: input.gadgetContext,
        lastMessages,
      });
      promptMessages.push({ role: 'user', content: input.content });

      const rawResponse  = await aiAdapter.chat(promptMessages, input.model, 0.7);
      const safeResponse = sanitizeResponse(rawResponse, input.ocrText);

      const assistantMsg: Omit<ChatMessage, 'msgId'> = {
        role:      'assistant',
        content:   safeResponse,
        moduleId:  input.moduleId,
        gadgetUsed: input.gadgetContext,
        modelUsed: input.model,
        timestamp: Date.now(),
      };
      await chatStorage.addMessage(input.missionId, assistantMsg);

      return { success: true };
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', input.missionId] });
    },
  });
}
