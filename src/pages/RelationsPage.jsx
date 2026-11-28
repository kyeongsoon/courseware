import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Lock, Network, Plus, Send, Trash2, Unlock, UsersRound } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCurrentClass } from '../contexts/ClassContext';
import ClassGate from '../components/ClassGate';
import RelationGraph, { GROUP_COLORS } from '../components/RelationGraph';
import { useStudents } from '../useStudents';
import { dateInt, dateLabel, fromInput, toInput } from '../attendance';
import { formatDate } from '../util/dates';
import {
  DEFAULT_QUESTIONS, MAX_PICKS, NOTE_KINDS, addNote, compareEdges, createSurvey, degrees, deleteNote, deleteSurvey,
  edgesOf, groupsOf, mutualPairs, setSurveyOpen, submitResponse, useMyResponse, useNotes, useResponses, useSurveys,
} from '../relations';

const nameMap = (roster) => Object.fromEntries(roster.map((s) => [s.uid, s.name]));

// 긴 목록은 앞부분만 보이고 '모두 보기'로 펼침
function More({ items, limit = 8, render = (x) => x, sep = ', ', as = 'p' }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, limit);
  const btn = items.length > limit && (
    <button type="button" className="link-btn" onClick={() => setAll(!all)}>{all ? '접기' : `… 모두 보기 (${items.length})`}</button>
  );
  if (as === 'ul') return <><ul className="rel-changes small">{shown.map(render)}</ul>{btn}</>;
  return <p className="small">{shown.map(render).join(sep)} {btn}</p>;
}

