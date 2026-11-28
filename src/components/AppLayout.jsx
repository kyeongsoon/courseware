import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Users,
  School,
  Library,
  Megaphone,
  Vote,
  HeartHandshake,
  CalendarCheck,
  Armchair,
  CalendarDays,
  Clock,
  UserPlus,
  KeyRound,
  CircleHelp,
  LogOut,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LiveBar from './LiveBar';
import { FEATURES } from '../features';
import { ClassPicker } from './ClassGate';

const COLLAPSE_KEY = 'sidebar-collapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

/** 메뉴 구성: 역할에 따라 보이는 항목이 달라짐 */
function buildSections({ isTeacher, hasPassword }) {
  const classItems = [
    { to: '/', label: '홈', icon: LayoutGrid, end: true },
    { to: '/notices', label: '알림장', icon: Megaphone },
    { to: '/polls', label: '설문·투표', icon: Vote },
    { to: '/counsel', label: isTeacher ? '상담 신청함' : '상담 신청', icon: HeartHandshake },
  ];
  const lifeItems = [
    { to: '/attendance', label: isTeacher ? '출결' : '출석 체크', icon: CalendarCheck },
    { to: '/seating', label: isTeacher ? '자리 배치' : '자리표', icon: Armchair },
  ];
  const planItems = [
    { to: '/calendar', label: '학급 달력', icon: CalendarDays },
    { to: '/timetable', label: '시간표', icon: Clock },
  ];
  const sections = [{ title: '우리 반', items: classItems }, { title: '생활', items: lifeItems }, { title: '일정', items: planItems }];
  if (isTeacher && FEATURES.lessons) {
    sections.push({ title: '수업', items: [{ to: '/teacher/lessons', label: '수업 관리', icon: Library }] });
  }
  if (isTeacher) {
    sections.push({
      title: '학생 관리',
      items: [
        { to: '/teacher/classes', label: '반 관리', icon: School },
        { to: '/teacher/students', label: '학생 명단', icon: Users },
        { to: '/teacher/accounts', label: '계정 만들기', icon: UserPlus },
      ],
    });
  }
  const settingItems = [];
  if (isTeacher) settingItems.push({ to: '/teacher/school', label: '학교 설정 (나이스)', icon: School });
  if (hasPassword) settingItems.push({ to: '/change-password', label: '비밀번호 변경', icon: KeyRound });
  if (settingItems.length) sections.push({ title: '설정', items: settingItems });
  return sections;
}

export function usePageTitle() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/teacher/classes')) return '반 관리';
  if (pathname.startsWith('/teacher/school')) return '학교 설정';
  if (pathname.startsWith('/notices')) return '알림장';
  if (pathname.startsWith('/polls')) return '설문·투표';
  if (pathname.startsWith('/counsel')) return '상담';
  if (pathname.startsWith('/attendance')) return '출결';
  if (pathname.startsWith('/seating')) return '자리표';
  if (pathname.startsWith('/calendar')) return '학급 달력';
  if (pathname.startsWith('/timetable')) return '시간표';
  if (pathname === '/teacher/lessons/new') return '새 차시';
  if (pathname.endsWith('/edit')) return '차시 수정';
  if (pathname.startsWith('/teacher/lessons')) return '수업 관리';
  if (pathname.startsWith('/lessons/')) return '수업';
  return (
    {
      '/': '홈',
      '/teacher/students': '학생 명단',
      '/teacher/accounts': '학생 계정 만들기',
      '/change-password': '비밀번호 변경',
      '/help': '도움말',
    }[pathname] ?? ''
  );
}

export default function AppLayout() {
  const { user, profile, isTeacher, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const title = usePageTitle();

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [q, setQ] = useState('');

  const hasPassword = user?.providerData.some((p) => p.providerId === 'password');
  const sections = useMemo(() => buildSections({ isTeacher, hasPassword }), [isTeacher, hasPassword]);

  // 검색어로 메뉴 걸러내기
  const filtered = useMemo(() => {
    const k = q.trim();
    if (!k) return sections;
    return sections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.includes(k)) }))
      .filter((s) => s.items.length);
  }, [sections, q]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1');
      } catch {
        /* 저장 불가 환경 무시 */
      }
      return !c;
    });
  };

  const onSearchKey = (e) => {
    if (e.key === 'Enter') {
      const first = filtered[0]?.items[0];
      if (first) {
        navigate(first.to);
        setQ('');
      }
    }
  };

  // 첫 로그인 비밀번호 변경 중에는 메뉴 없이 화면만.
  // (컴포넌트 구조는 그대로 두고 메뉴만 숨겨야 본문이 다시 그려지지 않음)
  const bare = !!profile?.mustChangePassword;

  const isCollapsed = collapsed && !mobileOpen;
  const name = profile?.displayName || (isTeacher ? '선생님' : '');
  const initial = (name || user?.email || '?').charAt(0).toUpperCase();

  return (
    <div className={`shell ${isCollapsed ? 'collapsed' : ''} ${bare ? 'bare' : ''}`}>
      {mobileOpen && <div className="scrim" onClick={() => setMobileOpen(false)} />}

      {!bare && <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="주 메뉴">
        <div className="brand">
          <div className="logo" aria-hidden="true">👋</div>
          <span className="brand-name">Hello, Class!</span>
          <button className="icon-btn collapse-btn" onClick={toggleCollapsed} title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}>
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
          </button>
          <button className="icon-btn close-btn" onClick={() => setMobileOpen(false)} title="메뉴 닫기">
            <X size={20} />
          </button>
        </div>

        <label className="search" title="메뉴 검색">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onSearchKey} placeholder="메뉴 검색" />
        </label>

        <nav className="nav">
          {filtered.map((s) => (
            <div key={s.title} className="nav-section">
              <div className="nav-title">{s.title}</div>
              {s.items.map((i) => (
                <NavLink key={i.to} to={i.to} end={i.end} className="nav-item" title={i.label}>
                  <i.icon size={20} strokeWidth={1.75} />
                  <span>{i.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <p className="nav-empty">일치하는 메뉴가 없어요</p>}
        </nav>

        <div className="nav-bottom">
          <NavLink to="/help" className="nav-item" title="도움말">
            <CircleHelp size={20} strokeWidth={1.75} />
            <span>도움말</span>
          </NavLink>
          <button className="nav-item" onClick={logout} title="로그아웃">
            <LogOut size={20} strokeWidth={1.75} />
            <span>로그아웃</span>
          </button>
        </div>
      </aside>}

      <div className="content">
        {!bare && <header className="content-header">
          <button className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} title="메뉴 열기">
            <Menu size={22} />
          </button>
          <h1>{title}</h1>
          <ClassPicker />
          <div className="me">
            <span className="role">{isTeacher ? '교사' : '학생'}</span>
            <span className="me-name">
              {name}
              {profile?.studentId && <small> {profile.studentId}</small>}
            </span>
            <span className="avatar">{initial}</span>
          </div>
        </header>}
        {!bare && FEATURES.lessons && <LiveBar />}
        <main className="content-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
