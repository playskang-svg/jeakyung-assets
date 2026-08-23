begin;

-- Bug: images uploaded into a post body never appeared - the file reached
-- storage and a board_attachments row was created, but the saved document
-- contained no inlineImage node at all, and the orphaned images were later
-- swept to 'cleanup_candidate'.
--
-- Root cause: right after uploading, the editor calls
-- getAttachmentViewUrl -> get_board_attachment_path to build the preview
-- URL for the node it is about to insert. A freshly uploaded inline image
-- is 'pending' (register_inline_board_image inserts it that way; it only
-- becomes 'active' when the post is saved and reconcile_board_inline_images
-- runs). But get_board_attachment_path only ever matched
-- lifecycle_status='active', so it raised attachment_access_denied, the
-- upload promise rejected, and the editor's catch marked the upload failed
-- instead of inserting the image into the document. Saving then found no
-- inlineImage nodes and marked the uploads for cleanup - so a body image
-- could never be added.
--
-- Fix: also let the uploader resolve their own 'pending' attachment, which
-- is exactly the pre-save preview window. Everyone else, and every other
-- status, is unchanged - all the existing post/board access checks below
-- still apply.
create or replace function public.get_board_attachment_path(p_attachment_id uuid)
returns jsonb language plpgsql stable security definer set search_path to 'pg_catalog' as $function$
declare a public.board_attachments;
begin
  select * into a from public.board_attachments
  where id=p_attachment_id and deleted_at is null
    and (lifecycle_status='active' or (lifecycle_status='pending' and uploaded_by=auth.uid()));
  if a.id is null or not exists(select 1 from public.board_posts p where p.id=a.post_id and p.deleted_at is null and p.status<>'deleted' and (p.status<>'draft' or p.author_user_id=auth.uid() or public.can_access_board(p.board_id,'other_post_update')))
    or not public.can_access_board(a.board_id,'detail_read') or not public.can_access_board(a.board_id,'attachment_view')
    or (a.purpose='general_attachment' and not public.can_access_board(a.board_id,'attachment_download')) then
    raise exception 'attachment_access_denied' using errcode='42501';
  end if;
  return jsonb_build_object('storage_path',a.storage_path,'original_name',a.original_name,'mime_type',a.mime_type,'purpose',a.purpose);
end;
$function$;

commit;
