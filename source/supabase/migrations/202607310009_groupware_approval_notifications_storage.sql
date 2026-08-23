-- Phase G4: 알림 시스템 및 저장소 설정
-- 202607310009_groupware_approval_notifications_storage.sql

-- 1. 그룹웨어 내부 알림 테이블
CREATE TABLE IF NOT EXISTS public.groupware_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    route TEXT, -- 클릭 시 이동할 경로
    related_entity_type TEXT, -- 'approval_document', 'notice', etc.
    related_entity_id UUID,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread ON public.groupware_notifications(user_id) WHERE read_at IS NULL;

-- 2. RLS 설정
ALTER TABLE public.groupware_notifications ENABLE ROW LEVEL SECURITY;

-- 자신의 알림만 조회 및 수정 가능
CREATE POLICY "Users can view own notifications"
    ON public.groupware_notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
    ON public.groupware_notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- 3. 스토리지 버킷 생성 (SQL에서 직접 생성이 제한될 수 있으므로 주석 처리하거나 안전하게 시도)
-- 실제로는 Supabase Dashboard 또는 별도 스크립트 권장
-- INSERT INTO storage.buckets (id, name, public) VALUES ('groupware-approval-attachments', 'groupware-approval-attachments', false) ON CONFLICT DO NOTHING;

-- 4. 스토리지 RLS (storage.objects에 대한 정책)
-- 이 부분은 보통 Dashboard에서 설정하거나 별도 마이그레이션 필요
-- 여기서는 참조용으로만 기록
/*
CREATE POLICY "Approval attachments access"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'groupware-approval-attachments' AND
  (
    EXISTS (
      SELECT 1 FROM public.approval_documents d
      LEFT JOIN public.approval_references r ON r.document_id = d.id
      LEFT JOIN public.approval_line_assignees a ON a.line_id IN (SELECT id FROM public.approval_lines WHERE document_id = d.id)
      WHERE d.id = (storage.foldername(name))[1]::uuid AND
      (d.drafter_user_id = auth.uid() OR r.user_id = auth.uid() OR a.assigned_user_id = auth.uid())
    )
  )
);
*/
