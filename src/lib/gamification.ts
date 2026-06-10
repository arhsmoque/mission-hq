import { ref, set, get, update } from 'firebase/database';
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

export async function getXP(uid: string): Promise<number> {
  const snap = await get(ref(rtdb, `mission_hq/progress/${uid}/xp`));
  return snap.exists() ? (snap.val() as number) : 0;
}

export async function addXP(uid: string, amount: number): Promise<number> {
  const current = await getXP(uid);
  const next    = current + amount;
  await update(ref(rtdb, `mission_hq/progress/${uid}`), { xp: next, updatedAt: Date.now() });
  return next;
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
