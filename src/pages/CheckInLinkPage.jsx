import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarCheck, Check, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import { checkIn, dateInt, dateLabel, kstTime, monthOf, useMyAttendance } from '../attendance';

/** 휴대폰 카메라로 교실 QR을 찍으면 열리는 주소 (/checkin?c=반&k=코드) → 바로 출석 */
export default function CheckInLinkPage() {
  const [params] = useSearchParams();
  const { user, profile, isTeacher } = useAuth();
  const { classId } = useCurrentClass();
  const today = dateInt();
  const records = useMyAttendance(isTeacher ? null : user?.uid, monthOf(today));
  const mine = records.find((r) => r.date === today);
  const [state, setState] = useState({ step: 'wait' });
  const tried = useRef(false);
  const code = params.get('k') ?? '';
  const qrClass = params.get('c') ?? '';

  useEffect(() => {
    if (isTeacher || tried.current || !classId || !profile) return;
    tried.current = true;
    if (qrClass && qrClass !== classId) return setState({ step: 'fail', msg: '다른 반의 출석 QR이에요.' });
    if (!/^\d{6}$/.test(code)) return setState({ step: 'fail', msg: '출석 QR 주소가 올바르지 않아요.' });
    setState({ step: 'busy' });
    checkIn(classId, user.uid, profile, code)
      .then(() => setState({ step: 'ok' }))
      .catch((e) => setState({
        step: 'fail',
        msg: e.code === 'permission-denied' ? 'QR 시간이 지났거나 이미 기록이 있어요. 교실 화면의 지금 QR을 다시 찍어 주세요.' : `실패: ${e.code ?? e.message}`,
      }));
  }, [isTeacher, classId, profile, qrClass, code, user]);

  if (isTeacher) {
    return <section className="panel"><p>학생이 찍는 출석 QR 주소예요. 선생님은 <Link to="/attendance">출결</Link>에서 확인하세요.</p></section>;
  }
  if (!classId) return <section className="panel"><p className="muted">아직 반이 정해지지 않았어요. 선생님께 말씀드리세요.</p></section>;

  const done = mine && (state.step === 'ok' || state.step === 'fail' || state.step === 'wait');
  return (
    <section className="panel checkin-link">
      <h2><CalendarCheck size={20} className="h-icon" /> 출석 · {dateLabel(today)}</h2>
      {done ? (
        <p className="checkin-big ok"><Check size={40} /> 출석했어요{mine.checkedAt ? ` (${kstTime(mine.checkedAt)})` : ''}</p>
      ) : state.step === 'fail' ? (
        <>
          <p className="checkin-big bad"><X size={40} /> 출석하지 못했어요</p>
          <p className="error">{state.msg}</p>
        </>
      ) : (
        <p className="checkin-big">확인 중…</p>
      )}
      <Link className="btn" to="/">홈으로</Link>
    </section>
  );
}
