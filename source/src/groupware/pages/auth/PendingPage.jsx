import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';

export default function PendingPage() {
  const auth = useAuth();
  const location = useLocation();
  const email = auth.profile?.email || location.state?.email || '신청 시 입력한 회사 이메일';
  const requestSubmitted = location.state?.requestSubmitted;

  if (!auth.loading && auth.session && auth.status === 'approved') return <Navigate to="/dashboard" replace />;
  if (!auth.loading && auth.session && ['rejected', 'locked', 'resigned'].includes(auth.status)) {
    return <Navigate to={`/${auth.status}`} replace />;
  }

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <section className="gw-auth-card gw-status-card" aria-labelledby="pending-title">
      <div className="gw-status-symbol" aria-hidden="true">✓</div>
      <div className="gw-auth-card-heading">
        <span className="gw-eyebrow">APPROVAL PENDING</span>
        <h1 id="pending-title">가입 승인 대기</h1>
        <p>가입 신청이 접수되면 관리자가 임직원 정보와 소속을 확인합니다.</p>
      </div>
      <div className="gw-pending-email">
        <span>확인할 이메일</span>
        <strong>{email}</strong>
      </div>
      {requestSubmitted && (
        <div className="gw-notice" role="status">
          가입 신청이 접수되었습니다. 이메일 확인이 설정된 경우 받은 편지함의 인증 링크도 확인해 주세요.
        </div>
      )}
      {location.state?.photoUploadFailed && (
        <div className="gw-notice gw-notice--warning" role="status">
          가입 신청은 접수됐지만 프로필 사진은 등록되지 않았습니다. 승인 후 내 프로필에서 다시 등록할 수 있습니다.
        </div>
      )}
      <ol className="gw-status-steps">
        <li><span>1</span><div><strong>신청 정보 확인</strong><p>관리자가 회사 이메일과 소속 정보를 확인합니다.</p></div></li>
        <li><span>2</span><div><strong>승인 또는 보완 안내</strong><p>승인 결과와 필요한 안내는 향후 인증 시스템에서 제공합니다.</p></div></li>
        <li><span>3</span><div><strong>그룹웨어 이용</strong><p>승인된 계정만 내부 업무 화면에 접근할 수 있습니다.</p></div></li>
      </ol>
      {auth.session ? (
        <button className="gw-primary-button" type="button" onClick={handleSignOut}>로그아웃</button>
      ) : (
        <Link className="gw-primary-button gw-button-link" to="/login">로그인 화면으로 돌아가기</Link>
      )}
      <p className="gw-help-text">문의: 경영지원부 · 070-800-8100 · sk@jeakyung.com</p>
    </section>
  );
}
