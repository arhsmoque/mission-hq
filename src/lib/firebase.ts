import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyB8j-jHo2N341ieW4AVCdPL3ipn4Ss8sYQ',
  authDomain: 'ash-2026-photobook.firebaseapp.com',
  databaseURL: 'https://ash-2026-photobook-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'ash-2026-photobook',
  storageBucket: 'ash-2026-photobook.firebasestorage.app',
  messagingSenderId: '328228907150',
  appId: '1:328228907150:web:fb4d2780b40bb8403ec1df',
};

export const app = initializeApp(firebaseConfig, 'mission-hq');
export const auth = getAuth(app);
export const rtdb = getDatabase(app);

if (import.meta.env.DEV) {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  connectDatabaseEmulator(rtdb, 'localhost', 9000);
}
