import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ref, update } from 'firebase/database';
import { rtdb, auth } from '@/lib/firebase';
import { useMission, useCompleteMission } from '@/features/mission/useMission';
import ModuleChat from '@/features/mission/ModuleChat';
import ModuleReorder from '@/features/mission/ModuleReorder';
import MissionComplete from '@/features/mission/MissionComplete';
import { useRootStore } from '@/stores/rootStore';
import type { Module } from '@/types';

export default function MissionView() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const { data: mission, isLoading } = useMission(missionId || '');
  const completeMission = useCompleteMission();
  const { addBadge, unlockGadget } = useRootStore();

  const [chatOpen, setChatOpen] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [chatModule, setChatModule] = useState<{ id: number; title: string; goal: string } | null>(null);

  const openChat = (module?: { id: number; title: string; goal: string }) => {
    setChatModule(module || null);
    setChatOpen(true);
  };

  const toggleModule = async (moduleId: number, current: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!mission || !uid) return;
    const modules = mission.aiAnalysis.modules.map((m) =>
      m.id === moduleId ? { ...m, isComplete: !current } : m
    );
    await update(ref(rtdb, `mission_hq/missions/${uid}/${missionId}`), {
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
    setShowComplete(true);
  };

  const handleReorder = async (modules: Module[]) => {
    const uid = auth.currentUser?.uid;
    if (!mission || !uid) return;
    await update(ref(rtdb, `mission_hq/missions/${uid}/${missionId}`), {
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

  const modules = mission.aiAnalysis?.modules || [];
  const allComplete = modules.length > 0 && modules.every((m) => m.isComplete);
  const progress = modules.length > 0 ? Math.round((modules.filter((m) => m.isComplete).length / modules.length) * 100) : 0;

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
          modules.map((mod) => (
            <div
              key={mod.id}
              className={`rounded-2xl bg-surface p-4 border shadow-sm transition-opacity ${
                mod.isComplete ? 'opacity-60 border-green/30' : 'border-border'
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleModule(mod.id, mod.isComplete)}
                  className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                    mod.isComplete
                      ? 'border-green bg-green text-white'
                      : 'border-text-3'
                  }`}
                >
                  {mod.isComplete && '✓'}
                </button>
                <div className="flex-1">
                  <h3 className={`font-semibold ${mod.isComplete ? 'line-through text-text-3' : 'text-primary'}`}>
                    {mod.title}
                  </h3>
                  <p className="mt-1 text-sm text-text-2">{mod.goal}</p>
                  <p className="mt-1 text-xs text-text-3 italic">Hint: {mod.hint}</p>
                </div>
              </div>
              <button
                onClick={() => openChat({ id: mod.id, title: mod.title, goal: mod.goal })}
                className="mt-3 w-full rounded-lg bg-bg-2 py-2 text-xs font-semibold text-text-2 active:scale-[0.98]"
              >
                Ask for Help on This Step
              </button>
            </div>
          ))
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
