import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';

// 교사 전용: 가입한 학생 목록 확인 (보안 규칙에서 교사만 읽기 허용)
export default function TeacherPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('studentId')))
      .then((snap) => setUsers(snap.docs.map((d) => d.data())))
      .catch((err) => setError(err.code ?? err.message));
  }, []);

  return (
    <div className="page">
      <header className="topbar">
        <strong>교사용 · 학생 명단</strong>
        <Link to="/">← 대시보드</Link>
      </header>
      <main>
        {error && <p className="error">불러오기 실패: {error}</p>}
        <table>
          <thead>
            <tr><th>학번</th><th>이름</th><th>이메일</th><th>역할</th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td>{u.studentId ?? '-'}</td>
                <td>{u.displayName}</td>
                <td>{u.email}</td>
                <td>{u.role === 'teacher' ? '교사' : '학생'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </div>
  );
}
