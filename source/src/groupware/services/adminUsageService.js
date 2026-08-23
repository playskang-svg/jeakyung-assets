import { requireSupabase } from '../lib/supabase.js';

export async function getAdminSystemUsage() {
  const client = requireSupabase();
  const [usage, details] = await Promise.all([
    client.rpc('get_admin_system_usage'),
    client.rpc('get_admin_file_cleanup_details'),
  ]);
  if (usage.error) throw usage.error;
  if (details.error) throw details.error;
  return { ...usage.data, file_details: details.data ?? { largest_file: null, cleanup_candidates: [] } };
}
