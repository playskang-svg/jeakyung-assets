import { requireSupabase } from '../lib/supabase.js';

export async function signInWithPassword({ email, password }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpMembership({
  name,
  email,
  phone,
  password,
  requestedDepartmentId,
  requestedPositionId,
  requestedJobTitleId,
  requestedHireDate,
  requestedEmployeeNumber,
  organizationRequestNote,
  profilePhotoUploadToken,
}) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        phone,
        requested_department_id: requestedDepartmentId,
        requested_position_id: requestedPositionId,
        requested_job_title_id: requestedJobTitleId,
        requested_hire_date: requestedHireDate || null,
        requested_employee_number: requestedEmployeeNumber || null,
        organization_request_note: organizationRequestNote || null,
        profile_photo_upload_token: profilePhotoUploadToken || null,
      },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOutCurrentSession() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const client = requireSupabase();
  const redirectTo = new URL('/groupware/reset-password/update', window.location.origin).toString();
  const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function updatePassword(password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.updateUser({ password });
  if (error) throw error;
  return data;
}

export async function getSignupOptions() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_signup_options');
  if (error) throw error;
  return data;
}

const SAFE_AUTH_MESSAGES = {
  over_email_send_rate_limit: '인증 메일 발송 한도를 잠시 초과했습니다. 약 1시간 뒤 다시 시도하거나 관리자에게 문의해 주세요.',
  over_request_rate_limit: '요청이 너무 많아 잠시 제한되었습니다. 몇 분 뒤 다시 시도해 주세요.',
  email_address_not_authorized: '현재 이 이메일 주소로는 인증 메일을 보낼 수 없습니다. 관리자에게 문의해 주세요.',
  email_address_invalid: '사용할 수 없는 이메일 주소입니다. 회사 이메일 주소를 다시 확인해 주세요.',
  weak_password: '비밀번호가 보안 기준에 맞지 않습니다. 영문 대·소문자, 숫자, 특수문자를 섞어 8자 이상으로 입력해 주세요.',
  email_not_confirmed: '이메일 인증이 아직 완료되지 않았습니다. 받은 편지함의 인증 메일을 확인해 주세요.',
  signup_disabled: '현재 가입 신청을 받지 않고 있습니다. 관리자에게 문의해 주세요.',
};

export function getSafeAuthMessage(error, fallback) {
  if (!error) return fallback;
  if (error.message === 'Supabase 연결 설정이 필요합니다.') return error.message;
  const code = error.code || error.error_code || '';
  if (SAFE_AUTH_MESSAGES[code]) return SAFE_AUTH_MESSAGES[code];
  if (error.status === 429) return SAFE_AUTH_MESSAGES.over_request_rate_limit;
  if (/error sending confirmation email/i.test(error.message || '')) return '인증 메일을 보내지 못했습니다. 관리자에게 문의해 주세요.';
  return fallback;
}
