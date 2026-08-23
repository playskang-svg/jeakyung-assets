begin;

-- Drop restricting storage_path check constraint on approval_attachments table
alter table public.approval_attachments drop constraint if exists approval_attachments_storage_path_check;

commit;
