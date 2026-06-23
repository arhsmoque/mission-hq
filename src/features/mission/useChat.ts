import { useMutation, useQueryClient } from '@tanstack/react-query';
import { auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { aiAdapter, chatStorage } from '@/adapters';
import { buildChatPrompt } from '@/lib/prompts';
import { sanitizeResponse } from '@/lib/safety';
import type { ChatMessage } from '@/types';
import { useState, useEffect } from 'react';

/** Subscribe to all chat messages for a mission in real-time. */
export function useChatMessages(missionId: string) {
  const userUid   = useRootStore((s) => s.user?.uid);
  const profileId = useRootStore((s) => s.profileId);
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userUid || !profileId || !missionId) return;
    const unsub = chatStorage.subscribeMessages(profileId, missionId, (msgs) => {
      setMessages(msgs);
      setIsLoading(false);
    });
    return unsub;
  }, [userUid, profileId, missionId]);

  return { data: messages, isLoading };
}

interface SendMessageInput {
  missionId: string;
  moduleId?: number;
  moduleTitle?: string;
  moduleGoal?: string;
  content: string;
  gadgetContext?: string;
  tutoringPolicyContext?: string;
  revealAuthorized?: boolean;
  model: string;
  ocrText: string;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const user        = useRootStore((s) => s.user);
  const profileId   = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      if (!auth.currentUser || !user?.uid || !profileId) throw new Error('Not authenticated');

      const userMsg: Omit<ChatMessage, 'msgId'> = {
        role:       'user',
        content:    input.content,
        moduleId:   input.moduleId ?? undefined,
        gadgetUsed: input.gadgetContext || undefined,
        modelUsed:  input.model,
        timestamp:  Date.now(),
      };
      await chatStorage.addMessage(profileId, input.missionId, userMsg);

      const lastMessages = await chatStorage.getRecentMessages(profileId, input.missionId, 10);

      const promptMessages = buildChatPrompt({
        ocrText:               input.ocrText,
        moduleTitle:           input.moduleTitle,
        moduleGoal:            input.moduleGoal,
        gadgetContext:         input.gadgetContext,
        tutoringPolicyContext: input.tutoringPolicyContext,
        lastMessages,
      });
      promptMessages.push({ role: 'user', content: input.content });

      const rawResponse  = await aiAdapter.chat(promptMessages, input.model, 0.7);
      const safeResponse = input.revealAuthorized
        ? rawResponse
        : sanitizeResponse(rawResponse, input.ocrText);

      const assistantMsg: Omit<ChatMessage, 'msgId'> = {
        role:       'assistant',
        content:    safeResponse,
        moduleId:   input.moduleId ?? undefined,
        gadgetUsed: input.gadgetContext || undefined,
        modelUsed:  input.model,
        timestamp:  Date.now(),
      };
      await chatStorage.addMessage(profileId, input.missionId, assistantMsg);

      return { success: true };
    },
    onSuccess: (_, input) => {
      const pid = useRootStore.getState().profileId;
      queryClient.invalidateQueries({ queryKey: ['chatMessages', pid, input.missionId] });
    },
  });
}
