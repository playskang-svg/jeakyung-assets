---
name: jeakyung_site_groupware
description: 재경로지스｜물류 그룹웨어/인트라넷("재경사이트 그룹웨어", jeakyung.com/groupware) 코어 작업 전용 참고 스킬 — 로그인/회원가입/권한, 대시보드, 관리자 화면, 팝업 공지, 조직도/근태/프로필/파일/링크페이지/검색 등. 게시판(BoardPage 등)은 jeakyung_site_board, 전자결재(ApprovalPage 등)는 jeakyung_site_approval 스킬을 대신 쓸 것 — 이 스킬은 그 두 기능의 세부 구현은 다루지 않는다.
---

# 재경사이트 — 그룹웨어 코어

React Router SPA, `basename="/groupware"`, Vite의 별도 빌드 엔트리(`groupware`)로 만들어져 저장소 루트 `groupware/index.html`에 빌드 산출물이 그대로 올라간다(직접 수정 금지, `npm run sync`로만 갱신). 부모 스킬 `jeakyung_site`의 배포/전역 규칙을 먼저 따른다.

## 엔트리/라우팅

- `source/src/groupware/main.jsx` → `App.jsx`(`<BrowserRouter basename="/groupware">`). 라우트 트리:
  - 공개(비로그인, `AuthLayout`): `login, signup, pending, rejected, locked, resigned`(전부 `MembershipStatusPage status=…`), `reset-password`, `reset-password/update`
  - 보호(`ProtectedRoute`→`AppShell`): `dashboard, profile, attendance, organization, boards*, pages/:pageSlug, approval/*, calendar, files, view/*, search, business-card`
  - 관리자 전용(`AdminRoute` 중첩, lazy import): `admin, admin/boards, admin/popups`
  - `*` → `/login`
- Vercel `vercel.json`: `/groupware`, `/groupware/:path*` → `/groupware/index.html` rewrite, `X-Robots-Tag: noindex, nofollow`.

## 인증 & 회원(멤버십)

- `lib/supabase.js`: `requireSupabase()` — 미설정 시 `'Supabase 연결 설정이 필요합니다.'` 던짐.
- `context/AuthContext.jsx`(`useAuth()`): 세션 변화마다 `membershipService.getIdentity()` → RPC `get_my_effective_access_context()`로 `{profile, roles, activeRole}` 받음(**서버가 최고 권한 역할을 계산, 클라이언트 역할 전환 없음**). `status`는 `resigned`(퇴사) > `profile.membership_status`(`pending|approved|rejected|locked|resigned`) > `profile-missing` 순으로 파생. 승인(`approved`) 상태일 때만 `touchPresence()`를 60초 간격 하트비트로 호출(서버 쪽 접속중 판정 창은 3분).
- `services/authService.js`: `signInWithPassword`, `signUpMembership`(부서/직급/직책/입사일/사번/조직 메모/프로필 사진까지 담아 `auth.signUp({options:{data}})`), `requestPasswordReset`(리다이렉트 `/groupware/reset-password/update`), `updatePassword`, `getSignupOptions()`(RPC `get_signup_options`).
- `services/membershipService.js`: `getIdentity`, `listPendingMemberships`(직접 `profiles` select), `approveMembership`/`rejectMembership`(RPC).
- `routes/ProtectedRoute.jsx`: `configured→loading→session(없으면 /login)→status`(`pending/rejected/locked/resigned`는 각각 대응 페이지로, 그 외 `approved` 아니면 일반 에러) 순으로 게이팅.
- `routes/AdminRoute.jsx`: `['admin','super_admin'].includes(auth.activeRole)`만 체크.
- **"2단계 로그인"(그룹웨어 로그인 후 메일 재로그인) 패턴은 코드/문서 어디에도 없다.** `source/docs/33_MAIL_INTEGRATION.md`가 명시적으로 "메일은 아직 미연동"이라고 밝히고 있고, `mail` 퀵링크는 그냥 `https://mail.jeakyung.com/`로 여는 외부 새 탭 링크(SSO 없음, 그룹웨어 비밀번호를 메일 인증에 재사용 금지라고 문서에 명시). 이 부분을 "이미 있는 기능"으로 오해해서 문서/안내문에 쓰지 말 것 — 실제로는 아직 없는 기능이다.
- 표준 스펙 문서: `source/docs/27_AUTH_AND_MEMBERSHIP.md` (membership_status vs employment_status 구분, 프로필 사진 업로드는 가입 시 24시간 유효 원타임 토큰/승인 후엔 인증 JWT로 Edge Function 경유).

