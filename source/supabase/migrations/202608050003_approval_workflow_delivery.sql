begin;

-- Keep fresh database resets compatible with the schema that was present when
-- this delivery first reached the linked project.
alter table public.approval_documents
  add column if not exists draft_line_schema jsonb not null default '[]'::jsonb;

alter table public.approval_line_assignees
  add column if not exists assignee_order integer not null default 1;

create or replace function public.get_approval_authoring_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.approval_categories c where c.is_active and c.archived_at is null),'[]'::jsonb),
    'templates',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('category_name',c.name,'version',to_jsonb(v)) order by c.sort_order,t.name) from public.approval_templates t join public.approval_categories c on c.id=t.category_id join public.approval_template_versions v on v.id=t.current_version_id where t.is_active and t.archived_at is null and v.status='published'),'[]'::jsonb),
    'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name),'department_name',d.name,'position_name',po.name) order by d.sort_order,p.name) from public.profiles p left join public.departments d on d.id=p.department_id left join public.positions po on po.id=p.position_id where p.membership_status='approved'),'[]'::jsonb)
  );
end; $$;

create or replace function public.get_approval_admin_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.name) from public.approval_categories c),'[]'::jsonb),
    'templates',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('category_name',c.name,'version',to_jsonb(v)) order by c.sort_order,t.name) from public.approval_templates t left join public.approval_categories c on c.id=t.category_id left join public.approval_template_versions v on v.id=t.current_version_id),'[]'::jsonb),
    'users',(public.get_approval_authoring_catalog()->'users')
  );
end; $$;

