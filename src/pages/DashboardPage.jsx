import { Link } from 'react-router-dom';
import { BookOpen, KeyRound, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudents } from '../useStudents';

function TeacherHome() {
  const { students, loading } = useStudents();
  const pending = students.filter((s) => s.mustChangePassword).length;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon"><Users size={20} /></span>
          <div><div className="stat-label">전체 학생</div><div className="stat-value">{loading ? '…' : `${students.length}명`}</div></div>
        </div>
        <div className="stat">
          <span className="stat-icon warn"><KeyRound size={20} /></span>
          <div><div className="stat-label">첫 비밀번호 변경 전</div><div className="stat-value">{loading ? '…' : `${pending}명`}</div></div>
        </div>
      </div>
      <section className="panel">
        <h2>바로 가기</h2>
        <div className="quick">
          <Link to="/teacher/accounts" className="quick-item"><UserPlus size={20} /> 학생 계정 만들기</Link>
          <Link to="/teacher/students" className="quick-item"><Users size={20} /> 학생 명단 보기</Link>
        </div>
      </section>
    </>
  );
}

export default function DashboardPage() {
  const { profile, isTeacher } = useAuth();

  return (
    <>
      <section className="welcome">
        <h2>안녕하세요, {profile?.displayName ? `${profile.displayName}님` : isTeacher ? '선생님' : ''} 👋</h2>
        <p className="muted">{isTeacher ? '오늘 수업을 준비해 볼까요?' : '오늘도 즐겁게 배워 봐요.'}</p>
      </section>
      {isTeacher ? (
        <TeacherHome />
      ) : (
        <section className="panel empty">
          <BookOpen size={32} strokeWidth={1.5} />
          <p>아직 열린 수업이 없어요. 선생님이 수업을 열면 여기에 표시됩니다.</p>
        </section>
      )}
    </>
  );
}