## 레이아웃 & 내비게이션

- `layouts/AppShell.jsx`: **사이드바 없음**(의도적 설계 — 대시보드의 버튼박스가 내비게이션 역할). 상단바에 `PopupLayer`(경로별 target: `/admin`→`groupware_admin`, `/approval`→`groupware_approval`, `/boards`→`groupware_boards`, 그 외→`groupware_dashboard`), `TopSearch`(게시판 검색), `TopClock`, 알림 벨(`approvalService.getHeaderState()` 60초 폴링+realtime), `UserAccountMenu`, `RouteBar`(브레드크럼).
- `components/PageScaffold.jsx`: 아직 미구현 기능 페이지(조직도/캘린더 등)의 "준비 중" 플레이스홀더 — 자세한 화면이 없다고 버그가 아니라 **의도된 임시 화면**임에 주의.
- `components/PageSection.jsx`("링크 페이지" 구성 요소): `item_type`이 `board`(임베디드 BoardPage)/`embed`(EmbeddedSite)/`html`(sanitizePopupHtml 경유)/`richtext`(BoardDocumentRenderer)/`buttons`.
- **퀵링크 vs 버튼박스** — 이름이 비슷한 두 개의 독립 메커니즘:
  - **퀵링크**(`config/navigation.js`의 `GROUPWARE_NAVIGATION` 정적 배열 + DB 오버레이 `services/quickLinkService.js`, 대시보드 "페이지" 줄): 마이그레이션 `202609020011_quick_links.sql`, RPC `get_quick_links/admin_get_quick_links/manage_quick_link/delete_quick_link`. `visibility`(all/admin/super_admin)에 따라 서버가 아예 `url: null`로 내려줌.
  - **버튼박스**(`services/buttonBoxService.js`, 마이그레이션 `202608231000_button_boxes.sql`): 카드/타일/리스트 형태의 재사용 링크 묶음, 대시보드 위젯이나 링크페이지 안에서 사용. `ButtonBoxGrid.jsx`가 `link_type==='board'`/`'embed'`일 때만 인페이지 다이얼로그(`ButtonBoxTargetDialog.jsx`)로 열고, 나머지는 그냥 새 탭.
  - 레거시 인트라넷(`https://jeakyung.quv.kr/...`)으로 가는 퀵링크: `schedule`(사내일정), `consignment`(지입업무) — `EmbeddedSite`로 프레임 안에서 열림. `mail`은 대상 서버가 `X-Frame-Options`를 보내서 강제로 `newTab`.

## 대시보드

`pages/internal/DashboardPage.jsx` 렌더 순서: `ProfileCard` → 공지+최신글 피드(`getBoardPosts('company-notice')`+`getRecentBoardPosts`) → "페이지" 퀵링크 줄 → "게시판" 런치 그리드 → 관리자 설정 위젯 그리드(`getMyDashboardWidgets`) → "사내앨범" 가로 스크롤 갤러리(`getAlbumHighlights`, 비어있으면 샘플 SVG 8장 폴백) → 숨긴 위젯 복원 영역. 전부 `Promise.allSettled`로 가져와서 한 데이터 소스 실패가 전체 화면을 막지 않게 함.
`services/dashboardService.js`: `getMyDashboardWidgets`(RPC `get_my_dashboard_widgets`), `setDashboardPreference`(`set_my_dashboard_preference`), 관리자용 `getDashboardAdminCatalog/saveDashboardWidget(manage_dashboard_widget)/reorderDashboardWidgets(reorder_dashboard_widgets)/deleteOrArchiveDashboardWidget`.

## 팝업 시스템 (공개 사이트와 공유, 상세 규칙은 여기)

파일: `source/src/shared/popup/{PopupLayer.jsx, PopupDocumentContent.jsx, popupHtml.js, popupService.js, mountPublicPopupLayer.jsx}`.

