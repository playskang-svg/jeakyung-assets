begin;

alter table public.approval_comments add column if not exists author_snapshot jsonb;
create unique index if not exists approval_references_document_user_type_unique on public.approval_references(document_id,user_id,reference_type);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('groupware-approval-attachments','groupware-approval-attachments',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict(id) do update set public=false,file_size_limit=20971520,allowed_mime_types=excluded.allowed_mime_types;

create policy approval_attachment_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='groupware-approval-attachments' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.approval_documents d where d.id=(storage.foldername(name))[1]::uuid and d.drafter_user_id=auth.uid() and d.status='draft'));
create policy approval_attachment_storage_select on storage.objects for select to authenticated
using(bucket_id='groupware-approval-attachments' and public.can_view_approval_document((storage.foldername(name))[1]::uuid));
create policy approval_attachment_storage_delete on storage.objects for delete to authenticated
using(bucket_id='groupware-approval-attachments' and (storage.foldername(name))[2]=auth.uid()::text and exists(select 1 from public.approval_documents d where d.id=(storage.foldername(name))[1]::uuid and d.drafter_user_id=auth.uid() and d.status='draft'));

create or replace function public.register_approval_attachment(p_document_id uuid,p_storage_path text,p_original_name text,p_mime_type text,p_file_size bigint)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare d public.approval_documents; result uuid;
begin
  select * into d from public.approval_documents where id=p_document_id;
  if not found or d.drafter_user_id<>auth.uid() or d.status<>'draft' or p_storage_path not like d.id::text||'/'||auth.uid()::text||'/%' or char_length(btrim(coalesce(p_original_name,''))) not between 1 and 240 or p_file_size not between 1 and 20971520 or p_mime_type not in ('application/pdf','image/jpeg','image/png','image/webp','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') then raise exception 'invalid_approval_attachment' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='groupware-approval-attachments' and name=p_storage_path and owner_id=auth.uid()::text and coalesce((metadata->>'size')::bigint,p_file_size)=p_file_size and metadata->>'mimetype'=p_mime_type) then raise exception 'attachment_file_not_found' using errcode='22023'; end if;
  if (select count(*) from public.approval_attachments where document_id=d.id and deleted_at is null)>=10 then raise exception 'approval_attachment_limit' using errcode='22023'; end if;
  if coalesce((select sum(file_size) from public.approval_attachments where document_id=d.id and deleted_at is null),0)+p_file_size>104857600 then raise exception 'approval_attachment_total_limit' using errcode='22023'; end if;
  insert into public.approval_attachments(document_id,revision_id,storage_path,original_name,mime_type,file_size,uploaded_by) values(d.id,d.current_revision_id,p_storage_path,left(btrim(p_original_name),240),p_mime_type,p_file_size,auth.uid()) returning id into result;
  return result;
end; $$;

create or replace function public.delete_approval_attachment(p_attachment_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare path_value text;
begin
  update public.approval_attachments a set deleted_at=now() from public.approval_documents d where a.id=p_attachment_id and d.id=a.document_id and d.drafter_user_id=auth.uid() and d.status='draft' and a.deleted_at is null returning a.storage_path into path_value;
  if path_value is null then raise exception 'attachment_delete_denied' using errcode='42501'; end if;
  return path_value;
end; $$;

create or replace function public.add_approval_comment(p_document_id uuid,p_content text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid;
begin
  if not public.can_view_approval_document(p_document_id) or char_length(btrim(coalesce(p_content,''))) not between 1 and 2000 then raise exception 'invalid_approval_comment' using errcode='22023'; end if;
  insert into public.approval_comments(document_id,revision_id,author_user_id,content,author_snapshot)
  select d.id,d.current_revision_id,auth.uid(),btrim(p_content),jsonb_build_object('name',coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name),'department_name',dep.name)
  from public.approval_documents d join public.profiles p on p.id=auth.uid() left join public.departments dep on dep.id=p.department_id where d.id=p_document_id returning id into result;
  return result;
end; $$;

create or replace function public.delete_approval_comment(p_comment_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.approval_comments set deleted_at=now(),content='삭제된 의견입니다.',updated_at=now() where id=p_comment_id and author_user_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'comment_delete_denied' using errcode='42501'; end if;
end; $$;

create or replace function public.set_approval_references(p_document_id uuid,p_references jsonb)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d public.approval_documents; item jsonb; user_value uuid; type_value text;
begin
  select * into d from public.approval_documents where id=p_document_id for update;
  if not found or d.drafter_user_id<>auth.uid() or d.status<>'draft' or jsonb_typeof(coalesce(p_references,'[]'::jsonb))<>'array' then raise exception 'reference_update_denied' using errcode='42501'; end if;
  delete from public.approval_references where document_id=d.id;
  for item in select value from jsonb_array_elements(p_references) loop
    user_value:=(item->>'user_id')::uuid; type_value:=coalesce(item->>'reference_type','reference');
    if user_value=auth.uid() or type_value not in ('reference','reader') or not exists(select 1 from public.profiles where id=user_value and membership_status='approved') then raise exception 'invalid_approval_reference' using errcode='22023'; end if;
    insert into public.approval_references(document_id,user_id,reference_type,added_by) values(d.id,user_value,type_value,auth.uid()) on conflict(document_id,user_id,reference_type) do nothing;
  end loop;
end; $$;

create or replace function public.get_my_approval_references()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id reference_id,r.reference_type,r.read_at,r.created_at,d.id,d.document_number,d.title,d.status,d.submitted_at,t.name template_name,coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name) drafter_name from public.approval_references r join public.approval_documents d on d.id=r.document_id join public.approval_templates t on t.id=d.template_id join public.profiles p on p.id=d.drafter_user_id where r.user_id=auth.uid()) x),'[]'::jsonb);
end; $$;

