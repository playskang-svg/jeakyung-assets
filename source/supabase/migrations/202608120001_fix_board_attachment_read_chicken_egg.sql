begin;

-- Bug: uploading any board attachment (general file or inline image) always
-- failed with "new row violates row-level security policy for table
-- objects". Root cause: the Supabase Storage API's upload response requires
-- the newly inserted storage.objects row to also satisfy the bucket's
-- SELECT policy (storage_board_read -> can_read_board_attachment_path).
-- That function only allowed access once a matching public.board_attachments
-- row existed - but that row is only created by register_board_attachment /
-- register_inline_board_image, which run AFTER the storage upload succeeds.
-- So the very first read-back of a freshly uploaded file could never pass.
--
-- Fix: also allow the uploader to read their own object immediately, based
-- on the ownership-encoded storage path (same convention already used by
-- can_upload_board_attachment_path), before it has been registered.
create or replace function public.can_read_board_attachment_path(p_storage_path text)
returns boolean language sql stable security definer set search_path = pg_catalog as $$
  select
    (string_to_array(p_storage_path, '/'))[2] = auth.uid()::text
    or exists(
      select 1 from public.board_attachments a join public.board_posts p on p.id=a.post_id
      where a.storage_path=p_storage_path and a.deleted_at is null and a.lifecycle_status='active' and p.deleted_at is null and p.status<>'deleted'
        and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update'))
        and public.can_access_board(a.board_id,'detail_read')
        and public.can_access_board(a.board_id,'attachment_view')
        and (a.purpose='inline_image' or public.can_access_board(a.board_id,'attachment_download'))
    );
$$;

commit;
