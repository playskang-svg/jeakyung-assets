begin;

create or replace function public.get_admin_file_cleanup_details()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'largest_file',(
      select jsonb_build_object('original_name',a.original_name,'file_size',a.file_size,'purpose',a.purpose,'board_name',b.name,'created_at',a.created_at)
      from public.board_attachments a join public.boards b on b.id=a.board_id
      where a.deleted_at is null
      order by a.file_size desc,a.created_at desc limit 1
    ),
    'cleanup_candidates',coalesce((
      select jsonb_agg(jsonb_build_object('id',item.id,'original_name',item.original_name,'file_size',item.file_size,'purpose',item.purpose,'board_name',item.board_name,'cleanup_after',item.cleanup_after) order by item.cleanup_after nulls last,item.file_size desc)
      from (
        select a.id,a.original_name,a.file_size,a.purpose,b.name board_name,a.cleanup_after
        from public.board_attachments a join public.boards b on b.id=a.board_id
        where a.deleted_at is null and a.lifecycle_status='cleanup_candidate'
        order by a.cleanup_after nulls last,a.file_size desc limit 20
      ) item
    ),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_file_cleanup_details() from public,anon,authenticated;
grant execute on function public.get_admin_file_cleanup_details() to authenticated;

commit;
