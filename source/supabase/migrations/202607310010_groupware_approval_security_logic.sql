-- Phase G4: 전자결재 보안 및 핵심 로직 (RPC & RLS Details)
-- 202607310010_groupware_approval_security_logic.sql

-- 1. 기본 RLS 정책 (Templates & Categories)
CREATE POLICY "Anyone can view active categories"
    ON public.approval_categories FOR SELECT
    USING (is_active = true OR EXISTS (SELECT 1 FROM public.user_role_assignments WHERE user_id = auth.uid() AND role_code IN ('admin', 'super_admin')));

CREATE POLICY "Anyone can view active templates"
    ON public.approval_templates FOR SELECT
    USING (is_active = true OR EXISTS (SELECT 1 FROM public.user_role_assignments WHERE user_id = auth.uid() AND role_code IN ('admin', 'super_admin')));

-- 2. 문서 접근 제어 (중요)
CREATE POLICY "Users can view documents they are involved in"
    ON public.approval_documents FOR SELECT
    USING (
        drafter_user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.approval_line_assignees a
            JOIN public.approval_lines l ON a.line_id = l.id
            WHERE l.document_id = public.approval_documents.id AND (a.assigned_user_id = auth.uid() OR a.delegated_from_user_id = auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.approval_references r
            WHERE r.document_id = public.approval_documents.id AND r.user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM public.user_role_assignments
            WHERE user_id = auth.uid() AND role_code IN ('admin', 'super_admin')
        )
    );

-- 3. 문서 번호 생성 함수 (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.generate_approval_document_number(p_template_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefix TEXT;
    v_year INTEGER;
    v_month INTEGER;
    v_last_num INTEGER;
    v_new_num INTEGER;
    v_doc_num TEXT;
BEGIN
    SELECT document_prefix INTO v_prefix FROM approval_templates WHERE id = p_template_id;
    v_year := EXTRACT(YEAR FROM now())::INTEGER;
    v_month := EXTRACT(MONTH FROM now())::INTEGER;

    -- 단순화를 위해 연도별 시퀀스만 사용
    INSERT INTO approval_number_sequences (template_id, sequence_year, sequence_month, last_number)
    VALUES (p_template_id, v_year, NULL, 1)
    ON CONFLICT (template_id, sequence_year, sequence_month) 
    DO UPDATE SET last_number = approval_number_sequences.last_number + 1, updated_at = now()
    RETURNING last_number INTO v_new_num;

    v_doc_num := v_prefix || '-' || TO_CHAR(v_year, 'FM9999') || '-' || LPAD(v_new_num::TEXT, 6, '0');
    
    RETURN v_doc_num;
END;
$$;

-- 4. 문서 제출 RPC
CREATE OR REPLACE FUNCTION public.submit_approval_document(p_document_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_drafter_id UUID;
    v_status TEXT;
    v_first_line_id UUID;
BEGIN
    SELECT drafter_user_id, status INTO v_drafter_id, v_status FROM approval_documents WHERE id = p_document_id;
    
    IF v_drafter_id != auth.uid() THEN
        RAISE EXCEPTION 'Only drafter can submit the document';
    END IF;
    
    IF v_status != 'draft' AND v_status != 'recalled' AND v_status != 'rejected' THEN
        RAISE EXCEPTION 'Document is not in a submittable state';
    END IF;

    -- 문서 번호 생성 (아직 없는 경우)
    UPDATE approval_documents 
    SET document_number = COALESCE(document_number, generate_approval_document_number(template_id)),
        status = 'in_progress',
        submitted_at = now(),
        updated_at = now()
    WHERE id = p_document_id;

    -- 첫 번째 단계 활성화
    SELECT id INTO v_first_line_id FROM approval_lines 
    WHERE document_id = p_document_id AND step_order = 1;

    IF v_first_line_id IS NOT NULL THEN
        UPDATE approval_lines SET status = 'active', activated_at = now() WHERE id = v_first_line_id;
        UPDATE approval_line_assignees SET status = 'pending' WHERE line_id = v_first_line_id;
    END IF;

    -- 감사 로그 등 추가 가능
END;
$$;
