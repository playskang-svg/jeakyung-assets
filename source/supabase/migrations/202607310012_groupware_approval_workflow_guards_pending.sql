begin;

create or replace function public.create_approval_delegation(p_delegate_user_id uuid,p_scope_type text,p_template_id uuid,p_department_id uuid,p_starts_at timestamptz,p_ends_at timestamptz,p_reason text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare result uuid; cycle_found boolean; status_value text;
begin
  if not public.is_approved_member() or not exists(select 1 from public.profiles where id=p_delegate_user_id and membership_status='approved') or p_delegate_user_id=auth.uid() or p_scope_type not in ('all','template','department') or p_starts_at>=p_ends_at or p_ends_at<=now() or p_ends_at>now()+interval '1 year' or char_length(btrim(coalesce(p_reason,'')))<2 then raise exception 'invalid_delegation' using errcode='22023'; end if;
  if p_scope_type='template' and (p_template_id is null or not exists(select 1 from public.approval_templates where id=p_template_id and is_active and archived_at is null)) then raise exception 'invalid_delegation_template' using errcode='22023'; end if;
  if p_scope_type='department' and (p_department_id is null or not exists(select 1 from public.departments where id=p_department_id and is_active and archived_at is null)) then raise exception 'invalid_delegation_department' using errcode='22023'; end if;
  with recursive chain(user_id) as (
    select p_delegate_user_id union
    select d.delegate_user_id from public.approval_delegations d join chain c on d.delegator_user_id=c.user_id where d.status in ('scheduled','active') and d.ends_at>now()
  ) select exists(select 1 from chain where user_id=auth.uid()) into cycle_found;
  if cycle_found then raise exception 'delegation_cycle_not_allowed' using errcode='22023'; end if;
  if exists(select 1 from public.approval_delegations where delegator_user_id=auth.uid() and status in ('scheduled','active') and ends_at>now() and tstzrange(starts_at,ends_at,'[)') && tstzrange(p_starts_at,p_ends_at,'[)') and (scope_type='all' or p_scope_type='all' or (scope_type=p_scope_type and coalesce(template_id::text,department_id::text)=coalesce(p_template_id::text,p_department_id::text)))) then raise exception 'delegation_period_overlap' using errcode='22023'; end if;
  status_value:=case when p_starts_at<=now() then 'active' else 'scheduled' end;
  insert into public.approval_delegations(delegator_user_id,delegate_user_id,scope_type,template_id,department_id,starts_at,ends_at,reason,status,created_by) values(auth.uid(),p_delegate_user_id,p_scope_type,case when p_scope_type='template' then p_template_id end,case when p_scope_type='department' then p_department_id end,p_starts_at,p_ends_at,btrim(p_reason),status_value,auth.uid()) returning id into result;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.delegation.created','approval_delegation',result::text,jsonb_build_object('scope_type',p_scope_type,'starts_at',p_starts_at,'ends_at',p_ends_at));
  insert into public.groupware_notifications(user_id,notification_type,title,message,route,related_entity_type,related_entity_id) values(p_delegate_user_id,'approval.delegation.started','결재 위임이 등록되었습니다','전자결재 위임 범위를 확인해 주세요.','/approval/delegations','approval_delegation',result);
  return result;
end; $$;

create or replace function public.mark_approval_reference_read(p_reference_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare document_value uuid;
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  select document_id into document_value from public.approval_references where id=p_reference_id and user_id=auth.uid();
  if not found or not public.can_view_approval_document(document_value) then raise exception 'reference_not_found' using errcode='42501'; end if;
  update public.approval_references set read_at=coalesce(read_at,now()) where id=p_reference_id and user_id=auth.uid();
end; $$;

create or replace function public.archive_approval_document(p_document_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare d public.approval_documents;
begin
  if char_length(btrim(coalesce(p_reason,'')))<2 then raise exception 'archive_reason_required' using errcode='22023'; end if;
  select * into d from public.approval_documents where id=p_document_id for update;
  if not found or d.status not in ('approved','rejected','recalled','canceled') or not (d.drafter_user_id=auth.uid() or public.is_membership_admin()) then raise exception 'archive_not_allowed' using errcode='42501'; end if;
  update public.approval_documents set status='archived',archived_at=now() where id=d.id;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.document.archived','approval_document',d.id::text,jsonb_build_object('previous_status',d.status,'reason',left(btrim(p_reason),500)));
end; $$;

create or replace function public.get_available_approval_actions(p_document_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select case when public.can_view_approval_document(p_document_id) then jsonb_build_object(
    'can_edit',d.drafter_user_id=auth.uid() and d.status in ('draft','rejected','recalled'),
    'can_submit',d.drafter_user_id=auth.uid() and d.status='draft',
    'can_recall',d.drafter_user_id=auth.uid() and d.status in ('submitted','in_progress') and coalesce(t.settings->>'recall_policy','before_first_action')<>'disabled' and not exists(select 1 from public.approval_actions where document_id=d.id and action_type in ('approve','reject','hold','release_hold','delegate')),
    'can_archive',(d.drafter_user_id=auth.uid() or public.is_membership_admin()) and d.status in ('approved','rejected','recalled','canceled'),
    'can_admin_cancel',public.has_role('super_admin') and d.status not in ('approved','canceled','archived'),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object(
      'assignee_id',a.id,'line_id',l.id,'step_order',l.step_order,'step_kind',l.step_kind,'line_mode',l.line_mode,
      'assignment_status',a.status,'is_delegated',a.assigned_user_id<>auth.uid(),'original_user_id',a.assigned_user_id,
      'can_approve',a.status='pending','can_reject',a.status='pending','can_hold',a.status='pending','can_release_hold',a.status='held'
    ) order by l.step_order,a.assignee_order)
    from public.approval_lines l join public.approval_line_assignees a on a.line_id=l.id
    where l.document_id=d.id and l.revision_id=d.current_revision_id and l.status in ('active','held')
      and (a.assigned_user_id=auth.uid() or public.has_active_approval_delegation(a.assigned_user_id,d.id))
      and a.status in ('pending','held')),'[]'::jsonb)
  ) else '{}'::jsonb end
  from public.approval_documents d join public.approval_templates t on t.id=d.template_id where d.id=p_document_id;
$$;

revoke all on function public.create_approval_delegation(uuid,text,uuid,uuid,timestamptz,timestamptz,text),public.mark_approval_reference_read(uuid),public.archive_approval_document(uuid,text),public.get_available_approval_actions(uuid) from public,anon;
grant execute on function public.create_approval_delegation(uuid,text,uuid,uuid,timestamptz,timestamptz,text),public.mark_approval_reference_read(uuid),public.archive_approval_document(uuid,text),public.get_available_approval_actions(uuid) to authenticated;

commit;
