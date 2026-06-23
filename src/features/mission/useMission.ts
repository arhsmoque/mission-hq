import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRootStore } from '@/stores/rootStore';
import { generateMissionId } from '@/lib/utils';
import { aiAdapter, missionStorage } from '@/adapters';
import { buildModuleGenPrompt } from '@/lib/prompts';
import { moduleSchema } from '@/lib/validators';
import { buildBasicMissionFromOcr, normalizeGeneratedMission } from './missionGeneration';
import type { Mission, Module } from '@/types';

/** Subscribe to a single mission in real-time. */
export function useMission(missionId: string) {
  const userUid   = useRootStore((s) => s.user?.uid);
  const profileId = useRootStore((s) => s.profileId);
  const [mission,   setMission]   = useState<Mission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userUid || !profileId || !missionId) return;
    const unsub = missionStorage.subscribeMission(profileId, missionId, (m) => {
      setMission(m);
      setIsLoading(false);
    });
    return unsub;
  }, [userUid, profileId, missionId]);

  return { data: mission, isLoading };
}

/** Subscribe to all missions for the active profile in real-time. */
export function useAllMissions() {
  const userUid   = useRootStore((s) => s.user?.uid);
  const profileId = useRootStore((s) => s.profileId);
  const [missions,  setMissions]  = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userUid || !profileId) return;
    const unsub = missionStorage.subscribeAllMissions(profileId, (ms) => {
      setMissions(ms);
      setIsLoading(false);
    });
    return unsub;
  }, [userUid, profileId]);

  return { data: missions, isLoading };
}

interface CreateMissionInput {
  ocrText: string;
  ocrEngine: 'tesseract' | 'google_vision' | 'vision_llm';
  confidence: number;
}

export function useCreateMission() {
  const user      = useRootStore((s) => s.user);
  const profileId = useRootStore((s) => s.profileId);
  return useMutation({
    mutationFn: async (input: CreateMissionInput): Promise<string> => {
      if (!user?.uid || !profileId) throw new Error('Not authenticated');
      const missionId = generateMissionId();
      await missionStorage.createMission(profileId, missionId, {
        profileId,
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
  const user        = useRootStore((s) => s.user);
  const profileId   = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: GenerateModulesInput) => {
      if (!user?.uid || !profileId) throw new Error('Not authenticated');

      const save = async (result: { missionTitle: string; modules: Module[] }) => {
        await missionStorage.updateMission(profileId, input.missionId, {
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
      const pid = useRootStore.getState().profileId;
      queryClient.invalidateQueries({ queryKey: ['mission', pid, input.missionId] });
    },
  });
}

interface CompleteMissionInput {
  missionId: string;
  modules: Module[];
}

export function useCompleteMission() {
  const queryClient = useQueryClient();
  const user        = useRootStore((s) => s.user);
  const profileId   = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: CompleteMissionInput) => {
      if (!user?.uid || !profileId) throw new Error('Not authenticated');
      await missionStorage.updateMission(profileId, input.missionId, {
        status: 'completed',
        completedAt: Date.now(),
        'aiAnalysis/modules': input.modules,
      });
      const completedCount = input.modules.filter((m) => m.isComplete).length;
      return { badgeId: completedCount >= 5 ? 'mission_master' : 'first_win' };
    },
    onSuccess: (_, input) => {
      const pid = useRootStore.getState().profileId;
      queryClient.invalidateQueries({ queryKey: ['mission', pid, input.missionId] });
    },
  });
}
