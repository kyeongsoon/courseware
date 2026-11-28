import { useMemo } from 'react';
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from 'd3-force';
import { NOTE_KINDS } from '../relations';

const W = 820, H = 580, PAD = 60;
export const GROUP_COLORS = ['#22b573', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16', '#06b6d4'];
const EDGE = { added: '#16a34a', removed: '#dc2626', kept: '#a1a1aa' };

// 같은 학생은 회차를 바꿔도 비슷한 자리에 오도록: 학번순 원에서 시작해 정해진 횟수만 계산 (무작위 없음)
// 화면 비율(가로로 넓게)에 맞게 퍼뜨리고, 점 크기+이름 자리만큼 겹치지 않게. 크기는 줄이지 않고 보는 범위(viewBox)를 맞춤
export function useLayout(roster, layoutEdges, radius) {
  return useMemo(() => {
    const n = roster.length;
    const sorted = [...roster].sort((a, b) => String(a.studentId).localeCompare(String(b.studentId)));
    const R0 = 60 + n * 9;
    const nodes = sorted.map((s, i) => {
      const t = (i / Math.max(1, n)) * Math.PI * 2;
      return { id: s.uid, r: radius(s.uid), x: Math.cos(t) * R0 * 1.4, y: Math.sin(t) * R0 };
    });
    const ids = new Set(nodes.map((d) => d.id));
    const links = layoutEdges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ source: e.from, target: e.to, mutual: e.mutual }));
    const sim = forceSimulation(nodes)
      .force('link', forceLink(links).id((d) => d.id).distance((l) => (l.mutual ? 85 : 120)).strength(0.35))
      .force('charge', forceManyBody().strength(-420).distanceMax(500))
      .force('x', forceX(0).strength(0.035))
      .force('y', forceY(0).strength(0.07))
      .force('collide', forceCollide((d) => d.r + 26).strength(1).iterations(3))
      .stop();
    for (let i = 0; i < 450; i++) sim.tick();
    const xs = nodes.map((d) => d.x), ys = nodes.map((d) => d.y);
    let [x0, x1, y0, y1] = [Math.min(...xs) - PAD, Math.max(...xs) + PAD, Math.min(...ys) - PAD, Math.max(...ys) + PAD + 14];
    // 너무 작으면 기본 크기만큼 (점이 지나치게 커 보이지 않게)
    if (x1 - x0 < W) { const c = (x0 + x1) / 2; x0 = c - W / 2; x1 = c + W / 2; }
    if (y1 - y0 < H) { const c = (y0 + y1) / 2; y0 = c - H / 2; y1 = c + H / 2; }
    return { pos: Object.fromEntries(nodes.map((d) => [d.id, { x: d.x, y: d.y }])), vb: `${x0} ${y0} ${x1 - x0} ${y1 - y0}` };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.map((s) => `${s.uid}:${radius(s.uid)}`).join(), layoutEdges.map((e) => `${e.from}>${e.to}`).join()]);
}

// 두 점 사이 선을 원 가장자리에서 끊기 (화살촉이 원에 가리지 않게)
function trim(a, b, ra, rb) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x1: a.x + (dx / len) * ra, y1: a.y + (dy / len) * ra, x2: b.x - (dx / len) * (rb + 4), y2: b.y - (dy / len) * (rb + 4) };
}

/**
 * edges: [{ from, to, weight, mutual, status?('added'|'removed'|'kept') }]
 * notes: 관찰 기록 [{ a, b, kind }] (선택)
 */
