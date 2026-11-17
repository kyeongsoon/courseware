import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, FileUp, Plus, Presentation, Save, Trash2, X } from 'lucide-react';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useClasses } from '../classes';
import {
  LIMITS, cleanLesson, createLesson, deleteLesson, updateLesson, useLessons, useUnits, validateLesson, youTubeId,
} from '../lessons';
import { SLIDE_LIMITS, deleteAllSlides, pdfToSlides, saveSlides } from '../slides';

const EMPTY = { unitId: '', title: '', summary: '', body: '', videoUrl: '', links: [], openClassIds: [] };

export default function LessonEditorPage() {
  const { lessonId } = useParams();
  const [params] = useSearchParams();
  const isNew = !lessonId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const { units } = useUnits();
  const { lessons } = useLessons({ isTeacher: true });
  const { classes } = useClasses();

  const [form, setForm] = useState({ ...EMPTY, unitId: params.get('unit') ?? '' });
  const [originalUnitId, setOriginalUnitId] = useState('');
  const [loaded, setLoaded] = useState(isNew);
  // 슬라이드: 저장돼 있는 것 / 새로 고른 PDF 를 변환한 것 / 지우기 예약
  const [savedSlides, setSavedSlides] = useState({ count: 0, name: '' });
  const [pendingSlides, setPendingSlides] = useState(null); // { slides, name }
  const [removeSlides, setRemoveSlides] = useState(false);
  const [slideMsg, setSlideMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isNew) return;
    getDoc(doc(db, 'lessons', lessonId))
      .then((snap) => {
        if (!snap.exists()) return navigate('/teacher/lessons', { replace: true });
        const d = snap.data();
        setForm({
          unitId: d.unitId ?? '', title: d.title ?? '', summary: d.summary ?? '', body: d.body ?? '',
          videoUrl: d.videoUrl ?? '', links: d.links ?? [], openClassIds: d.openClassIds ?? [],
        });
        setOriginalUnitId(d.unitId ?? '');
        setSavedSlides({ count: d.slideCount ?? 0, name: d.slidesName ?? '' });
        setLoaded(true);
      })
      .catch((e) => setErr(`불러오기 실패: ${e.code ?? e.message}`));
  }, [isNew, lessonId, navigate]);

  // 새 차시인데 단원이 정해지지 않았으면 첫 단원으로
  useEffect(() => {
    if (isNew && !form.unitId && units.length) setForm((f) => ({ ...f, unitId: units[0].id }));
  }, [isNew, form.unitId, units]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setLink = (i, key, value) =>
    setForm((f) => ({ ...f, links: f.links.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }));
  const addLink = () => setForm((f) => ({ ...f, links: [...f.links, { label: '', url: '' }] }));
  const removeLink = (i) => setForm((f) => ({ ...f, links: f.links.filter((_, j) => j !== i) }));

  const toggleClass = (id) =>
    setForm((f) => ({
      ...f,
      openClassIds: f.openClassIds.includes(id) ? f.openClassIds.filter((c) => c !== id) : [...f.openClassIds, id],
    }));
  const liveClassIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);
  const openCount = form.openClassIds.filter((id) => liveClassIds.has(id)).length;
  const allOpen = classes.length > 0 && openCount === classes.length;
  const toggleAll = () => setForm((f) => ({ ...f, openClassIds: allOpen ? [] : classes.map((c) => c.id) }));

  const videoId = youTubeId(form.videoUrl.trim());

  const onPickPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const slides = await pdfToSlides(file, ({ done, total }) => setSlideMsg(`PDF를 슬라이드로 바꾸는 중… ${done + 1} / ${total}`));
      setPendingSlides({ slides, name: file.name });
      setRemoveSlides(false);
      setSlideMsg('');
    } catch (e2) {
      setSlideMsg('');
      setErr(e2.message?.includes('Invalid PDF') ? 'PDF 파일을 읽지 못했어요. 파일이 손상됐는지 확인해 주세요.' : e2.message);
    } finally {
      setBusy(false);
    }
  };

  const onSave = async (e) => {
    e.preventDefault();
    const data = cleanLesson(form);
    // 지워진 반은 공개 목록에서 정리
    data.openClassIds = data.openClassIds.filter((id) => liveClassIds.has(id));
    const msg = validateLesson(data);
    if (msg) return setErr(msg);
    setErr('');
    setBusy(true);
    try {
      const inTarget = lessons.filter((l) => l.unitId === data.unitId && l.id !== lessonId);
      let id = lessonId;
      if (isNew) id = (await createLesson(data, inTarget, user.uid)).id;
      else await updateLesson(lessonId, data, { movedToUnitLessons: data.unitId !== originalUnitId ? inTarget : undefined });
      if (pendingSlides) {
        await saveSlides(id, pendingSlides.slides, { oldCount: savedSlides.count, name: pendingSlides.name }, ({ done, total }) =>
          setSlideMsg(`슬라이드 저장 중… ${done + 1} / ${total}`),
        );
      } else if (removeSlides) {
        await deleteAllSlides(id);
      }
      navigate('/teacher/lessons');
    } catch (e2) {
      setErr(`저장 실패: ${e2.code ?? e2.message}`);
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!confirm(`'${form.title}' 차시를 삭제할까요? 되돌릴 수 없어요.`)) return;
    setBusy(true);
    try {
      if (savedSlides.count) await deleteAllSlides(lessonId, { updateLesson: false });
      await deleteLesson(lessonId);
      navigate('/teacher/lessons', { replace: true });
    } catch (e2) {
      setErr(`삭제 실패: ${e2.code ?? e2.message}`);
      setBusy(false);
    }
  };

  if (!loaded) return <div className="muted">{err || '불러오는 중…'}</div>;

  if (!units.length) {
    return (
      <section className="panel empty">
        <p>차시를 만들려면 먼저 단원이 있어야 해요.</p>
        <Link className="btn primary" to="/teacher/lessons">단원 만들러 가기</Link>
      </section>
    );
  }

  return (
    <>
      <Link to="/teacher/lessons" className="back-link"><ArrowLeft size={16} /> 수업 관리</Link>
      <form className="editor" onSubmit={onSave}>
        <section className="panel">
          <h2>{isNew ? '새 차시' : '차시 수정'}</h2>
          <div className="grid-2">
            <label>
              단원
              <select value={form.unitId} onChange={set('unitId')} required>
                {units.map((u, i) => <option key={u.id} value={u.id}>{i + 1}단원. {u.title}</option>)}
              </select>
            </label>
            <label>
              차시 제목
              <input value={form.title} onChange={set('title')} maxLength={LIMITS.title} placeholder="예: 정보의 디지털 표현" required />
            </label>
          </div>
          <label>
            한 줄 요약 <span className="muted small">(목록에 보여요)</span>
            <input value={form.summary} onChange={set('summary')} maxLength={LIMITS.summary} placeholder="예: 0과 1로 문자·이미지·소리를 나타내는 방법을 알아봐요." />
          </label>
          <label>
            본문
            <textarea
              className="prose-input"
              rows={12}
              value={form.body}
              onChange={set('body')}
              maxLength={LIMITS.body}
              placeholder={'학습 목표, 설명, 활동 안내 등을 자유롭게 쓰세요.\n빈 줄로 문단을 나누고, http로 시작하는 주소는 자동으로 링크가 돼요.'}
            />
            <span className="muted small right-note">{form.body.length.toLocaleString()} / {LIMITS.body.toLocaleString()}자</span>
          </label>
        </section>

        <section className="panel">
          <h2>슬라이드 (PPT)</h2>
          <p className="muted small">
            PowerPoint에서 <b>파일 → 내보내기 → PDF</b>로 저장한 파일을 올리세요. 수업 화면에서 한 장씩 넘겨 볼 수 있고,
            실시간 수업 중에는 선생님이 넘기면 학생 화면도 같이 넘어가요. (애니메이션은 빠져요, 최대 {SLIDE_LIMITS.maxPages}장)
          </p>
          {pendingSlides ? (
            <div className="slide-file">
              <Presentation size={20} />
              <span><b>{pendingSlides.name}</b> · {pendingSlides.slides.length}장 <span className="muted">(저장하면 올라가요)</span></span>
              <button type="button" className="btn small" onClick={() => setPendingSlides(null)}><X size={16} /> 취소</button>
            </div>
          ) : savedSlides.count > 0 && !removeSlides ? (
            <div className="slide-file">
              <Presentation size={20} />
              <span><b>{savedSlides.name || '슬라이드'}</b> · {savedSlides.count}장</span>
              <button type="button" className="btn small danger" onClick={() => setRemoveSlides(true)}><Trash2 size={16} /> 슬라이드 빼기</button>
            </div>
          ) : removeSlides ? (
            <div className="slide-file">
              <span className="muted">저장하면 슬라이드가 빠져요.</span>
              <button type="button" className="btn small" onClick={() => setRemoveSlides(false)}>되돌리기</button>
            </div>
          ) : null}
          <label className="btn file-btn">
            <FileUp size={18} /> {savedSlides.count || pendingSlides ? 'PDF 바꾸기' : 'PDF 올리기'}
            <input type="file" accept="application/pdf,.pdf" onChange={onPickPdf} disabled={busy} aria-label="슬라이드 PDF 파일" />
          </label>
          {slideMsg && <p className="info">{slideMsg}</p>}
        </section>

        <section className="panel">
          <h2>영상과 자료</h2>
          <label>
            영상 주소 <span className="muted small">(YouTube 주소를 넣으면 수업 화면에 바로 재생돼요)</span>
            <input value={form.videoUrl} onChange={set('videoUrl')} placeholder="https://www.youtube.com/watch?v=…" inputMode="url" />
          </label>
          {form.videoUrl.trim() && (
            <p className={videoId ? 'info' : 'muted small'}>
              {videoId ? '✓ YouTube 영상으로 인식했어요.' : 'YouTube 영상이 아니면 링크 버튼으로 보여요.'}
            </p>
          )}

          <div className="links-edit">
            <div className="label-like">자료 링크 <span className="muted small">(구글 슬라이드, 문서, 활동지 등)</span></div>
            {form.links.map((l, i) => (
              <div key={i} className="link-row">
                <input value={l.label} onChange={(e) => setLink(i, 'label', e.target.value)} placeholder="이름 (예: 수업 슬라이드)" aria-label={`자료 ${i + 1} 이름`} maxLength={60} />
                <input value={l.url} onChange={(e) => setLink(i, 'url', e.target.value)} placeholder="https://…" aria-label={`자료 ${i + 1} 주소`} inputMode="url" />
                <button type="button" className="icon-btn" title="이 자료 빼기" onClick={() => removeLink(i)}><X size={18} /></button>
              </div>
            ))}
            {form.links.length < LIMITS.links && (
              <button type="button" className="btn small" onClick={addLink}><Plus size={16} /> 자료 링크 추가</button>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>공개할 반</h2>
            {classes.length > 0 && (
              <button type="button" className="btn small" onClick={toggleAll}>{allOpen ? '모두 해제' : '모든 반 선택'}</button>
            )}
          </div>
          {classes.length === 0 ? (
            <p className="muted">아직 반이 없어요. <Link to="/teacher/classes">반 관리</Link>에서 반을 만들면 여기서 고를 수 있어요. 지금 저장하면 비공개로 저장돼요.</p>
          ) : (
            <>
              <div className="check-grid">
                {classes.map((c) => (
                  <label key={c.id} className={`check-card ${form.openClassIds.includes(c.id) ? 'on' : ''}`}>
                    <input type="checkbox" checked={form.openClassIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
              <p className="muted small">{openCount ? `${openCount}개 반 학생에게 보여요.` : '아무 반도 고르지 않으면 비공개예요 (교사만 볼 수 있음).'}</p>
            </>
          )}
        </section>

        {err && <p className="error">{err}</p>}
        <div className="row editor-actions">
          <button className="btn primary" type="submit" disabled={busy}><Save size={18} /> {busy ? '저장 중…' : '저장'}</button>
          <Link className="btn" to="/teacher/lessons">취소</Link>
          {!isNew && (
            <button type="button" className="btn danger push-right" onClick={onDelete} disabled={busy}><Trash2 size={18} /> 차시 삭제</button>
          )}
        </div>
      </form>
    </>
  );
}
