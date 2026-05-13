import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  onSnapshot,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { callOpenRouter } from '@/lib/ai';
import { buildChatPrompt } from '@/lib/prompts';
import { sanitizeResponse } from '@/lib/safety';
import type { ChatMessage } from '@/types';

export function useChatMessages(missionId: string) {
  return useQuery({
    queryKey: ['chatMessages', missionId],
    queryFn: () =>
      new Promise<ChatMessage[]>((resolve) => {
        const q = query(
          collection(db, 'chats', missionId, 'messages'),
          orderBy('timestamp', 'asc')
        );
        const unsub = onSnapshot(q, (snap) => {
          const msgs = snap.docs.map((d) => ({ msgId: d.id, ...d.data() } as ChatMessage));
          resolve(msgs);
        });
        return () => unsub();
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

      // Write user message to Firestore
      await addDoc(collection(db, 'chats', input.missionId, 'messages'), {
        role: 'user',
        content: input.content,
        moduleId: input.moduleId ?? null,
        gadgetUsed: input.gadgetContext || null,
        modelUsed: input.model,
        timestamp: serverTimestamp(),
      });

      // Fetch last messages for context
      const q = query(
        collection(db, 'chats', input.missionId, 'messages'),
        orderBy('timestamp', 'desc'),
        limit(10)
      );
      const snap = await getDocs(q);
      const lastMessages = snap.docs.map((d) => d.data() as { role: string; content: string }).reverse();

      // Build prompt and call OpenRouter
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

      // Write assistant message to Firestore
      await addDoc(collection(db, 'chats', input.missionId, 'messages'), {
        role: 'assistant',
        content: safeResponse,
        moduleId: input.moduleId ?? null,
        gadgetUsed: input.gadgetContext || null,
        modelUsed: input.model,
        timestamp: serverTimestamp(),
      });

      return { success: true };
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', input.missionId] });
    },
  });
}
