-- 관리자 화면에서 위젯 순서를 위/아래 버튼으로 바꾸기 위한 전용 RPC.
-- manage_dashboard_widget 은 배포 규칙까지 통째로 지우고 다시 넣기 때문에
-- 순서만 바꾸려고 부르기에는 위험하다. 여기서는 sort_order 만 건드린다.
create or replace function public.reorder_dashboard_widgets(p_orders jsonb)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare entry jsonb; updated integer := 0;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  for entry in select value from jsonb_array_elements(coalesce(p_orders, '[]')) loop
    update public.dashboard_widgets
      set sort_order = (entry->>'sort_order')::integer
    where id = (entry->>'id')::uuid;
    if found then updated := updated + 1; end if;
  end loop;

  insert into public.audit_logs(actor_user_id, action, target_type, target_id, after_data)
  values (auth.uid(), 'dashboard.widget.reordered', 'dashboard_widget', null, p_orders);

  return updated;
end; $$;

revoke all on function public.reorder_dashboard_widgets(jsonb) from public, anon;
grant execute on function public.reorder_dashboard_widgets(jsonb) to authenticated;
