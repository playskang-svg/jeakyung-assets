begin;

-- 대시보드 '문서 만들기' 로그보기 팝업용. 승인된 회원이면 누가 어떤 문서를 만들었는지
-- (이름·파일 이름·링크·일시)만 읽는다. 이메일·일정 기록은 빼고 관리자 함수에만 남긴다.
create or replace function public.get_doc_create_logs(p_limit integer default 100)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'title', l.title, 'url', l.url, 'created_at', l.created_at,
      'user_name', coalesce(p.name, '(탈퇴 회원)')) order by l.created_at desc)
    from (select * from public.google_activity_logs where kind='doc_create'
          order by created_at desc limit least(greatest(coalesce(p_limit,100),1),300)) l
    left join public.profiles p on p.id=l.user_id), '[]'::jsonb);
end;
$$;

revoke all on function public.get_doc_create_logs(integer) from public, anon;
grant execute on function public.get_doc_create_logs(integer) to authenticated;

commit;
