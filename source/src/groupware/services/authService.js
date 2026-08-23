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

export function getSafeAuthMessage(error, fallback) {
  if (!error) return fallback;
  if (error.message === 'Supabase 연결 설정이 필요합니다.') return error.message;
  return fallback;
}