- **표시/해제**: `PopupLayer`가 `getActivePopupDocuments(client, target)`으로 목록을 받아 첫 문서만 모달로 표시. 닫기는 2단계 — `sessionStorage` 키 `jeakyung-popup-dismissed:<id>`(이번 세션만), `localStorage` 키 `jeakyung-popup-dismissed-7days:<id>`(만료 타임스탬프 저장, "7일간 표시하지 않기").
- **소독 규칙**(`popupHtml.js` `sanitizePopupHtml`) — **팝업 본문은 반드시 이 규칙 안에서만 작성**:
  - 허용 태그: `A,B,BLOCKQUOTE,BR,CODE,DIV,EM,FIGCAPTION,FIGURE,H1-H6,HR,I,IMG,LI,OL,P,PRE,S,SECTION,SMALL,SPAN,STRONG,TABLE/TBODY/TD/TFOOT/TH/THEAD/TR,U,UL`. 이 외 태그는 통째로 제거가 아니라 **태그만 벗겨내고 자식은 유지**(단 `BASE,BUTTON,EMBED,FORM,IFRAME,INPUT,LINK,META,OBJECT,SCRIPT`는 완전 제거).
  - **`<style>` 태그는 기본적으로 통째로 제거된다** — `styleScope` 옵션을 넘길 때만(예: `NewsPage`/`SiteArticleAdminPanel`이 `.news-article-body`로 넘김) 살아남고, 그마저도 선택자가 스코프 안으로 재작성됨. **PopupLayer 자체는 styleScope를 안 넘기므로 팝업 안에서 `<style>` 블록으로 CSS를 쓸 수 없다 — 반드시 인라인 `style=""` 속성만 사용할 것.**
  - 인라인 style 허용 속성(`SAFE_STYLE_PROPERTIES`)엔 `position`이 없고, `url(...)`/`expression(...)`/`javascript:`/`@import`/`position:`이 들어간 선언은 통째로 버려진다. **SVG 태그도 허용 목록에 없음** — 팝업 안에 SVG 아이콘/다이어그램을 못 넣는다(대신 이모지나 유니코드 기호, 또는 이미 있는 이미지 URL을 `<img>`로 사용).
  - `<img src>`는 `https://` 또는 `/`로 시작해야 함(`data:`/`javascript:` 차단). `<a href>`는 `http(s):/mailto:/tel:/#//` 만 허용, `target=_blank`면 강제로 `rel="noopener noreferrer"`.
- `services/popupService.js`: `getActivePopupDocuments`(RPC `get_active_popup_documents`), `getPopupAdminCatalog`(`get_popup_admin_catalog`), `savePopupDocument`(`manage_popup_document`), `deletePopupDocument`(`delete_popup_document`).
- `pages/internal/PopupAdminPage.jsx`의 `TARGETS`: `groupware_all`(로그인 후 전체), `groupware_dashboard`, `groupware_boards`, `groupware_approval`, `groupware_admin`, `public_all`(비로그인 전체), `public_home`, `public_privacy`. `size`는 `small|medium|large|full`, `starts_at`/`ends_at` 예약, `is_active`/`archived`(보관, 하드 삭제와 별개).
- **테이블 `popup_documents`**(`202608050002_popup_documents.sql` + 이후 확장): `id, title(1-120자), content_mode(editor|html), content_html(1-200000자), targets text[](8개 값의 부분집합, cardinality>0), size(small/medium/large/full), starts_at, ends_at(ends_at>starts_at), sort_order, is_active, archived_at, created_by/updated_by`. **RLS로 테이블 직접 접근 완전 차단, 전부 RPC 경유**:
  - `get_active_popup_documents(p_target)`: `groupware_%` target은 `is_approved_member()` 필요(아니면 그냥 빈 배열), `_all` 우산값 매칭 지원. anon+authenticated 허용.
  - `get_popup_admin_catalog()`/`manage_popup_document(jsonb)`/`delete_popup_document(uuid)`: `is_membership_admin()` 필요. `manage_popup_document`는 클라이언트 소독과 별개로 서버에서도 정규식 기반 위험 태그/속성 재검사를 하고, 저장할 때마다 `audit_logs`에 `popup.created/updated`(content_html은 로그에서 제외) 기록.

## 관리자 화면 (`pages/internal/AdminPage.jsx` + `components/admin/**`)

같은 페이지 안에서 `section` 상태값으로 패널을 전환(라우트 아님): `membership|employee|organization|widgets|linkpages|quicklinks|buttonboxes|sitearticles|presence|attendance|usage`. (`boards`→`/admin/boards`, `approval`→`/approval/admin`, `popups`→`/admin/popups`는 실제 라우트 링크이며 각각 board/approval 스킬 참고.)

