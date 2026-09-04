---
name: jeakyung_site_approval
description: 재경로지스｜물류 그룹웨어 전자결재("재경사이트 전자결재", /groupware/approval/*) 작업 전용 참고 스킬 — 기안(양식/결재선), 승인·반려·보류, 도장/서명, 대결/위임, 알림, 첨부파일, 관리자 양식 관리, 문서 상태 흐름. 게시판은 jeakyung_site_board, 그 외 그룹웨어 화면은 jeakyung_site_groupware 스킬을 쓸 것.
---

# 재경사이트 — 전자결재(Approval)

부모 스킬 `jeakyung_site`(전역 규칙)와 `jeakyung_site_groupware`(인증/권한 게이팅 관용구)를 먼저 참고. **전자결재는 이 저장소 자체 기준으로 기능 완성·운영 중인 것으로 취급한다**(§운영 상태 참고 — 상위 기획 문서의 "미구현" 문구는 오래된 것).

## 페이지 & 라우팅 — `ApprovalRoutes.jsx` (`/approval` 하위, 라우터 basename이 이미 `/groupware`이므로 여기 경로엔 `/groupware` 접두사를 또 붙이지 않는다 — 과거 실수가 코드 주석으로 남아있음)

| 경로 | 페이지 | 역할 |
|---|---|---|
| `index` | `ApprovalHomePage` | 인박스/드래프트/완료 건수, 최근 문서, `/approval/new`·`/approval/credentials` 링크 |
| `new` | `ApprovalDraftPage` | 신규 기안 |
| `documents/:id/edit` | `ApprovalDraftPage isEdit` | 반려/회수된 문서 수정·재상신 |
| `drafts\|inbox\|outbox\|completed\|references` | `ApprovalListPage type=…` | `inbox`/`references`는 전용 RPC, `drafts/outbox/completed`는 `approval_documents` 직접 쿼리 |
| `documents/:id` | `ApprovalDocumentPage` | 열람·승인/반려/보류/회수/보관/강제취소 액션 |
| `credentials` | `ApprovalCredentialsPage` | 본인 도장·서명 이미지 등록(승인 권한 자체와는 무관, §5 참고) |
| `admin/*` | `ApprovalAdminPage` | 분류/양식(결재선 템플릿) 관리, admin/super_admin만 |

`ApprovalListPage`의 상태→라벨: `draft/submitted/in_progress/held/rejected/recalled/approved/canceled/archived`. 행 링크는 `draft/recalled/rejected`면 `/edit`, 그 외엔 읽기 화면으로.

`ApprovalDraftPage` 핵심 동작: 템플릿 선택 → `formData`(템플릿별 동적 필드) → **결재선**은 `customLines===null`이면 템플릿 기본 결재선을 그대로 쓰고, "직접 지정"을 누르면 순서 변경 가능한 다중 승인자 리스트로 완전히 덮어씀(주요 결재자 휴리스틱 필터: 대표/사장/임원/이사/전무/상무/지사장/본부장/센터장/팀장/부장/차장/과장/관리자 등 직책 키워드 매칭 + 전체 승인 회원 콤보박스). "저장 결재선" 프리셋은 **`localStorage`에만 저장**(`jeakyung-approval-presets`/`-recent`) — DB엔 `approval_saved_lines` 테이블이 있지만 프론트가 안 씀(§7 미사용 스키마 참고). 저장 흐름: `saveDraft()`→`setReferences()`→파일별 `uploadAttachment()`(개별 실패 허용)→선택 시 `submitDocument()`.

`ApprovalDocumentPage` 핵심 동작: "도장란" 그리드(기안+각 결재선 담당자 박스, 승인 이력이 있으면 도장/서명 이미지 표시), 액션 버튼은 **전부 서버가 계산한 `doc.availableActions`로만 표시**(`can_edit/can_submit/can_recall/can_archive/can_admin_cancel`, `assignments[].can_approve/can_reject/can_hold/can_release_hold`) — 클라이언트에서 조건을 새로 계산하지 말 것. 승인은 반드시 등록된 도장/서명(`credentialId`)을 골라야 하고, 반려/보류는 2자 이상 의견을, 회수/보관/관리자취소는 2자 이상 사유를 요구(`window.prompt`). `super_admin`만 "강제 취소" 버튼(`can_admin_cancel` && `activeRole==='super_admin'` 둘 다 필요). 인쇄 버튼은 `window.print()`, `.gw-no-print` 클래스로 액션 UI 숨김.

`ApprovalAdminPage`: 분류(카테고리) CRUD + 양식(템플릿) 관리 — **템플릿을 저장할 때마다 새 불변 버전을 발행**한다(과거 버전은 변경 안 됨, 이미 상신된 문서는 당시 버전 그대로 유지). 결재선 스텝 종류는 결재/합의/협조(`approval/agreement/cooperation`), 여기 관리자 UI에서는 스텝당 단일 담당자만 지정 가능(다중 담당자/병렬 모드는 기안자가 `ApprovalDraftPage`에서 직접 지정할 때만 가능). 템플릿 설정에 `recall_policy`(기본 `before_first_action`)와 `allow_self_approval`.

`ApprovalCredentialsPage`: 도장(업로드 PNG/JPG/WEBP ≤2MB)과 서명(캔버스 손그림 → PNG export 또는 업로드) 등록. **이건 "누가 결재할 수 있는가"를 정하는 화면이 아니다** — 승인 자격은 오직 문서의 결재선에 올라있는지로만 결정되고, 도장/서명은 그 승인 행위를 시각적으로 남기는 개인 소지품일 뿐. 첫 등록 항목이 자동으로 `is_default`.

## 서비스 레이어 — `services/approvalService.js`

전부 `requireSupabase().rpc(...)` 프록시(일부만 storage 직접 접근). 액션 후 커스텀 이벤트 `groupware:approval-state-changed`(`APPROVAL_STATE_CHANGED_EVENT`) 발생.

| 함수 | RPC |
|---|---|
| `getAuthoringCatalog()` | `get_approval_authoring_catalog`(분류+템플릿+유저) |
| `saveDraft(...)` / `createDraft(...)`(레거시 래퍼) | `save_approval_draft` |
| `submitDocument(id)` | `submit_approval_document_v2` |
| `processAction(id,assigneeId,action,opinion)` | `process_approval_action_v2` |
| `processSignedAction(id,assigneeId,action,opinion,credentialId)` | `process_signed_approval_action_v2` |
| `getCredentials()` | `approval_credentials` 직접 조회 + storage 서명 URL |
| `uploadCredential(file,{type,label,isDefault})` | Storage 업로드 + `register_approval_credential` |
| `archiveCredential(id)` | `archive_approval_credential` |
| `getHeaderState()` | `get_groupware_header_state`(대기건수+알림) |
| `markNotificationRead(id)` | `mark_groupware_notification_read` |
| `getDelegations()` / `createDelegation` / `revokeDelegation` | `get_my_approval_delegations`/`create_approval_delegation`/`revoke_approval_delegation` — **RPC는 완성돼 있지만 이걸 호출하는 화면(UI)이 아직 없음** — 대결/위임 기능을 노출하려면 새 페이지를 만들어야 함 |
| `setReferences`/`getReferences`/`markReferenceRead` | `set_approval_references`/`get_my_approval_references`/`mark_approval_reference_read` |
| `addComment`/`deleteComment` | `add_approval_comment`/`delete_approval_comment` |
| `uploadAttachment(id,file)` | Storage `groupware-approval-attachments`(한글 파일명 ASCII로 정리) + `register_approval_attachment`, ≤20MB |
| `deleteAttachment(id)` | `delete_approval_attachment` + storage 객체 삭제 |
| `adminCancelDocument(id,reason)` | `admin_cancel_approval_document` |
| `recallDocument(id,opinion)` | `recall_approval_document_v2` |
| `archiveDocument(id,reason)` | `archive_approval_document` |
| `getAvailableActions(id)` | `get_available_approval_actions` — **UI 버튼 노출의 유일한 근거** |
| `getHomeSummary()` / `getInbox()` | `get_approval_home_summary` / `get_my_approval_inbox` |
| `getDocument(id)` | `approval_documents` 조인 직접 조회(템플릿버전/리비전/결재선→담당자/액션이력/첨부/댓글/참조) + `getAvailableActions` |
| `getAdminCatalog()` / `saveCategory(...)` / `saveTemplate(...)` | `get_approval_admin_catalog` / `manage_approval_category` / `manage_approval_template`(항상 새 버전 발행) |

## 결재선(라우팅) 모델 — 템플릿마다 다르게 설정 가능한 하이브리드

고정된 결재 순서가 아니라, **템플릿의 기본 결재선을 기안자가 그대로 쓰거나(동적 대상은 제출 시점에 실제 유저로 해석) 완전히 덮어쓸 수 있는** 구조:
- 스텝 대상 타입: `management`(경영진)/`drafter_department_head`(기안자 소속 부서장)/`department`/`role`/`user`(지정 유저).
- 스텝 진행 모드(`line_mode`): `sequential`(순차 단일) / `parallel_all`(전원 승인 필요) / `parallel_required_count`(N-of-M).
- 스텝 종류(`step_kind`): `approval`(결재, 기본적으로 진행을 막음) / `agreement`(합의) / `cooperation`(협조).
- **결재선은 상신(`submit`) 전까지만 수정 가능** — `save_approval_draft`가 동적 대상을 실제 유저ID로 해석해 `approval_documents.draft_line_schema`(아직 미확정)에 저장하고, `submit_approval_document_v2`가 이걸 실제 `approval_lines`/`approval_line_assignees`로 **동결**한다. 이후 반려/회수되어 재상신해도 그 리비전엔 확정된 결재선이 새로 다시 만들어짐.
- **대결/위임**(`approval_delegations`, 범위 all/template/department, 기간 지정)은 서버·RPC 레벨엔 완성돼 있으나 전용 화면이 없다 — "대결/위임 화면을 만들어달라"는 요청이 오면 이 서비스 함수(`getDelegations/createDelegation/revokeDelegation`)를 그대로 쓰면 된다.

## 문서 상태 흐름

```
draft --(기안자, submit)--> in_progress ⇄ held (hold/release_hold)
in_progress --(모든 담당자 approve)--> approved
in_progress --(담당자 reject)--> rejected
in_progress/held --(승인/반려/보류 이력이 아직 없을 때만, 기안자, recall)--> recalled
rejected/recalled --(기안자 수정 후 재상신, action_type='resubmit')--> in_progress
approved/rejected/recalled/canceled --(기안자 or admin, archive)--> archived
(approved/canceled/archived 제외 모든 상태) --(super_admin만, admin_cancel)--> canceled
```
스텝 상태: `waiting→active→approved/rejected/held/skipped/canceled`. 담당자 상태: `waiting→pending→approved/rejected/held/delegated/skipped`. 액션 이력 타입: `submit/approve/reject/hold/release_hold/recall/resubmit/cancel/skip/delegate/final_approve/admin_override`.

`recall_policy`가 템플릿 설정에서 `disabled`면 회수 자체가 항상 막힘(기본값 `before_first_action`은 첫 승인/반려/보류 행위 전까지만 회수 허용).

## Supabase 스키마 — 기반 `202607310008_groupware_approval_core.sql`

- `approval_categories`, `approval_templates`(→`current_version_id`), `approval_template_versions`(`form_schema`/`line_schema` jsonb, `status: draft|published|retired`, 저장할 때마다 새로 생김)
- `approval_number_sequences` — `generate_approval_document_number()`가 `PREFIX-YYYY-NNNNNN` 문서번호를 연/월별 원자적으로 채번
- `approval_documents(id,template_id,template_version_id,document_number,title,drafter_user_id,drafter_department_id,current_revision_id,current_step_order,status,draft_line_schema jsonb,submitted_at,completed_at,recalled_at,canceled_at,archived_at)`
- `approval_document_revisions` — 리비전마다 불변 스냅샷(`body_json`,`form_data`,`drafter_snapshot`) — 초안 저장할 때마다 새 리비전 생성
- `approval_lines(id,document_id,revision_id,step_order,step_kind,line_mode,required_count,is_blocking,status)`
- `approval_line_assignees(id,line_id,assigned_user_id,assignment_source,assignee_snapshot,status,delegated_from_user_id,assignee_order)`
- `approval_actions(id,document_id,revision_id,line_id,assignee_id,actor_user_id,action_type,opinion,credential_snapshot jsonb)` — `credential_snapshot`은 승인 당시 도장/서명을 얼려서 남김(나중에 도장 바꿔도 이력은 안 바뀜)
- `approval_references(id,document_id,user_id,reference_type(reference|reader),read_at)`
- `approval_comments(id,document_id,revision_id,author_user_id,content,is_internal,deleted_at)` — 삭제는 소프트("삭제된 의견입니다."로 치환)
- `approval_attachments(id,document_id,revision_id,storage_path,original_name,mime_type,file_size,attachment_type(general|inline_image|supporting_document),deleted_at)` — 첨부는 문서가 `draft`이고 본인이 기안자일 때만 등록 가능, 문서당 ≤10개·합계 ≤100MB
- `approval_delegations`(대결/위임)(delegator_user_id,delegate_user_id,scope_type(all|template|department),template_id,department_id,starts_at<ends_at,status(scheduled|active|expired|revoked)) — **RPC는 완성, UI는 미완성**
- **미사용 스키마(존재하지만 아무 코드도 참조 안 함)**: `approval_authority_rules`("전결 규칙", 금액/부서별 최종승인권한 — RPC/서비스 어디서도 안 씀), `approval_saved_lines`(개인 저장 결재선 — 프론트는 대신 `localStorage`를 씀). **이 두 테이블을 보고 "이미 쓰이는 기능"이라 착각하지 말 것** — 새로 붙이려면 RPC부터 만들어야 한다.
- `approval_credentials(id,user_id,credential_type(signature|stamp),label,storage_path UNIQUE,mime_type,file_size(1-2097152),is_default,archived_at)` — RLS로 본인 것만 select.

Storage 버킷: `groupware-approval-credentials`(≤2MB, png/jpg/webp), `groupware-approval-attachments`(≤20MB, pdf/jpeg/png/webp/text/zip/docx/xlsx).

**권한 헬퍼**(그룹웨어 코어와 동일 관용구 + 결재 전용 확장): `is_approved_member()`/`is_membership_admin()` 그대로 사용. `can_view_approval_document(id)` = 기안자 OR (직접 담당자 OR `has_active_approval_delegation`로 대결 중인 담당자) OR 참조/열람자 OR `is_membership_admin()`. `admin_cancel_approval_document`는 `get_user_active_role(auth.uid())='super_admin'`을 직접 체크(단순 `is_membership_admin()`보다 더 좁음 — admin은 강제취소 못 함, super_admin만 가능).

**핵심 RPC 요약**(전부 `SECURITY DEFINER`, `authenticated`만):
- `save_approval_draft`가 `line_schema_override`(또는 템플릿 기본값)를 실제 승인 회원 목록으로 해석해 `draft_line_schema`에 저장(자기 자신 제외, `allow_self_approval` 아니면).
- `submit_approval_document_v2`가 `draft_line_schema`를 `approval_lines`/`approval_line_assignees`로 동결·1단계 활성화·문서번호 채번·`groupware_notifications` 알림 발송까지 한 번에 처리.
- `process_approval_action_v2`가 승인/반려/보류의 전체 케스케이드(라인 완료 판정, 다음 라인 활성화 또는 최종 승인, 반려 시 나머지 라인 전부 취소) 담당 — **문서 상태를 클라이언트에서 직접 조작하지 말고 항상 이 RPC를 통해서만 변경**.
- `process_signed_approval_action_v2`는 위 RPC를 감싸면서 `credential_snapshot`을 얼려 붙이는 래퍼.
- **구버전(v1) 함수들은 이미 삭제됨**(`202609010004_drop_superseded_approval_functions.sql`): `submit_approval_document`, `recall_approval_document`, `process_signed_approval_action`(`_v2` 없는 것), `save_approval_comment`, `save_approval_references`, `mark_notification_read` — 코드에서 이 이름들을 다시 호출하지 말 것, 전부 `_v2` 붙은 것이 현재 유효 버전.

## 운영 상태 — 신뢰할 문서와 신뢰하면 안 되는 문서

- 저장소 루트/`source/`의 **`WEBSITE_SPEC.md`와 `source/docs/00_INDEX.md`는 오래된 초기 기획 문구**(예: "전자결재는 후속 승인 전까지 구현하지 않는다")가 그대로 남아있다 — **전자결재 준비 상태 판단에 이 두 문서를 근거로 쓰지 말 것.**
- 실제 최신 현황의 출처는 **`source/docs/PROJECT_MANAGEMENT/02_CURRENT_STATUS.md`** — 여기엔 "전자결재 핵심 기능·대결/위임·도장/서명·알림·첨부파일·의견·인쇄·강제취소 구현 완료"라고 명시되어 있다.
- `notice/index.html`(직원 공지)도 전자결재를 이미 쓸 수 있는 기능으로 안내하고 있다 — 게시판처럼 legacy 이관 대상이 아님(예전 시스템에 대응 기능 자체가 없었으므로).
- **결론: 전자결재는 이 저장소 기준 완성된 기능으로 취급하고, "개발 중"이라고 안내문 등에 쓰지 말 것.** 다만 대결/위임은 백엔드만 완성, 화면 자체가 없다는 점은 명확히 구분해서 안내할 것.
