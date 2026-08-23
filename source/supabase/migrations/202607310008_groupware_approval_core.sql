-- Phase G4: 전자결재 핵심 데이터 모델
-- 202607310008_groupware_approval_core.sql

-- 1. 결재 분류
CREATE TABLE IF NOT EXISTS public.approval_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 결재 양식
CREATE TABLE IF NOT EXISTS public.approval_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.approval_categories(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    document_prefix TEXT NOT NULL,
    settings JSONB DEFAULT '{}'::jsonb,
    current_version_id UUID, -- 아래에서 FK 설정
    is_active BOOLEAN DEFAULT true,
    archived_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 결재 양식 버전
CREATE TABLE IF NOT EXISTS public.approval_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.approval_templates(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    form_schema JSONB NOT NULL,
    line_schema JSONB NOT NULL,
    settings_snapshot JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
    published_by UUID REFERENCES auth.users(id),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.approval_templates 
ADD CONSTRAINT fk_current_version 
FOREIGN KEY (current_version_id) REFERENCES public.approval_template_versions(id) ON DELETE SET NULL;

-- 4. 문서 번호 시퀀스
CREATE TABLE IF NOT EXISTS public.approval_number_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.approval_templates(id) ON DELETE CASCADE,
    sequence_year INTEGER NOT NULL,
    sequence_month INTEGER, -- NULL이면 연 단위 시퀀스
    last_number INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(template_id, sequence_year, sequence_month)
);

-- 5. 결재 문서
CREATE TABLE IF NOT EXISTS public.approval_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES public.approval_templates(id),
    template_version_id UUID REFERENCES public.approval_template_versions(id),
    document_number TEXT UNIQUE,
    title TEXT NOT NULL,
    drafter_user_id UUID NOT NULL REFERENCES auth.users(id),
    drafter_department_id UUID REFERENCES public.departments(id),
    current_revision_id UUID, -- 아래에서 FK 설정
    current_step_order INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'in_progress', 'held', 'approved', 'rejected', 'recalled', 'canceled', 'archived')),
    submitted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    recalled_at TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 결재 문서 리비전 (본문 Snapshot)
CREATE TABLE IF NOT EXISTS public.approval_document_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    body_json JSONB,
    form_data JSONB,
    drafter_snapshot JSONB,
    change_reason TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.approval_documents 
ADD CONSTRAINT fk_current_revision 
FOREIGN KEY (current_revision_id) REFERENCES public.approval_document_revisions(id) ON DELETE SET NULL;

-- 7. 결재 단계 (Line Step)
CREATE TABLE IF NOT EXISTS public.approval_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES public.approval_document_revisions(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_kind TEXT NOT NULL CHECK (step_kind IN ('approval', 'agreement', 'cooperation')),
    line_mode TEXT NOT NULL CHECK (line_mode IN ('sequential', 'parallel_all', 'parallel_required_count')),
    required_count INTEGER DEFAULT 1,
    is_blocking BOOLEAN DEFAULT true,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'approved', 'rejected', 'held', 'skipped', 'canceled')),
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 결재 단계별 배정자
CREATE TABLE IF NOT EXISTS public.approval_line_assignees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES public.approval_lines(id) ON DELETE CASCADE,
    assigned_user_id UUID REFERENCES auth.users(id),
    assignment_source TEXT NOT NULL, -- 'template', 'user_selected', 'rule'
    assigned_role_code TEXT,
    assigned_department_id UUID REFERENCES public.departments(id),
    assignee_snapshot JSONB,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'pending', 'approved', 'rejected', 'held', 'delegated', 'skipped')),
    acted_at TIMESTAMPTZ,
    delegated_from_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. 결재 처리 이력 (Action)
CREATE TABLE IF NOT EXISTS public.approval_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES public.approval_document_revisions(id) ON DELETE CASCADE,
    line_id UUID REFERENCES public.approval_lines(id),
    assignee_id UUID REFERENCES public.approval_line_assignees(id),
    actor_user_id UUID NOT NULL REFERENCES auth.users(id),
    action_type TEXT NOT NULL CHECK (action_type IN ('submit', 'approve', 'reject', 'hold', 'release_hold', 'recall', 'resubmit', 'cancel', 'skip', 'delegate', 'final_approve', 'admin_override')),
    opinion TEXT,
    actor_snapshot JSONB,
    delegation_id UUID, -- 아래에서 FK 설정 가능 여부 확인 (순환 참조 주의)
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 참조 및 열람
CREATE TABLE IF NOT EXISTS public.approval_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    reference_type TEXT NOT NULL CHECK (reference_type IN ('reference', 'reader')),
    added_by UUID REFERENCES auth.users(id),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. 결재 의견 (코멘트)
CREATE TABLE IF NOT EXISTS public.approval_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES public.approval_document_revisions(id) ON DELETE CASCADE,
    author_user_id UUID NOT NULL REFERENCES auth.users(id),
    content TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. 결재 첨부파일
CREATE TABLE IF NOT EXISTS public.approval_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES public.approval_documents(id) ON DELETE CASCADE,
    revision_id UUID REFERENCES public.approval_document_revisions(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    attachment_type TEXT NOT NULL DEFAULT 'general' CHECK (attachment_type IN ('general', 'inline_image', 'supporting_document')),
    created_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

-- 13. 대결 및 위임
CREATE TABLE IF NOT EXISTS public.approval_delegations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegator_user_id UUID NOT NULL REFERENCES auth.users(id),
    delegate_user_id UUID NOT NULL REFERENCES auth.users(id),
    scope_type TEXT NOT NULL DEFAULT 'all' CHECK (scope_type IN ('all', 'template', 'department')),
    template_id UUID REFERENCES public.approval_templates(id),
    department_id UUID REFERENCES public.departments(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'expired', 'revoked')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    CONSTRAINT check_delegation_dates CHECK (starts_at < ends_at),
    CONSTRAINT check_self_delegation CHECK (delegator_user_id != delegate_user_id)
);

-- 14. 전결 규칙
CREATE TABLE IF NOT EXISTS public.approval_authority_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    template_id UUID REFERENCES public.approval_templates(id),
    department_id UUID REFERENCES public.departments(id),
    role_code TEXT,
    amount_field_key TEXT,
    minimum_amount NUMERIC,
    maximum_amount NUMERIC,
    can_final_approve BOOLEAN DEFAULT false,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. 개인 저장 결재선
CREATE TABLE IF NOT EXISTS public.approval_saved_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    line_schema JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. 인덱스 설정
CREATE INDEX idx_approval_docs_drafter ON public.approval_documents(drafter_user_id);
CREATE INDEX idx_approval_docs_status ON public.approval_documents(status);
CREATE INDEX idx_approval_lines_doc_rev ON public.approval_lines(document_id, revision_id);
CREATE INDEX idx_approval_assignees_user ON public.approval_line_assignees(assigned_user_id);
CREATE INDEX idx_approval_delegations_active ON public.approval_delegations(status, starts_at, ends_at);

-- RLS 활성화
ALTER TABLE public.approval_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_document_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_line_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_delegations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_authority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_saved_lines ENABLE ROW LEVEL SECURITY;
