import { useState } from 'react';
import { Link } from 'react-router-dom';

import FormStatus from '../../components/FormStatus.jsx';
import SupabaseConfigurationNotice from '../../components/SupabaseConfigurationNotice.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getSafeAuthMessage } from '../../services/authService.js';

export default function ResetPasswordPage() {
  const auth = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await auth.resetPassword(String(form.get('email')).trim());
      setMessage('입력한 정보와 일치하는 계정이 있다면 비밀번호 재설정 안내를 발송했습니다.');
    } catch (submitError) {
      setError(getSafeAuthMessage(submitError, '재설정 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="gw-auth-card" aria-labelledby="reset-title">
      <div className="gw-auth-card-heading">
        <span className="gw-eyebrow">PASSWORD RESET</span>
        <h1 id="reset-title">비밀번호 재설정</h1>
        <p>가입 신청에 사용한 회사 이메일을 입력해 주세요.</p>
      </div>
      {!auth.configured && <SupabaseConfigurationNotice />}
      <form className="gw-form" onSubmit={handleSubmit} aria-describedby="reset-status">
        <div className="gw-field">
          <label htmlFor="reset-email">회사 이메일</label>
          <input id="reset-email" name="email" type="email" autoComplete="email" placeholder="name@jeakyung.com" required />
        </div>
        <FormStatus id="reset-status" message={error || message} tone={error ? 'error' : 'info'} />
        <button className="gw-primary-button" type="submit" disabled={!auth.configured || submitting}>
          {submitting ? '요청 중…' : '재설정 요청'}
        </button>
      </form>
      <p className="gw-auth-return"><Link to="/login">로그인 화면으로 돌아가기</Link></p>
    </section>
  );
}
