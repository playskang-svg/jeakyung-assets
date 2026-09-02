import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import GroupwareBrand from '../components/GroupwareBrand.jsx';
import UserAccountMenu from '../components/profile/UserAccountMenu.jsx';
import { getRouteTitle } from '../config/navigation.js';
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
// 이동 경로가 된다. 어디로 갈 수 있는지는 최고관리자가 대시보드 구성으로 정한다.
// 그래서 이 껍데기가 항상 들고 있어야 하는 것은 두 가지뿐이다.
//   - 대시보드로 돌아가는 길(상단 왼쪽 로고)
//   - 내가 누구이고 어떤 권한인지, 그리고 나가는 문(상단 오른쪽)
// 관리자 화면으로 가는 버튼은 최고관리자에게만 보인다. 관리자 권한이 없는
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
            <div><span>현재 위치</span><strong>{getRouteTitle(location.pathname)}</strong></div>
          </div>
          <div className="gw-topbar-tools" aria-label="사용자와 업무 도구">
            {isSuperAdmin && (
              <Link className="gw-admin-mode-button" to="/admin">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6.5v5c0 4.4 3.2 8.3 8 9.5 4.8-1.2 8-5.1 8-9.5v-5L12 3Z" /><path d="m9 12 2 2 4-4" /></svg>
                관리자 모드
              </Link>
            )}
            <div className="gw-notification-menu" ref={notificationRef}><button type="button" aria-expanded={notificationsOpen} aria-controls="groupware-notification-panel" title="개인 알림" onClick={() => setNotificationsOpen((current) => !current)}><span aria-hidden="true">●</span><span className="gw-tool-label">알림</span>{headerState.unread_count > 0 && <span className="gw-topbar-count">{headerState.unread_count}</span>}</button>{notificationsOpen && <div className="gw-notification-panel" id="groupware-notification-panel"><header><strong>개인 알림</strong>{headerState.unread_count > 0 && <button type="button" onClick={async () => { await approvalService.markNotificationRead(); setHeaderState((current) => ({ ...current, unread_count: 0, notifications: current.notifications.map((item) => ({ ...item, read_at: item.read_at ?? new Date().toISOString() })) })); }}>모두 읽음</button>}</header><div>{headerState.notifications.map((item) => <button type="button" className={item.read_at ? '' : 'is-unread'} key={item.id} onClick={async () => { if (!item.read_at) await approvalService.markNotificationRead(item.id); setNotificationsOpen(false); if (item.route) navigate(item.route); }}><strong>{item.title}</strong><span>{item.message}</span><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time></button>)}</div>{headerState.notifications.length === 0 && <p>새 알림이 없습니다.</p>}</div>}</div>
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
