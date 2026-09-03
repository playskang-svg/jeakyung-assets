import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import GroupwareBrand from '../components/GroupwareBrand.jsx';
import UserAccountMenu from '../components/profile/UserAccountMenu.jsx';
import { getRouteTrail } from '../config/navigation.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { APPROVAL_STATE_CHANGED_EVENT, approvalService } from '../services/approvalService.js';
import PopupLayer from '../../shared/popup/PopupLayer.jsx';

function getPopupTarget(pathname) {
  if (pathname.startsWith('/admin')) return 'groupware_admin';
  if (pathname.startsWith('/approval')) return 'groupware_approval';
  if (pathname.startsWith('/boards')) return 'groupware_boards';
  return 'groupware_dashboard';
}

// 왼쪽 사이드바는 없앴다. 메뉴를 세로로 길게 늘어놓는 대신 대시보드의 박스가
// 이동 경로가 된다. 어디로 갈 수 있는지는 시스템 관리자가 대시보드 구성으로 정한다.
// 그래서 이 껍데기가 항상 들고 있어야 하는 것은 두 가지뿐이다.
//   - 대시보드로 돌아가는 길(상단 왼쪽 로고)
//   - 내가 누구이고 어떤 권한인지, 그리고 나가는 문(상단 오른쪽)
// 관리자 화면으로 가는 버튼은 시스템 관리자에게만 보인다. 관리자 권한이 없는
// 사람에게 들어가지지 않는 문을 보여 줄 이유가 없다.
export default function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signOutError, setSignOutError] = useState('');
  const [headerState, setHeaderState] = useState({ approval_pending: 0, unread_count: 0, notifications: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  const isSuperAdmin = auth.activeRole === 'super_admin';

  useEffect(() => {
    if (auth.status !== 'approved') { setHeaderState({ approval_pending: 0, unread_count: 0, notifications: [] }); return undefined; }
    let active = true;
    const loadHeader = () => approvalService.getHeaderState().then((value) => active && setHeaderState(value)).catch(() => {});
    loadHeader();
    const timer = window.setInterval(loadHeader, 60000);
    window.addEventListener(APPROVAL_STATE_CHANGED_EVENT, loadHeader);
    const channel = supabase.channel(`groupware-notifications-${auth.user?.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'groupware_notifications', filter: `user_id=eq.${auth.user?.id}` }, loadHeader).subscribe();
    return () => { active = false; window.clearInterval(timer); window.removeEventListener(APPROVAL_STATE_CHANGED_EVENT, loadHeader); supabase.removeChannel(channel); };
  }, [auth.status, auth.user?.id, location.pathname]);

  // 알림 패널은 바깥을 누르거나 Esc 를 누르면 닫는다. 사이드바가 없어진 만큼
  // 화면 위에 떠 있는 것은 스스로 정리되어야 한다.
  useEffect(() => {
    if (!notificationsOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!notificationRef.current?.contains(event.target)) setNotificationsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('mousedown', handlePointerDown); document.removeEventListener('keydown', handleKeyDown); };
  }, [notificationsOpen]);

  useEffect(() => { setNotificationsOpen(false); }, [location.pathname]);

  return (
    <div className="gw-app-shell gw-app-shell--flat">
      <PopupLayer client={supabase} target={getPopupTarget(location.pathname)} />
      <a className="gw-skip-link" href="#groupware-content">본문으로 바로가기</a>

      <div className="gw-workspace">
        <header className="gw-topbar">
          <div className="gw-topbar-title">
            <Link className="gw-topbar-brand" to="/" aria-label="대시보드로 이동"><GroupwareBrand /></Link>
          </div>
          <div className="gw-topbar-tools" aria-label="사용자와 업무 도구">
            <TopSearch />
            <TopClock />
            {/* 인트라넷 홈. 옆의 '홈페이지'는 회사 웹사이트로 나가므로, 여기
                안으로 돌아오는 길을 따로 둔다. */}
            <Link className="gw-intranet-home-button" to="/dashboard" title="인트라넷 홈" aria-label="인트라넷 홈">
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8" /><path d="M12 18v3" /></svg>
            </Link>
            <a className="gw-site-home-button" href="https://jeakyung.com/" target="_blank" rel="noopener noreferrer" title="회사 홈페이지" aria-label="회사 홈페이지, 새 창">
              <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11 12 4l9 7" /><path d="M6 10v9h12v-9" /></svg>
              <span className="gw-tool-label">홈페이지</span>
            </a>
            {isSuperAdmin && (
              <Link className="gw-admin-mode-button" to="/admin">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6.5v5c0 4.4 3.2 8.3 8 9.5 4.8-1.2 8-5.1 8-9.5v-5L12 3Z" /><path d="m9 12 2 2 4-4" /></svg>
                <span className="gw-tool-label">관리자 모드</span>
              </Link>
            )}
            <div className="gw-notification-menu" ref={notificationRef}><button type="button" aria-expanded={notificationsOpen} aria-controls="groupware-notification-panel" title="개인 알림" onClick={() => setNotificationsOpen((current) => !current)}><span aria-hidden="true">●</span><span className="gw-tool-label">알림</span>{headerState.unread_count > 0 && <span className="gw-topbar-count">{headerState.unread_count}</span>}</button>{notificationsOpen && <div className="gw-notification-panel" id="groupware-notification-panel"><header><strong>개인 알림</strong>{headerState.unread_count > 0 && <button type="button" onClick={async () => { await approvalService.markNotificationRead(); setHeaderState((current) => ({ ...current, unread_count: 0, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })) })); }}>모두 읽음</button>}</header><div>{headerState.notifications.map((item) => <button type="button" className={item.read_at ? '' : 'is-unread'} key={item.id} onClick={async () => { if (!item.read_at) await approvalService.markNotificationRead(item.id); setNotificationsOpen(false); if (item.route) navigate(item.route); }}><strong>{item.title}</strong><span>{item.message}</span><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time></button>)}</div>{headerState.notifications.length === 0 && <p>새 알림이 없습니다.</p>}</div>}</div>
            <UserAccountMenu onSignOutError={setSignOutError} />
          </div>
        </header>
        <main className="gw-content" id="groupware-content" tabIndex="-1">
          <RouteBar />
          {signOutError && <div className="gw-notice gw-notice--warning" role="alert">{signOutError}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 게시판 전체 검색. 어느 게시판에 썼는지 기억나지 않는 글을 찾는 자리라
// 화면마다 있어야 한다.
//
// 좁은 화면에서는 입력칸을 접고 돋보기만 남긴다. 누르면 펼쳐지며 커서가
// 들어간다 — 접힌 채로는 무엇을 하는 버튼인지 알 수 없으니 aria-label 을 둔다.
function TopSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const inputRef = useRef(null);

  // 검색 화면을 벗어나면 입력칸을 비운다. 다른 화면 상단에 지난 검색어가
  // 남아 있으면 그 화면이 그 검색 결과인 것처럼 보인다.
  useEffect(() => {
    if (!location.pathname.startsWith('/search')) setTerm('');
  }, [location.pathname]);

  const submit = (event) => {
    event.preventDefault();
    const query = term.trim();
    if (!query) { inputRef.current?.focus(); return; }
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <form className={open ? 'gw-topsearch is-open' : 'gw-topsearch'} role="search" onSubmit={submit}>
      <button type="submit" aria-label="검색" onClick={() => { if (!open) { setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); } }}>
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
      </button>
      <input
        ref={inputRef}
        type="search"
        value={term}
        placeholder="게시판 검색"
        aria-label="게시판 전체 검색"
        onChange={(event) => setTerm(event.target.value)}
        onBlur={() => { if (!term.trim()) setOpen(false); }}
      />
    </form>
  );
}

// 날짜·시계와 일정 버튼. 홈 화면 위쪽에 있던 것을 상단바로 올렸다 — 매일
// 보는 값이라 홈에서만 보이면 다른 화면에서는 달력을 따로 열어야 했다.
// 좁은 화면에서는 날짜와 시계를 접고 일정 버튼만 남긴다.
function TopClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return (
    <div className="gw-topclock">
      <span className="gw-topclock-date">{now.getMonth() + 1}월 {now.getDate()}일 {WEEKDAYS[now.getDay()]}</span>
      <time className="gw-topclock-time" dateTime={now.toISOString()}>{time}</time>
      <Link className="gw-topclock-button" to="/view/schedule" title="사내일정" aria-label="사내일정">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
        <span className="gw-tool-label">일정</span>
      </Link>
    </div>
  );
}

// 지금 어디에 있고 어떻게 빠져나가는지. 사이드바가 없어진 뒤로 이 줄이
// 없으면 두세 단계 들어간 화면에서 돌아갈 길이 주소창밖에 남지 않는다.
function RouteBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const trail = getRouteTrail(location.pathname);

  // 대시보드에서는 굳이 "홈 > 대시보드"를 보여 줄 필요가 없다.
  if (trail.length <= 1) return null;

  // 새 탭이나 북마크로 바로 들어오면 돌아갈 이력이 없다. 그럴 때 navigate(-1)
  // 은 그룹웨어 바깥으로 나가 버리므로 한 단계 위 화면으로 보낸다.
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate(trail[trail.length - 2].path);
  };

  return (
    <nav className="gw-routebar" aria-label="현재 위치">
      <ol>
        {trail.map((step, index) => (
          <li key={step.path}>
            {index === trail.length - 1
              ? <span aria-current="page">{step.label}</span>
              : <Link to={step.path}>{step.label}</Link>}
          </li>
        ))}
      </ol>
      <div className="gw-routebar-actions">
        <button type="button" onClick={goBack}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          뒤로
        </button>
        <Link to="/dashboard">
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 11 12 4l8 7" /><path d="M6 10v9h12v-9" /></svg>
          홈으로
        </Link>
      </div>
    </nav>
  );
}

