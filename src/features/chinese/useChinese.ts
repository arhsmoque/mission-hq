import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ref, push, set, remove, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { annotateChinese } from '@/lib/chinese';
import type { VocabEntry } from '@/types';

export function useVocabBank() {
  const user = useRootStore((s) => s.user);

  return useQuery({
    queryKey: ['vocab', user?.uid],
    queryFn: () =>
      new Promise<VocabEntry[]>((resolve) => {
        if (!user?.uid) return resolve([]);
        const unsub = onValue(ref(rtdb, `mission_hq/vocab/${user.uid}`), (snap) => {
          if (!snap.exists()) return resolve([]);
          const items = Object.entries(snap.val() as Record<string, Omit<VocabEntry, 'vocabId'>>)
            .map(([id, data]) => ({ vocabId: id, ...data } as VocabEntry))
            .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
          resolve(items);
        });
        return () => unsub();
      }),
    staleTime: Infinity,
    enabled: !!user?.uid,
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
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: SaveVocabInput) => {
      if (!user?.uid) throw new Error('Not authenticated');
      await set(push(ref(rtdb, `mission_hq/vocab/${user.uid}`)), {
        ...input,
        savedAt: Date.now(),
        reviewCount: 0,
        nextReview: Date.now(),
      });
    },
    onSuccess: () => {
      const uid = useRootStore.getState().user?.uid;
      queryClient.invalidateQueries({ queryKey: ['vocab', uid] });
    },
  });
}

export function useDeleteVocab() {
  const queryClient = useQueryClient();
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (vocabId: string) => {
      if (!user?.uid) throw new Error('Not authenticated');
      await remove(ref(rtdb, `mission_hq/vocab/${user.uid}/${vocabId}`));
    },
    onSuccess: () => {
      const uid = useRootStore.getState().user?.uid;
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