// ── 학생: 조사 응답 ──
function SurveyForm({ survey }) {
  const { user } = useAuth();
  const mine = useMyResponse(survey.id, user.uid);
  const [answers, setAnswers] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = answers ?? mine?.answers ?? {};
  const friends = survey.roster.filter((s) => s.uid !== user.uid).sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));

  const toggle = (q, uid) => {
    const list = cur[q] ?? [];
    const next = list.includes(uid) ? list.filter((x) => x !== uid) : list.length >= survey.maxPicks ? list : [...list, uid];
    setAnswers({ ...cur, [q]: next });
    setMsg('');
  };
  const onSubmit = async () => {
    setBusy(true);
    try {
      await submitResponse(survey, user.uid, cur);
      setAnswers(null);
      setMsg('제출했어요. 마감 전까지는 다시 고칠 수 있어요.');
    } catch (e) {
      setMsg(e.code === 'permission-denied' ? '제출할 수 없어요. 조사가 마감됐을 수 있어요.' : `실패: ${e.code ?? e.message}`);
    } finally {
      setBusy(false);
    }
  };

  if (mine === undefined) return <p className="muted">불러오는 중…</p>;
  return (
    <section className="panel rel-form">
      <h2><UsersRound size={18} className="h-icon" /> {survey.title}</h2>
      <p className="muted small"><Lock size={13} /> 내 응답은 <b>선생님만</b> 볼 수 있어요. 친구들은 볼 수 없어요. 질문마다 {survey.maxPicks}명까지 골라요 (안 골라도 돼요).</p>
      {mine && !answers && <p className="info">제출했어요 ({formatDate(mine.submittedAt)}). 마감 전까지 고칠 수 있어요.</p>}
      {survey.questions.map((q, i) => (
        <fieldset key={q.id} className="rel-q">
          <legend>{i + 1}. {q.text} <span className="muted small">({(cur[q.id] ?? []).length}/{survey.maxPicks})</span></legend>
          <div className="chips">
            {friends.map((f) => {
              const on = (cur[q.id] ?? []).includes(f.uid);
              const full = !on && (cur[q.id] ?? []).length >= survey.maxPicks;
              return (
                <button key={f.uid} type="button" className={`chip-btn ${on ? 'on' : ''}`} disabled={full} aria-pressed={on} onClick={() => toggle(q.id, f.uid)}>
                  {f.name}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {msg && <p className="info">{msg}</p>}
      <div><button className="btn primary" onClick={onSubmit} disabled={busy || (mine && !answers)}><Send size={16} /> {mine ? '고쳐서 제출' : '제출'}</button></div>
    </section>
  );
}

function StudentRelations() {
  const { classId } = useCurrentClass();
  const surveys = useSurveys(classId);
  if (surveys === undefined) return <div className="muted">불러오는 중…</div>;
  const open = surveys.filter((s) => s.open);
  if (!open.length) {
    return <section className="panel empty"><UsersRound size={32} strokeWidth={1.5} /><p>지금 진행 중인 친구 조사가 없어요.</p></section>;
  }
  return open.map((s) => <SurveyForm key={s.id} survey={s} />);
}

// 학생 홈: 아직 안 한 조사 알림
export function RelationsReminder() {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const surveys = useSurveys(classId);
  const open = (surveys ?? []).filter((s) => s.open);
  const first = open[0];
  const mine = useMyResponse(first?.id, user?.uid);
  if (!first || mine !== null) return null;
  return (
    <section className="panel notice">
      <span><UsersRound size={18} className="h-icon" /> <b>{first.title}</b>에 아직 응답하지 않았어요.</span>
      <Link className="btn small primary" to="/relations">응답하러 가기</Link>
    </section>
  );
}

// ── 교사: 관계도 ──
function GraphTab({ surveys, responses, notes }) {
  const [sid, setSid] = useState(surveys.at(-1)?.id ?? '');
  const survey = surveys.find((s) => s.id === sid) ?? surveys.at(-1);
  const [question, setQuestion] = useState('all');
  const [prevId, setPrevId] = useState('');
  const [showNotes, setShowNotes] = useState(false);
  const [selected, setSelected] = useState(null);
  const prev = surveys.find((s) => s.id === prevId && s.id !== survey?.id);

  const data = useMemo(() => {
    if (!survey) return null;
    const roster = survey.roster;
    const edges = edgesOf(survey, responses, question);
    const deg = degrees(roster, edges);
    const groups = groupsOf(roster, edges);
    const answered = new Set(responses.filter((r) => r.surveyId === survey.id).map((r) => r.uid));
    let cmp = null;
    if (prev) {
      const both = new Set(prev.roster.map((s) => s.uid));
      const prevEdges = edgesOf(prev, responses, question).filter((e) => both.has(e.from) && both.has(e.to));
      const c = compareEdges(prevEdges, edges);
      const prevDeg = degrees(roster, prevEdges);
      cmp = {
        ...c, prevDeg,
        edges: [...c.kept.map((e) => ({ ...e, status: 'kept' })), ...c.added.map((e) => ({ ...e, status: 'added' })), ...c.removed.map((e) => ({ ...e, status: 'removed' }))],
        layout: [...edges, ...c.removed],
      };
    }
    return { roster, edges, deg, groups, answered, cmp };
  }, [survey, responses, question, prev]);

  if (!survey) return <p className="muted">아직 조사가 없어요. '조사 관리'에서 첫 조사를 시작하세요.</p>;
  const names = nameMap(data.roster);
  const lonely = data.roster.filter((s) => data.deg[s.uid].inn === 0);
  const pairs = mutualPairs(data.edges);
  const groupList = {};
  Object.entries(data.groups).forEach(([u, g]) => g >= 0 && (groupList[g] ??= []).push(names[u]));
  const sel = selected && data.roster.find((s) => s.uid === selected);
  const visibleNotes = showNotes ? notes.filter((n) => names[n.a] && names[n.b]) : [];

  return (
    <>
      <div className="rel-controls">
        <label className="inline-label small">회차
          <select value={survey.id} onChange={(e) => { setSid(e.target.value); setSelected(null); }} aria-label="회차">
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}{s.open ? ' (진행 중)' : ''}</option>)}
          </select>
        </label>
        <label className="inline-label small">질문
          <select value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="질문">
            <option value="all">전체 질문 합쳐서</option>
            {survey.questions.map((q, i) => <option key={q.id} value={q.id}>{i + 1}. {q.text}</option>)}
          </select>
        </label>
        <label className="inline-label small">비교
          <select value={prevId} onChange={(e) => setPrevId(e.target.value)} aria-label="비교할 회차">
            <option value="">비교 안 함</option>
            {surveys.filter((s) => s.id !== survey.id).map((s) => <option key={s.id} value={s.id}>{s.title}과 비교</option>)}
          </select>
        </label>
        <label className="check-line small"><input type="checkbox" checked={showNotes} onChange={(e) => setShowNotes(e.target.checked)} /> 관찰 기록 겹쳐 보기</label>
        <span className="muted small">응답 {data.answered.size} / {data.roster.length}명</span>
      </div>

      <div className="rel-layout">
        <div className="rel-canvas">
          <RelationGraph roster={data.roster} edges={data.cmp ? data.cmp.edges : data.edges} layoutEdges={data.cmp ? data.cmp.layout : data.edges}
            deg={data.deg} groups={data.groups} notes={visibleNotes} selected={selected} onSelect={setSelected} compare={!!data.cmp} />
          <div className="rel-legend small">
            {data.cmp ? (
              <>
                <span><i className="lg-line" style={{ background: '#16a34a' }} /> 새로 생긴 선택</span>
                <span><i className="lg-line dashed" style={{ borderColor: '#dc2626' }} /> 사라진 선택</span>
                <span><i className="lg-line" style={{ background: '#a1a1aa' }} /> 그대로</span>
              </>
            ) : (
              <>
                <span><i className="lg-line thick" /> 서로 고름</span>
                <span><i className="lg-line" style={{ background: '#a1a1aa' }} /> 한쪽만 고름 (화살표 방향)</span>
                <span><i className="lg-dot" /> 숫자·크기 = 받은 선택 수</span>
                <span><i className="lg-ring" /> 아무도 고르지 않음</span>
              </>
            )}
            {showNotes && Object.entries(NOTE_KINDS).map(([k, v]) => <span key={k}><i className="lg-line dotted" style={{ borderColor: v.color }} /> {v.label}</span>)}
          </div>
        </div>

        <aside className="rel-side">
          {sel ? (
            <StudentDetail s={sel} survey={survey} responses={responses} names={names} deg={data.deg} notes={notes} cmp={data.cmp} onClose={() => setSelected(null)} />
          ) : (
            <>
              {data.cmp && (
                <div className="rel-box">
                  <h3>{prev.title} → {survey.title}</h3>
                  <p className="small">새로 생긴 선택 <b className="good">{data.cmp.added.length}</b> · 사라진 선택 <b className="bad">{data.cmp.removed.length}</b> · 그대로 {data.cmp.kept.length}</p>
                  <ChangeList roster={data.roster} deg={data.deg} prevDeg={data.cmp.prevDeg} />
                </div>
              )}
              <div className={`rel-box ${lonely.length ? 'warn-box' : ''}`}>
                <h3>아무도 고르지 않은 학생 ({lonely.length})</h3>
                <p className="small">{lonely.length ? lonely.map((s) => s.name).join(', ') : '없어요 🙂'}</p>
                {lonely.some((s) => !data.answered.has(s.uid)) && <p className="muted small">응답하지 않은 학생도 있으니 함께 확인하세요.</p>}
              </div>
              <div className="rel-box">
                <h3>서로 고른 짝 ({pairs.length})</h3>
                {pairs.length ? <More items={pairs} render={([a, b]) => `${names[a]}↔${names[b]}`} /> : <p className="small">아직 없어요</p>}
              </div>
              <div className="rel-box">
                <h3>무리</h3>
                {Object.keys(groupList).length ? (
                  <ul className="rel-groups small">
                    {Object.entries(groupList).map(([g, ms]) => <li key={g}><i className="lg-dot" style={{ background: GROUP_COLORS[g % GROUP_COLORS.length] }} /> {ms.join(', ')}</li>)}
                  </ul>
                ) : <p className="small muted">아직 없어요</p>}
              </div>
              <p className="muted small">학생을 누르면 누구를 고르고 누구에게 선택받았는지 볼 수 있어요.</p>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function ChangeList({ roster, deg, prevDeg }) {
  // 많이 줄어든 학생(먼저 살펴볼 학생)부터
  const rows = roster.map((s) => ({ s, d: deg[s.uid].inn - (prevDeg[s.uid]?.inn ?? 0) })).filter((r) => r.d !== 0).sort((a, b) => a.d - b.d || b.s.name.localeCompare(a.s.name));
  if (!rows.length) return <p className="muted small">받은 선택 수가 바뀐 학생이 없어요.</p>;
  return (
    <More as="ul" items={rows} limit={6} render={({ s, d }) => (
      <li key={s.uid}>{s.name} <span className={d > 0 ? 'good' : 'bad'}>{prevDeg[s.uid]?.inn ?? 0} → {deg[s.uid].inn} ({d > 0 ? `+${d}` : d})</span></li>
    )} />
  );
}

function StudentDetail({ s, survey, responses, names, deg, notes, cmp, onClose }) {
  const mine = responses.find((r) => r.surveyId === survey.id && r.uid === s.uid);
  const pickedBy = survey.questions.map((q) => ({
    q, who: responses.filter((r) => r.surveyId === survey.id && (r.answers?.[q.id] ?? []).includes(s.uid)).map((r) => names[r.uid]).filter(Boolean),
  }));
  const myNotes = notes.filter((n) => n.a === s.uid || n.b === s.uid);
  return (
    <div className="rel-box">
      <div className="row between"><h3>{s.name} <span className="muted small">{s.studentId}</span></h3><button className="btn small" onClick={onClose}>닫기</button></div>
      <p className="small">받은 선택 <b>{deg[s.uid].inn}</b>명{cmp && ` (지난 회차 ${cmp.prevDeg[s.uid]?.inn ?? 0}명)`} · 고른 친구 {deg[s.uid].out}명</p>
      <h4>고른 친구</h4>
      {mine ? (
        <ul className="small rel-picks">
          {survey.questions.map((q, i) => <li key={q.id}><span className="muted">{i + 1}. {q.text}:</span> {(mine.answers?.[q.id] ?? []).map((u) => names[u]).filter(Boolean).join(', ') || '없음'}</li>)}
        </ul>
      ) : <p className="small muted">아직 응답하지 않았어요.</p>}
      <h4>이 학생을 고른 친구</h4>
      <ul className="small rel-picks">
        {pickedBy.map(({ q, who }, i) => <li key={q.id}><span className="muted">{i + 1}. {q.text}:</span> {who.join(', ') || '없음'}</li>)}
      </ul>
      {myNotes.length > 0 && (
        <>
          <h4>관찰 기록</h4>
          <ul className="small rel-picks">
            {myNotes.map((n) => <li key={n.id}>{dateLabel(n.date)} · {names[n.a === s.uid ? n.b : n.a] ?? '(지금 명단에 없음)'} · <b style={{ color: NOTE_KINDS[n.kind]?.color }}>{NOTE_KINDS[n.kind]?.label}</b> {n.note}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

// ── 교사: 학생별 추이 ──
function TrendTab({ surveys, responses }) {
  const [question, setQuestion] = useState('all');
  const all = new Map();
  surveys.forEach((s) => s.roster.forEach((r) => all.set(r.uid, r)));
  const roster = [...all.values()].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
  const degs = surveys.map((s) => ({ s, d: degrees(s.roster, edgesOf(s, responses, question)), inRoster: new Set(s.roster.map((r) => r.uid)) }));
  if (!surveys.length) return <p className="muted">아직 조사가 없어요.</p>;
  return (
    <>
      <div className="rel-controls">
        <label className="inline-label small">질문
          <select value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="추이 질문">
            <option value="all">전체 질문 합쳐서</option>
            {surveys.at(-1).questions.map((q, i) => <option key={q.id} value={q.id}>{i + 1}. {q.text}</option>)}
          </select>
        </label>
        <span className="muted small">숫자 = 그 회차에 이 학생을 고른 친구 수 (0은 빨간색)</span>
      </div>
      <div className="table-wrap">
        <table className="rel-trend">
          <thead><tr><th>학번</th><th>이름</th>{degs.map(({ s }) => <th key={s.id}>{s.title}</th>)}<th>변화</th></tr></thead>
          <tbody>
            {roster.map((r) => {
              const vals = degs.map(({ d, inRoster }) => (inRoster.has(r.uid) ? d[r.uid]?.inn ?? 0 : null));
              const known = vals.filter((v) => v !== null);
              const diff = known.length >= 2 ? known.at(-1) - known.at(-2) : null;
              return (
                <tr key={r.uid}>
                  <td>{r.studentId}</td><td>{r.name}</td>
                  {vals.map((v, i) => <td key={i} className={v === 0 ? 'bad-num' : ''}>{v ?? '-'}</td>)}
                  <td className={diff > 0 ? 'good' : diff < 0 ? 'bad' : 'muted'}>{diff === null ? '' : diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── 교사: 조사 관리 ──
function ManageTab({ surveys, responses, roster }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const m = Math.floor(dateInt() / 100) % 100;
  const [title, setTitle] = useState(`${m}월 교우관계 조사`);
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS.map((q) => ({ ...q })));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const onCreate = async (e) => {
    e.preventDefault();
    if (!roster.length) return setMsg('이 반에 학생이 없어요.');
    setBusy(true);
    try {
      await createSurvey(classId, { title, questions, roster }, user.uid);
      setMsg(`'${title}'을 시작했어요. 학생 홈에 응답 안내가 보여요.`);
    } catch (err) {
      setMsg(`실패: ${err.code ?? err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="rel-new" onSubmit={onCreate}>
        <h3><Plus size={16} /> 새 조사 시작</h3>
        <label>제목<input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} aria-label="조사 제목" /></label>
        {questions.map((q, i) => (
          <label key={q.id}>질문 {i + 1}
            <input value={q.text} maxLength={60} onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} aria-label={`질문 ${i + 1}`} />
          </label>
        ))}
        <p className="muted small">질문마다 {MAX_PICKS}명까지 고르고, 지금 반 명단({roster.length}명)으로 시작해요. 회차를 비교하려면 질문 순서를 같게 두세요.</p>
        <div><button className="btn primary" disabled={busy}>조사 시작</button></div>
        {msg && <p className="info">{msg}</p>}
      </form>

      <h3 className="rel-sub">회차 ({surveys.length})</h3>
      {!surveys.length && <p className="muted">아직 조사가 없어요.</p>}
      <ul className="item-list">
        {[...surveys].reverse().map((s) => {
          const done = new Set(responses.filter((r) => r.surveyId === s.id).map((r) => r.uid));
          const missing = s.roster.filter((r) => !done.has(r.uid));
          return (
            <li key={s.id} className="rel-round">
              <div className="item-main">
                <span className="item-title">{s.title} {s.open ? <span className="tag done">진행 중</span> : <span className="tag muted-tag">마감</span>}</span>
                <span className="muted small">{formatDate(s.createdAt)} · 응답 {done.size} / {s.roster.length}명</span>
                {s.open && missing.length > 0 && <span className="small">아직 안 한 학생: {missing.map((r) => r.name).join(', ')}</span>}
              </div>
              <div className="row">
                <button className="btn small" onClick={() => setSurveyOpen(s.id, !s.open)}>{s.open ? <><Lock size={14} /> 마감</> : <><Unlock size={14} /> 다시 열기</>}</button>
                <button className="btn small danger" onClick={() => confirm(`'${s.title}'과 학생 응답을 모두 지울까요? 되돌릴 수 없어요.`) && deleteSurvey(s.id)}><Trash2 size={14} /> 삭제</button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// ── 교사: 관찰 기록 ──
function NotesTab({ notes, roster }) {
  const { user } = useAuth();
  const { classId } = useCurrentClass();
  const sorted = [...roster].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
  const names = Object.fromEntries(roster.map((s) => [s.uid, s.displayName]));
  const [n, setN] = useState({ a: '', b: '', kind: 'close', note: '', date: dateInt() });
  const [err, setErr] = useState('');
  const onAdd = async (e) => {
    e.preventDefault();
    if (!n.a || !n.b || n.a === n.b) return setErr('서로 다른 두 학생을 골라 주세요.');
    setErr('');
    await addNote(classId, n, user.uid);
    setN({ ...n, a: '', b: '', note: '' });
  };
  const pick = (k) => (
    <select value={n[k]} onChange={(e) => setN({ ...n, [k]: e.target.value })} aria-label={k === 'a' ? '학생 1' : '학생 2'}>
      <option value="">{k === 'a' ? '학생 1' : '학생 2'}</option>
      {sorted.map((s) => <option key={s.uid} value={s.uid}>{s.studentId} {s.displayName}</option>)}
    </select>
  );
  return (
    <>
      <form className="rel-note-form" onSubmit={onAdd}>
        {pick('a')}
        <select value={n.kind} onChange={(e) => setN({ ...n, kind: e.target.value })} aria-label="관계 종류">
          {Object.entries(NOTE_KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {pick('b')}
        <input type="date" value={toInput(n.date)} onChange={(e) => e.target.value && setN({ ...n, date: fromInput(e.target.value) })} aria-label="날짜" />
        <input className="grow" value={n.note} maxLength={200} onChange={(e) => setN({ ...n, note: e.target.value })} placeholder="메모 (예: 쉬는 시간에 말다툼)" aria-label="메모" />
        <button className="btn primary"><Plus size={16} /> 기록</button>
      </form>
      {err && <p className="error">{err}</p>}
      <p className="muted small"><Eye size={13} /> 관찰 기록은 선생님만 봐요. 관계도에서 '관찰 기록 겹쳐 보기'를 켜면 점선으로 보여요.</p>
      {notes.length === 0 ? <p className="muted">아직 기록이 없어요.</p> : (
        <ul className="item-list">
          {notes.map((x) => (
            <li key={x.id} className="row between">
              <span>
                <span className="muted small">{dateLabel(x.date)}</span>{' '}
                <b>{names[x.a] ?? '(명단에 없음)'}</b> – <b>{names[x.b] ?? '(명단에 없음)'}</b>{' '}
                <span className="tag" style={{ color: NOTE_KINDS[x.kind]?.color }}>{NOTE_KINDS[x.kind]?.label}</span> {x.note}
              </span>
              <button className="icon-btn" title="기록 삭제" onClick={() => confirm('이 기록을 지울까요?') && deleteNote(x.id)}><Trash2 size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function TeacherRelations() {
  const { classId } = useCurrentClass();
  const surveys = useSurveys(classId);
  const responses = useResponses(classId);
  const notes = useNotes(classId);
  const { students } = useStudents();
  const roster = useMemo(() => students.filter((s) => s.classId === classId), [students, classId]);
  const [tab, setTab] = useState('graph');
  if (surveys === undefined) return <div className="muted">불러오는 중…</div>;
  const tabs = [['graph', '관계도'], ['trend', '학생별 추이'], ['manage', '조사 관리'], ['notes', '관찰 기록']];
  return (
    <section className="panel">
      <div className="panel-head">
        <h2><Network size={18} className="h-icon" /> 교우 관계</h2>
        <div className="tabs" role="tablist">
          {tabs.map(([k, v]) => <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>{v}</button>)}
        </div>
      </div>
      {tab === 'graph' && <GraphTab key={classId} surveys={surveys} responses={responses} notes={notes} />}
      {tab === 'trend' && <TrendTab surveys={surveys} responses={responses} />}
      {tab === 'manage' && <ManageTab surveys={surveys} responses={responses} roster={roster} />}
      {tab === 'notes' && <NotesTab notes={notes} roster={roster} />}
      <p className="muted small rel-foot"><Lock size={13} /> 조사 응답과 관계도는 선생님만 볼 수 있어요. 학생 상담·자리 배치 참고용으로 쓰고, 학생에게 결과를 보여 주지 마세요.</p>
    </section>
  );
}

export default function RelationsPage() {
  const { isTeacher } = useAuth();
  return <ClassGate>{isTeacher ? <TeacherRelations /> : <StudentRelations />}</ClassGate>;
}
