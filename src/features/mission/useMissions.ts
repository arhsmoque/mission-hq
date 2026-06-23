import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import type { Mission } from '@/types';

export function useMissions() {
  const userUid   = useRootStore((s) => s.user?.uid);
  const profileId = useRootStore((s) => s.profileId);
  const [missions,  setMissions]  = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userUid || !profileId) return;
    const unsub = onValue(ref(rtdb, `mission_hq/missions/${profileId}`), (snap) => {
      if (!snap.exists()) {
        setMissions([]);
        setIsLoading(false);
        return;
      }
      const items = Object.entries(snap.val() as Record<string, Omit<Mission, 'missionId'>>)
        .map(([id, data]) => ({ missionId: id, ...data } as Mission))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      setMissions(items);
      setIsLoading(false);
    });
    return unsub;
  }, [userUid, profileId]);

  return { data: missions, isLoading };
}
