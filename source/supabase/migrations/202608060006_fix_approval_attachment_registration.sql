begin;

-- Fix register_approval_attachment to verify file existence safely in storage.objects
create or replace function public.register_approval_attachment(
  p_document_id uuid,
  p_storage_path text,
  p_original_name text,
  p_mime_type text,
  p_file_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  d public.approval_documents;
  result uuid;
begin
  select * into d from public.approval_documents where id = p_document_id;
  if not found or d.drafter_user_id <> auth.uid() or d.status <> 'draft'
     or p_storage_path not like d.id::text || '/' || auth.uid()::text || '/%'
     or char_length(btrim(coalesce(p_original_name, ''))) not between 1 and 240
     or p_file_size not between 1 and 20971520
     or p_mime_type not in (
       'application/pdf',
       'image/jpeg',
       'image/png',
       'image/webp',
       'text/plain',
       'application/zip',
       'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
       'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     ) then
    raise exception 'invalid_approval_attachment' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'groupware-approval-attachments'
      and name = p_storage_path
  ) then
    raise exception 'attachment_file_not_found' using errcode = '22023';
  end if;

  if (select count(*) from public.approval_attachments where document_id = d.id and deleted_at is null) >= 10 then
    raise exception 'approval_attachment_limit' using errcode = '22023';
  end if;

  if coalesce((select sum(file_size) from public.approval_attachments where document_id = d.id and deleted_at is null), 0) + p_file_size > 104857600 then
    raise exception 'approval_attachment_total_limit' using errcode = '22023';
  end if;

  insert into public.approval_attachments (
    document_id, revision_id, storage_path, original_name, mime_type, file_size, uploaded_by
  ) values (
    d.id, d.current_revision_id, p_storage_path, left(btrim(p_original_name), 240), p_mime_type, p_file_size, auth.uid()
  ) returning id into result;

  return result;
end; $$;

commit;
