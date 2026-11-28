import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { parseCheckIn } from '../checkinCode';

/**
 * 학생: 출석 QR 인증 창 — 카메라로 교실 화면의 QR을 찍거나 6자리 코드를 입력
 * onCode(code) 는 Promise. 실패하면 메시지를 보여 주고 다시 찍을 수 있음
 */
export default function QrScanner({ classId, onCode, onClose }) {
  const video = useRef(null);
  const [camErr, setCamErr] = useState('');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const busyRef = useRef(false);
  const failed = useRef({ code: '', at: 0 }); // 카메라가 방금 실패한 QR을 계속 다시 읽지 않게

  const submit = async (code, fromCamera = false) => {
    if (busyRef.current) return;
    if (fromCamera && failed.current.code === code && Date.now() - failed.current.at < 3000) return;
    busyRef.current = true;
    setBusy(true);
    setErr('');
    try {
      await onCode(code);
    } catch (e) {
      setErr(e.message);
      failed.current = { code, at: Date.now() };
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  useEffect(() => {
    let stream = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setCamErr('이 브라우저는 카메라를 쓸 수 없어요. 아래에 코드를 입력하세요.');
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      } catch {
        return setCamErr('카메라를 켤 수 없어요. 카메라 권한을 허용하거나, 아래에 코드를 입력하세요.');
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      const v = video.current;
      v.srcObject = stream;
      await v.play().catch(() => {});
      const { default: jsQR } = await import('jsqr');
      const scan = () => {
        if (stopped) return;
        if (v.readyState >= 2 && v.videoWidth && !busyRef.current) {
          const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480);
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0, w, h);
          const hit = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          const got = hit && parseCheckIn(hit.data);
          if (got) {
            if (got.classId && got.classId !== classId) setErr('다른 반의 출석 QR이에요.');
            else submit(got.code, true);
          }
        }
        raf = requestAnimationFrame(scan);
      };
      scan();
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  const onType = (e) => {
    e.preventDefault();
    const code = typed.replace(/\D/g, '');
    if (code.length !== 6) return setErr('코드 6자리를 입력하세요.');
    submit(code);
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal qr-scan" role="dialog" aria-label="QR로 출석" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <h2><Camera size={18} className="h-icon" /> QR로 출석</h2>
          <button className="icon-btn" onClick={onClose} title="닫기"><X size={20} /></button>
        </div>
        <p className="muted small">교실 화면의 QR 코드를 네모 안에 비춰 주세요.</p>
        {camErr ? <p className="info">{camErr}</p> : (
          <div className="scan-box">
            <video ref={video} playsInline muted />
            <span className="scan-frame" aria-hidden="true" />
          </div>
        )}
        <form className="row" onSubmit={onType}>
          <input className="grow code-input" inputMode="numeric" autoComplete="off" maxLength={7} value={typed}
            onChange={(e) => setTyped(e.target.value)} placeholder="화면의 코드 6자리" aria-label="출석 코드" />
          <button className="btn primary" type="submit" disabled={busy}>{busy ? '확인 중…' : '출석'}</button>
        </form>
        {err && <p className="error">{err}</p>}
      </div>
    </div>
  );
}
