import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { generateMissionId } from '@/lib/utils';
import { callOpenRouter } from '@/lib/ai';
import { buildModuleGenPrompt } from '@/lib/prompts';
import { moduleSchema } from '@/lib/validators';
import type { Mission, Module } from '@/types';

export function useMission(missionId: string) {
  return useQuery({
    queryKey: ['mission', missionId],
    queryFn: () =>
      new Promise<Mission | null>((resolve) => {
        const unsub = onSnapshot(doc(db, 'missions', missionId), (snap) => {
          if (!snap.exists()) resolve(null);
          else resolve({ missionId: snap.id, ...snap.data() } as Mission);
        });
        return () => unsub();
      }),
    staleTime: Infinity,
  });
}

interface CreateMissionInput {
  file: File;
  ocrText: string;
  ocrEngine: 'tesseract' | 'google_vision';
  confidence: number;
}

export function useCreateMission() {
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CreateMissionInput): Promise<string> => {
      if (!user) throw new Error('Not authenticated');

      const missionId = generateMissionId();
      const storageRef = ref(storage, `missions/${user.uid}/${missionId}/${input.file.name}`);
      await uploadBytes(storageRef, input.file);
      const fileUrl = await getDownloadURL(storageRef);

      const missionData: Omit<Mission, 'missionId'> = {
        uid: user.uid,
        title: 'Untitled Mission',
        client: 'Cikgu',
        status: 'pending',
        fileUrl,
        ocrText: input.ocrText,
        ocrEngine: input.ocrEngine,
        aiAnalysis: {
          model: '',
          generatedAt: serverTimestamp() as any,
          modules: [],
        },
        parentReviewed: false,
        estimatedDurationMinutes: 15,
        createdAt: serverTimestamp() as any,
      };

      await setDoc(doc(collection(db, 'missions'), missionId), missionData);
      return missionId;
    },
  });
}

interface GenerateModulesInput {
  missionId: string;
  ocrText: string;
  model: string;
}

async function tryGenerate(ocrText: string, model: string, temperature: number) {
  const promptMessages = buildModuleGenPrompt(ocrText);
  const rawResponse = await callOpenRouter(promptMessages, model, temperature);

  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);

  const validated = moduleSchema.parse(parsed);

  const modules: Module[] = validated.modules.map((m, idx) => ({
    id: m.id ?? idx + 1,
    title: m.title,
    goal: m.goal,
    hint: m.hint,
    example: m.example ?? undefined,
    reflectionPrompt: m.reflectionPrompt,
    isComplete: false,
  }));

  return { missionTitle: validated.missionTitle, modules };
}

export function useGenerateModules() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: GenerateModulesInput) => {
      // Try with temperature 0.3 first
      try {
        const result = await tryGenerate(input.ocrText, input.model, 0.3);
        await setDoc(
          doc(db, 'missions', input.missionId),
          {
            title: result.missionTitle,
            status: 'active',
            'aiAnalysis.model': input.model,
            'aiAnalysis.generatedAt': serverTimestamp(),
            'aiAnalysis.modules': result.modules,
          },
          { merge: true }
        );
        return result;
      } catch {
        // Retry with temperature 0.2
        try {
          const result = await tryGenerate(input.ocrText, input.model, 0.2);
          await setDoc(
            doc(db, 'missions', input.missionId),
            {
              title: result.missionTitle,
              status: 'active',
              'aiAnalysis.model': input.model,
              'aiAnalysis.generatedAt': serverTimestamp(),
              'aiAnalysis.modules': result.modules,
            },
            { merge: true }
          );
          return result;
        } catch {
          // Fallback to generic 3-step module
          const fallbackModules: Module[] = [
            { id: 1, title: 'Read the Problem', goal: 'Understand what is being asked', hint: 'Read slowly and circle key words', example: undefined, reflectionPrompt: 'What is the question asking for?', isComplete: false },
            { id: 2, title: 'Plan Your Solution', goal: 'Choose a strategy', hint: 'Think about what operation or method to use', example: undefined, reflectionPrompt: 'What strategy will you try?', isComplete: false },
            { id: 3, title: 'Solve and Check', goal: 'Work through and verify', hint: 'Do the work step by step', example: undefined, reflectionPrompt: 'Does your answer make sense?', isComplete: false },
          ];
          await setDoc(
            doc(db, 'missions', input.missionId),
            {
              title: 'Untitled Mission',
              status: 'active',
              'aiAnalysis.model': input.model,
              'aiAnalysis.generatedAt': serverTimestamp(),
              'aiAnalysis.modules': fallbackModules,
            },
            { merge: true }
          );
          return { missionTitle: 'Untitled Mission', modules: fallbackModules };
        }
      }
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mission', input.missionId] });
    },
  });
}

interface CompleteMissionInput {
  missionId: string;
  modules: Module[];
}

export function useCompleteMission() {
  const queryClient = useQueryClient();
  const { user } = useRootStore();

  return useMutation({
    mutationFn: async (input: CompleteMissionInput) => {
      if (!user) throw new Error('Not authenticated');

      // Update mission status
      await setDoc(
        doc(db, 'missions', input.missionId),
        {
          status: 'completed',
          completedAt: serverTimestamp(),
          'aiAnalysis.modules': input.modules,
        },
        { merge: true }
      );

      // Award badge (simple logic for now)
      const completedCount = input.modules.filter((m) => m.isComplete).length;
      const badgeId = completedCount >= 5 ? 'mission_master' : 'first_win';

      return { badgeId };
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mission', input.missionId] });
    },
  });
}
