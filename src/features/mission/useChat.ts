import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ref, push, set, onValue, query as dbQuery, orderByChild, limitToLast, get } from 'firebase/database';
import { rtdb, auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { callOpenRouter } from '@/lib/ai';
import { buildChatPrompt } from '@/lib/prompts';
import { sanitizeResponse } from '@/lib/safety';
import type { ChatMessage } from '@/types';

export function useChatMessages(missionId: string) {
  const user = useRootStore((s) => s.user);
  return useQuery({
    queryKey: ['chatMessages', user?.uid, missionId],
    queryFn: () =>
      new Promise<ChatMessage[]>((resolve) => {
        if (!user?.uid) return resolve([]);
        const chatsRef = ref(rtdb, `mission_hq/chats/${user.uid}/${missionId}`);
        const unsub = onValue(chatsRef, (snap) => {
          if (!snap.exists()) return resolve([]);
          const msgs = Object.entries(snap.val() as Record<string, Omit<ChatMessage, 'msgId'>>)
            .map(([id, data]) => ({ msgId: id, ...data } as ChatMessage))
            .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
          resolve(msgs);
        });
        return () => unsub();
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

      const chatsRef = ref(rtdb, `mission_hq/chats/${user.uid}/${input.missionId}`);

      await set(push(chatsRef), {
        role: 'user',
        content: input.content,
        moduleId: input.moduleId ?? null,
        gadgetUsed: input.gadgetContext || null,
        modelUsed: input.model,
        timestamp: Date.now(),
      });

      const snap = await get(dbQuery(chatsRef, orderByChild('timestamp'), limitToLast(10)));
      const lastMessages: { role: string; content: string }[] = [];
      if (snap.exists()) {
        Object.values(snap.val() as Record<string, Omit<ChatMessage, 'msgId'>>)
          .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
          .forEach((msg) => lastMessages.push({ role: msg.role, content: msg.content }));
      }

      const promptMessages = buildChatPrompt({
        ocrText: input.ocrText,
        moduleTitle: input.moduleTitle,
        moduleGoal: input.moduleGoal,
        gadgetContext: input.gadgetContext,
        lastMessages,
      });
      promptMessages.push({ role: 'user', content: input.content });

      const rawResponse = await callOpenRouter(promptMessages, input.model, 0.7);
      const safeResponse = sanitizeResponse(rawResponse, input.ocrText);

      await set(push(chatsRef), {
        role: 'assistant',
        content: safeResponse,
        moduleId: input.moduleId ?? null,
        gadgetUsed: input.gadgetContext || null,
        modelUsed: input.model,
        timestamp: Date.now(),
      });

      return { success: true };
    },
    onSuccess: (_, input) => {
      const uid = useRootStore.getState().user?.uid;
      queryClient.invalidateQueries({ queryKey: ['chatMessages', uid, input.missionId] });
    },
  });
}