create or replace function public.notify_approval_references_on_submit()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.status='draft' and new.status='in_progress' then
    insert into public.groupware_notifications(user_id,notification_type,title,message,route,related_entity_type,related_entity_id)
    select r.user_id,'approval.referenced','결재 문서 참조 요청',new.title,'/approval/documents/'||new.id::text,'approval_document',new.id from public.approval_references r where r.document_id=new.id;
  end if;
  return new;
end; $$;

drop trigger if exists approval_reference_submit_notification on public.approval_documents;
create trigger approval_reference_submit_notification after update of status on public.approval_documents for each row execute function public.notify_approval_references_on_submit();

create or replace function public.admin_cancel_approval_document(p_document_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d public.approval_documents;
begin
  if public.get_user_active_role(auth.uid()) is distinct from 'super_admin' or char_length(btrim(coalesce(p_reason,'')))<2 then raise exception 'admin_cancel_denied' using errcode='42501'; end if;
  select * into d from public.approval_documents where id=p_document_id for update;
  if not found or d.status in ('approved','canceled','archived') then raise exception 'document_cannot_be_canceled' using errcode='22023'; end if;
  update public.approval_documents set status='canceled',canceled_at=now(),completed_at=now(),updated_at=now() where id=d.id;
  update public.approval_lines set status='canceled',completed_at=now() where document_id=d.id and revision_id=d.current_revision_id and status in ('waiting','active','held');
  update public.approval_line_assignees set status='skipped' where line_id in(select id from public.approval_lines where document_id=d.id and revision_id=d.current_revision_id) and status in ('waiting','pending','held');
  insert into public.approval_actions(document_id,revision_id,actor_user_id,action_type,opinion,actor_snapshot) select d.id,d.current_revision_id,auth.uid(),'admin_override',btrim(p_reason),jsonb_build_object('name',coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name)) from public.profiles p where p.id=auth.uid();
  insert into public.groupware_notifications(user_id,notification_type,title,message,route,related_entity_type,related_entity_id) values(d.drafter_user_id,'approval.canceled','결재 문서 관리자 취소',d.title,'/approval/documents/'||d.id,'approval_document',d.id);
end; $$;

revoke all on function public.register_approval_attachment(uuid,text,text,text,bigint),public.delete_approval_attachment(uuid),public.add_approval_comment(uuid,text),public.delete_approval_comment(uuid),public.set_approval_references(uuid,jsonb),public.get_my_approval_references(),public.admin_cancel_approval_document(uuid,text),public.notify_approval_references_on_submit() from public,anon;
grant execute on function public.register_approval_attachment(uuid,text,text,text,bigint),public.delete_approval_attachment(uuid),public.add_approval_comment(uuid,text),public.delete_approval_comment(uuid),public.set_approval_references(uuid,jsonb),public.get_my_approval_references(),public.admin_cancel_approval_document(uuid,text) to authenticated;

commit;
