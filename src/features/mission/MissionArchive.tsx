import { useQuery } from '@tanstack/react-query';
import { ref, onValue } from 'firebase/database';
import { rtdb, auth } from '@/lib/firebase';
import type { Mission } from '@/types';

export default function MissionArchive() {
  const uid = auth.currentUser?.uid;

  const { data: missions = [], isLoading } = useQuery({
    queryKey: ['missions', uid],
    queryFn: () =>
      new Promise<Mission[]>((resolve) => {
        if (!uid) return resolve([]);
        const unsub = onValue(ref(rtdb, `mission_hq/missions/${uid}`), (snap) => {
          if (!snap.exists()) return resolve([]);
          const items = Object.entries(snap.val() as Record<string, any>)
            .map(([id, data]) => ({ missionId: id, ...data } as Mission))
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          resolve(items);
        });
        return () => unsub();
      }),
    staleTime: Infinity,
    enabled: !!uid,
  });

  const active = missions.filter((m) => m.status === 'active');
  const completed = missions.filter((m) => m.status === 'completed');

  if (isLoading) return <p className="text-text-3">Loading missions...</p>;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="font-semibold text-primary mb-3">
          Active Missions ({active.length})
        </h3>
        {active.length === 0 && (
          <p className="text-sm text-text-3">No active missions. Start one!</p>
        )}
        <div className="space-y-2">
          {active.map((m) => (
            <div
              key={m.missionId}
              className="rounded-xl bg-surface p-4 border border-border"
            >
              <p className="font-semibold text-primary">{m.title}</p>
              <p className="text-xs text-text-3">
                {m.aiAnalysis?.modules?.filter((mod) => mod.isComplete).length || 0} /{' '}
                {m.aiAnalysis?.modules?.length || 0} steps done
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-primary mb-3">
          Completed ({completed.length})
        </h3>
        {completed.length === 0 && (
          <p className="text-sm text-text-3">No completed missions yet.</p>
        )}
        <div className="space-y-2">
          {completed.map((m) => (
            <div
              key={m.missionId}
              className="rounded-xl bg-bg-2 p-4 border border-border opacity-70"
            >
              <p className="font-semibold text-text-2">{m.title}</p>
              <p className="text-xs text-text-3">Mission accomplished!</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
