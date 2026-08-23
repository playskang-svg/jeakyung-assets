import { Outlet } from 'react-router-dom';

import GroupwareBrand from '../components/GroupwareBrand.jsx';

export default function AuthLayout() {
  return (
    <div className="gw-auth-shell">
      <header className="gw-auth-header">
        <GroupwareBrand />
        <a className="gw-public-link" href="/">공개 사이트로 이동</a>
      </header>
      <main className="gw-auth-main" id="groupware-main">
        <div className="gw-auth-intro" aria-hidden="true">
          <span className="gw-auth-kicker">JAEKYUNG WORKSPACE</span>
          <strong>하나의 재경,<br />이어지는 업무의 흐름.</strong>
          <p>임직원의 협업과 업무 정보를 안전하게 연결하는 그룹웨어입니다.</p>
        </div>
        <Outlet />
      </main>
      <footer className="gw-auth-footer">
        <span>임직원 전용 시스템</span>
        <span>문의: 경영지원부 · 070-800-8100</span>
      </footer>
    </div>
  );
}
