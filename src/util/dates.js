// 날짜 표시 도우미 (한국 시간 기준)
const fmt = (opts) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opts });

export function toDate(ts) {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  return ts instanceof Date ? ts : new Date(ts);
}

// "11월 27일 (금) 오후 3:20"
export function formatDateTime(ts) {
  const d = toDate(ts);
  return d ? fmt({ month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(d) : '';
}

// "11월 27일 (금)"
export function formatDate(ts) {
  const d = toDate(ts);
  return d ? fmt({ month: 'long', day: 'numeric', weekday: 'short' }).format(d) : '';
}

// 방금 / 5분 전 / 3시간 전 / 날짜
export function timeAgo(ts, now = Date.now()) {
  const d = toDate(ts);
  if (!d) return '방금';
  const s = Math.round((now - d.getTime()) / 1000);
  if (s < 60) return '방금';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  return formatDate(d);
}

// 정렬용 숫자 (아직 서버 시각이 안 정해진 새 글은 맨 위로)
export const tsMillis = (ts) => toDate(ts)?.getTime() ?? Number.MAX_SAFE_INTEGER;
