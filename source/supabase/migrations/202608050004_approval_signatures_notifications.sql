begin;

create table if not exists public.approval_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credential_type text not null check(credential_type in ('signature','stamp')),
  label text not null,
  storage_path text not null unique,
  mime_type text not null check(mime_type in ('image/png','image/jpeg','image/webp')),
  file_size bigint not null check(file_size between 1 and 2097152),
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.approval_actions add column if not exists credential_snapshot jsonb;
alter table public.approval_credentials enable row level security;
revoke all on table public.approval_credentials from anon,authenticated;
grant select on table public.approval_credentials to authenticated;
create policy approval_credentials_select_own on public.approval_credentials for select to authenticated using(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('groupware-approval-credentials','groupware-approval-credentials',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict(id) do update set public=false,file_size_limit=2097152,allowed_mime_types=excluded.allowed_mime_types;

create policy approval_credentials_storage_insert on storage.objects for insert to authenticated
with check(bucket_id='groupware-approval-credentials' and (storage.foldername(name))[1]=auth.uid()::text);
create policy approval_credentials_storage_select on storage.objects for select to authenticated
using(bucket_id='groupware-approval-credentials' and (
  (storage.foldername(name))[1]=auth.uid()::text or exists(
    select 1 from public.approval_actions a where a.credential_snapshot->>'storage_path'=name and public.can_view_approval_document(a.document_id)
  )
));
create policy approval_credentials_storage_delete on storage.objects for delete to authenticated
using(bucket_id='groupware-approval-credentials' and (storage.foldername(name))[1]=auth.uid()::text and not exists(select 1 from public.approval_actions a where a.credential_snapshot->>'storage_path'=name));

do $$ begin
  if exists(select 1 from pg_catalog.pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_catalog.pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='groupware_notifications') then
    alter publication supabase_realtime add table public.groupware_notifications;
  end if;
end $$;

create or replace function public.register_approval_credential(p_type text,p_label text,p_storage_path text,p_mime_type text,p_file_size bigint,p_is_default boolean default false)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid;
begin
  if not public.is_approved_member() or p_type not in ('signature','stamp') or char_length(btrim(coalesce(p_label,''))) not between 1 and 40 or p_storage_path not like auth.uid()::text||'/%' or p_mime_type not in ('image/png','image/jpeg','image/webp') or p_file_size not between 1 and 2097152 then raise exception 'invalid_approval_credential' using errcode='22023'; end if;
  if not exists(select 1 from storage.objects where bucket_id='groupware-approval-credentials' and name=p_storage_path and owner_id=auth.uid()::text) then raise exception 'credential_file_not_found' using errcode='22023'; end if;
  if p_is_default then update public.approval_credentials set is_default=false,updated_at=now() where user_id=auth.uid() and archived_at is null; end if;
  insert into public.approval_credentials(user_id,credential_type,label,storage_path,mime_type,file_size,is_default) values(auth.uid(),p_type,btrim(p_label),p_storage_path,p_mime_type,p_file_size,p_is_default) returning id into result;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.credential.registered','approval_credential',result::text,jsonb_build_object('credential_type',p_type));
  return result;
end; $$;

create or replace function public.archive_approval_credential(p_credential_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.approval_credentials set archived_at=now(),is_default=false,updated_at=now() where id=p_credential_id and user_id=auth.uid() and archived_at is null;
  if not found then raise exception 'credential_not_found' using errcode='P0002'; end if;
end; $$;

create or replace function public.process_signed_approval_action(p_document_id uuid,p_assignee_id uuid,p_action text,p_opinion text,p_credential_id uuid)
returns text language plpgsql security definer set search_path=pg_catalog as $$
declare credential_value public.approval_credentials; action_result jsonb; result text; action_value uuid;
begin
  if p_action='approve' then
    select * into credential_value from public.approval_credentials where id=p_credential_id and user_id=auth.uid() and archived_at is null;
    if not found then raise exception 'active_signature_or_stamp_required' using errcode='22023'; end if;
  end if;
  action_result:=public.process_approval_action(p_document_id,p_assignee_id,p_action,p_opinion);
  result:=action_result->>'status';
  if p_action='approve' then
    select id into action_value from public.approval_actions where document_id=p_document_id and assignee_id=p_assignee_id and actor_user_id=auth.uid() and action_type='approve' order by created_at desc limit 1;
    update public.approval_actions set credential_snapshot=jsonb_build_object('credential_id',credential_value.id,'credential_type',credential_value.credential_type,'label',credential_value.label,'storage_path',credential_value.storage_path,'signed_at',now()) where id=action_value;
  end if;
  return result;
end; $$;

create or replace function public.get_groupware_header_state()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'approval_pending',(select count(*) from public.get_my_approval_inbox()),
    'unread_count',(select count(*) from public.groupware_notifications where user_id=auth.uid() and read_at is null),
    'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select id,notification_type,title,message,route,read_at,created_at from public.groupware_notifications where user_id=auth.uid() order by created_at desc limit 20) n),'[]'::jsonb)
  );
end; $$;

create or replace function public.mark_groupware_notification_read(p_notification_id uuid default null)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  update public.groupware_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and (p_notification_id is null or id=p_notification_id);
end; $$;

create or replace function public.get_my_approval_delegations()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (
    select d.id,d.delegator_user_id,d.delegate_user_id,d.scope_type,d.template_id,d.starts_at,d.ends_at,d.reason,d.status,d.created_at,
      coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name) delegate_name,t.name template_name
    from public.approval_delegations d join public.profiles p on p.id=d.delegate_user_id left join public.approval_templates t on t.id=d.template_id
    where d.delegator_user_id=auth.uid()
  ) x),'[]'::jsonb);
end; $$;

create or replace function public.revoke_approval_delegation(p_delegation_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
  if char_length(btrim(coalesce(p_reason,'')))<2 then raise exception 'revocation_reason_required' using errcode='22023'; end if;
  update public.approval_delegations set status='revoked',revoked_at=now() where id=p_delegation_id and delegator_user_id=auth.uid() and status in ('scheduled','active');
  if not found then raise exception 'delegation_not_found' using errcode='P0002'; end if;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.delegation.revoked','approval_delegation',p_delegation_id::text,jsonb_build_object('reason',left(btrim(p_reason),500)));
end; $$;

revoke all on function public.register_approval_credential(text,text,text,text,bigint,boolean),public.archive_approval_credential(uuid),public.process_signed_approval_action(uuid,uuid,text,text,uuid),public.get_groupware_header_state(),public.mark_groupware_notification_read(uuid),public.get_my_approval_delegations(),public.revoke_approval_delegation(uuid,text) from public,anon;
grant execute on function public.register_approval_credential(text,text,text,text,bigint,boolean),public.archive_approval_credential(uuid),public.process_signed_approval_action(uuid,uuid,text,text,uuid),public.get_groupware_header_state(),public.mark_groupware_notification_read(uuid),public.get_my_approval_delegations(),public.revoke_approval_delegation(uuid,text) to authenticated;

commit;
