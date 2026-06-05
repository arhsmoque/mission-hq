import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { aiAdapter, chatStorage } from '@/adapters';
import { buildChatPrompt } from '@/lib/prompts';
import { sanitizeResponse } from '@/lib/safety';
import type { ChatMessage } from '@/types';

/** Subscribe to all chat messages for a mission. Resolves once; mutations invalidate to refresh. */
export function useChatMessages(missionId: string) {
  const user = useRootStore((s) => s.user);
  return useQuery({
    queryKey: ['chatMessages', user?.uid, missionId],
    queryFn: () =>
      new Promise<ChatMessage[]>((resolve) => {
        if (!user?.uid) return resolve([]);
        const unsub = chatStorage.subscribeMessages(user.uid, missionId, (msgs) => {
          resolve(msgs);
          unsub();
        });
      }),
    staleTime: Infinity,
    enabled: !!user?.uid && !!missionId,
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
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!auth.currentUser || !user?.uid) throw new Error('Not authenticated');

      const userMsg: Omit<ChatMessage, 'msgId'> = {
        role:      'user',
        content:   input.content,
        moduleId:  input.moduleId ?? undefined,
        gadgetUsed: input.gadgetContext || undefined,
        modelUsed: input.model,
        timestamp: Date.now(),
      };
      await chatStorage.addMessage(user.uid, input.missionId, userMsg);

      const lastMessages = await chatStorage.getRecentMessages(user.uid, input.missionId, 10);

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
        moduleId:  input.moduleId ?? undefined,
        gadgetUsed: input.gadgetContext || undefined,
        modelUsed: input.model,
        timestamp: Date.now(),
      };
      await chatStorage.addMessage(user.uid, input.missionId, assistantMsg);

      return { success: true };
    },
    onSuccess: (_, input) => {
      const uid = useRootStore.getState().user?.uid;
      queryClient.invalidateQueries({ queryKey: ['chatMessages', uid, input.missionId] });
    },
  });
}
