begin;

-- Phase G4-1: 전자결재 조회 권한 및 서버 결재함
-- 기존 마이그레이션은 수정하지 않고 정책을 보강한다.

drop policy if exists "Anyone can view active categories"
on public.approval_categories;

create policy "Approved members can view approval categories"
on public.approval_categories
for select
to authenticated
using (
  public.is_approved_member()
  and (
    (is_active and archived_at is null)
    or public.is_membership_admin()
  )
);

drop policy if exists "Anyone can view active templates"
on public.approval_templates;

create policy "Approved members can view approval templates"
on public.approval_templates
for select
to authenticated
using (
  public.is_approved_member()
  and (
    (is_active and archived_at is null)
    or public.is_membership_admin()
  )
);

create policy "Approved members can view published template versions"
on public.approval_template_versions
for select
to authenticated
using (
  public.is_approved_member()
  and (
    status = 'published'
    or public.is_membership_admin()
  )
);

-- 결재함 RPC와 문서 RLS가 동일한 위임 범위 규칙을 사용한다.
create or replace function public.has_active_approval_delegation(
  p_assigned_user_id uuid,
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
set row_security = off
as $$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.approval_documents d
      join public.approval_delegations dg
        on dg.delegator_user_id = p_assigned_user_id
       and dg.delegate_user_id = auth.uid()
      where d.id = p_document_id
        and dg.status in ('scheduled', 'active')
        and now() between dg.starts_at and dg.ends_at
        and (
          dg.scope_type = 'all'
          or (
            dg.scope_type = 'template'
            and dg.template_id = d.template_id
          )
          or (
            dg.scope_type = 'department'
            and dg.department_id = d.drafter_department_id
          )
        )
    );
$$;

revoke all
on function public.has_active_approval_delegation(uuid, uuid)
from public;

grant execute
on function public.has_active_approval_delegation(uuid, uuid)
to authenticated;

create or replace function public.can_view_approval_document(
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
set row_security = off
as $$
  select
    public.is_approved_member()
    and exists (
      select 1
      from public.approval_documents d
      where d.id = p_document_id
        and (
          d.drafter_user_id = auth.uid()

          or exists (
            select 1
            from public.approval_lines l
            join public.approval_line_assignees a
              on a.line_id = l.id
            where l.document_id = d.id
              and (
                a.assigned_user_id = auth.uid()
                or a.delegated_from_user_id = auth.uid()
                or public.has_active_approval_delegation(
                  a.assigned_user_id,
                  d.id
                )
              )
          )

          or exists (
            select 1
            from public.approval_references r
            where r.document_id = d.id
              and r.user_id = auth.uid()
          )

          or public.is_membership_admin()
        )
    );
$$;

revoke all
on function public.can_view_approval_document(uuid)
from public;

grant execute
on function public.can_view_approval_document(uuid)
to authenticated;

drop policy if exists "Users can view documents they are involved in"
on public.approval_documents;

create policy "Participants can view approval documents"
on public.approval_documents
for select
to authenticated
using (
  public.can_view_approval_document(id)
);

create policy "Approved users can create own approval drafts"
on public.approval_documents
for insert
to authenticated
with check (
  public.is_approved_member()
  and drafter_user_id = auth.uid()
  and status = 'draft'
);

create policy "Drafters can update editable approval documents"
on public.approval_documents
for update
to authenticated
using (
  drafter_user_id = auth.uid()
  and status in ('draft', 'recalled', 'rejected')
)
with check (
  drafter_user_id = auth.uid()
  and status in ('draft', 'recalled', 'rejected')
);

create policy "Participants can view approval revisions"
on public.approval_document_revisions
for select
to authenticated
using (
  public.can_view_approval_document(document_id)
);

create policy "Drafters can create approval revisions"
on public.approval_document_revisions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.approval_documents d
    where d.id = document_id
      and d.drafter_user_id = auth.uid()
      and d.status in ('draft', 'recalled', 'rejected')
  )
);

create policy "Participants can view approval lines"
on public.approval_lines
for select
to authenticated
using (
  public.can_view_approval_document(document_id)
);

create policy "Participants can view approval line assignees"
on public.approval_line_assignees
for select
to authenticated
using (
  exists (
    select 1
    from public.approval_lines l
    where l.id = line_id
      and public.can_view_approval_document(l.document_id)
  )
);

create policy "Participants can view approval actions"
on public.approval_actions
for select
to authenticated
using (
  public.can_view_approval_document(document_id)
);

create policy "Participants can view approval references"
on public.approval_references
for select
to authenticated
using (
  public.can_view_approval_document(document_id)
);

create policy "Participants can view approval comments"
on public.approval_comments
for select
to authenticated
using (
  deleted_at is null
  and public.can_view_approval_document(document_id)
);

create policy "Participants can view approval attachments"
on public.approval_attachments
for select
to authenticated
using (
  deleted_at is null
  and public.can_view_approval_document(document_id)
);

create or replace function public.get_my_approval_inbox()
returns table (
  document_id uuid,
  document_number text,
  title text,
  document_status text,
  template_name text,
  drafter_user_id uuid,
  drafter_name text,
  submitted_at timestamptz,
  active_line_id uuid,
  step_order integer,
  step_kind text,
  line_mode text,
  assignee_id uuid,
  assignee_status text,
  is_delegated boolean
)
language sql
stable
security definer
set search_path = pg_catalog
set row_security = off
as $$
  select
    d.id,
    d.document_number,
    d.title,
    d.status,
    t.name,
    d.drafter_user_id,
    coalesce(
      nullif(p.preferred_name, ''),
      nullif(p.full_name, ''),
      p.name,
      '알 수 없음'
    ),
    d.submitted_at,
    l.id,
    l.step_order,
    l.step_kind,
    l.line_mode,
    a.id,
    a.status,
    a.assigned_user_id <> auth.uid()
  from public.approval_line_assignees a
  join public.approval_lines l
    on l.id = a.line_id
  join public.approval_documents d
    on d.id = l.document_id
  join public.approval_templates t
    on t.id = d.template_id
  left join public.profiles p
    on p.id = d.drafter_user_id
  where public.is_approved_member()
    and d.status in ('in_progress', 'held')
    and l.status in ('active', 'held')
    and a.status in ('pending', 'held')
    and (
      a.assigned_user_id = auth.uid()

      or public.has_active_approval_delegation(
        a.assigned_user_id,
        d.id
      )
    )
  order by
    d.submitted_at asc nulls last,
    l.step_order asc;
$$;

revoke all
on function public.get_my_approval_inbox()
from public;

grant execute
on function public.get_my_approval_inbox()
to authenticated;

commit;
