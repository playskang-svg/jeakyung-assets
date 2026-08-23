import { requireSupabase } from '../lib/supabase.js';

export async function getOrganizationDirectory() {
  const client = requireSupabase();
  const [departmentsResult, positionsResult, jobTitlesResult, rolesResult] = await Promise.all([
    client.from('departments').select('id,code,name,parent_id,sort_order,is_active,archived_at').order('sort_order').order('name'),
    client.from('positions').select('id,code,name,sort_order,is_active').order('sort_order').order('name'),
    client.from('job_titles').select('id,code,name,sort_order,is_active').order('sort_order').order('name'),
    client.from('roles').select('code,name,sort_order').order('sort_order'),
  ]);

  const error = departmentsResult.error || positionsResult.error || jobTitlesResult.error || rolesResult.error;
  if (error) throw error;

  return {
    departments: departmentsResult.data ?? [],
    positions: positionsResult.data ?? [],
    jobTitles: jobTitlesResult.data ?? [],
    roles: rolesResult.data ?? [],
  };
}

export async function upsertOrganizationItem({ entity, id, code, name, parentId, sortOrder, isActive }) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('upsert_organization_item', {
    p_entity: entity,
    p_id: id || null,
    p_code: code,
    p_name: name,
    p_parent_id: parentId || null,
    p_sort_order: Number(sortOrder) || 0,
    p_is_active: Boolean(isActive),
  });
  if (error) throw error;
  return data;
}
