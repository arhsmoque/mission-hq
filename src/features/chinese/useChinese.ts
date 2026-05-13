import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { annotateChinese } from '@/lib/chinese';
import type { VocabEntry } from '@/types';

export function useVocabBank() {
  const uid = auth.currentUser?.uid;

  return useQuery({
    queryKey: ['vocab', uid],
    queryFn: () =>
      new Promise<VocabEntry[]>((resolve) => {
        if (!uid) return resolve([]);
        const q = query(
          collection(db, 'users', uid, 'vocab'),
          orderBy('savedAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
          const items = snap.docs.map((d) => ({ vocabId: d.id, ...d.data() } as VocabEntry));
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
      await addDoc(collection(db, 'users', uid, 'vocab'), {
        ...input,
        savedAt: serverTimestamp(),
        reviewCount: 0,
        nextReview: serverTimestamp(),
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
      await deleteDoc(doc(db, 'users', uid, 'vocab', vocabId));
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
