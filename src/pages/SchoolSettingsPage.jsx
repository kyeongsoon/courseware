import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound, Search, School } from 'lucide-react';
import { NeisError, saveSchoolSettings, searchSchools, useSchoolSettings } from '../neis';

export default function SchoolSettingsPage() {
  const saved = useSchoolSettings();
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [results, setResults] = useState(null);
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (saved) {
      setKey(saved.apiKey ?? '');
      setPicked({ atptCode: saved.atptCode, schoolCode: saved.schoolCode, schoolName: saved.schoolName, kind: saved.kind, region: saved.region ?? '' });
    }
  }, [saved]);

  const onSearch = async (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setErr('학교 이름을 두 글자 이상 입력해 주세요.');
    setBusy(true);
    setErr('');
    setMsg('');
    try {
      const list = await searchSchools(name, key.trim());
      setResults(list);
      if (!list.length) setErr('검색 결과가 없어요. 학교 이름을 다시 확인해 주세요.');
    } catch (e2) {
      setErr(e2 instanceof NeisError ? e2.message : `검색 실패: ${e2.message}`);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!picked) return setErr('학교를 골라 주세요.');
    setBusy(true);
    setErr('');
    try {
      await saveSchoolSettings({ ...picked, apiKey: key.trim() });
      setMsg('저장했어요. 이제 학급 달력과 시간표에서 나이스 자료를 가져올 수 있어요.');
    } catch (e2) {
      setErr(`저장 실패: ${e2.code ?? e2.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (saved === undefined) return <div className="muted">불러오는 중…</div>;
  return (
    <section className="panel">
      <h2><School size={18} className="h-icon" /> 학교 설정 (나이스 연동)</h2>
      <p className="muted small">
        나이스 교육정보 개방 포털의 학사일정과 시간표를 가져오려면 우리 학교와 API 키가 필요해요. 키와 학교 정보는 교사만 볼 수 있게 저장돼요.
      </p>

      <label>
        <span className="row nowrap"><KeyRound size={16} /> 나이스 API 키</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="나이스 포털에서 발급받은 인증키" autoComplete="off" spellCheck={false} />
      </label>
      <p className="muted small">
        키가 없으면 한 번에 5건까지만 받아져요.{' '}
        <a href="https://open.neis.go.kr/portal/guide/actKeyPage.do" target="_blank" rel="noopener noreferrer">나이스 포털에서 키 발급받기 <ExternalLink size={12} /></a>
        {' '}(회원가입 → 마이페이지 → 인증키 신청, 무료)
      </p>

      <form className="row" onSubmit={onSearch}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="학교 이름 (예: 서울고등학교)" aria-label="학교 이름" />
        <button className="btn" type="submit" disabled={busy}><Search size={16} /> {busy ? '찾는 중…' : '학교 찾기'}</button>
      </form>

      {results && results.length > 0 && (
        <ul className="item-list school-list">
          {results.map((r) => (
            <li key={`${r.atptCode}-${r.schoolCode}`}>
              <label className={`check-card ${picked?.schoolCode === r.schoolCode ? 'on' : ''}`}>
                <input type="radio" name="school" checked={picked?.schoolCode === r.schoolCode} onChange={() => setPicked(r)} />
                <span className="item-main">
                  <span className="item-title">{r.schoolName} <span className="tag muted-tag">{r.kind}</span></span>
                  <span className="muted small">{r.region} · {r.address}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <p className="info">
          선택한 학교: <b>{picked.schoolName}</b> ({picked.kind}{picked.region ? ` · ${picked.region}` : ''})
        </p>
      )}
      {err && <p className="error">{err}</p>}
      {msg && <p className="info">{msg}</p>}
      <div><button className="btn primary" onClick={onSave} disabled={busy || !picked}>저장</button></div>
    </section>
  );
}
