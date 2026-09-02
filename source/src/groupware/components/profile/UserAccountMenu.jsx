import { useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import ProfileAvatar from './ProfileAvatar.jsx';

export default function UserAccountMenu({ onSignOutError }) {
  const auth = useAuth();
  const detailsRef = useRef(null);
  const profile = auth.profile ?? {};
  const displayName = profile.display_name || profile.preferred_name || profile.full_name || profile.name || '사용자';
  // 이번 접속을 시작한 시각. 세션이 발급된 때를 그대로 쓴다.
  const signedInAt = auth.session?.user?.last_sign_in_at ?? null;

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch {
      onSignOutError('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <details className="gw-user-menu" ref={detailsRef}>
      {/* 이름·소속·직급·역할은 홈 화면 프로필 카드가 이미 보여 준다. 상단바에
          또 적으면 같은 값이 한 화면에 두 번 나온다. 여기서는 사진만 둔다. */}
      <summary aria-label={`${displayName} 사용자 메뉴 열기`}>
        <ProfileAvatar profile={profile} size="small" />
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="gw-user-menu-panel">
        {signedInAt && (
          <p className="gw-user-menu-signedin">
            <span>접속 시간</span>
            <time dateTime={signedInAt}>{new Date(signedInAt).toLocaleString('ko-KR')}</time>
          </p>
        )}
        <div className="gw-user-menu-actions"><button type="button" onClick={signOut}>로그아웃</button></div>
      </div>
    </details>
  );
}
