import { useQuery } from '@tanstack/react-query';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import type { Mission } from '@/types';

export function useMissions() {
  const profileId = useRootStore((s) => s.profileId);
  return useQuery({
    queryKey: ['missions', profileId],
    queryFn: () =>
      new Promise<Mission[]>((resolve) => {
        if (!profileId) return resolve([]);
        const unsub = onValue(ref(rtdb, `mission_hq/missions/${profileId}`), (snap) => {
          if (!snap.exists()) return resolve([]);
          const items = Object.entries(snap.val() as Record<string, Omit<Mission, 'missionId'>>)
            .map(([id, data]) => ({ missionId: id, ...data } as Mission))
            .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          resolve(items);
        });
        return () => unsub();
      }),
    staleTime: Infinity,
    enabled: !!profileId,
  });
}
