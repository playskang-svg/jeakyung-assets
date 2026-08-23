begin;

-- The first remote delivery used an earlier 202608050003 body. Keep the
-- already-recorded migration immutable and repair the runtime contract here.
alter table public.approval_documents
  add column if not exists draft_line_schema jsonb not null default '[]'::jsonb;

alter table public.approval_line_assignees
  add column if not exists assignee_order integer not null default 1;

create or replace function public.submit_approval_document_v2(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  document_row public.approval_documents;
  revision_row public.approval_document_revisions;
  step_value jsonb;
  assignee_value jsonb;
  line_id_value uuid;
  first_line_id uuid;
  step_order_value integer := 0;
  assignee_order_value integer;
  assignee_id_value uuid;
  assignee_count integer;
  action_value text;
begin
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;

  select * into document_row
  from public.approval_documents
  where id = p_document_id
  for update;

  if not found or document_row.drafter_user_id <> auth.uid() then
    raise exception 'approval_submit_denied' using errcode = '42501';
  end if;
  if document_row.status not in ('draft', 'recalled', 'rejected') then
    raise exception 'approval_document_not_submittable' using errcode = '22023';
  end if;
  if document_row.current_revision_id is null
     or jsonb_typeof(document_row.draft_line_schema) <> 'array'
     or jsonb_array_length(document_row.draft_line_schema) = 0 then
    raise exception 'approval_line_required' using errcode = '22023';
  end if;

  select * into revision_row
  from public.approval_document_revisions
  where id = document_row.current_revision_id
    and document_id = document_row.id;
  if not found then
    raise exception 'approval_revision_not_found' using errcode = 'P0002';
  end if;

  delete from public.approval_lines
  where document_id = document_row.id
    and revision_id = document_row.current_revision_id;

  for step_value in
    select value from jsonb_array_elements(document_row.draft_line_schema)
  loop
    step_order_value := step_order_value + 1;
    if jsonb_typeof(step_value->'assignees') <> 'array'
       or jsonb_array_length(step_value->'assignees') = 0 then
      raise exception 'approval_line_has_no_assignee' using errcode = '22023';
    end if;

    assignee_count := jsonb_array_length(step_value->'assignees');
    if coalesce(step_value->>'line_mode', 'sequential') = 'parallel_required_count'
       and greatest(coalesce((step_value->>'required_count')::integer, 1), 1) > assignee_count then
      raise exception 'approval_required_count_exceeds_assignees' using errcode = '22023';
    end if;

    insert into public.approval_lines(
      document_id, revision_id, step_order, step_kind, line_mode,
      required_count, is_blocking, status, activated_at
    ) values (
      document_row.id,
      document_row.current_revision_id,
      step_order_value,
      coalesce(step_value->>'step_kind', 'approval'),
      coalesce(step_value->>'line_mode', 'sequential'),
      greatest(coalesce((step_value->>'required_count')::integer, 1), 1),
      coalesce((step_value->>'is_blocking')::boolean, true),
      case when step_order_value = 1 then 'active' else 'waiting' end,
      case when step_order_value = 1 then now() end
    ) returning id into line_id_value;

    if step_order_value = 1 then first_line_id := line_id_value; end if;
    assignee_order_value := 0;

    for assignee_value in
      select value from jsonb_array_elements(step_value->'assignees')
    loop
      assignee_order_value := assignee_order_value + 1;
      assignee_id_value := (assignee_value->>'user_id')::uuid;
      if not exists (
        select 1 from public.profiles
        where id = assignee_id_value and membership_status = 'approved'
      ) then
        raise exception 'approval_assignee_unavailable' using errcode = '22023';
      end if;

      insert into public.approval_line_assignees(
        line_id, assigned_user_id, assignment_source, assignee_snapshot,
        assignee_order, status
      )
      select
        line_id_value,
        p.id,
        coalesce(nullif(assignee_value->>'source', ''), 'user_selected'),
        jsonb_build_object(
          'user_id', p.id,
          'name', coalesce(nullif(p.preferred_name, ''), nullif(p.full_name, ''), p.name),
          'department_name', d.name,
          'position_name', po.name,
          'job_title_name', jt.name
        ),
        assignee_order_value,
        case when step_order_value = 1 then 'pending' else 'waiting' end
      from public.profiles p
      left join public.departments d on d.id = p.department_id
      left join public.positions po on po.id = p.position_id
      left join public.job_titles jt on jt.id = p.job_title_id
      where p.id = assignee_id_value;
    end loop;
  end loop;

  action_value := case
    when document_row.status in ('recalled', 'rejected') then 'resubmit'
    else 'submit'
  end;

  update public.approval_documents
  set document_number = coalesce(document_number, public.generate_approval_document_number(template_id)),
      status = 'in_progress',
      current_step_order = 1,
      submitted_at = now(),
      completed_at = null,
      recalled_at = null,
      updated_at = now()
  where id = document_row.id;

  insert into public.approval_actions(
    document_id, revision_id, actor_user_id, action_type, actor_snapshot
  )
  select
    document_row.id,
    document_row.current_revision_id,
    auth.uid(),
    action_value,
    jsonb_build_object(
      'name', coalesce(nullif(p.preferred_name, ''), nullif(p.full_name, ''), p.name),
      'department_name', d.name
    )
  from public.profiles p
  left join public.departments d on d.id = p.department_id
  where p.id = auth.uid();

  insert into public.groupware_notifications(
    user_id, notification_type, title, message, route,
    related_entity_type, related_entity_id
  )
  select distinct
    a.assigned_user_id,
    'approval.requested',
    '새 결재 요청',
    document_row.title,
    '/approval/documents/' || document_row.id::text,
    'approval_document',
    document_row.id
  from public.approval_line_assignees a
  where a.line_id = first_line_id
    and a.assigned_user_id <> auth.uid();
end;
$$;

create or replace function public.process_approval_action_v2(
  p_document_id uuid,
  p_assignee_id uuid,
  p_action text,
  p_opinion text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  document_row public.approval_documents;
  assignee_row public.approval_line_assignees;
  line_row public.approval_lines;
  actor_row public.profiles;
  delegation_id_value uuid;
  approved_count integer;
  pending_count integer;
  line_complete boolean := false;
  next_line_id uuid;
  next_step_order integer;
  result_status text;
begin
  if p_action not in ('approve', 'reject', 'hold', 'release_hold') then
    raise exception 'invalid_approval_action' using errcode = '22023';
  end if;
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;

  select * into document_row
  from public.approval_documents
  where id = p_document_id
  for update;
  if not found then raise exception 'approval_document_not_found' using errcode = 'P0002'; end if;

  select a.* into assignee_row
  from public.approval_line_assignees a
  join public.approval_lines l on l.id = a.line_id
  where a.id = p_assignee_id
    and l.document_id = document_row.id
    and l.revision_id = document_row.current_revision_id
  for update of a;
  if not found then raise exception 'approval_assignment_not_found' using errcode = 'P0002'; end if;

  select * into line_row from public.approval_lines where id = assignee_row.line_id for update;
  select * into actor_row from public.profiles where id = auth.uid();

  if assignee_row.assigned_user_id <> auth.uid() then
    select d.id into delegation_id_value
    from public.approval_delegations d
    where d.delegator_user_id = assignee_row.assigned_user_id
      and d.delegate_user_id = auth.uid()
      and d.status in ('scheduled', 'active')
      and d.starts_at <= now() and d.ends_at > now()
      and (
        d.scope_type = 'all'
        or (d.scope_type = 'template' and d.template_id = document_row.template_id)
        or (d.scope_type = 'department' and d.department_id = document_row.drafter_department_id)
      )
    order by d.created_at desc
    limit 1;
    if delegation_id_value is null then
      raise exception 'approval_action_denied' using errcode = '42501';
    end if;
  end if;

  if p_action = 'release_hold' then
    if document_row.status <> 'held' or line_row.status <> 'held' or assignee_row.status <> 'held' then
      raise exception 'approval_action_state_conflict' using errcode = '40001';
    end if;
  elsif document_row.status <> 'in_progress'
        or line_row.status <> 'active'
        or assignee_row.status <> 'pending' then
    raise exception 'approval_action_state_conflict' using errcode = '40001';
  end if;

  insert into public.approval_actions(
    document_id, revision_id, line_id, assignee_id, actor_user_id,
    action_type, opinion, actor_snapshot, delegation_id
  ) values (
    document_row.id,
    document_row.current_revision_id,
    line_row.id,
    assignee_row.id,
    auth.uid(),
    p_action,
    nullif(btrim(coalesce(p_opinion, '')), ''),
    jsonb_build_object(
      'name', coalesce(nullif(actor_row.preferred_name, ''), nullif(actor_row.full_name, ''), actor_row.name),
      'department_id', actor_row.department_id
    ),
    delegation_id_value
  );

  if p_action = 'reject' then
    update public.approval_line_assignees
    set status = case when id = assignee_row.id then 'rejected' else 'skipped' end,
        acted_at = case when id = assignee_row.id then now() else acted_at end
    where line_id in (
      select id from public.approval_lines
      where document_id = document_row.id and revision_id = document_row.current_revision_id
    ) and status in ('waiting', 'pending', 'held');
    update public.approval_lines
    set status = case when id = line_row.id then 'rejected' else 'canceled' end,
        completed_at = now()
    where document_id = document_row.id
      and revision_id = document_row.current_revision_id
      and status in ('waiting', 'active', 'held');
    update public.approval_documents
    set status = 'rejected', completed_at = now(), updated_at = now()
    where id = document_row.id;
    result_status := 'rejected';

  elsif p_action = 'hold' then
    update public.approval_line_assignees set status = 'held', acted_at = now() where id = assignee_row.id;
    update public.approval_lines set status = 'held' where id = line_row.id;
    update public.approval_documents set status = 'held', updated_at = now() where id = document_row.id;
    result_status := 'held';

  elsif p_action = 'release_hold' then
    update public.approval_line_assignees set status = 'pending', acted_at = null where id = assignee_row.id;
    update public.approval_lines set status = 'active' where id = line_row.id;
    update public.approval_documents set status = 'in_progress', updated_at = now() where id = document_row.id;
    result_status := 'in_progress';

  else
    update public.approval_line_assignees set status = 'approved', acted_at = now() where id = assignee_row.id;

    select count(*) filter (where status = 'approved'),
           count(*) filter (where status = 'pending')
    into approved_count, pending_count
    from public.approval_line_assignees
    where line_id = line_row.id;

    line_complete := case line_row.line_mode
      when 'parallel_required_count' then approved_count >= line_row.required_count
      else pending_count = 0
    end;

    if line_complete then
      update public.approval_line_assignees set status = 'skipped'
      where line_id = line_row.id and status = 'pending';
      update public.approval_lines set status = 'approved', completed_at = now() where id = line_row.id;

      select id, step_order into next_line_id, next_step_order
      from public.approval_lines
      where document_id = document_row.id
        and revision_id = document_row.current_revision_id
        and status = 'waiting'
        and step_order > line_row.step_order
      order by step_order
      limit 1
      for update;

      if next_line_id is null then
        update public.approval_documents
        set status = 'approved', completed_at = now(), updated_at = now()
        where id = document_row.id;
        insert into public.approval_actions(
          document_id, revision_id, line_id, actor_user_id,
          action_type, actor_snapshot
        ) values (
          document_row.id, document_row.current_revision_id, line_row.id,
          auth.uid(), 'final_approve',
          jsonb_build_object('name', coalesce(nullif(actor_row.preferred_name, ''), nullif(actor_row.full_name, ''), actor_row.name))
        );
        result_status := 'approved';
      else
        update public.approval_lines set status = 'active', activated_at = now() where id = next_line_id;
        update public.approval_line_assignees set status = 'pending' where line_id = next_line_id and status = 'waiting';
        update public.approval_documents
        set current_step_order = next_step_order, status = 'in_progress', updated_at = now()
        where id = document_row.id;
        insert into public.groupware_notifications(
          user_id, notification_type, title, message, route,
          related_entity_type, related_entity_id
        )
        select distinct
          a.assigned_user_id, 'approval.requested', '새 결재 요청', document_row.title,
          '/approval/documents/' || document_row.id::text,
          'approval_document', document_row.id
        from public.approval_line_assignees a
        where a.line_id = next_line_id and a.assigned_user_id <> auth.uid();
        result_status := 'in_progress';
      end if;
    else
      result_status := 'in_progress';
    end if;
  end if;

  if result_status in ('approved', 'rejected', 'held') then
    insert into public.groupware_notifications(
      user_id, notification_type, title, message, route,
      related_entity_type, related_entity_id
    ) values (
      document_row.drafter_user_id,
      'approval.' || result_status,
      case result_status
        when 'approved' then '결재가 완료되었습니다'
        when 'rejected' then '결재가 반려되었습니다'
        else '결재가 보류되었습니다'
      end,
      document_row.title,
      '/approval/documents/' || document_row.id::text,
      'approval_document',
      document_row.id
    );
  end if;

  return jsonb_build_object('status', result_status, 'document_id', document_row.id);
end;
$$;

create or replace function public.process_signed_approval_action_v2(
  p_document_id uuid,
  p_assignee_id uuid,
  p_action text,
  p_opinion text,
  p_credential_id uuid
)
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  credential_value public.approval_credentials;
  action_result jsonb;
  action_id_value uuid;
begin
  if p_action = 'approve' then
    select * into credential_value
    from public.approval_credentials
    where id = p_credential_id
      and user_id = auth.uid()
      and archived_at is null;
    if not found then
      raise exception 'active_signature_or_stamp_required' using errcode = '22023';
    end if;
  end if;

  action_result := public.process_approval_action_v2(
    p_document_id, p_assignee_id, p_action, p_opinion
  );

  if p_action = 'approve' then
    select id into action_id_value
    from public.approval_actions
    where document_id = p_document_id
      and assignee_id = p_assignee_id
      and actor_user_id = auth.uid()
      and action_type = 'approve'
    order by created_at desc
    limit 1;

    update public.approval_actions
    set credential_snapshot = jsonb_build_object(
      'credential_id', credential_value.id,
      'credential_type', credential_value.credential_type,
      'label', credential_value.label,
      'storage_path', credential_value.storage_path,
      'signed_at', now()
    )
    where id = action_id_value;
  end if;

  return action_result->>'status';
end;
$$;

create or replace function public.recall_approval_document_v2(p_document_id uuid, p_opinion text default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  document_row public.approval_documents;
  template_settings jsonb;
begin
  select * into document_row
  from public.approval_documents
  where id = p_document_id
  for update;

  if not found or document_row.drafter_user_id <> auth.uid() then
    raise exception 'approval_recall_denied' using errcode = '42501';
  end if;

  select settings into template_settings
  from public.approval_templates
  where id = document_row.template_id;

  if document_row.status not in ('submitted', 'in_progress', 'held')
     or coalesce(template_settings->>'recall_policy', 'before_first_action') = 'disabled'
     or exists (
       select 1 from public.approval_actions
       where document_id = document_row.id
         and action_type in ('approve', 'reject', 'hold', 'release_hold', 'delegate')
     ) then
    raise exception 'approval_document_not_recallable' using errcode = '22023';
  end if;

  update public.approval_line_assignees
  set status = 'skipped'
  where line_id in (
    select id from public.approval_lines
    where document_id = document_row.id and revision_id = document_row.current_revision_id
  ) and status in ('waiting', 'pending', 'held');
  update public.approval_lines
  set status = 'canceled', completed_at = now()
  where document_id = document_row.id
    and revision_id = document_row.current_revision_id
    and status in ('waiting', 'active', 'held');
  update public.approval_documents
  set status = 'recalled', recalled_at = now(), completed_at = now(), updated_at = now()
  where id = document_row.id;

  insert into public.approval_actions(
    document_id, revision_id, actor_user_id, action_type, opinion, actor_snapshot
  )
  select
    document_row.id, document_row.current_revision_id, auth.uid(), 'recall',
    nullif(btrim(coalesce(p_opinion, '')), ''),
    jsonb_build_object('name', coalesce(nullif(p.preferred_name, ''), nullif(p.full_name, ''), p.name))
  from public.profiles p where p.id = auth.uid();
end;
$$;

revoke all on function public.submit_approval_document_v2(uuid) from public, anon;
revoke all on function public.process_approval_action_v2(uuid, uuid, text, text) from public, anon;
revoke all on function public.process_signed_approval_action_v2(uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.recall_approval_document_v2(uuid, text) from public, anon;
grant execute on function public.submit_approval_document_v2(uuid) to authenticated;
grant execute on function public.process_approval_action_v2(uuid, uuid, text, text) to authenticated;
grant execute on function public.process_signed_approval_action_v2(uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.recall_approval_document_v2(uuid, text) to authenticated;

commit;
