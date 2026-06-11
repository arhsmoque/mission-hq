import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRootStore } from '@/stores/rootStore';
import { generateMissionId } from '@/lib/utils';
import { aiAdapter, missionStorage } from '@/adapters';
import { buildModuleGenPrompt } from '@/lib/prompts';
import { moduleSchema } from '@/lib/validators';
import { buildBasicMissionFromOcr, normalizeGeneratedMission } from './missionGeneration';
import type { Mission, Module } from '@/types';

/** Subscribe to a single mission. Resolves once on load; mutations invalidate to refresh. */
export function useMission(missionId: string) {
  const user = useRootStore((s) => s.user);
  return useQuery({
    queryKey: ['mission', user?.uid, missionId],
    queryFn: () =>
      new Promise<Mission | null>((resolve) => {
        if (!user?.uid) return resolve(null);
        const unsub = missionStorage.subscribeMission(user.uid, missionId, (m) => {
          resolve(m);
          unsub();
        });
      }),
    staleTime: Infinity,
    enabled: !!user?.uid && !!missionId,
  });
}

/** Subscribe to all missions for the active user. */
export function useAllMissions() {
  const user = useRootStore((s) => s.user);
  return useQuery({
    queryKey: ['missions', user?.uid],
    queryFn: () =>
      new Promise<Mission[]>((resolve) => {
        if (!user?.uid) return resolve([]);
        const unsub = missionStorage.subscribeAllMissions(user.uid, (ms) => {
          resolve(ms);
          unsub();
        });
      }),
    staleTime: Infinity,
    enabled: !!user?.uid,
  });
}

interface CreateMissionInput {
  ocrText: string;
  ocrEngine: 'tesseract' | 'google_vision' | 'vision_llm';
  confidence: number;
}

export function useCreateMission() {
  const user = useRootStore((s) => s.user);
  const profileId = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: CreateMissionInput): Promise<string> => {
      if (!user?.uid) throw new Error('Not authenticated');
      const missionId = generateMissionId();
      await missionStorage.createMission(user.uid, missionId, {
        profileId: profileId ?? '',
        title: 'Untitled Mission',
        client: 'Cikgu',
        status: 'pending',
        ocrText: input.ocrText,
        ocrEngine: input.ocrEngine,
        aiAnalysis: { model: '', generatedAt: Date.now(), modules: [] },
        parentReviewed: false,
        estimatedDurationMinutes: 15,
        createdAt: Date.now(),
      });
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
  const rawResponse = await aiAdapter.chat(promptMessages, model, temperature);
  const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
  const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawResponse);
  const validated = moduleSchema.parse(parsed);
  return normalizeGeneratedMission(validated);
}

export function useGenerateModules() {
  const queryClient = useQueryClient();
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: GenerateModulesInput) => {
      if (!user?.uid) throw new Error('Not authenticated');

      const save = async (result: { missionTitle: string; modules: Module[] }) => {
        await missionStorage.updateMission(user.uid, input.missionId, {
          title: result.missionTitle,
          status: 'active',
          'aiAnalysis/model': input.model,
          'aiAnalysis/generatedAt': Date.now(),
          'aiAnalysis/modules': result.modules,
        });
        return result;
      };

      const attempts = [
        () => tryGenerate(input.ocrText, input.model, 0.3),
        () => tryGenerate(input.ocrText, input.model, 0.2),
      ];

      for (const attempt of attempts) {
        try {
          return await save(await attempt());
        } catch (err) {
          console.warn('AI mission generation attempt failed:', err);
        }
      }

      return await save(buildBasicMissionFromOcr(input.ocrText));
    },
    onSuccess: (_, input) => {
      const uid = useRootStore.getState().user?.uid;
      queryClient.invalidateQueries({ queryKey: ['mission', uid, input.missionId] });
    },
  });
}

interface CompleteMissionInput {
  missionId: string;
  modules: Module[];
}

export function useCompleteMission() {
  const queryClient = useQueryClient();
  const user = useRootStore((s) => s.user);

  return useMutation({
    mutationFn: async (input: CompleteMissionInput) => {
      if (!user?.uid) throw new Error('Not authenticated');
      await missionStorage.updateMission(user.uid, input.missionId, {
        status: 'completed',
        completedAt: Date.now(),
        'aiAnalysis/modules': input.modules,
      });
      const completedCount = input.modules.filter((m) => m.isComplete).length;
      return { badgeId: completedCount >= 5 ? 'mission_master' : 'first_win' };
    },
    onSuccess: (_, input) => {
      const uid = useRootStore.getState().user?.uid;
      queryClient.invalidateQueries({ queryKey: ['mission', uid, input.missionId] });
    },
  });
}
