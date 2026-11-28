import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Maximize, Minimize, QrCode, X } from 'lucide-react';
import { ROTATE_MS, checkInUrl, useRotatingCode } from '../checkinCode';
import { kstTime } from '../attendance';

/** 교사: 교실 TV/프로젝터에 띄우는 출석 QR (20초마다 바뀜) */
export default function CheckInQr({ classId, className, teacherUid, roster, records, onClose }) {
  const { code, left, err } = useRotatingCode(classId, teacherUid);
  const [img, setImg] = useState('');
  const box = useRef(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    if (!code) return;
    QRCode.toDataURL(checkInUrl(classId, code), { width: 640, margin: 1, errorCorrectionLevel: 'M' }).then(setImg).catch(() => setImg(''));
  }, [classId, code]);

  useEffect(() => {
    const on = () => setFull(document.fullscreenElement === box.current);
    document.addEventListener('fullscreenchange', on);
    const esc = (e) => e.key === 'Escape' && !document.fullscreenElement && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);

  const inRoster = new Set(roster.map((s) => s.uid));
  const checked = records.filter((r) => inRoster.has(r.uid));
  const recent = records.filter((r) => r.by === 'self' && r.checkedAt).sort((a, b) => (b.checkedAt?.toMillis?.() ?? 0) - (a.checkedAt?.toMillis?.() ?? 0)).slice(0, 8);

  return (
    <div className="qr-screen" ref={box} role="dialog" aria-label="출석 QR">
      <div className="qr-top">
        <h2><QrCode size={22} /> {className} 출석</h2>
        <div className="row">
          <button className="icon-btn" onClick={() => (document.fullscreenElement ? document.exitFullscreen?.() : box.current?.requestFullscreen?.())} title={full ? '전체 화면 끝내기' : '전체 화면'}>
            {full ? <Minimize size={22} /> : <Maximize size={22} />}
          </button>
          <button className="icon-btn" onClick={onClose} title="닫기"><X size={22} /></button>
        </div>
      </div>
      <div className="qr-body">
        <div className="qr-left">
          {img ? <img className="qr-img" src={img} alt="출석 QR 코드" /> : <div className="qr-img qr-wait">QR 만드는 중…</div>}
          <p className="qr-howto">휴대폰 카메라로 찍거나, 사이트의 <b>QR로 출석</b>에서 찍으세요</p>
        </div>
        <div className="qr-right">
          <p className="muted">또는 코드 입력</p>
          <p className="qr-code" aria-label="출석 코드">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : '······'}</p>
          <div className="qr-bar" aria-hidden="true"><span style={{ width: `${(left / (ROTATE_MS / 1000)) * 100}%` }} /></div>
          <p className="muted small">{left}초 뒤 새 코드</p>
          <p className="qr-count"><b>{checked.length}</b> / {roster.length}명 출석</p>
          {recent.length > 0 && (
            <ul className="qr-recent">
              {recent.map((r) => <li key={r.id}><b>{r.name}</b> <span className="muted">{kstTime(r.checkedAt)}</span></li>)}
            </ul>
          )}
          {err && <p className="error">{err}</p>}
        </div>
      </div>
    </div>
  );
}
