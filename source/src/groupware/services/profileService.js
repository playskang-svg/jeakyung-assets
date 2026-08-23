import { requireSupabase } from '../lib/supabase.js';

const PHOTO_BUCKET = 'groupware-profile-photos';

export async function updateMyProfile(values) {
  const { data, error } = await requireSupabase().rpc('update_my_employee_profile', {
    p_preferred_name: values.preferredName || null,
    p_mobile_phone: values.mobilePhone || null,
    p_office_phone: values.officePhone || null,
    p_extension_number: values.extensionNumber || null,
    p_introduction: values.introduction || null,
  });
  if (error) throw error;
  return data;
}

export async function getEmployeeProfileCatalog({ search = '', departmentId = null } = {}) {
  const { data, error } = await requireSupabase().rpc('get_employee_profile_catalog', {
    p_search: search || null,
    p_department_id: departmentId || null,
  });
  if (error) throw error;
  return data ?? { employees: [], recent_changes: [] };
}

export async function updateEmployeeProfile(profile) {
  const { data, error } = await requireSupabase().rpc('update_employee_profile', {
    p_user_id: profile.id,
    p_full_name: profile.fullName,
    p_employee_number: profile.employeeNumber || null,
    p_department_id: profile.departmentId,
    p_position_id: profile.positionId,
    p_job_title_id: profile.jobTitleId,
    p_hire_date: profile.hireDate || null,
    p_company_email: profile.companyEmail || null,
    p_mobile_phone: profile.mobilePhone || null,
    p_office_phone: profile.officePhone || null,
    p_extension_number: profile.extensionNumber || null,
    p_employment_status: profile.employmentStatus,
    p_work_location: profile.workLocation || null,
    p_roles: profile.roles,
    p_preferred_start_role: profile.preferredStartRole,
  });
  if (error) throw error;
  if (data?.ok === false) throw new Error(data.code || 'employee_profile_update_blocked');
  return data;
}

export async function uploadProfilePhoto({ userId, file }) {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('file', file, file.name || 'profile.webp');
  const { data, error } = await requireSupabase().functions.invoke('profile-photo-upload', { body: form });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function uploadSignupProfilePhoto({ userId, uploadToken, file }) {
  const form = new FormData();
  form.append('user_id', userId);
  form.append('signup_token', uploadToken);
  form.append('file', file, file.name || 'profile.webp');
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('profile-photo-upload', {
    body: form,
    headers: { 'x-signup-photo': 'true' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getProfilePhotoUrl(storagePath, expiresIn = 300) {
  if (!storagePath) return null;
  const { data, error } = await requireSupabase().storage.from(PHOTO_BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
