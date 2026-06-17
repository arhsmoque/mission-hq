import { ref, get, set } from 'firebase/database';
import { rtdb } from '@/lib/firebase';

const PIN_PATH = (uid: string) => `mission_hq/parentConfigs/${uid}/pinHash`;

const DEFAULT_PIN = '240514';

export async function hashPin(pin: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPin(uid: string, input: string): Promise<boolean> {
  const inputHash = await hashPin(input);
  const snap = await get(ref(rtdb, PIN_PATH(uid)));
  if (!snap.exists()) {
    return inputHash === await hashPin(DEFAULT_PIN);
  }
  return inputHash === (snap.val() as string);
}

export async function changePinHash(uid: string, newPin: string): Promise<void> {
  await set(ref(rtdb, PIN_PATH(uid)), await hashPin(newPin));
}
