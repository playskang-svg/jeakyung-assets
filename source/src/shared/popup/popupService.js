export async function getActivePopupDocuments(client, target) {
  if (!client) return [];
  const { data, error } = await client.rpc('get_active_popup_documents', { p_target: target });
  if (error) throw error;
  return data ?? [];
}

export async function getPopupAdminCatalog(client) {
  if (!client) return { documents: [] };
  const { data, error } = await client.rpc('get_popup_admin_catalog');
  if (error) throw error;
  return data ?? { documents: [] };
}

export async function savePopupDocument(client, documentValue) {
  if (!client) throw new Error('Supabase 연결 설정이 필요합니다.');
  const { data, error } = await client.rpc('manage_popup_document', { p_document: documentValue });
  if (error) throw error;
  return data;
}

