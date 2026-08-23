import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import FormStatus from '../../components/FormStatus.jsx';
import PasswordField from '../../components/PasswordField.jsx';
import SupabaseConfigurationNotice from '../../components/SupabaseConfigurationNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSafeAuthMessage } from '../../services/authService.js';

export default function UpdatePasswordPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password'));
    if (password !== form.get('passwordConfirmation')) {
      setError('비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await auth.updatePassword(password);
      await auth.signOut();
      navigate('/login', { replace: true, state: { passwordUpdated: true } });
    } catch (submitError) {
      setError(getSafeAuthMessage(submitError, '복구 링크가 만료되었거나 비밀번호를 변경하지 못했습니다. 재설정을 다시 요청해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  const recoveryUnavailable = auth.configured && !auth.loading && !auth.session;

  return (
    <section className="gw-auth-card" aria-labelledby="update-password-title">
      <div className="gw-auth-card-heading">
        <span className="gw-eyebrow">NEW PASSWORD</span>
        <h1 id="update-password-title">새 비밀번호 설정</h1>
        <p>재설정 안내를 통해 열린 안전한 복구 세션에서 새 비밀번호를 설정합니다.</p>
      </div>
      {!auth.configured && <SupabaseConfigurationNotice />}
      {recoveryUnavailable ? (
        <div className="gw-account-notice" role="alert">
          <strong>복구 세션을 확인할 수 없습니다.</strong>
          <p>링크가 잘못되었거나 만료되었을 수 있습니다.</p>
          <Link to="/reset-password">비밀번호 재설정 다시 요청</Link>
        </div>
      ) : (
        <form className="gw-form" onSubmit={handleSubmit} aria-describedby="update-password-status">
          <PasswordField id="update-password" name="password" label="새 비밀번호" autoComplete="new-password" minLength={8} />
          <PasswordField id="update-password-confirmation" name="passwordConfirmation" label="새 비밀번호 확인" autoComplete="new-password" minLength={8} />
          <FormStatus id="update-password-status" message={error} tone="error" />
          <button className="gw-primary-button" type="submit" disabled={!auth.configured || auth.loading || submitting}>
            {submitting ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      )}
      <p className="gw-auth-return"><Link to="/login">로그인 화면으로 돌아가기</Link></p>
    </section>
  );
}
