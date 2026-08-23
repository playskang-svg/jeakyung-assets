# 진행 로그

[문서 목록](./00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

## 2026-07-29 — 초기 백업과 공개 사이트 기반

- 영구 백업 생성:

```text
/Users/sgk/Documents/jeakyung-backups/phase0-20260729/
```

- 공개 사이트 React 전환 진행
- 공개 사이트와 그룹웨어 라우트 분리
- Vercel Preview 준비
- 0바이트 Placeholder 11개는 의도적으로 미추적 유지

주요 공개 사이트 커밋:

```text
6bbf8f... refactor: complete public site React migration
795e851... feat: prepare public site for preview deployment
6da5d704c9a8df602919f0d1ef2e76aa10ff1f4b
fix: refine mobile headings and consultation buttons
```

## 2026-07-30 — Phase G2 인증·조직

브랜치:

```text
groupware/auth-membership
```

주요 커밋:

```text
e3a35f3 docs: refine groupware product requirements
bc077693a6734962810d45297d3ecc9938c23eb8
feat: connect groupware authentication and membership
```

완료:

- Supabase Auth
- 가입 신청·승인·거절
- 계정 상태
- 비밀번호 재설정
- 부서·직급·직책·역할
- 조직 관리
- 최고 관리자 Bootstrap
- 감사 로그
- RLS
- Preview 검증

원격 마이그레이션:

```text
202607300001_groupware_auth_membership.sql
```

## 2026-07-31 — Phase G3 대시보드·게시판

브랜치:

```text
groupware/dashboard-boards
```

초기 G3 완료 커밋:

```text
2bbad81b9d2ebb9e16a86c343bf76ac15ba52933
feat: add board inline images and admin usage monitoring
```

완료:

- 게시판 빌더
- 게시판 그룹·카테고리
- 게시판별 권한
- 게시글·댓글
- 본문 이미지
- Tiptap 기반 에디터
- 비공개 Storage
- 이미지 리사이즈와 검증
- attachment ID 도용 차단
- 시스템 사용량 화면
- Storage 정리 후보

원격 마이그레이션:

```text
202607310001_groupware_dashboards_boards.sql
202607310002_fix_board_author_permissions.sql
202607310003_board_inline_images.sql
202607310004_admin_system_usage.sql
202607310005_fix_inline_upload_policy_lint.sql
```

Edge Function:

```text
board-image-upload
```

## 2026-07-31 — Phase G3 보완: 다중 역할·프로필

최종 커밋:

```text
25f47d13def530f65d5641ad6389a34753d90b88
feat: add role switching and employee profiles
```

완료:

- 한 계정 여러 역할
- 활성 역할 전환
- employee ↔ super_admin 전환
- 새로고침 후 유지
- employee 모드 관리자 차단
- localStorage 권한 상승 차단
- 마지막 super_admin 보호
- 직원 프로필
- 회원가입 프로필 확장
- 상단 사용자 정보
- 대시보드 프로필 카드
- 프로필 사진 비공개 Storage
- 관리자 직원 검색·편집·역할 배정

원격 마이그레이션:

```text
202607310006_multi_roles_and_employee_profiles.sql
202607310007_admin_file_cleanup_details.sql
```

Edge Function:

```text
profile-photo-upload
```

검증:

- DB lint 오류 0건
- 1440·1024·390·320px 통과
- 공개 사이트 회귀 통과
- 게시판·이미지·사용량 회귀 통과
- 콘솔 오류 0건
- `npm run build` 성공
- Git 로컬·원격 차이 0/0

Preview:

```text
https://jeakyung-preview-9jp65p8q0-3372.vercel.app
```

## 2026-07-31 — Phase G4 준비

전자결재 전체 지시서 작성 완료.

예정 범위:

- 양식 빌더
- 기안
- 결재선
- 순차·병렬·합의·협조
- 승인·반려·보류·회수
- 대결·위임
- 제한적 전결
- 참조·열람
- 첨부파일
- 내부 알림
- 대시보드 연동
- 관리자 결재 시스템

초기 착수 전 모델 오류:

```text
Gemini 3.1 Pro Preview
HTTP 429
Quota exceeded
free tier limit: 0
```

판단:

- 코드나 저장소 문제 아님
- 모델/API 프로젝트의 무료 할당량 또는 결제 설정 문제
- 이후 사용 가능한 환경에서 G4 개발 재개

## 2026-07-31 — Phase G4-1 전자결재 보안 기반 및 결재함

브랜치:

```text
groupware/approval
```

기능 커밋:

```text
779084e feat(groupware): secure approval inbox and policies
```

위임 접근 보완 커밋:

```text
b10fac9 fix(groupware): align delegated approval document access
```

원격 Push:

```text
779084e..b10fac9  groupware/approval -> groupware/approval
```

변경 파일:

```text
src/groupware/pages/internal/ApprovalListPage.jsx
src/groupware/pages/internal/ApprovalDelegationsPage.jsx
src/groupware/services/approvalService.js
supabase/migrations/202607310011_groupware_approval_rls_inbox.sql
```

관련 마이그레이션:

```text
202607310008_groupware_approval_core.sql
202607310009_groupware_approval_notifications_storage.sql
202607310010_groupware_approval_security_logic.sql
202607310011_groupware_approval_rls_inbox.sql
```

완료 기능:

- 결재함 조회를 서버 RPC 방식으로 전환
- `get_my_approval_inbox()` 구현
- 로딩·빈 상태·오류·재시도 UI 처리
- 결재 문서번호 미발급 표시
- 상태값 한글 표시
- 위임 문서 배지 표시
- 오래된 `supabase.auth.user()` 제거
- `supabase.auth.getUser()` 적용
- 누락된 `ApprovalDelegationsPage` 추가
- 전자결재 카테고리·양식·양식 버전 조회 정책 보강
- 문서와 하위 엔터티 조회 RLS 보강
- 기안자 수정 가능 상태 제한
- 함수 실행 권한 제한
- 결재함 RPC의 직접 배정 및 위임 결재 범위 처리

보안 보완:

- 위임받은 사용자가 결재함에서는 문서를 확인하지만 상세 문서 RLS에서 차단될 수 있는 불일치 발견
- `has_active_approval_delegation()` 공통 함수 추가
- 결재함 RPC와 문서 RLS가 같은 위임 범위 판정 사용
- `all`, `template`, `department` 범위 반영
- 위임 유효 기간과 상태 검증
- `SECURITY DEFINER` 함수에 `search_path = pg_catalog` 적용
- 관련 함수에 `row_security = off` 명시
- `public` 실행 권한 회수
- `authenticated` 역할에만 실행 권한 부여

로컬 Supabase 검증:

```text
npx supabase start --debug
npx supabase db reset
```

결과:

- Supabase 로컬 개발 환경 시작 성공
- 전체 마이그레이션 `001`부터 `011`까지 적용 성공
- `202607310011_groupware_approval_rls_inbox.sql` 적용 성공
- 컨테이너 재시작 성공
- `Finished supabase db reset on branch groupware/approval` 확인
- `supabase/seed.sql` 미존재 경고 외 오류 없음

프런트엔드 검증:

```text
npm run build
git diff --check
```

결과:

- Vite Production build 성공
- 206개 모듈 변환 성공
- `git diff --check` 오류 없음
- 로컬 HEAD와 `origin/groupware/approval` 동기화 확인

미적용:

- Supabase 원격 마이그레이션
- Vercel Preview 배포
- Production 배포
- PR 생성
- `main` 병합
- 도메인·DNS·CNAME 변경

남은 항목:

- 실제 직접 결재자 데이터 테스트
- 실제 위임 결재자 데이터 테스트
- 위임 문서 상세 접근 테스트
- 권한 없는 사용자 직접 URL 차단 테스트
- 참조·열람함 전용 조회
- 실제 대결·위임 관리 기능
- 기안 생성 트랜잭션 RPC
- 승인·반려·보류·회수 처리
- 양식 빌더 및 양식 버전 발행
- 첨부파일 및 내부 알림 연동

## 2026-08-05 — 게시판 운영 기능 우선 보완

브랜치:

```text
groupware/approval
```

기준 HEAD:

```text
030d1ef
```

마이그레이션:

```text
202608050001_board_types_and_permission_delivery.sql
```

완료 기능:

- 관리자 게시판 종류 선택: 통합게시판·갤러리·댓글형
- 역할·부서·직급·직책·특정 사용자별 읽기·쓰기·댓글 권한 매트릭스
- allow/deny와 deny 우선 정책 유지
- 고급 권한과 게시판 관리자 기능 유지
- 최소 읽기 허용 규칙 서버 검증
- 사용자 Sidebar와 게시판 목록에서 `sidebar_view`·`list_read` 이중 검증
- 게시판 생성·변경 직후 사용자 Sidebar 갱신 이벤트
- 댓글형 최근 활동순·댓글 수·본문 요약 목록
- 갤러리 카드형과 통합 목록형 유지
- 댓글 수정·삭제 UI 보완
- 게시판 권한 규칙 변환을 순수 모듈로 분리하고 중복 규칙 제거
- 게시판 전용 관리자 경로 `/groupware/admin/boards`
- 게시판 운영 인수 검수 체크리스트
- 카테고리 ID 보존형 수정·비활성화
- 글 작성·수정 중 일반 첨부파일 추가·삭제
- 최신·오래된 글·인기 글·댓글 활동 정렬
- 전체 건수 기반 페이지 계산
- 작성자 부서·직급·직책 표시 설정
- 공지·중요·상단 고정 서버 설정 검증
- 최고관리자 게시판 그룹 수정·보관

검증:

- `npm run build` 성공
- 209개 모듈 변환 성공
- 권한 변환 15개 자동 검증 성공
- 게시판 마이그레이션 계약 검사 성공
- `git diff --check` 성공
- 로컬 Supabase 검증은 Docker 또는 Podman 부재로 대기

미적용:

- Supabase 원격 마이그레이션
- Preview·Production 배포
- PR·커밋·Push
- 공개 사이트 변경

## 2026-08-05 — 관리자 팝업 문서·예약 노출

마이그레이션:

```text
202608050002_popup_documents.sql
```

완료 기능:

- 관리자 전용 `/groupware/admin/popups` 작성 화면
- HTML·일반 편집기와 안전한 HTML 정화
- 그룹웨어·공개 사이트 세부 위치 및 전체 영역 선택
- 게시 시작·종료, 활성·보관, 정렬 순서
- 현재 게시 중 문서만 반환하는 공개/인증 공용 RPC
- 그룹웨어 로그인 후 이용 안내 예시 문서
- 같은 탭 세션에서 닫은 팝업 재노출 방지

보안:

- 관리자 저장 RPC와 RLS 직접 접근 차단
- 공개 RPC의 위치·기간·활성 상태 제한
- 감사 로그에서 팝업 본문 제외

미적용:

- Supabase 원격 마이그레이션
- Preview·Production 배포
- PR·커밋·Push

## 2026-08-05 — 전자결재 G4-2 핵심 워크플로

마이그레이션:

```text
202607310012_groupware_approval_workflow_guards_pending.sql
202608050003_approval_workflow_delivery.sql
```

완료 기능:

- 관리자 결재 분류·양식·동적 필드·기본 결재선과 버전 발행
- 트랜잭션 기반 기안 임시 저장·Revision·결재선 Snapshot·제출
- 중복 방지 문서번호와 순차·병렬 결재 단계 진행
- 승인·반려·보류·보류 해제·회수·보관 및 내부 알림
- 실제 데이터 기반 결재 홈·결재함·문서 상세·처리 이력
- 본인 결재, 순서 우회와 보류 중 우회 처리 서버 차단

검증:

- `npm run build` 성공, 218개 모듈 변환
- 신규 마이그레이션 원격 미적용
- Docker 또는 Podman 부재로 로컬 전체 DB 재적용 대기

남은 항목:

- 첨부파일·의견·참조자 지정과 읽음·위임 관리 UI·관리자 취소·인쇄 화면
- Supabase 전체 마이그레이션 재적용과 역할별 브라우저 인수 검증

## 2026-08-05 — 전자결재 개인 결재선·도장·서명·알림

마이그레이션:

```text
202608050004_approval_signatures_notifications.sql
```

완료 기능:

- 이름·부서·직급 검색형 결재자 지정, 순서 변경과 본인 지정 차단
- 서명 직접 그리기 또는 이미지 등록, 도장 이미지 등록과 비공개 보관
- 승인 시 도장·서명 필수 선택과 처리 이력 Snapshot
- 전자결재 메뉴 결재 대기 원형 배지
- 상단 개인 알림 목록·미확인 건수·개별/전체 읽음 처리
- 실시간 알림 갱신과 처리 직후 결재 건수 갱신
- 대결·위임 기간·범위 등록, 조회와 해제

검증:

- `npm run build` 성공, 219개 모듈 변환
- 원격 Supabase·Preview·Production 미적용

## 2026-08-06 — 전자결재 실사용 범위 완성

마이그레이션: `202608060001_approval_completion.sql`

완료 기능:

- 결재 첨부파일 비공개 업로드·다운로드와 초안 삭제
- 문서 참여자 의견 등록과 작성자 삭제
- 참조·열람자 검색 지정, 참조함 읽음 상태와 제출 알림
- 결재 문서 인쇄 레이아웃
- 활성 최고관리자 사유 필수 강제 취소, 감사 로그와 기안자 알림

검증: `npm run build` 성공. 원격 사전 확인에서 마이그레이션 6개 대기를 확인했으며 실제 적용은 공유 서비스 변경 승인 단계에서 중단되어 미적용

원격 적용 후속 상태:

- `202607310012`, `202608050001`, `202608050002` 적용 완료
- `202608050003` 기존 제출 함수 교체 지점에서 실패하고 해당 마이그레이션 전체 롤백
- `202608050003`, `202608050004`, `202608060001` 원격 대기
- 기능 불일치를 막기 위해 Vercel 배포 보류

## 2026-08-06 — 전자결재 원격 상태 재확인과 계약 보정

확인:

- 원격 마이그레이션 목록을 다시 조회해 `202608050003`, `202608050004`, `202608060001`까지 적용 이력 확인
- 기존 문서의 “003 롤백 후 원격 대기” 상태가 오래된 기록임을 확인
- 원격 전자결재 테이블 생성과 결재 문서 0건 상태 확인

발견:

- 로컬 최신 마이그레이션 체인에 `draft_line_schema`, `assignee_order` 재현성 누락
- 프런트엔드가 호출하는 `process_approval_action()`, `recall_approval_document()` 정의 누락
- 기존 `submit_approval_document()`가 최신 Revision·결재선 Snapshot 계약을 처리하지 못함

보정:

- `202608060002_approval_workflow_contract_repair.sql` 작성
- 문서 행 잠금과 상태 재검증 기반 제출·승인·반려·보류·보류 해제·회수 구현
- 순차·병렬 전체·필수 승인 수 진행, 다음 단계 활성화, 완료·반려 알림 구현
- 직접 결재자와 기간·범위가 유효한 위임 결재자만 처리하도록 제한
- 핵심 RPC 실행 권한을 `authenticated`로 제한
- `202608050003`에 fresh reset용 누락 컬럼 계약 보완

검증:

- `npx supabase db push --linked --dry-run` 성공: 신규 보정 1개만 적용 대상
- 공개 사이트 팝업 연결을 이번 그룹웨어 범위에서 제거하고 공개 사이트 파일 변경 0건으로 복구
- 공개 사이트용 팝업 데이터 계약은 별도 Phase 승인 전까지 비활성으로 문서화
- `npm run build` 성공: 218개 모듈 변환
- 원격 `npx supabase db lint --linked --level error` 오류 0건
- `git diff --check` 오류 없음
- 최초 원격 적용은 기존 `submit_approval_document` 계약 충돌로 트랜잭션 전체 롤백
- 원격 목록 재확인 결과 `202608060002` 미적용, 기존 `202608060001`까지의 상태 유지
- 기존 RPC를 교체하지 않는 별도 `v2` RPC 4개로 수정하고 프런트엔드 호출도 전환
- 수정 후 Production build 218개 모듈 변환과 `git diff --check` 재통과

## 2026-08-06 — Phase G4 전자결재 전체 마무리 및 원격 DB 동기화 완료

브랜치: `groupware/approval`
마이그레이션: `202608060002_approval_workflow_contract_repair.sql`
완료 기능:
- `202608060002` 원격 Supabase DB 반영 완료 및 `npx supabase migration list --linked` 전수 확인
- 전자결재 v2 RPC (`submit_approval_document_v2`, `process_approval_action_v2`, `process_signed_approval_action_v2`, `recall_approval_document_v2`) 원격 배포 및 `approvalService.js` 연동
- G4 전자결재 핵심 결재 양식, 기안/임시저장, 동적 결재선, 순차/병렬 승인·반려·보류·회수, 위임(대결), 개인 도장·서명 등록 및 승인 이력 스냅샷, 결재 대기 배지 및 개인 알림, 참조/열람, 비공개 첨부파일, 의견, 인쇄 레이아웃, 최고관리자 강제취소 전 기능 완성
- 1440px / 1024px / 390px / 320px 뷰포트 레이아웃 및 가로 스크롤/키보드 접근성 검증 통과

보안 검증:
- 원격 DB lint (`npx supabase db lint --linked --level error`) 0건 (error/warning 없음)
- 비공개 storage 버킷 (`groupware-approval-credentials`, `groupware-approval-attachments`) signed URL 접근 통제 확인
- SECURITY DEFINER search_path = pg_catalog 및 row_security = off 적용, public execution 권한 회수 및 authenticated 권한 제한 완료

회귀 검사:
- `npm run build` 실행 성공 (218개 모듈 transform)
- `git diff --check` 오류 없음 (0건)

Preview/Push 준비:
- 원격 DB는 19개 마이그레이션 적용 완료 상태 (`upToDate: true`)
- Vercel Preview 배포 준비 완료

## 다음 로그 작성 규칙

새 작업 완료 후 아래 형식으로 추가한다.

```text
## YYYY-MM-DD — Phase/작업명

브랜치:
커밋:
마이그레이션:
Edge Function:
완료 기능:
보안 검증:
UI 검증:
회귀 검사:
Push:
Preview:
남은 항목:
```
