-- 팝업 삭제.
--
-- 여태 만들고 고칠 수만 있었다. 잘못 만든 팝업은 '보관'으로 숨길 수는 있어도
-- 목록에서 사라지지 않아 관리자 화면이 쓰지 않는 문서로 계속 불어났다.
--
-- 지운 뒤에는 되돌릴 수 없으므로 무엇을 지웠는지는 감사 로그에 남긴다.
-- 본문(content_html)은 길고 로그에 둘 이유가 없어 빼고 넣는다 —
-- manage_popup_document 가 남기는 방식과 같다.
create or replace function public.delete_popup_document(p_id uuid)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare removed jsonb;
begin
  if not public.is_membership_admin() then
    raise exception 'membership_admin_required' using errcode = '42501';
  end if;

  select to_jsonb(d) into removed from public.popup_documents d where d.id = p_id for update;
  if removed is null then
    raise exception 'popup_not_found' using errcode = 'P0002';
  end if;

  delete from public.popup_documents where id = p_id;

  insert into public.audit_logs (actor_user_id, action, target_type, target_id, before_data, after_data)
  values (auth.uid(), 'popup.deleted', 'popup_document', p_id::text, removed - 'content_html', null);
end;
$function$;

revoke all on function public.delete_popup_document(uuid) from public;
grant execute on function public.delete_popup_document(uuid) to authenticated;
