import { ref, set, get } from 'firebase/database';
import { rtdb } from './firebase';

export function persistGamification(
  uid: string,
  badges: string[],
  gadgets: string[]
) {
  return set(ref(rtdb, `mission_hq/progress/${uid}`), {
    badges,
    gadgets,
    updatedAt: Date.now(),
  });
}

export async function loadGamificationOnce(
  uid: string
): Promise<{ badges: string[]; gadgets: string[] } | null> {
  const snap = await get(ref(rtdb, `mission_hq/progress/${uid}`));
  if (!snap.exists()) return null;
  const data = snap.val();
  return {
    badges: data.badges ?? [],
    gadgets: data.gadgets ?? ['hint_machine'],
  };
}
