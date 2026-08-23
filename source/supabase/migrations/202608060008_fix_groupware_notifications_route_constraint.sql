begin;

-- Drop restricting route check constraint on groupware_notifications table
alter table public.groupware_notifications drop constraint if exists groupware_notifications_route_check;

-- Optionally add a safe, flexible route constraint if needed, or leave unconstrained
alter table public.groupware_notifications add constraint groupware_notifications_route_check
  check (route is null or char_length(route) <= 2000);

-- Update submit_approval_document_v2 to use full route path
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
    '/groupware/approval/documents/' || document_row.id::text,
    'approval_document',
    document_row.id
  from public.approval_line_assignees a
  where a.line_id = first_line_id
    and a.assigned_user_id <> auth.uid();
end;
$$;

commit;
