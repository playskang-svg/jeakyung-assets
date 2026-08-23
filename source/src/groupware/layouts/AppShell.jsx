import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import GroupwareBrand from '../components/GroupwareBrand.jsx';
import NavigationIcon from '../components/NavigationIcon.jsx';
import ProfileAvatar from '../components/profile/ProfileAvatar.jsx';
import UserAccountMenu from '../components/profile/UserAccountMenu.jsx';
import { GROUPWARE_NAVIGATION, getRouteTitle } from '../config/navigation.js';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase } from '../lib/supabase.js';
import { BOARD_CATALOG_CHANGED_EVENT, getVisibleBoards } from '../services/boardService.js';
import { APPROVAL_STATE_CHANGED_EVENT, approvalService } from '../services/approvalService.js';
import PopupLayer from '../../shared/popup/PopupLayer.jsx';

const MOBILE_QUERY = '(max-width: 1023px)';

function getPopupTarget(pathname) {
  if (pathname.startsWith('/admin')) return 'groupware_admin';
  if (pathname.startsWith('/approval')) return 'groupware_approval';
  if (pathname.startsWith('/boards')) return 'groupware_boards';
  return 'groupware_dashboard';
}

export default function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuButtonRef = useRef(null);
  const firstMenuRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [signOutError, setSignOutError] = useState('');
  const [boards, setBoards] = useState([]);
  const [headerState, setHeaderState] = useState({ approval_pending: 0, unread_count: 0, notifications: [] });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const visibleNavigation = useMemo(
    () => GROUPWARE_NAVIGATION.filter((item) => !item.requiredPermission || auth.permissions.includes(item.requiredPermission)),
    [auth.permissions],
  );

  const closeDrawer = ({ restoreFocus = false } = {}) => {
    setDrawerOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const openDrawer = () => {
    setDrawerOpen(true);
    window.requestAnimationFrame(() => firstMenuRef.current?.focus());
  };

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event) => {
      setIsMobile(event.matches);
      if (!event.matches) setDrawerOpen(false);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') closeDrawer({ restoreFocus: true });
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (isMobile) setDrawerOpen(false);
  }, [location.pathname, isMobile]);

  useEffect(() => {
    document.body.classList.toggle('gw-drawer-open', isMobile && drawerOpen);
    return () => document.body.classList.remove('gw-drawer-open');
  }, [drawerOpen, isMobile]);

  useEffect(() => {
    if (auth.status !== 'approved') { setBoards([]); return; }
    const loadBoards = () => getVisibleBoards().then(setBoards).catch(() => setBoards([]));
    loadBoards();
    window.addEventListener(BOARD_CATALOG_CHANGED_EVENT, loadBoards);
    return () => window.removeEventListener(BOARD_CATALOG_CHANGED_EVENT, loadBoards);
  }, [auth.status, auth.activeRole, location.pathname]);

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

  const boardGroups = useMemo(() => boards.reduce((result, board) => {
    const group = board.group_name ?? '기타';
    (result[group] ??= []).push(board);
    return result;
  }, {}), [boards]);
  const favoriteBoards = boards.filter((board) => board.is_favorite);
  const recentBoards = boards.filter((board) => board.last_visited_at).sort((a, b) => new Date(b.last_visited_at) - new Date(a.last_visited_at)).slice(0, 5);

  const sidebarHidden = isMobile && !drawerOpen;

  const displayName = auth.profile?.display_name || auth.profile?.preferred_name || auth.profile?.full_name || auth.profile?.name || '사용자';
  const activeRoleName = auth.assignedRoles.find((role) => role.code === auth.activeRole)?.name || auth.activeRole || '역할 확인 중';

  return (
    <div className={`gw-app-shell${collapsed ? ' gw-app-shell--collapsed' : ''}`}>
      <PopupLayer client={supabase} target={getPopupTarget(location.pathname)} />
      <a className="gw-skip-link" href="#groupware-content">본문으로 바로가기</a>
      <aside
        className={`gw-sidebar${drawerOpen ? ' is-open' : ''}`}
        aria-label="그룹웨어 주요 메뉴"
        aria-hidden={sidebarHidden || undefined}
        inert={sidebarHidden}
      >
        <div className="gw-sidebar-header">
          <GroupwareBrand compact={collapsed} />
          {/* 접기 버튼은 사이드바 하단이 아니라 로고 옆(일반적인 위치)에 둔다. */}
          <button
            className="gw-collapse-button"
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            aria-pressed={collapsed}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            title={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
          <button className="gw-drawer-close" type="button" onClick={() => closeDrawer({ restoreFocus: true })} aria-label="메뉴 닫기">×</button>
        </div>
        <nav className="gw-sidebar-nav" id="groupware-navigation">
          {visibleNavigation.map((item, index) => (
            <div className="gw-nav-block" key={item.key}>
              {item.external ? (
                <a
                  className="gw-nav-link"
                  ref={index === 0 ? firstMenuRef : undefined}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={collapsed ? item.label : undefined}
                  aria-label={`${item.label}, 새 창`}
                  onClick={() => isMobile && closeDrawer()}
                >
                  <NavigationIcon name={item.key} />
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="gw-nav-external-icon">↗</span>
                </a>
              ) : (
                <NavLink
                  className={({ isActive }) => `gw-nav-link${isActive ? ' is-active' : ''}`}
                  ref={index === 0 ? firstMenuRef : undefined}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  onClick={() => isMobile && closeDrawer()}
                >
                  <NavigationIcon name={item.key} />
                  <span>{item.label}</span>
                  {item.key === 'approval' && headerState.approval_pending > 0 && <span className="gw-nav-count" aria-label={`결재 대기 ${headerState.approval_pending}건`}>{headerState.approval_pending}</span>}
                </NavLink>
              )}
              {item.key === 'boards' && !collapsed && boards.length > 0 && (
                <div className="gw-board-nav" aria-label="내 게시판">
                  {favoriteBoards.length > 0 && <BoardNavGroup label="즐겨찾기" boards={favoriteBoards} onNavigate={() => isMobile && closeDrawer()} />}
                  {recentBoards.length > 0 && <BoardNavGroup label="최근" boards={recentBoards} onNavigate={() => isMobile && closeDrawer()} />}
                  {Object.entries(boardGroups).map(([group, items]) => <BoardNavGroup key={group} label={group} boards={items} onNavigate={() => isMobile && closeDrawer()} />)}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="gw-sidebar-footer">
          <div className="gw-sidebar-user"><ProfileAvatar profile={auth.profile} size="small" /><p><strong>{displayName}</strong><span>{auth.profile?.department_name || '소속 미등록'}</span><span>{activeRoleName}</span></p></div>
        </div>
      </aside>

      {isMobile && drawerOpen && <button className="gw-drawer-overlay" type="button" tabIndex="-1" aria-label="메뉴 닫기" onClick={() => closeDrawer({ restoreFocus: true })} />}

      <div className="gw-workspace">
        <header className="gw-topbar">
          <div className="gw-topbar-title">
            <button ref={menuButtonRef} className="gw-menu-button" type="button" aria-expanded={drawerOpen} aria-controls="groupware-navigation" aria-label={drawerOpen ? '메뉴 닫기' : '메뉴 열기'} onClick={drawerOpen ? () => closeDrawer({ restoreFocus: true }) : openDrawer}>
              <span aria-hidden="true">☰</span>
            </button>
            <div><span>현재 위치</span><strong>{getRouteTitle(location.pathname)}</strong></div>
          </div>
          <div className="gw-topbar-tools" aria-label="사용자와 업무 도구">
            <button type="button" disabled title="검색 기능은 추후 제공됩니다"><span aria-hidden="true">⌕</span><span className="gw-tool-label">검색</span></button>
            <div className="gw-notification-menu"><button type="button" aria-expanded={notificationsOpen} aria-controls="groupware-notification-panel" title="개인 알림" onClick={() => setNotificationsOpen((current) => !current)}><span aria-hidden="true">●</span><span className="gw-tool-label">알림</span>{headerState.unread_count > 0 && <span className="gw-topbar-count">{headerState.unread_count}</span>}</button>{notificationsOpen && <div className="gw-notification-panel" id="groupware-notification-panel"><header><strong>개인 알림</strong>{headerState.unread_count > 0 && <button type="button" onClick={async () => { await approvalService.markNotificationRead(); setHeaderState((current) => ({ ...current, unread_count: 0, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })) })); }}>모두 읽음</button>}</header><div>{headerState.notifications.map((item) => <button type="button" className={item.read_at ? '' : 'is-unread'} key={item.id} onClick={async () => { if (!item.read_at) await approvalService.markNotificationRead(item.id); setNotificationsOpen(false); if (item.route) navigate(item.route); }}><strong>{item.title}</strong><span>{item.message}</span><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time></button>)}</div>{headerState.notifications.length === 0 && <p>새 알림이 없습니다.</p>}</div>}</div>
            <UserAccountMenu onSignOutError={setSignOutError} />
          </div>
        </header>
        <main className="gw-content" id="groupware-content" tabIndex="-1">
          {signOutError && <div className="gw-notice gw-notice--warning" role="alert">{signOutError}</div>}
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function BoardNavGroup({ label, boards, onNavigate }) {
  return (
    <details className="gw-board-nav-group" open>
      <summary>{label}<span>{boards.length}</span></summary>
      {boards.map((board) => <NavLink className={({ isActive }) => isActive ? 'is-active' : undefined} key={`${label}-${board.id}`} to={`/boards/${board.slug}`} onClick={onNavigate}>{board.name}</NavLink>)}
    </details>
  );
}