| 패널 | 관리 대상|
|---|---|
| `MembershipApprovalPanel` | 가입 승인 대기자 목록, 최종 부서/직급/직책/역할/입사일/사번 지정 후 승인·반려 |
| `OrganizationManagementPanel` | 부서/직급/직책 카탈로그 CRUD |
| `EmployeeProfilePanel` | 관리자용 공식 직원 정보 편집(이름/사번/회사이메일/부서/직급/직책/입사일/재직상태/역할) — 본인 셀프서비스 편집(`MyProfilePage`)과는 다른 필드 |
| `SystemUsagePanel` | 사용량 스냅샷 + 첨부파일 정리(`runAttachmentCleanup`) 실행 |
| `PresenceAdminPanel` | 회원별 로그인 이력/요약 |
| `AttendanceAdminPanel` | 회원별 출퇴근 기록(로그인 요약과 교차 대조, 기본 31일) |
| `SiteArticleAdminPanel` | **공개 홈페이지의 "소식/정보" 글 작성/수정**(jeakyung_site_front가 다루는 콘텐츠를 실제로 편집하는 곳이 여기) |
| `PageSectionEditor` | 링크페이지 콘텐츠 항목(`html/richtext/buttons`) 에디터 |
| `LinkPageAdminPanel` | "업무 페이지"(링크트리) CRUD |
| `QuickLinkAdminPanel` / `ButtonBoxAdminPanel` / `DashboardWidgetPanel` | 위 §레이아웃/대시보드 참고 |

**서버 측 권한 게이팅 관용구** (`202607300001_groupware_auth_membership.sql`, `202607310006_multi_roles_and_employee_profiles.sql`): `is_approved_member()` = `auth.uid()` 있고 `profiles.membership_status='approved'`이며 `employment_status<>'resigned'`. `is_membership_admin()` = `is_approved_member() AND (has_role('admin') OR has_role('super_admin'))`. **거의 모든 관리자 RPC가 함수 맨 앞에서 `is_membership_admin()`을 체크**하고, 읽기 RPC는 `is_approved_member()`를 체크한다 — 새 RPC를 추가할 때 이 패턴을 그대로 따를 것.

## 그 외 기능 (한 줄 요약)

- **프로필**: `ProfileCard`/`ProfileAvatar`/`UserAccountMenu`/`OnlinePeek`(접속중 위젯)/`AttendancePunch`(서버 타임스탬프 출퇴근 버튼)/`MyProfilePage`(셀프서비스, 공식 HR 필드는 편집 불가).
- **조직도**(`OrganizationPage.jsx`): 아직 `PageScaffold` 플레이스홀더("다음 Phase 구현 예정") — 서비스 함수(`organizationService.js`)는 이미 있지만 화면은 미완성.
- **캘린더**(`CalendarPage.jsx`): 마찬가지로 `PageScaffold` 플레이스홀더, 미구현.
- **근태**(`AttendancePage.jsx`): 본인 6개월 이력 열람(서버가 본인 기록만 강제), `attendanceService.js`(`getMyAttendance/getTodayAttendance/punchIn/punchOut`, 시각은 항상 서버 스탬프).
- **명함**(`BusinessCardPage.jsx`): 첫 버전.
- **파일**(`FilesPage.jsx`): 회사 구글드라이브 공유폴더를 `embeddedfolderview` 임베드 URL로(원본 드라이브 URL은 X-Frame-Options로 막힘).
- **링크트리**(`LinkTreePage.jsx`): 관리자 설정 "업무 페이지"(`linkPageService.js`, 마이그레이션 `202608230001_link_pages.sql`).
- **검색**(`SearchPage.jsx`): 게시판 글 검색(`boardService.searchBoardPosts`), 상단바 `TopSearch`에서 진입.
- **접속현황**(`presenceService.js`): 하트비트 기반(리얼타임 소켓 아님) "누가 접속중"; `AuthContext`가 주기 호출.
- **외부 뷰**(`ExternalViewPage.jsx`/`EmbeddedSite.jsx`): 라우트에 실제 URL을 안 실은 iframe 래퍼(`/view/:viewKey`, `/view/link/:linkId` — id/key만 노출해 URL 조작 방지), 4초 타임아웃으로 iframe이 조용히 차단됐는지(X-Frame-Options 등) 감지해 새 탭 폴백 제시.

## Supabase 프로젝트

`vzswlvumcdxnryrfwkkl`(`source/.env`의 `VITE_SUPABASE_URL`). `config.toml` 없음 — `source/supabase/migrations/*.sql`을 날짜순으로 원격 프로젝트에 직접 적용.
