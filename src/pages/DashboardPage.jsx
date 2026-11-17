import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useClasses } from '../classes';
import { BookOpen, KeyRound, School, UserPlus, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useStudents } from '../useStudents';

function TeacherHome() {
  const { students, loading } = useStudents();
  const { classes } = useClasses();
  const ids = new Set(classes.map((c) => c.id));
  const unassigned = students.filter((s) => !ids.has(s.classId)).length;
  const pending = students.filter((s) => s.mustChangePassword).length;

  return (
    <>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon"><Users size={20} /></span>
          <div><div className="stat-label">전체 학생</div><div className="stat-value">{loading ? '…' : `${students.length}명`}</div></div>
        </div>
        <div className="stat">
          <span className="stat-icon"><School size={20} /></span>
          <div><div className="stat-label">반</div><div className="stat-value">{classes.length}개</div>
            {unassigned > 0 && !loading && <Link to="/teacher/classes" className="stat-note">반 없는 학생 {unassigned}명 →</Link>}</div>
        </div>
        <div className="stat">
          <span className="stat-icon warn"><KeyRound size={20} /></span>
          <div><div className="stat-label">첫 비밀번호 변경 전</div><div className="stat-value">{loading ? '…' : `${pending}명`}</div></div>
        </div>
      </div>
      <section className="panel">
        <h2>바로 가기</h2>
        <div className="quick">
          <Link to="/teacher/classes" className="quick-item"><School size={20} /> 반 관리</Link>
          <Link to="/teacher/accounts" className="quick-item"><UserPlus size={20} /> 학생 계정 만들기</Link>
          <Link to="/teacher/students" className="quick-item"><Users size={20} /> 학생 명단 보기</Link>
        </div>
      </section>
    </>
  );
}

// 학생: 내 반 이름 (반 문서는 로그인한 누구나 읽기 가능)
function useMyClassName(classId) {
  const [name, setName] = useState('');
  useEffect(() => {
    if (!classId) return setName('');
    getDoc(doc(db, 'classes', classId))
      .then((snap) => setName(snap.exists() ? snap.data().name : ''))
      .catch(() => setName(''));
  }, [classId]);
  return name;
}

export default function DashboardPage() {
  const { profile, isTeacher } = useAuth();
  const myClass = useMyClassName(isTeacher ? null : profile?.classId);

  return (
    <>
      <section className="welcome">
        <h2>안녕하세요, {profile?.displayName ? `${profile.displayName}님` : isTeacher ? '선생님' : ''} 👋</h2>
        <p className="muted">
          {isTeacher ? '오늘 수업을 준비해 볼까요?' : '오늘도 즐겁게 배워 봐요.'}
          {myClass && <span className="class-chip">{myClass}</span>}
        </p>
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
