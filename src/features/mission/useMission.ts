import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRootStore } from '@/stores/rootStore';
import { generateMissionId } from '@/lib/utils';
import { aiAdapter, missionStorage } from '@/adapters';
import { buildModuleGenPrompt } from '@/lib/prompts';
import { moduleSchema } from '@/lib/validators';
import type { Mission, Module } from '@/types';

/** Subscribe to a single mission. Resolves once on load; mutations invalidate to refresh. */
export function useMission(missionId: string) {
  const profileId = useRootStore((s) => s.profileId);
  return useQuery({
    queryKey: ['mission', profileId, missionId],
    queryFn: () =>
      new Promise<Mission | null>((resolve) => {
        if (!profileId) return resolve(null);
        const unsub = missionStorage.subscribeMission(profileId, missionId, (m) => {
          resolve(m);
          unsub();
        });
      }),
    staleTime: Infinity,
    enabled: !!profileId && !!missionId,
  });
}

/** Subscribe to all missions for the active profile. */
export function useAllMissions() {
  const profileId = useRootStore((s) => s.profileId);
  return useQuery({
    queryKey: ['missions', profileId],
    queryFn: () =>
      new Promise<Mission[]>((resolve) => {
        if (!profileId) return resolve([]);
        const unsub = missionStorage.subscribeAllMissions(profileId, (ms) => {
          resolve(ms);
          unsub();
        });
      }),
    staleTime: Infinity,
    enabled: !!profileId,
  });
}

interface CreateMissionInput {
  ocrText: string;
  ocrEngine: 'tesseract' | 'google_vision';
  confidence: number;
}

export function useCreateMission() {
  const profileId = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: CreateMissionInput): Promise<string> => {
      if (!profileId) throw new Error('No profile selected');
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
  const profileId = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: GenerateModulesInput) => {
      if (!profileId) throw new Error('No profile selected');

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

      try {
        return await save(await tryGenerate(input.ocrText, input.model, 0.3));
      } catch {
        try {
          return await save(await tryGenerate(input.ocrText, input.model, 0.2));
        } catch {
          const fallback: Module[] = [
            { id: 1, title: 'Read the Problem',   goal: 'Understand what is being asked', hint: 'Read slowly and circle key words',              reflectionPrompt: 'What is the question asking for?', isComplete: false },
            { id: 2, title: 'Plan Your Solution', goal: 'Choose a strategy',               hint: 'Think about what operation or method to use', reflectionPrompt: 'What strategy will you try?',       isComplete: false },
            { id: 3, title: 'Solve and Check',    goal: 'Work through and verify',         hint: 'Do the work step by step',                   reflectionPrompt: 'Does your answer make sense?',   isComplete: false },
          ];
          await missionStorage.updateMission(profileId, input.missionId, {
            title: 'Untitled Mission',
            status: 'active',
            'aiAnalysis/model': input.model,
            'aiAnalysis/generatedAt': Date.now(),
            'aiAnalysis/modules': fallback,
          });
          return { missionTitle: 'Untitled Mission', modules: fallback };
        }
      }
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mission', profileId, input.missionId] });
    },
  });
}

interface CompleteMissionInput {
  missionId: string;
  modules: Module[];
}

export function useCompleteMission() {
  const queryClient = useQueryClient();
  const profileId = useRootStore((s) => s.profileId);

  return useMutation({
    mutationFn: async (input: CompleteMissionInput) => {
      if (!profileId) throw new Error('No profile selected');
      await missionStorage.updateMission(profileId, input.missionId, {
        status: 'completed',
        completedAt: Date.now(),
        'aiAnalysis/modules': input.modules,
      });
      const completedCount = input.modules.filter((m) => m.isComplete).length;
      return { badgeId: completedCount >= 5 ? 'mission_master' : 'first_win' };
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['mission', profileId, input.missionId] });
    },
  });
}
