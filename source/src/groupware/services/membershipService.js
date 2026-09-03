import { requireSupabase } from '../lib/supabase.js';

export async function getIdentity() {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_my_effective_access_context');
  if (error) throw error;

  return {
    profile: data?.profile ?? null,
    roles: data?.roles ?? [],
    // 서버가 보유 역할 중 가장 높은 역할을 그대로 내려준다. 역할 전환은 없다.
    activeRole: data?.active_role ?? null,
  };
}

export async function listPendingMemberships() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select(`
      id,name,full_name,email,phone,mobile_phone,membership_status,created_at,requested_hire_date,requested_employee_number,organization_request_note,profile_photo_path,
      requested_department:departments!profiles_requested_department_id_fkey(id,name),
      requested_position:positions!profiles_requested_position_id_fkey(id,name),
      requested_job_title:job_titles!profiles_requested_job_title_id_fkey(id,name)
    `)
    .eq('membership_status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function approveMembership({ userId, departmentId, positionId, jobTitleId, roleCode, hireDate, employeeNumber }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('approve_membership', {
    p_user_id: userId,
    p_department_id: departmentId,
    // 직급은 선택이다. 빈 문자열을 그대로 보내면 uuid 로 못 읽는다.
    p_position_id: positionId || null,
    p_job_title_id: jobTitleId,
    p_role_code: roleCode,
    p_hire_date: hireDate || null,
    p_employee_number: employeeNumber || null,
  });
  if (error) throw error;
  return data;
}

export async function rejectMembership({ userId, reason }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('reject_membership', {
    p_user_id: userId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}
