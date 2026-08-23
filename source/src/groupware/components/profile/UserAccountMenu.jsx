import { useRef } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import ProfileAvatar from './ProfileAvatar.jsx';

export default function UserAccountMenu({ onSignOutError }) {
  const auth = useAuth();
  const detailsRef = useRef(null);
  const profile = auth.profile ?? {};
  const displayName = profile.display_name || profile.preferred_name || profile.full_name || profile.name || '사용자';
  // 역할은 전환하지 않는다. 보유 역할 중 가장 높은 역할이 그대로 내 권한이다.
  const activeRoleName = auth.assignedRoles.find((role) => role.code === auth.activeRole)?.name || auth.activeRole || '역할 확인 중';
  const otherRoles = auth.assignedRoles.filter((role) => role.code !== auth.activeRole);
  const organizationSummary = `${profile.department_name || '소속 미등록'} · ${profile.job_title_name || profile.position_name || '직급·직책 미등록'} · ${activeRoleName}`;

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch {
      onSignOutError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <details className="gw-user-menu" ref={detailsRef}>
      <summary aria-label={`${displayName} 사용자 메뉴 열기`}>
        <ProfileAvatar profile={profile} size="small" />
        {/* 상단바는 한 줄로 끝낸다: 이름 옆에 소속·직급만, 권한은 패널에서 확인. */}
        <span className="gw-user-menu-copy"><strong>{displayName}</strong><small title={organizationSummary}>{profile.department_name || '소속 미등록'} · {profile.job_title_name || profile.position_name || '직급 미등록'}</small></span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="gw-user-menu-panel">
        <div className="gw-user-menu-identity"><ProfileAvatar profile={profile} /><div><strong>{displayName}</strong><span>{profile.department_name || '소속 미등록'}</span><span>{profile.job_title_name || profile.position_name || '직급·직책 미등록'}</span><b>{activeRoleName}</b></div></div>
        {otherRoles.length > 0 && (
          <p className="gw-user-menu-roles">보유 역할 {auth.assignedRoles.map((role) => role.name).join(' · ')}</p>
        )}
        <div className="gw-user-menu-actions"><Link to="/profile" onClick={() => detailsRef.current?.removeAttribute('open')}>내 프로필</Link><button type="button" onClick={signOut}>로그아웃</button></div>
      </div>
    </details>
  );
}
