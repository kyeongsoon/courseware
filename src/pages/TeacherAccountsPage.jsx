import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Eye, UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { createStudentAccounts, downloadCsv, parseStudentList } from '../studentAccounts';

const SAMPLE = `30201,김민준
30202,이서연
30203,박지호,mypass123`;

export default function TeacherAccountsPage() {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState([]);
  const [results, setResults] = useState([]);
  const [progress, setProgress] = useState(null);

  const valid = preview.filter((p) => !p.error);
  const created = results.filter((r) => r.ok).length;

  const onPreview = () => {
    setResults([]);
    setPreview(parseStudentList(text));
  };

  const onCreate = async () => {
    if (!valid.length) return;
    if (!confirm(`학생 계정 ${valid.length}개를 만들까요?`)) return;
    setProgress({ done: 0, total: valid.length });
    const res = await createStudentAccounts(valid, user.uid, (done, total) => setProgress({ done, total }));
    setResults(res);
    setPreview([]);
    setText('');
    setProgress(null);
  };

  return (
    <>
      <section className="panel">
        <h2>학생 정보 입력</h2>
        <p className="muted">
          한 줄에 한 명씩 <code>학번,이름</code> 을 입력하세요. 엑셀에서 두 열을 복사해 붙여넣어도 됩니다.
          세 번째 칸에 비밀번호를 쓰면 그 값을, 비우면 8자리 초기 비밀번호를 자동으로 만듭니다.
          학생은 <b>학번을 아이디</b>로 로그인하고, 첫 로그인 때 비밀번호를 바꿉니다.
        </p>
        <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} />
        <div className="row">
          <button className="btn" onClick={onPreview} disabled={!text.trim() || progress}>
            <Eye size={18} /> 미리보기
          </button>
          <button className="btn primary" onClick={onCreate} disabled={!valid.length || progress}>
            <UserPlus size={18} />
            {progress ? `만드는 중… ${progress.done}/${progress.total}` : `계정 ${valid.length}개 만들기`}
          </button>
        </div>

        {preview.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead><tr><th>줄</th><th>아이디(학번)</th><th>이름</th><th>초기 비밀번호</th><th>확인</th></tr></thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.line} className={p.error ? 'bad' : ''}>
                    <td>{p.line}</td><td>{p.studentId}</td><td>{p.displayName}</td><td><code>{p.password}</code></td>
                    <td>{p.error || <span className="ok">OK</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {results.length > 0 && (
        <section className="panel result">
          <h2>생성 결과</h2>
          <p>
            <b>{created}개 생성</b>{results.length - created > 0 && `, ${results.length - created}개 실패`}.
            초기 비밀번호는 지금만 확인할 수 있으니 <b>꼭 CSV로 저장</b>해 학생에게 나눠 주세요.
          </p>
          <div className="row">
            <button className="btn primary" onClick={() => downloadCsv(results)}>
              <Download size={18} /> CSV 다운로드 (엑셀)
            </button>
            <Link className="btn" to="/teacher/students">학생 명단 보기</Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>아이디</th><th>이름</th><th>초기 비밀번호</th><th>결과</th></tr></thead>
              <tbody>
                {results.map((r) => (
                  <tr key={`${r.line}-${r.studentId}`} className={r.ok ? '' : 'bad'}>
                    <td>{r.studentId}</td><td>{r.displayName}</td><td><code>{r.ok ? r.password : '-'}</code></td>
                    <td>{r.ok ? '생성됨' : r.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
