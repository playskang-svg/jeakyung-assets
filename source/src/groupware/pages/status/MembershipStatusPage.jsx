import { Link, Navigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_CONTENT = {
  rejected: {
    eyebrow: 'MEMBERSHIP REJECTED',
    title: '가입 신청이 승인되지 않았습니다',
    description: '신청 정보 확인 결과 가입 승인이 완료되지 않았습니다.',
  },
  locked: {
    eyebrow: 'ACCOUNT LOCKED',
    title: '계정 이용이 잠겨 있습니다',
    description: '보안 또는 운영 확인이 필요해 그룹웨어 이용이 일시 중단되었습니다.',
  },
  resigned: {
    eyebrow: 'ACCESS ENDED',
    title: '그룹웨어 이용이 종료되었습니다',
    description: '현재 계정은 내부 업무 시스템 이용 대상이 아닙니다.',
  },
};

export default function MembershipStatusPage({ status }) {
  const auth = useAuth();
  const content = STATUS_CONTENT[status];

  if (!content) return <Navigate to="/login" replace />;
  if (auth.loading) return <section className="gw-auth-card" role="status">계정 상태를 확인하고 있습니다.</section>;
  if (auth.session && auth.status !== status) return <Navigate to="/dashboard" replace />;

  const handleSignOut = async () => {
    await auth.signOut();
  };

  return (
    <section className="gw-auth-card gw-status-card" aria-labelledby={`${status}-title`}>
      <div className="gw-status-symbol gw-status-symbol--warning" aria-hidden="true">!</div>
      <div className="gw-auth-card-heading">
        <span className="gw-eyebrow">{content.eyebrow}</span>
        <h1 id={`${status}-title`}>{content.title}</h1>
        <p>{content.description}</p>
      </div>
      {status === 'rejected' && auth.profile?.rejection_reason && (
        <div className="gw-notice gw-notice--warning"><strong>확인 내용</strong><br />{auth.profile.rejection_reason}</div>
      )}
      <p className="gw-help-text">문의: 경영지원부 · 070-800-8100 · sk@jeakyung.com</p>
      {auth.session ? (
        <button className="gw-primary-button" type="button" onClick={handleSignOut}>로그아웃</button>
      ) : (
        <Link className="gw-primary-button gw-button-link" to="/login">로그인 화면으로 돌아가기</Link>
      )}
    </section>
  );
}
