import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * 교실 화면 출석 코드 (QR)
 * checkinCodes/{classId} { code, issuedAt, prevCode, prevIssuedAt, teacherUid } — 교사만 읽고 씀
 * - 교사 화면이 20초마다 새 6자리 코드를 만듦. 코드는 만든 때(서버 시각)부터 45초 동안 유효
 *   → 방금 바뀐 직전 코드도 잠깐 받아 줌. 코드 확인은 보안 규칙이 함 (학생은 코드를 읽을 수 없음)
 * classes/{id}.checkInOpen  true 면 코드 없이도 출석 체크 허용 (선생님 출장 등)
 */
export const ROTATE_MS = 20000;
export const CODE_LIFE_S = 45;

const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');

// QR 안에 들어가는 주소: 폰 카메라로 찍으면 사이트가 열리고 바로 출석
export const checkInUrl = (classId, code) => `${window.location.origin}/checkin?c=${encodeURIComponent(classId)}&k=${code}`;

// 출석 QR 주소 또는 6자리 코드에서 { classId, code } 읽기
export function parseCheckIn(text) {
  const t = String(text ?? '').trim();
  if (/^\d{6}$/.test(t)) return { classId: null, code: t };
  try {
    const u = new URL(t);
    const code = u.searchParams.get('k') ?? '';
    if (u.pathname === '/checkin' && /^\d{6}$/.test(code)) return { classId: u.searchParams.get('c'), code };
  } catch {
    /* 주소가 아님 */
  }
  return null;
}

// 교사: 화면이 열려 있는 동안 코드를 계속 바꿈 → { code, left(다음 코드까지 초) }
export function useRotatingCode(classId, teacherUid) {
  const [code, setCode] = useState('');
  const [left, setLeft] = useState(ROTATE_MS / 1000);
  const [err, setErr] = useState('');
  const last = useRef(null); // 서버에 저장된 지금 코드 { code, issuedAt }
  const ref = classId ? doc(db, 'checkinCodes', classId) : null;

  useEffect(() => {
    if (!ref) return undefined;
    let stopped = false;
    let nextAt = 0;
    const unsub = onSnapshot(ref, (s) => {
      const d = s.data();
      if (d?.issuedAt && d.code) last.current = { code: d.code, issuedAt: d.issuedAt };
    }, () => {});
    const rotate = async () => {
      const c = newCode();
      nextAt = Date.now() + ROTATE_MS;
      const prev = last.current;
      try {
        await setDoc(ref, {
          code: c, issuedAt: serverTimestamp(), teacherUid,
          prevCode: prev?.code ?? '', prevIssuedAt: prev?.issuedAt ?? null,
        });
        if (!stopped) {
          setCode(c);
          setErr('');
        }
      } catch (e) {
        if (!stopped) setErr(`코드를 저장하지 못했어요: ${e.code ?? e.message}`);
      }
    };
    rotate();
    const tick = setInterval(() => {
      const ms = nextAt - Date.now();
      if (ms <= 0) rotate();
      else setLeft(Math.ceil(ms / 1000));
    }, 250);
    return () => {
      stopped = true;
      clearInterval(tick);
      unsub();
      // 화면을 닫으면 코드를 바로 못 쓰게
      updateDoc(ref, { code: '', prevCode: '' }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, teacherUid]);

  return { code, left, err };
}

export const setCheckInOpen = (classId, open) => updateDoc(doc(db, 'classes', classId), { checkInOpen: open });
