import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMission, useCompleteMission } from '@/features/mission/useMission';
import { missionStorage } from '@/adapters';
import ModuleChat from '@/features/mission/ModuleChat';
import ModuleReorder from '@/features/mission/ModuleReorder';
import MissionComplete from '@/features/mission/MissionComplete';
import { useRootStore } from '@/stores/rootStore';
import { persistGamification } from '@/lib/gamification';
import type { Module } from '@/types';

export default function MissionView() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const { data: mission, isLoading } = useMission(missionId || '');
  const completeMission = useCompleteMission();
  const { addBadge, unlockGadget, user, profileId } = useRootStore();
  const userUid = user?.uid;

  const [chatOpen, setChatOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [chatModule, setChatModule] = useState<{ id: number; title: string; goal: string } | null>(null);

  const openChat = (module?: { id: number; title: string; goal: string }) => {
    setChatModule(module || null);
    setChatOpen(true);
  };

  const toggleModule = async (moduleId: number, current: boolean) => {
    if (!mission || !userUid || !profileId || !missionId) return;
    const existing = mission.aiAnalysis?.modules;
    if (!Array.isArray(existing)) return;
    const modules = existing.map((m) =>
      m.id === moduleId ? { ...m, isComplete: !current } : m
    );
    await missionStorage.updateMission(profileId, missionId, {
      'aiAnalysis/modules': modules,
    });
    if (modules.every((m) => m.isComplete) && !showComplete) {
      handleComplete(modules);
    }
  };

  const handleComplete = async (modules: Module[]) => {
    const result = await completeMission.mutateAsync({ missionId: missionId!, modules });
    addBadge(result.badgeId);
    unlockGadget('vocab_definer');
    if (profileId) {
      const state = useRootStore.getState();
      persistGamification(profileId, state.earnedBadges, state.unlockedGadgets);
    }
    setShowComplete(true);
  };

  const handleReorder = async (modules: Module[]) => {
    if (!mission || !userUid || !profileId || !missionId) return;
    await missionStorage.updateMission(profileId, missionId, {
      'aiAnalysis/modules': modules,
    });
  };

  if (!missionId) return null;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-text-3">
        Loading mission...
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="p-6">
        <button onClick={() => navigate(-1)} className="mb-4 text-text-2">Back</button>
        <p className="text-text-3">Mission not found.</p>
      </div>
    );
  }

  const NODE_COLORS = ['#fda4af', '#86efac', '#7dd3fc'] as const;

  const rawModules = mission.aiAnalysis?.modules;
  const modules: Module[] = Array.isArray(rawModules) ? rawModules : [];
  const allComplete = modules.length > 0 && modules.every((m) => m.isComplete);
  const progress = modules.length > 0
    ? Math.round((modules.filter((m) => m.isComplete).length / modules.length) * 100)
    : 0;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-text-2">
        Back
      </button>

      <h1 className="font-display text-2xl font-black text-primary">
        {mission.title}
      </h1>
      <p className="text-text-3 mt-1">Client: {mission.client}</p>

      <div className="mt-4 h-3 w-full rounded-full bg-bg-2 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-text-3 text-right">{progress}% complete</p>

      {allComplete && (
        <div className="mt-4 rounded-2xl bg-green/10 p-4 text-center text-green font-bold">
          Mission Accomplished! 🎉
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => openChat()}
          className="flex-1 rounded-xl bg-bg-2 py-3 font-semibold text-text active:scale-[0.98]"
        >
          Ask about this mission
        </button>
        <button
          onClick={() => setReorderMode(!reorderMode)}
          className={`rounded-xl px-4 py-3 font-semibold active:scale-[0.98] ${
            reorderMode ? 'bg-accent text-white' : 'bg-bg-2 text-text'
          }`}
        >
          {reorderMode ? 'Done' : 'Reorder'}
        </button>
      </div>

      <div className="mt-6 space-y-3">
        <h2 className="font-semibold text-text-2 text-sm uppercase tracking-wide">
          Steps ({modules.filter((m) => m.isComplete).length}/{modules.length})
        </h2>

        {modules.length === 0 && (
          <p className="text-text-3">No modules yet. The AI is still thinking...</p>
        )}

        {reorderMode ? (
          <ModuleReorder modules={modules} onReorder={handleReorder} />
        ) : (
          modules.map((mod, index) => {
            const nodeColor = NODE_COLORS[index % 3];
            const isLast = index === modules.length - 1;
            return (
              <div key={mod.id} className="flex gap-3">
                {/* Node + vertical connector */}
                <div className="flex flex-col items-center flex-shrink-0 pt-1">
                  <button
                    onClick={() => toggleModule(mod.id, mod.isComplete)}
                    style={{
                      borderColor: nodeColor,
                      backgroundColor: mod.isComplete ? nodeColor : 'transparent',
                      color: mod.isComplete ? '#000' : nodeColor,
                      boxShadow: mod.isComplete
                        ? `0 0 0 3px ${nodeColor}33, 0 0 14px ${nodeColor}44`
                        : 'none',
                    }}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all duration-300"
                  >
                    {mod.isComplete ? '✓' : index + 1}
                  </button>
                  {!isLast && (
                    <div
                      className="w-px flex-1 min-h-6 mt-1 transition-colors duration-500"
                      style={{
                        backgroundColor: mod.isComplete
                          ? `${nodeColor}44`
                          : 'rgba(255,255,255,0.06)',
                      }}
                    />
                  )}
                </div>

                {/* Content card */}
                <div className="flex-1 pb-5">
                  <div
                    className={`rounded-2xl bg-surface p-4 border transition-opacity duration-300 ${mod.isComplete ? 'opacity-50' : ''}`}
                    style={{
                      borderColor: mod.isComplete
                        ? `${nodeColor}22`
                        : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <h3 className={`font-semibold ${mod.isComplete ? 'line-through text-text-3' : 'text-primary'}`}>
                      {mod.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-2">{mod.goal}</p>
                    <p className="mt-1 text-xs text-text-3 italic">Hint: {mod.hint}</p>
                    <button
                      onClick={() => openChat({ id: mod.id, title: mod.title, goal: mod.goal })}
                      className="mt-3 w-full rounded-lg bg-bg-2 py-2 text-xs font-semibold text-text-2 active:scale-[0.98]"
                    >
                      Ask for Help on This Step
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {chatOpen && (
        <ModuleChat
          missionId={missionId}
          moduleId={chatModule?.id}
          moduleTitle={chatModule?.title}
          moduleGoal={chatModule?.goal}
          ocrText={mission.ocrText}
          onClose={() => setChatOpen(false)}
        />
      )}

      {showComplete && (
        <MissionComplete
          onClose={() => {
            setShowComplete(false);
            navigate('/');
          }}
          badgeUnlocked={completeMission.data?.badgeId}
          gadgetUnlocked="vocab_definer"
        />
      )}
    </div>
  );
}
