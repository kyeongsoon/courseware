import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

// 값은 .env.local 에서 읽어옵니다 (.env.example 참고).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey) {
  console.error('Firebase 설정이 비어 있습니다. .env.example 을 복사해 .env.local 을 만들어 주세요.');
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Cloud Functions 는 서울 리전(asia-northeast3)에 배포
export const functions = getFunctions(app, 'asia-northeast3');
// 로컬 테스트: VITE_USE_EMULATOR=true 이면 실제 프로젝트 대신 Firebase 에뮬레이터 사용
export const useEmulator = import.meta.env.VITE_USE_EMULATOR === 'true';
export const AUTH_EMULATOR_URL = 'http://127.0.0.1:9099';
if (useEmulator) {
  connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
