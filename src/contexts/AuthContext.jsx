import { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

const AuthContext = createContext(null);

/**
 * Firestore users/{uid} 문서 구조
 * {
 *   uid, email, displayName,
 *   studentId: '30215' | null,   // 학번 (학년+반+번호)
 *   role: 'student' | 'teacher', // 교사 권한은 콘솔에서 직접 부여
 *   createdAt, lastLoginAt
 * }
 */
async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: extra.displayName ?? user.displayName ?? '',
      studentId: extra.studentId ?? null,
      role: 'student', // 보안 규칙상 스스로는 student 로만 생성 가능
      createdAt: serverTimestamp(),
      lastLoginAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth 사용자
  const [profile, setProfile] = useState(null); // Firestore 프로필
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile = () => {};
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      unsubProfile();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      // 프로필 문서를 실시간 구독 (교사가 role 을 바꾸면 즉시 반영)
      unsubProfile = onSnapshot(
        doc(db, 'users', u.uid),
        (snap) => {
          setProfile(snap.exists() ? snap.data() : null);
          setLoading(false);
        },
        (err) => {
          console.error('프로필 구독 오류', err);
          setLoading(false);
        },
      );
    });
    return () => {
      unsubProfile();
      unsubAuth();
    };
  }, []);

  const loginWithGoogle = async () => {
    const { user } = await signInWithPopup(auth, googleProvider);
    await ensureUserDoc(user);
  };

  const loginWithEmail = async (email, password) => {
    const { user } = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserDoc(user);
  };

  const signupWithEmail = async ({ email, password, displayName, studentId }) => {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(user, { displayName });
    await ensureUserDoc(user, { displayName, studentId });
  };

  const completeProfile = async ({ displayName, studentId }) => {
    await updateDoc(doc(db, 'users', user.uid), { displayName, studentId });
  };

  const resetPassword = (email) => sendPasswordResetEmail(auth, email);
  const logout = () => signOut(auth);

  const value = {
    user,
    profile,
    loading,
    isTeacher: profile?.role === 'teacher',
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    completeProfile,
    resetPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