export default function RelationGraph({ roster, edges, layoutEdges, deg, groups, notes = [], conflicts = [], selected, onSelect, compare = false }) {
  const radius = (uid) => 17 + Math.min(5, deg[uid]?.inn ?? 0) * 3;
  const { pos, vb } = useLayout(roster, layoutEdges ?? edges, radius);
  const touches = (e) => !selected || e.from === selected || e.to === selected || e.a === selected || e.b === selected;
  const drawn = new Set();

  return (
    <svg className="rel-graph" viewBox={vb} role="img" aria-label="학급 관계도" onClick={() => onSelect?.(null)}>
      <defs>
        {[['arrow', '#71717a'], ['arrow-added', EDGE.added], ['arrow-removed', EDGE.removed], ['arrow-hi', '#18181b'], ['arrow-conflict', '#dc2626']].map(([id, c]) => (
          <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="11" markerHeight="11" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {notes.map((n) => {
        const a = pos[n.a], b = pos[n.b];
        if (!a || !b) return null;
        return <line key={n.id} className="rel-note" x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={NOTE_KINDS[n.kind]?.color ?? '#71717a'} strokeWidth={3} strokeDasharray="2 6" strokeLinecap="round" opacity={touches(n) ? 0.8 : 0.12} />;
      })}

      {conflicts.map((c) => {
        const a = pos[c.from], b = pos[c.to];
        if (!a || !b) return null;
        const l = trim(a, b, radius(c.from), radius(c.to));
        return <line key={`c-${c.from}>${c.to}`} className="rel-conflict" {...l} stroke="#dc2626" strokeWidth={2.4} strokeDasharray="7 5"
          markerEnd="url(#arrow-conflict)" opacity={touches(c) ? 0.9 : 0.12} />;
      })}

      {edges.map((e) => {
        const a = pos[e.from], b = pos[e.to];
        if (!a || !b) return null;
        const pair = [e.from, e.to].sort().join('|');
        if (!compare && e.mutual) {
          if (drawn.has(pair)) return null;
          drawn.add(pair);
        }
        const on = touches(e);
        const hi = selected && on;
        const color = compare ? EDGE[e.status] : hi ? '#18181b' : e.mutual ? '#52525b' : '#a1a1aa';
        const marker = compare ? (e.status === 'kept' ? 'arrow' : `arrow-${e.status}`) : hi ? 'arrow-hi' : 'arrow';
        const l = trim(a, b, radius(e.from), radius(e.to));
        return (
          <line key={`${e.from}>${e.to}`} {...l} className={`rel-edge ${e.mutual ? 'mutual' : ''} ${e.status ?? ''}`}
            stroke={color} strokeWidth={(e.mutual && !compare ? 3.2 : 1.6) + (e.weight > 1 ? 0.8 : 0)}
            strokeDasharray={e.status === 'removed' ? '6 5' : undefined}
            markerEnd={!compare && e.mutual ? `url(#${marker})` : `url(#${marker})`}
            markerStart={!compare && e.mutual ? `url(#${marker})` : undefined}
            opacity={on ? 1 : 0.12} />
        );
      })}

      {roster.map((s) => {
        const p = pos[s.uid];
        if (!p) return null;
        const r = radius(s.uid);
        const g = groups?.[s.uid] ?? -1;
        const lonely = (deg[s.uid]?.inn ?? 0) === 0;
        const dim = selected && selected !== s.uid && !edges.some((e) => (e.from === selected && e.to === s.uid) || (e.to === selected && e.from === s.uid));
        return (
          <g key={s.uid} className={`rel-node ${selected === s.uid ? 'on' : ''} ${lonely ? 'lonely' : ''}`} transform={`translate(${p.x},${p.y})`}
            opacity={dim ? 0.25 : 1} onClick={(ev) => { ev.stopPropagation(); onSelect?.(selected === s.uid ? null : s.uid); }}
            role="button" aria-label={`${s.name} (받은 선택 ${deg[s.uid]?.inn ?? 0})`} tabIndex={0}
            onKeyDown={(ev) => ev.key === 'Enter' && onSelect?.(s.uid)}>
            {lonely && <circle r={r + 6} fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="4 3" />}
            <circle r={r} fill={g >= 0 ? GROUP_COLORS[g % GROUP_COLORS.length] : '#d4d4d8'} stroke={selected === s.uid ? '#18181b' : '#fff'} strokeWidth={selected === s.uid ? 3 : 2} />
            <text y={4} textAnchor="middle" className="rel-in">{deg[s.uid]?.inn ?? 0}</text>
            <text y={r + 18} textAnchor="middle" className="rel-name">{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
