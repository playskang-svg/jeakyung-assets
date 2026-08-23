begin;

-- Bug: every board file upload (general attachment and inline image) failed
-- with "new row violates row-level security policy for table objects".
--
-- Root cause: the Supabase Storage API inserts the storage.objects row
-- BEFORE the file body is stored - at that moment `metadata` is still NULL,
-- and it is only populated with size/mimetype once the upload completes.
-- can_upload_board_attachment_path (the bucket's INSERT policy) read
-- coalesce((p_metadata->>'size')::bigint, 0) and rejected anything with
-- size < 1, so the initial insert was always denied and no upload could
-- ever start. Size/MIME were effectively unenforceable at INSERT time.
--
-- Fix: when metadata is absent (the pre-upload insert), validate only what
-- is knowable then - path ownership, board access, post editability, and
-- the settings toggles/extension rules. When metadata IS present (later
-- update, or a direct insert), keep enforcing the size and MIME limits
-- exactly as before. The bucket also enforces file_size_limit and
-- allowed_mime_types independently, and register_board_attachment /
-- register_inline_board_image re-check the real size and MIME against
-- storage.objects afterwards, so the size/type limits are still enforced.
create or replace function public.can_upload_board_attachment_path(p_storage_path text, p_metadata jsonb)
returns boolean language plpgsql stable security definer set search_path to 'pg_catalog' as $function$
declare
  parts text[] := string_to_array(p_storage_path, '/');
  v_board_id uuid;
  v_post_id uuid;
  v_has_metadata boolean;
  v_object_size bigint;
  v_object_mime text;
  v_settings jsonb;
  v_stored_inline_count integer;
  v_stored_total_bytes bigint;
begin
  if array_length(parts, 1) <> 5 or parts[2] <> auth.uid()::text or parts[3] not in ('inline','general') then return false; end if;
  begin v_board_id := parts[1]::uuid; exception when others then return false; end;
  if not public.evaluate_board_access(v_board_id, 'attachment_upload', auth.uid()) then return false; end if;
  begin v_post_id := parts[4]::uuid; exception when others then return false; end;

  -- The Storage API's initial insert carries no metadata yet.
  v_has_metadata := p_metadata ? 'size';
  v_object_size := coalesce((p_metadata->>'size')::bigint, 0);
  v_object_mime := coalesce(p_metadata->>'mimetype', '');

  select b.settings into v_settings from public.boards b where b.id=v_board_id;
  if not public.can_edit_board_post_for_attachment(v_post_id)
    or not exists(select 1 from public.board_posts p where p.id=v_post_id and p.board_id=v_board_id)
    or (v_has_metadata and v_object_size < 1) then return false; end if;

  select
    count(*) filter (where split_part(o.name,'/',3)='inline'),
    coalesce(sum(coalesce((o.metadata->>'size')::bigint,0)),0)
  into v_stored_inline_count,v_stored_total_bytes
  from storage.objects o
  left join public.board_attachments a on a.storage_path=o.name and a.deleted_at is null
  where o.bucket_id='groupware-board-attachments'
    and split_part(o.name,'/',1)=v_board_id::text
    and split_part(o.name,'/',3) in ('inline','general')
    and split_part(o.name,'/',4)=v_post_id::text
    and (a.id is null or a.lifecycle_status in ('pending','active'));

  if parts[3]='inline' then
    return coalesce((v_settings->>'allow_images')::boolean,false)
      and (not v_has_metadata or (
        v_object_size <= least(greatest(coalesce((v_settings->>'max_inline_image_size_mb')::bigint,10),1),10)*1048576
        and v_object_mime in ('image/jpeg','image/png','image/webp','image/gif')
        and v_stored_total_bytes+v_object_size <= (
          least(greatest(coalesce((v_settings->>'max_total_attachment_mb')::bigint,50),1),50)
          + least(greatest(coalesce((v_settings->>'max_inline_image_size_mb')::bigint,10),1),10)
        )*1048576
      ))
      and v_stored_inline_count < least(greatest(coalesce((v_settings->>'max_inline_images')::integer,20),1),20)+1;
  end if;
  return coalesce((v_settings->>'allow_attachments')::boolean,false)
    and (not v_has_metadata or (
      v_object_size <= least(greatest(coalesce((v_settings->>'max_file_size_mb')::bigint,20),1),20)*1048576
      and v_stored_total_bytes+v_object_size <= least(greatest(coalesce((v_settings->>'max_total_attachment_mb')::bigint,50),1),50)*1048576
    ))
    and lower(parts[5]) !~ '\.(exe|dll|bat|cmd|com|scr|msi|js|jar|sh|ps1)$';
end;
$function$;

commit;
