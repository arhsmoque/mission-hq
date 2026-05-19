import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, push, set, remove, onValue } from 'firebase/database';
import { rtdb, auth } from '@/lib/firebase';
import { annotateChinese } from '@/lib/chinese';
import type { VocabEntry } from '@/types';

export function useVocabBank() {
  const uid = auth.currentUser?.uid;

  return useQuery({
    queryKey: ['vocab', uid],
    queryFn: () =>
      new Promise<VocabEntry[]>((resolve) => {
        if (!uid) return resolve([]);
        const unsub = onValue(ref(rtdb, `mission_hq/vocab/${uid}`), (snap) => {
          if (!snap.exists()) return resolve([]);
          const items = Object.entries(snap.val() as Record<string, Omit<VocabEntry, 'vocabId'>>)
            .map(([id, data]) => ({ vocabId: id, ...data } as VocabEntry))
            .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
          resolve(items);
        });
        return () => unsub();
      }),
    staleTime: Infinity,
    enabled: !!uid,
  });
}

interface SaveVocabInput {
  character: string;
  pinyin: string;
  malay: string;
  english: string;
  sourceMissionId?: string;
}

export function useSaveVocab() {
  const queryClient = useQueryClient();
  const uid = auth.currentUser?.uid;

  return useMutation({
    mutationFn: async (input: SaveVocabInput) => {
      if (!uid) throw new Error('Not authenticated');
      await set(push(ref(rtdb, `mission_hq/vocab/${uid}`)), {
        ...input,
        savedAt: Date.now(),
        reviewCount: 0,
        nextReview: Date.now(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', uid] });
    },
  });
}

export function useDeleteVocab() {
  const queryClient = useQueryClient();
  const uid = auth.currentUser?.uid;

  return useMutation({
    mutationFn: async (vocabId: string) => {
      if (!uid) throw new Error('Not authenticated');
      await remove(ref(rtdb, `mission_hq/vocab/${uid}/${vocabId}`));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vocab', uid] });
    },
  });
}

export function useAnnotateChinese() {
  return useMutation({
    mutationFn: async ({ text, model }: { text: string; model: string }) => {
      return annotateChinese(text, model);
    },
  });
}
