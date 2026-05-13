import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { APP_CONFIG } from '@/config';

const firebaseConfig = APP_CONFIG.firebase;

export const app = initializeApp(firebaseConfig, 'mission-hq');
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectDatabaseEmulator(rtdb, 'localhost', 9000);
}
