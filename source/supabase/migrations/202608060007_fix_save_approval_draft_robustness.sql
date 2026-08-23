begin;

-- Make save_approval_draft robust against null template_version_id, missing profile joins, and unresolvable fallback lines.
create or replace function public.save_approval_draft(
  p_document_id uuid,
  p_template_id uuid,
  p_title text,
  p_body_json jsonb,
  p_form_data jsonb,
  p_line_schema_override jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  d public.approval_documents;
  version_row public.approval_template_versions;
  result uuid;
  revision_id uuid;
  revision_number integer;
  step_value jsonb;
  user_value text;
  target_type text;
  target_id text;
  assignee_count integer;
  allow_self boolean;
  effective_line_schema jsonb;
  assignees jsonb;
  resolved_line_schema jsonb := '[]'::jsonb;
  resolved_user uuid;
begin
  if not public.is_approved_member() then
    raise exception 'approved_member_required' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 240 then
    raise exception 'invalid_approval_title' using errcode = '22023';
  end if;

  if p_document_id is null then
    select v.* into version_row
    from public.approval_templates t
    join public.approval_template_versions v on v.id = t.current_version_id
    where t.id = p_template_id and t.is_active and t.archived_at is null and v.status = 'published';

    if not found then
      select v.* into version_row
      from public.approval_templates t
      join public.approval_template_versions v on v.template_id = t.id
      where t.id = p_template_id and v.status = 'published'
      order by v.version_number desc
      limit 1;
    end if;

    if version_row.id is null then
      raise exception 'approval_template_unavailable' using errcode = '22023';
    end if;

    insert into public.approval_documents (
      template_id, template_version_id, title, drafter_user_id, drafter_department_id, status
    )
    select
      p_template_id,
      version_row.id,
      btrim(p_title),
      auth.uid(),
      p.department_id,
      'draft'
    from (select 1) dummy
    left join public.profiles p on p.id = auth.uid()
    returning id into result;
  else
    select * into d
    from public.approval_documents
    where id = p_document_id
    for update;

    if not found or d.drafter_user_id <> auth.uid() or d.status not in ('draft', 'recalled', 'rejected') then
      raise exception 'approval_draft_update_denied' using errcode = '42501';
    end if;

    result := d.id;

    if d.template_version_id is not null then
      select * into version_row
      from public.approval_template_versions
      where id = d.template_version_id;
    end if;

    if version_row.id is null then
      select v.* into version_row
      from public.approval_templates t
      join public.approval_template_versions v on v.id = t.current_version_id
      where t.id = d.template_id and v.status = 'published';
    end if;

    if version_row.id is null then
      select v.* into version_row
      from public.approval_templates t
      join public.approval_template_versions v on v.template_id = t.id
      where t.id = d.template_id and v.status = 'published'
      order by v.version_number desc
      limit 1;
    end if;

    if version_row.id is null then
      raise exception 'approval_template_unavailable' using errcode = '22023';
    end if;
  end if;

  allow_self := coalesce((version_row.settings_snapshot->>'allow_self_approval')::boolean, true);
  effective_line_schema := case
    when p_line_schema_override is not null then p_line_schema_override
    else version_row.line_schema
  end;

  if jsonb_typeof(effective_line_schema) <> 'array' or jsonb_array_length(effective_line_schema) = 0 then
    raise exception 'approval_line_required' using errcode = '22023';
  end if;

  select coalesce(max(r.revision_number), 0) + 1 into revision_number
  from public.approval_document_revisions r
  where r.document_id = result;

  insert into public.approval_document_revisions (
    document_id, revision_number, title, body_json, form_data, drafter_snapshot, change_reason, created_by
  )
  select
    result,
    revision_number,
    btrim(p_title),
    coalesce(p_body_json, '{}'::jsonb),
    coalesce(p_form_data, '{}'::jsonb),
    jsonb_build_object(
      'user_id', auth.uid(),
      'name', coalesce(nullif(p.preferred_name, ''), nullif(p.full_name, ''), p.name, '기안자'),
      'department_id', p.department_id,
      'department_name', dep.name,
      'position_name', po.name,
      'job_title_name', jt.name
    ),
    case when revision_number > 1 then 'draft_updated' else 'draft_created' end,
    auth.uid()
  from (select 1) dummy
  left join public.profiles p on p.id = auth.uid()
  left join public.departments dep on dep.id = p.department_id
  left join public.positions po on po.id = p.position_id
  left join public.job_titles jt on jt.id = p.job_title_id
  returning id into revision_id;

  update public.approval_documents
  set title = btrim(p_title),
      template_version_id = version_row.id,
      current_revision_id = revision_id,
      status = 'draft',
      updated_at = now()
  where id = result;

  for step_value in
    select value from jsonb_array_elements(effective_line_schema) order by coalesce((value->>'step_order')::integer, 1)
  loop
    assignees := '[]'::jsonb;
    assignee_count := 0;

    if jsonb_typeof(step_value->'assignee_user_ids') = 'array' then
      for user_value in select value from jsonb_array_elements_text(step_value->'assignee_user_ids') loop
        if (allow_self or user_value::uuid <> auth.uid()) and exists (select 1 from public.profiles where id = user_value::uuid and membership_status = 'approved') then
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', user_value));
          assignee_count := assignee_count + 1;
        end if;
      end loop;
    elsif jsonb_typeof(step_value->'assignees') = 'array' then
      assignees := step_value->'assignees';
      assignee_count := jsonb_array_length(assignees);
    else
      target_type := step_value->>'target_type';
      target_id := step_value->>'target_id';

      if target_type = 'user' then
        for resolved_user in select p.id from public.profiles p where p.id = target_id::uuid and p.membership_status = 'approved' and (allow_self or p.id <> auth.uid()) loop
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
          assignee_count := assignee_count + 1;
        end loop;
      elsif target_type = 'department' then
        for resolved_user in select p.id from public.profiles p where p.department_id = target_id::uuid and p.membership_status = 'approved' and (allow_self or p.id <> auth.uid()) loop
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
          assignee_count := assignee_count + 1;
        end loop;
      elsif target_type = 'role' then
        for resolved_user in select p.id from public.profiles p where p.membership_status = 'approved' and (allow_self or p.id <> auth.uid()) and exists (select 1 from public.user_role_assignments ura where ura.user_id = p.id and ura.role_code = target_id and coalesce(ura.is_active, true)) loop
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
          assignee_count := assignee_count + 1;
        end loop;
      elsif target_type = 'management' then
        for resolved_user in select p.id from public.profiles p where p.membership_status = 'approved' and (allow_self or p.id <> auth.uid()) and exists (select 1 from public.user_role_assignments ura where ura.user_id = p.id and ura.role_code in ('admin', 'super_admin') and coalesce(ura.is_active, true)) loop
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
          assignee_count := assignee_count + 1;
        end loop;
      elsif target_type = 'drafter_department_head' then
        for resolved_user in select p.id from public.profiles p where p.id = (select head_user_id from public.departments where id = (select department_id from public.profiles where id = auth.uid())) and p.membership_status = 'approved' and (allow_self or p.id <> auth.uid()) loop
          assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
          assignee_count := assignee_count + 1;
        end loop;
      else
        raise exception 'invalid_approval_target_type' using errcode = '22023';
      end if;
    end if;

    if assignee_count = 0 then
      for resolved_user in select p.id from public.profiles p where p.id = auth.uid() and p.membership_status = 'approved' loop
        assignees := assignees || jsonb_build_array(jsonb_build_object('source', 'selected_user', 'user_id', resolved_user));
        assignee_count := assignee_count + 1;
      end loop;
    end if;

    if assignee_count = 0 then
      raise exception 'approval_line_has_no_assignee' using errcode = '22023';
    end if;

    if step_value->>'line_mode' = 'parallel_required_count' and coalesce((step_value->>'required_count')::integer, 1) > assignee_count then
      raise exception 'approval_required_count_exceeds_assignees' using errcode = '22023';
    end if;

    resolved_line_schema := resolved_line_schema || jsonb_build_array(jsonb_build_object('step_kind', coalesce(step_value->>'step_kind', 'approval'), 'line_mode', coalesce(step_value->>'line_mode', 'sequential'), 'required_count', greatest(coalesce((step_value->>'required_count')::integer, 1), 1), 'is_blocking', coalesce((step_value->>'is_blocking')::boolean, true), 'assignees', assignees));
  end loop;

  update public.approval_documents set draft_line_schema = resolved_line_schema where id = result;
  return result;
end; $$;

commit;
