import { requireSupabase } from '../lib/supabase.js';

export async function getMyDashboardWidgets() {
  const { data, error } = await requireSupabase().rpc('get_my_dashboard_widgets');
  if (error) throw error;
  return data ?? [];
}

export async function setDashboardPreference(widgetId, { customOrder = null, isHidden = false }) {
  const { error } = await requireSupabase().rpc('set_my_dashboard_preference', {
    p_widget_id: widgetId,
    p_custom_order: customOrder,
    p_is_hidden: isHidden,
  });
  if (error) throw error;
}

export async function getDashboardAdminCatalog() {
  const { data, error } = await requireSupabase().rpc('get_dashboard_admin_catalog');
  if (error) throw error;
  return data ?? { widgets: [], assignments: [] };
}

export async function saveDashboardWidget(widget, assignments) {
  const { data, error } = await requireSupabase().rpc('manage_dashboard_widget', {
    p_widget: widget,
    p_assignments: assignments,
  });
  if (error) throw error;
  return data;
}

export async function deleteOrArchiveDashboardWidget(widgetId) {
  const { data, error } = await requireSupabase().rpc('delete_or_archive_dashboard_widget', { p_widget_id: widgetId });
  if (error) throw error;
  return data;
}
