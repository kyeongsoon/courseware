// 화면·서버(자동 갱신 스크립트) 양쪽에서 쓰는 순수 계산 함수 (Firebase 안 씀)

// ── 날짜 계산 (날짜 숫자 20261128 ↔ 달력) ──
export const ymd = (y, m, d) => y * 10000 + m * 100 + d;
export const parts = (n) => [Math.floor(n / 10000), Math.floor(n / 100) % 100, n % 100];
const utc = (n) => {
  const [y, m, d] = parts(n);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (n, k) => {
  const t = new Date(utc(n) + k * 86400000);
  return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
};
export const diffDays = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
export const weekday = (n) => new Date(utc(n)).getUTCDay(); // 0=일

// 한국 시각 오늘 날짜 숫자 (20261128)
export const kstToday = (now = new Date()) => {
  const k = new Date(now.getTime() + 9 * 3600000);
  return ymd(k.getUTCFullYear(), k.getUTCMonth() + 1, k.getUTCDate());
};

// ── 시간표 ──
export const DEFAULT_TIMES = ['08:40-09:25', '09:35-10:20', '10:30-11:15', '11:25-12:10', '13:00-13:45', '13:55-14:40', '14:50-15:35', '15:45-16:30', '16:40-17:25', '17:35-18:20'];
export const emptyTimetable = (days = 5, periods = 7) => ({
  days, periods, times: DEFAULT_TIMES.slice(0, periods), cells: Array(days * periods).fill(null),
});

export const cellAt = (tt, day, period) => tt.cells[day * tt.periods + period];

// 요일·교시 수 바꾸기 (남는 칸은 유지)
export function resizeTimetable(tt, days, periods) {
  const cells = Array(days * periods).fill(null);
  for (let d = 0; d < Math.min(days, tt.days); d++) {
    for (let p = 0; p < Math.min(periods, tt.periods); p++) cells[d * periods + p] = cellAt(tt, d, p);
  }
  const times = Array.from({ length: periods }, (_, i) => tt.times[i] ?? DEFAULT_TIMES[i] ?? '');
  return { ...tt, days, periods, cells, times };
}
