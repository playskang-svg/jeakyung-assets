-- Seed standard approval templates: General Draft, Proposal, Expense Resolution, Leave Application
create or replace function public.__seed_standard_approval_templates()
returns text
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  cat_common uuid;
  cat_finance uuid;
  cat_hr uuid;

  tpl_draft uuid;
  tpl_proposal uuid;
  tpl_expense uuid;
  tpl_leave uuid;

  ver_draft uuid;
  ver_proposal uuid;
  ver_expense uuid;
  ver_leave uuid;
begin
  -- 1. Categories
  select id into cat_common from public.approval_categories where code = 'CAT_COMMON';
  if cat_common is null then
    insert into public.approval_categories (name, code, description, sort_order, is_active)
    values ('공통기안', 'CAT_COMMON', '일반 업무 기안 및 공통 품의서', 10, true)
    returning id into cat_common;
  end if;

  select id into cat_finance from public.approval_categories where code = 'CAT_FINANCE';
  if cat_finance is null then
    insert into public.approval_categories (name, code, description, sort_order, is_active)
    values ('재무/회계', 'CAT_FINANCE', '지출결의서, 예산신청, 비품구입 요청', 20, true)
    returning id into cat_finance;
  end if;

  select id into cat_hr from public.approval_categories where code = 'CAT_HR';
  if cat_hr is null then
    insert into public.approval_categories (name, code, description, sort_order, is_active)
    values ('인사/복무', 'CAT_HR', '휴가신청, 근무 변경, 교육 신청', 30, true)
    returning id into cat_hr;
  end if;

  -- 2. Templates
  -- 2-1. 일반 기안서
  select id into tpl_draft from public.approval_templates where code = 'TPL_DRAFT';
  if tpl_draft is null then
    insert into public.approval_templates (
      category_id, name, code, description, document_prefix, settings, is_active
    ) values (
      cat_common, '일반 기안서', 'TPL_DRAFT', '기본 업무 보고 및 기안 작성용 양식', 'DFT',
      '{"allow_self_approval": true, "line_editable": true}'::jsonb, true
    ) returning id into tpl_draft;

    insert into public.approval_template_versions (
      template_id, version_number, form_schema, line_schema, settings_snapshot, status, published_at
    ) values (
      tpl_draft, 1,
      jsonb_build_object('fields', jsonb_build_array(
        jsonb_build_object('field_key', 'draft_type', 'label', '기안 구분', 'type', 'select', 'required', true, 'options', jsonb_build_array('업무기안', '보고서', '협조요청', '기타')),
        jsonb_build_object('field_key', 'urgency', 'label', '긴급 여부', 'type', 'select', 'required', true, 'options', jsonb_build_array('일반', '긴급'))
      )),
      jsonb_build_array(
        jsonb_build_object('step_order', 1, 'step_kind', 'approval', 'line_mode', 'sequential', 'target_type', 'management', 'required_count', 1, 'is_blocking', true)
      ),
      '{"allow_self_approval": true, "line_editable": true}'::jsonb,
      'published', now()
    ) returning id into ver_draft;

    update public.approval_templates set current_version_id = ver_draft where id = tpl_draft;
  end if;

  -- 2-2. 품의서
  select id into tpl_proposal from public.approval_templates where code = 'TPL_PROPOSAL';
  if tpl_proposal is null then
    insert into public.approval_templates (
      category_id, name, code, description, document_prefix, settings, is_active
    ) values (
      cat_common, '품의서', 'TPL_PROPOSAL', '사업 추진, 계약 체결, 소요 예산 품의용 양식', 'PUM',
      '{"allow_self_approval": true, "line_editable": true}'::jsonb, true
    ) returning id into tpl_proposal;

    insert into public.approval_template_versions (
      template_id, version_number, form_schema, line_schema, settings_snapshot, status, published_at
    ) values (
      tpl_proposal, 1,
      jsonb_build_object('fields', jsonb_build_array(
        jsonb_build_object('field_key', 'proposal_target', 'label', '품의 목적/대상', 'type', 'text', 'required', true),
        jsonb_build_object('field_key', 'estimated_cost', 'label', '소요 예상 예산', 'type', 'text', 'required', false),
        jsonb_build_object('field_key', 'expected_effect', 'label', '기대 효과', 'type', 'textarea', 'required', false)
      )),
      jsonb_build_array(
        jsonb_build_object('step_order', 1, 'step_kind', 'approval', 'line_mode', 'sequential', 'target_type', 'management', 'required_count', 1, 'is_blocking', true)
      ),
      '{"allow_self_approval": true, "line_editable": true}'::jsonb,
      'published', now()
    ) returning id into ver_proposal;

    update public.approval_templates set current_version_id = ver_proposal where id = tpl_proposal;
  end if;

  -- 2-3. 지출결의서
  select id into tpl_expense from public.approval_templates where code = 'TPL_EXPENSE';
  if tpl_expense is null then
    insert into public.approval_templates (
      category_id, name, code, description, document_prefix, settings, is_active
    ) values (
      cat_finance, '지출결의서', 'TPL_EXPENSE', '법인카드 결제 및 계좌이체 지출 결의용 양식', 'EXP',
      '{"allow_self_approval": true, "line_editable": true}'::jsonb, true
    ) returning id into tpl_expense;

    insert into public.approval_template_versions (
      template_id, version_number, form_schema, line_schema, settings_snapshot, status, published_at
    ) values (
      tpl_expense, 1,
      jsonb_build_object('fields', jsonb_build_array(
        jsonb_build_object('field_key', 'payment_method', 'label', '결제 방식', 'type', 'select', 'required', true, 'options', jsonb_build_array('법인카드', '계좌이체', '현금')),
        jsonb_build_object('field_key', 'total_amount', 'label', '총 결제 금액(원)', 'type', 'text', 'required', true),
        jsonb_build_object('field_key', 'usage_date', 'label', '지출 일자', 'type', 'date', 'required', true),
        jsonb_build_object('field_key', 'vendor_name', 'label', '사용처/거래처명', 'type', 'text', 'required', true)
      )),
      jsonb_build_array(
        jsonb_build_object('step_order', 1, 'step_kind', 'approval', 'line_mode', 'sequential', 'target_type', 'management', 'required_count', 1, 'is_blocking', true)
      ),
      '{"allow_self_approval": true, "line_editable": true}'::jsonb,
      'published', now()
    ) returning id into ver_expense;

    update public.approval_templates set current_version_id = ver_expense where id = tpl_expense;
  end if;

  -- 2-4. 휴가신청서
  select id into tpl_leave from public.approval_templates where code = 'TPL_LEAVE';
  if tpl_leave is null then
    insert into public.approval_templates (
      category_id, name, code, description, document_prefix, settings, is_active
    ) values (
      cat_hr, '휴가신청서', 'TPL_LEAVE', '연차, 반차, 공가 등 휴가 신청용 양식', 'LVA',
      '{"allow_self_approval": true, "line_editable": true}'::jsonb, true
    ) returning id into tpl_leave;

    insert into public.approval_template_versions (
      template_id, version_number, form_schema, line_schema, settings_snapshot, status, published_at
    ) values (
      tpl_leave, 1,
      jsonb_build_object('fields', jsonb_build_array(
        jsonb_build_object('field_key', 'leave_type', 'label', '휴가 종류', 'type', 'select', 'required', true, 'options', jsonb_build_array('연차', '반차(오전)', '반차(오후)', '병가', '경조휴가', '공가')),
        jsonb_build_object('field_key', 'start_date', 'label', '휴가 시작일', 'type', 'date', 'required', true),
        jsonb_build_object('field_key', 'end_date', 'label', '휴가 종료일', 'type', 'date', 'required', true),
        jsonb_build_object('field_key', 'total_days', 'label', '사용 일수', 'type', 'text', 'required', true),
        jsonb_build_object('field_key', 'emergency_contact', 'label', '비상 연락처', 'type', 'text', 'required', false)
      )),
      jsonb_build_array(
        jsonb_build_object('step_order', 1, 'step_kind', 'approval', 'line_mode', 'sequential', 'target_type', 'management', 'required_count', 1, 'is_blocking', true)
      ),
      '{"allow_self_approval": true, "line_editable": true}'::jsonb,
      'published', now()
    ) returning id into ver_leave;

    update public.approval_templates set current_version_id = ver_leave where id = tpl_leave;
  end if;

  return 'success';
exception when others then
  return SQLERRM;
end; $$;

select public.__seed_standard_approval_templates();
drop function public.__seed_standard_approval_templates();
