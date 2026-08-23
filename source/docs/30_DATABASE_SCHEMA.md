# 데이터베이스 논리 스키마

## 범위

Supabase PostgreSQL에 적용할 논리 모델이다. G2 스키마는 `supabase/migrations/202607300001_groupware_auth_membership.sql`에서 재현한다.

## 인증·조직

| 테이블 | 주요 책임 |
| --- | --- |
| `profiles` | `auth.users`와 1:1 연결된 프로필, 신청·최종 조직과 회원 상태 |
| `departments` | 상위 부서, 명칭, 정렬, 상태와 보관 정보 |
| `positions` | 직급 코드, 명칭, 정렬과 활성 상태 |
| `job_titles` | 직책 코드, 명칭, 정렬과 활성 상태 |
| `roles` | 다섯 개 고정 역할 정의 |
| `user_role_assignments` | 사용자 다중 역할과 부여자·시각 |
| `audit_logs` | 승인·거절·조직 변경의 이전/이후 값과 작업자 |

가입 신청은 별도 권한 테이블로 사용하지 않고 `profiles.requested_*`에 보존한다. 승인 시 `department_id`, `position_id`, `job_title_id`와 역할을 관리자 RPC가 확정한다.

## G3 대시보드·게시판

| 영역 | 실제 테이블 |
| --- | --- |
| 대시보드 | `dashboard_widgets`, `dashboard_widget_assignments`, `user_dashboard_preferences` |
| 게시판 정의 | `board_groups`, `boards`, `board_categories`, `board_permission_rules`, `board_managers` |
| 사용자 탐색 | `board_favorites`, `board_recent_visits` |
| 게시판 콘텐츠 | `board_posts`, `board_comments`, `board_reactions`, `board_post_views`, `board_attachments` |
| 팝업 문서 | `popup_documents` |

- G3 스키마는 `202607310001_groupware_dashboards_boards.sql`, 작성자 대상 권한 보완 `202607310002_fix_board_author_permissions.sql`, 본문 이미지 확장 `202607310003_board_inline_images.sql`로 재현한다.
- 위젯 배포와 게시판 권한 대상은 역할·부서·직급·직책·사용자 관계를 기존 G2 테이블에서 판정한다.
- 게시글 조회수는 사용자·날짜 조합으로 중복 증가를 제한하고, 삭제는 게시글·댓글·첨부 메타데이터의 소프트 삭제를 우선한다.
- `board_posts.content_document`는 서버 허용 목록을 통과한 Tiptap JSON을 보존하고 `content`는 검색용 평문을 유지한다. `cover_attachment_id`는 갤러리 대표 이미지를 가리킨다.
- `board_attachments.purpose`는 본문 이미지와 일반 첨부를 구분한다. 이미지 크기·형식·대체 텍스트·캡션·정렬·표시 크기·본문 순서와 `pending`·`active`·`cleanup_candidate`·`deleted` 수명주기를 기록한다.
- `get_admin_system_usage()`는 관리자 전용 집계 RPC로 회원·콘텐츠·첨부 생명주기·Storage 객체와 게시판별 사용량을 반환한다. 원본 행과 개인 식별정보는 반환하지 않는다.
- 팝업 문서는 노출 위치 배열, 게시 시작·종료 시각, 작성 방식과 정화된 HTML을 보관한다. 공개 조회는 활성 기간과 위치를 서버에서 제한한 RPC만 사용한다.

## G4 전자결재

| 영역 | 실제 테이블 |
| --- | --- |
| 양식 | `approval_categories`, `approval_templates`, `approval_template_versions`, `approval_number_sequences` |
| 문서 | `approval_documents`, `approval_document_revisions`, `approval_attachments`, `approval_comments` |
| 결재 흐름 | `approval_lines`, `approval_line_assignees`, `approval_actions` |
| 확장 | `approval_references`, `approval_delegations`, `approval_authority_rules`, `approval_saved_lines`, `groupware_notifications` |
| 개인 결재 표시 | `approval_credentials`, `approval_actions.credential_snapshot` |

- 문서는 발행된 양식 버전과 기안 시점의 기안자·결재자 조직 정보를 Snapshot으로 보존한다.
- 임시 저장과 결재선 생성은 서버 함수의 한 트랜잭션에서 처리하며 제출 시 문서번호와 첫 단계를 활성화한다.
- 문서와 하위 엔터티는 기안자·결재자·유효한 위임자·참조자·관리자 범위에 따라 RLS와 서버 함수에서 함께 제한한다.
- 도장·서명 원본은 사용자 소유 비공개 Storage에 저장하고 승인 시 사용한 종류·이름·경로·시각을 처리 이력에 Snapshot으로 고정한다.
- 첨부파일은 문서·업로더 경로의 비공개 Storage 객체와 `approval_attachments` 메타데이터를 함께 보존하며 문서 참여 권한으로 다운로드를 제한한다.
- 참조자는 문서별 사용자·참조 유형을 중복 없이 기록하고 `read_at`으로 참조함 읽음 상태를 관리한다.

## 이후 업무 모듈

| 모듈 | 주요 테이블 후보 |
| --- | --- |
| 일정 | `calendars`, `events`, `event_attendees` |
| 파일 | `file_spaces`, `file_entries`, `file_permissions` |
| 알림 | `notifications`, `notification_preferences` |
| 감사 | `audit_logs` |

## 공통 필드 원칙

- 식별자는 UUID를 기본으로 한다.
- `created_at`, `updated_at`, 작성·수정 주체를 기록한다.
- 상태, 비활성·보관 시각과 사유를 별도 필드로 둔다.
- 업무 이력이 있는 조직·계정·게시판은 물리 삭제보다 보관을 우선한다.
- 공개 이름과 내부 추적 식별자를 분리한다.
- 시간은 UTC로 저장하고 UI에서 Asia/Seoul로 표시한다.

## 관계와 무결성

- 부서는 자기 자신이나 하위 부서를 상위로 지정할 수 없다.
- 구성원 이동은 과거 소속 기간을 보존한다.
- 게시글·결재·일정·파일이 참조하는 사용자를 임의 삭제하지 않는다.
- 첨부 메타데이터와 Storage 객체 권한을 같은 정책으로 관리한다.
- 감사 로그는 일반 관리자도 임의 수정·삭제할 수 없게 한다.

RLS와 서버 함수 기준은 [`31_SECURITY_AND_RLS.md`](31_SECURITY_AND_RLS.md)를 따른다.

## G3 보완 스키마

- `202607310006_multi_roles_and_employee_profiles.sql`은 기존 `user_role_assignments`를 유지하면서 `is_active`, `revoked_at`, `updated_at`을 추가한다. 역할 변경 이력은 소프트 해제 상태와 `audit_logs`로 보존한다.
- `user_active_roles`는 사용자별 서버 검증 활성 역할 하나를 저장한다. `profiles.preferred_start_role`은 현재 역할이 해제될 때 사용할 안전한 대체 역할이다.
- `profiles`는 공식 이름, 표시 이름, 사번, 입사일, 회사·개인 업무 연락처, 재직 상태, 근무지, 소개, 프로필 사진 경로와 가입 신청용 확장 필드를 보유한다. 기존 `name`, `email`, `phone`은 호환 필드로 유지한다.
- `profile_photo_files`는 비공개 Storage 객체의 소유자, MIME, 크기와 `active`·`cleanup_candidate` 수명주기를 기록한다. 이전 사진은 즉시 삭제하지 않는다.
