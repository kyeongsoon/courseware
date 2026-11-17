import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * lessons/{lessonId}/slides/{번호}  { index, image(data URL), w, h }
 * lessons/{lessonId}.slideCount, slidesName
 *
 * PDF 를 교사 브라우저에서 장마다 그림(WebP, 안 되면 JPEG)으로 바꿔 Firestore 에 저장.
 * Firestore 문서 하나는 1MB 까지라, 한 장이 너무 크면 화질·크기를 낮춰 맞춤.
 */
export const SLIDE_LIMITS = { maxPages: 150, maxFileMB: 80, width: 1280, maxChars: 900_000 };

let pdfjsPromise = null;
// 학생 화면에서는 필요 없으므로 PDF 를 올릴 때만 불러옴
function loadPdfJs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  });
  return pdfjsPromise;
}

function encode(canvas, quality) {
  const webp = canvas.toDataURL('image/webp', quality);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', quality);
}

async function renderPage(page) {
  const base = page.getViewport({ scale: 1 });
  let width = SLIDE_LIMITS.width;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(width / base.width, 3);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    for (const q of [0.78, 0.6, 0.45]) {
      const image = encode(canvas, q);
      if (image.length <= SLIDE_LIMITS.maxChars) return { image, w: canvas.width, h: canvas.height };
    }
    width = Math.round(width * 0.75); // 그래도 크면 크기를 줄여서 다시
  }
  throw new Error('슬라이드 한 장이 너무 커요. 그림이 아주 많은 장은 나눠 주세요.');
}

// PDF 파일 → 슬라이드 그림 목록
export async function pdfToSlides(file, onProgress = () => {}) {
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    throw new Error('PDF 파일만 올릴 수 있어요. PowerPoint에서 파일 → 내보내기 → PDF로 저장해 주세요.');
  }
  if (file.size > SLIDE_LIMITS.maxFileMB * 1024 * 1024) throw new Error(`PDF는 ${SLIDE_LIMITS.maxFileMB}MB까지 올릴 수 있어요.`);
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > SLIDE_LIMITS.maxPages) throw new Error(`슬라이드는 ${SLIDE_LIMITS.maxPages}장까지 올릴 수 있어요.`);
    const slides = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress({ phase: 'convert', done: i - 1, total: pdf.numPages });
      const page = await pdf.getPage(i);
      slides.push(await renderPage(page));
      page.cleanup();
    }
    return slides;
  } finally {
    await task.destroy(); // 변환에 쓴 메모리 정리
  }
}

const slidesCol = (lessonId) => collection(db, 'lessons', lessonId, 'slides');
const slideRef = (lessonId, i) => doc(db, 'lessons', lessonId, 'slides', String(i).padStart(3, '0'));

// 슬라이드 저장 (예전 것보다 장수가 적으면 남는 장은 지움)
export async function saveSlides(lessonId, slides, { oldCount = 0, name = '' } = {}, onProgress = () => {}) {
  for (let i = 0; i < slides.length; i++) {
    onProgress({ phase: 'save', done: i, total: slides.length });
    await setDoc(slideRef(lessonId, i), { index: i, ...slides[i] });
  }
  for (let i = slides.length; i < oldCount; i++) await deleteDoc(slideRef(lessonId, i));
  await updateDoc(doc(db, 'lessons', lessonId), { slideCount: slides.length, slidesName: name.slice(0, 100) });
}

export async function deleteAllSlides(lessonId, { updateLesson = true } = {}) {
  const snap = await getDocs(slidesCol(lessonId));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  if (updateLesson) await updateDoc(doc(db, 'lessons', lessonId), { slideCount: 0, slidesName: '' });
}

// 슬라이드 실시간 구독 (교체하면 바로 반영)
export function useSlides(lessonId, count) {
  const [slides, setSlides] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!lessonId || !count) {
      setSlides([]);
      return undefined;
    }
    return onSnapshot(
      query(slidesCol(lessonId), orderBy('index')),
      (snap) => setSlides(snap.docs.map((d) => d.data())),
      (err) => setError(err.code ?? err.message),
    );
  }, [lessonId, count]);
  return { slides, error };
}