create or replace function public.manage_approval_category(p_category jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare result uuid; category_name text:=btrim(coalesce(p_category->>'name','')); category_code text:=lower(btrim(coalesce(p_category->>'code','')));
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  if char_length(category_name) not between 1 and 120 or category_code !~ '^[a-z0-9][a-z0-9_-]{1,59}$' then raise exception 'invalid_approval_category' using errcode='22023'; end if;
  if nullif(p_category->>'id','') is null then
    insert into public.approval_categories(name,code,description,sort_order,is_active,created_by) values(category_name,category_code,left(nullif(btrim(p_category->>'description'),''),500),coalesce((p_category->>'sort_order')::integer,100),coalesce((p_category->>'is_active')::boolean,true),auth.uid()) returning id into result;
  else
    result:=(p_category->>'id')::uuid;
    update public.approval_categories set name=category_name,code=category_code,description=left(nullif(btrim(p_category->>'description'),''),500),sort_order=coalesce((p_category->>'sort_order')::integer,100),is_active=coalesce((p_category->>'is_active')::boolean,true),archived_at=case when coalesce((p_category->>'archived')::boolean,false) then coalesce(archived_at,now()) else null end,updated_at=now() where id=result;
    if not found then raise exception 'approval_category_not_found' using errcode='P0002'; end if;
  end if;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.category.saved','approval_category',result::text,jsonb_build_object('code',category_code));
  return result;
end; $$;

create or replace function public.manage_approval_template(p_template jsonb,p_form_schema jsonb,p_line_schema jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare result uuid; version_id uuid; next_version integer; template_name text:=btrim(coalesce(p_template->>'name','')); template_code text:=upper(btrim(coalesce(p_template->>'code',''))); prefix_value text:=upper(btrim(coalesce(p_template->>'document_prefix',''))); step_value jsonb; normalized_fields jsonb;
begin
  if not public.is_membership_admin() then raise exception 'membership_admin_required' using errcode='42501'; end if;
  if char_length(template_name) not between 1 and 120 or template_code !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' or prefix_value !~ '^[A-Z0-9-]{1,20}$' then raise exception 'invalid_approval_template' using errcode='22023'; end if;
  if jsonb_typeof(coalesce(p_form_schema,'[]'::jsonb))<>'array' or jsonb_typeof(coalesce(p_line_schema,'[]'::jsonb))<>'array' or jsonb_array_length(p_line_schema)=0 then raise exception 'invalid_approval_template_schema' using errcode='22023'; end if;
  for step_value in select value from jsonb_array_elements(p_line_schema) loop
    if coalesce(step_value->>'step_kind','') not in ('approval','agreement','cooperation') or coalesce(step_value->>'line_mode','') not in ('sequential','parallel_all','parallel_required_count') then raise exception 'invalid_approval_line_schema' using errcode='22023'; end if;
  end loop;
  select coalesce(jsonb_agg((value-'key')||jsonb_build_object('field_key',value->>'key')),'[]'::jsonb) into normalized_fields from jsonb_array_elements(p_form_schema);
  if nullif(p_template->>'id','') is null then
    insert into public.approval_templates(category_id,name,code,description,document_prefix,settings,is_active,created_by) values((p_template->>'category_id')::uuid,template_name,template_code,left(nullif(btrim(p_template->>'description'),''),500),prefix_value,coalesce(p_template->'settings','{}'::jsonb)||'{"line_editable":true}'::jsonb,coalesce((p_template->>'is_active')::boolean,true),auth.uid()) returning id into result;
  else
    result:=(p_template->>'id')::uuid;
    update public.approval_templates set category_id=(p_template->>'category_id')::uuid,name=template_name,code=template_code,description=left(nullif(btrim(p_template->>'description'),''),500),document_prefix=prefix_value,settings=coalesce(p_template->'settings','{}'::jsonb)||'{"line_editable":true}'::jsonb,is_active=coalesce((p_template->>'is_active')::boolean,true),archived_at=case when coalesce((p_template->>'archived')::boolean,false) then coalesce(archived_at,now()) else null end,updated_at=now() where id=result;
    if not found then raise exception 'approval_template_not_found' using errcode='P0002'; end if;
  end if;
  select coalesce(max(version_number),0)+1 into next_version from public.approval_template_versions where template_id=result;
  update public.approval_template_versions set status='retired' where template_id=result and status='published';
  insert into public.approval_template_versions(template_id,version_number,form_schema,line_schema,settings_snapshot,status,published_by,published_at) values(result,next_version,jsonb_build_object('fields',normalized_fields),p_line_schema,coalesce(p_template->'settings','{}'::jsonb)||'{"line_editable":true}'::jsonb,'published',auth.uid(),now()) returning id into version_id;
  update public.approval_templates set current_version_id=version_id where id=result;
  insert into public.audit_logs(actor_user_id,action,target_type,target_id,metadata) values(auth.uid(),'approval.template.published','approval_template',result::text,jsonb_build_object('version',next_version));
  return result;
end; $$;

create or replace function public.save_approval_draft(p_document_id uuid,p_template_id uuid,p_title text,p_body_json jsonb,p_form_data jsonb,p_line_schema_override jsonb default null)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare d public.approval_documents; version_row public.approval_template_versions; result uuid; revision_id uuid; revision_number integer; step_value jsonb; user_value text; target_type text; target_id text; assignee_count integer; allow_self boolean; effective_line_schema jsonb; assignees jsonb; resolved_line_schema jsonb:='[]'::jsonb; resolved_user uuid;
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 240 then raise exception 'invalid_approval_title' using errcode='22023'; end if;
  if p_document_id is null then
    select v.* into version_row from public.approval_templates t join public.approval_template_versions v on v.id=t.current_version_id where t.id=p_template_id and t.is_active and t.archived_at is null and v.status='published';
    if not found then raise exception 'approval_template_unavailable' using errcode='22023'; end if;
    insert into public.approval_documents(template_id,template_version_id,title,drafter_user_id,drafter_department_id,status) select p_template_id,version_row.id,btrim(p_title),auth.uid(),p.department_id,'draft' from public.profiles p where p.id=auth.uid() returning id into result;
  else
    select * into d from public.approval_documents where id=p_document_id for update;
    if not found or d.drafter_user_id<>auth.uid() or d.status not in ('draft','recalled','rejected') then raise exception 'approval_draft_update_denied' using errcode='42501'; end if;
    result:=d.id;
    select * into version_row from public.approval_template_versions where id=d.template_version_id;
  end if;
  allow_self:=coalesce((version_row.settings_snapshot->>'allow_self_approval')::boolean,false);
  effective_line_schema:=case when p_line_schema_override is not null then p_line_schema_override else version_row.line_schema end;
  if jsonb_typeof(effective_line_schema)<>'array' or jsonb_array_length(effective_line_schema)=0 then raise exception 'approval_line_required' using errcode='22023'; end if;
  select coalesce(max(r.revision_number),0)+1 into revision_number from public.approval_document_revisions r where r.document_id=result;
  insert into public.approval_document_revisions(document_id,revision_number,title,body_json,form_data,drafter_snapshot,change_reason,created_by) select result,revision_number,btrim(p_title),coalesce(p_body_json,'{}'::jsonb),coalesce(p_form_data,'{}'::jsonb),jsonb_build_object('user_id',p.id,'name',coalesce(nullif(p.preferred_name,''),nullif(p.full_name,''),p.name),'department_id',p.department_id,'department_name',dep.name,'position_name',po.name,'job_title_name',jt.name),case when revision_number>1 then 'draft_updated' else 'draft_created' end,auth.uid() from public.profiles p left join public.departments dep on dep.id=p.department_id left join public.positions po on po.id=p.position_id left join public.job_titles jt on jt.id=p.job_title_id where p.id=auth.uid() returning id into revision_id;
  update public.approval_documents set title=btrim(p_title),current_revision_id=revision_id,status='draft',updated_at=now() where id=result;
  for step_value in select value from jsonb_array_elements(effective_line_schema) order by coalesce((value->>'step_order')::integer,1) loop
    assignees:='[]'::jsonb; assignee_count:=0;
    if jsonb_typeof(step_value->'assignee_user_ids')='array' then
      for user_value in select value from jsonb_array_elements_text(step_value->'assignee_user_ids') loop
        if (allow_self or user_value::uuid<>auth.uid()) and exists(select 1 from public.profiles where id=user_value::uuid and membership_status='approved') then assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',user_value)); assignee_count:=assignee_count+1; end if;
      end loop;
    elsif jsonb_typeof(step_value->'assignees')='array' then
      assignees:=step_value->'assignees'; assignee_count:=jsonb_array_length(assignees);
    else
      target_type:=step_value->>'target_type'; target_id:=step_value->>'target_id';
      if target_type='user' then
        for resolved_user in select p.id from public.profiles p where p.id=target_id::uuid and p.membership_status='approved' and (allow_self or p.id<>auth.uid()) loop assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',resolved_user)); assignee_count:=assignee_count+1; end loop;
      elsif target_type='department' then
        for resolved_user in select p.id from public.profiles p where p.department_id=target_id::uuid and p.membership_status='approved' and (allow_self or p.id<>auth.uid()) loop assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',resolved_user)); assignee_count:=assignee_count+1; end loop;
      elsif target_type='role' then
        for resolved_user in select p.id from public.profiles p where p.membership_status='approved' and (allow_self or p.id<>auth.uid()) and exists(select 1 from public.user_role_assignments ura where ura.user_id=p.id and ura.role_code=target_id and coalesce(ura.is_active,true)) loop assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',resolved_user)); assignee_count:=assignee_count+1; end loop;
      elsif target_type='management' then
        for resolved_user in select p.id from public.profiles p where p.membership_status='approved' and (allow_self or p.id<>auth.uid()) and exists(select 1 from public.user_role_assignments ura where ura.user_id=p.id and ura.role_code in ('admin','super_admin') and coalesce(ura.is_active,true)) loop assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',resolved_user)); assignee_count:=assignee_count+1; end loop;
      elsif target_type='drafter_department_head' then
        for resolved_user in select p.id from public.profiles p where p.id=(select head_user_id from public.departments where id=(select department_id from public.profiles where id=auth.uid())) and p.membership_status='approved' and (allow_self or p.id<>auth.uid()) loop assignees:=assignees||jsonb_build_array(jsonb_build_object('source','selected_user','user_id',resolved_user)); assignee_count:=assignee_count+1; end loop;
      else
        raise exception 'invalid_approval_target_type' using errcode='22023';
      end if;
    end if;
    if assignee_count=0 then raise exception 'approval_line_has_no_assignee' using errcode='22023'; end if;
    if step_value->>'line_mode'='parallel_required_count' and coalesce((step_value->>'required_count')::integer,1)>assignee_count then raise exception 'approval_required_count_exceeds_assignees' using errcode='22023'; end if;
    resolved_line_schema:=resolved_line_schema||jsonb_build_array(jsonb_build_object('step_kind',coalesce(step_value->>'step_kind','approval'),'line_mode',coalesce(step_value->>'line_mode','sequential'),'required_count',greatest(coalesce((step_value->>'required_count')::integer,1),1),'is_blocking',coalesce((step_value->>'is_blocking')::boolean,true),'assignees',assignees));
  end loop;
  update public.approval_documents set draft_line_schema=resolved_line_schema where id=result;
  return result;
end; $$;

create or replace function public.generate_approval_document_number(p_template_id uuid)
returns text
language plpgsql
security definer
set search_path=pg_catalog
as $$
declare prefix_value text; year_value integer:=extract(year from now())::integer; number_value integer;
begin
  select nullif(btrim(document_prefix),'') into prefix_value from public.approval_templates where id=p_template_id;
  if prefix_value is null then raise exception 'approval_template_prefix_required' using errcode='22023'; end if;
  insert into public.approval_number_sequences(template_id,sequence_year,sequence_month,last_number)
  values(p_template_id,year_value,0,1)
  on conflict(template_id,sequence_year,sequence_month)
  do update set last_number=public.approval_number_sequences.last_number+1,updated_at=now()
  returning last_number into number_value;
  return prefix_value||'-'||year_value::text||'-'||lpad(number_value::text,6,'0');
end; $$;

create or replace function public.get_available_approval_actions(p_document_id uuid)
returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select case when public.can_view_approval_document(p_document_id) then jsonb_build_object(
    'can_edit',d.drafter_user_id=auth.uid() and d.status in ('draft','rejected','recalled'),
    'can_submit',d.drafter_user_id=auth.uid() and d.status='draft',
    'can_recall',d.drafter_user_id=auth.uid() and d.status in ('submitted','in_progress') and coalesce(t.settings->>'recall_policy','before_first_action')<>'disabled' and not exists(select 1 from public.approval_actions where document_id=d.id and action_type in ('approve','reject','hold','release_hold','delegate')),
    'can_archive',(d.drafter_user_id=auth.uid() or public.is_membership_admin()) and d.status in ('approved','rejected','recalled','canceled'),
    'can_admin_cancel',public.get_user_active_role(auth.uid())='super_admin' and d.status not in ('approved','canceled','archived'),
    'assignments',coalesce((select jsonb_agg(jsonb_build_object(
      'assignee_id',a.id,'line_id',l.id,'step_order',l.step_order,'step_kind',l.step_kind,'line_mode',l.line_mode,
      'assignment_status',a.status,'is_delegated',a.assigned_user_id<>auth.uid(),'original_user_id',a.assigned_user_id,
      'can_approve',d.status='in_progress' and a.status='pending','can_reject',d.status='in_progress' and a.status='pending','can_hold',d.status='in_progress' and a.status='pending','can_release_hold',d.status='held' and a.status='held'
    ) order by l.step_order,a.created_at,a.id)
    from public.approval_lines l join public.approval_line_assignees a on a.line_id=l.id
    where l.document_id=d.id and l.revision_id=d.current_revision_id and l.status in ('active','held')
      and (a.assigned_user_id=auth.uid() or public.has_active_approval_delegation(a.assigned_user_id,d.id))
      and a.status in ('pending','held')),'[]'::jsonb)
  ) else '{}'::jsonb end
  from public.approval_documents d join public.approval_templates t on t.id=d.template_id where d.id=p_document_id;
$$;

create or replace function public.get_approval_home_summary()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if not public.is_approved_member() then raise exception 'approved_member_required' using errcode='42501'; end if;
  return jsonb_build_object(
    'inbox',(select count(*) from public.get_my_approval_inbox()),
    'drafts',(select count(*) from public.approval_documents where drafter_user_id=auth.uid() and status='draft'),
    'outbox',(select count(*) from public.approval_documents where drafter_user_id=auth.uid() and status in ('submitted','in_progress','held','rejected','recalled')),
    'completed',(select count(*) from public.approval_documents where status='approved' and public.can_view_approval_document(id)),
    'recent',coalesce((select jsonb_agg(to_jsonb(x)) from (select d.id,d.document_number,d.title,d.status,d.updated_at from public.approval_documents d where public.can_view_approval_document(d.id) order by d.updated_at desc limit 5) x),'[]'::jsonb)
  );
end; $$;

insert into public.approval_categories(name,code,description,sort_order,is_active)
select '일반 결재','general','일반 품의와 업무 요청',10,true where not exists(select 1 from public.approval_categories where code='general');

do $$ declare category_value uuid; template_value uuid; version_value uuid;
begin
  select id into category_value from public.approval_categories where code='general';
  select id into template_value from public.approval_templates where code='GENERAL-REQUEST';
  if template_value is null then
    insert into public.approval_templates(category_id,name,code,description,document_prefix,settings,is_active) values(category_value,'일반 품의서','GENERAL-REQUEST','목적·금액·희망일을 작성하는 기본 결재 양식','JR','{"recall_policy":"before_first_action","allow_self_approval":false,"line_editable":true}'::jsonb,true) returning id into template_value;
    insert into public.approval_template_versions(template_id,version_number,form_schema,line_schema,settings_snapshot,status,published_at) values(template_value,1,'{"fields":[{"field_key":"purpose","label":"품의 목적","type":"textarea","required":true},{"field_key":"amount","label":"예상 금액","type":"number","required":false},{"field_key":"needed_date","label":"희망 처리일","type":"date","required":false}]}'::jsonb,'[{"step_order":1,"step_kind":"approval","line_mode":"parallel_required_count","required_count":1,"is_blocking":true,"target_type":"management","target_id":"management"}]'::jsonb,'{"recall_policy":"before_first_action","allow_self_approval":false,"line_editable":true}'::jsonb,'published',now()) returning id into version_value;
    update public.approval_templates set current_version_id=version_value where id=template_value;
  end if;
end $$;

revoke all on function public.get_approval_authoring_catalog(),public.get_approval_admin_catalog(),public.manage_approval_category(jsonb),public.manage_approval_template(jsonb,jsonb,jsonb),public.save_approval_draft(uuid,uuid,text,jsonb,jsonb,jsonb),public.get_approval_home_summary() from public,anon;
revoke all on function public.generate_approval_document_number(uuid) from public,anon,authenticated;
grant execute on function public.get_approval_authoring_catalog(),public.get_approval_admin_catalog(),public.save_approval_draft(uuid,uuid,text,jsonb,jsonb,jsonb),public.get_approval_home_summary() to authenticated;
grant execute on function public.manage_approval_category(jsonb),public.manage_approval_template(jsonb,jsonb,jsonb) to authenticated;

commit;
