import { Link } from 'react-router-dom';
import { School } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';

// 반 선택 (교사 화면 위쪽)
export function ClassPicker() {
  const { isTeacher } = useAuth();
  const cls = useCurrentClass();
  if (!isTeacher || !cls || cls.classes.length === 0) return null;
  return (
    <label className="class-picker" title="학급운영 기능을 쓸 반">
      <School size={16} />
      <select value={cls.classId} onChange={(e) => cls.setClassId(e.target.value)} aria-label="반 선택">
        {cls.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </label>
  );
}

// 반이 정해져 있어야 쓸 수 있는 화면을 감쌈
export default function ClassGate({ children }) {
  const { isTeacher } = useAuth();
  const cls = useCurrentClass();
  if (!cls || cls.loading) return <div className="muted">불러오는 중…</div>;
  if (!cls.classId) {
    return (
      <section className="panel empty">
        <School size={32} strokeWidth={1.5} />
        {isTeacher ? (
          <>
            <p>먼저 반을 만들어 주세요. 학급운영 기능은 반 단위로 쓰여요.</p>
            <Link className="btn primary" to="/teacher/classes">반 관리로 가기</Link>
          </>
        ) : (
          <p>아직 반이 정해지지 않았어요. 선생님이 반에 넣어 주면 쓸 수 있어요.</p>
        )}
      </section>
    );
  }
  return children;
}
