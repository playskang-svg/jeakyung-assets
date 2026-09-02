import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import FormStatus from '../../components/FormStatus.jsx';
import PasswordField from '../../components/PasswordField.jsx';
import SupabaseConfigurationNotice from '../../components/SupabaseConfigurationNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSafeAuthMessage } from '../../services/authService.js';

function getStatusPath(status) {
  if (['pending', 'rejected', 'locked', 'resigned'].includes(status)) return `/${status}`;
  return '/dashboard';
}

export default function LoginPage() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const wasProtected = location.state?.reason === 'authentication-required';
  const wasAdminProtected = location.state?.reason === 'admin-required';

  useEffect(() => {
    if (!auth.loading && auth.session && auth.profile) {
      const requestedPath = location.state?.from;
      navigate(auth.status === 'approved' && requestedPath ? requestedPath : getStatusPath(auth.status), { replace: true });
    }
  }, [auth.loading, auth.profile, auth.session, auth.status, location.state, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    const form = new FormData(event.currentTarget);

    try {
      const result = await auth.signIn({
        email: String(form.get('email')).trim(),
        password: String(form.get('password')),
      });
      const status = result.profile?.membership_status ?? 'profile-error';
      const requestedPath = location.state?.from;
      navigate(status === 'approved' && requestedPath ? requestedPath : getStatusPath(status), { replace: true });
    } catch (submitError) {
      setError(getSafeAuthMessage(submitError, '로그인 정보를 확인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="gw-auth-card" aria-labelledby="login-title">
      <div className="gw-auth-card-heading">
        <span className="gw-eyebrow">EMPLOYEE ACCESS</span>
        <h1 id="login-title">그룹웨어 로그인</h1>
        <p>승인된 재경로지스｜물류 임직원 계정으로 이용하는 내부 시스템입니다.</p>
      </div>

      {wasProtected && (
        <div className="gw-notice gw-notice--warning" role="status">
          내부 페이지를 이용하려면 승인된 계정으로 로그인해야 합니다.
        </div>
      )}

      {wasAdminProtected && (
        <div className="gw-notice gw-notice--warning" role="status">
          관리자 권한이 필요한 화면입니다.
        </div>
      )}

      {location.state?.passwordUpdated && (
        <div className="gw-notice" role="status">비밀번호를 변경했습니다. 새 비밀번호로 로그인해 주세요.</div>
      )}

      {!auth.configured && <SupabaseConfigurationNotice />}

      <form className="gw-form" onSubmit={handleSubmit} aria-describedby="login-status">
        <div className="gw-field">
          <label htmlFor="login-email">회사 이메일</label>
          <input id="login-email" name="email" type="email" autoComplete="username" placeholder="name@jeakyung.com" required />
        </div>
        <PasswordField id="login-password" name="password" label="비밀번호" autoComplete="current-password" />
        <label className="gw-check-row">
          <input type="checkbox" name="remember" checked readOnly />
          <span>로그인 상태 유지</span>
        </label>
        <p className="gw-field-hint">브라우저의 안전한 세션 저장소를 사용하며 로그아웃 시 현재 기기의 세션을 삭제합니다.</p>
        <FormStatus id="login-status" message={error} tone="error" />
        <button className="gw-primary-button" type="submit" disabled={!auth.configured || submitting}>
          {submitting ? '로그인 확인 중…' : '로그인'}
        </button>
      </form>

      <div className="gw-auth-links">
        <Link to="/reset-password">비밀번호를 잊으셨나요?</Link>
        <Link to="/signup">임직원 가입 신청</Link>
      </div>

      <div className="gw-account-notice">
        <strong>아직 승인되지 않은 계정인가요?</strong>
        <p>가입 신청 후 관리자의 승인이 완료되어야 로그인할 수 있습니다.</p>
        <Link to="/pending">승인 대기 안내 확인</Link>
      </div>
    </section>
  );
}
