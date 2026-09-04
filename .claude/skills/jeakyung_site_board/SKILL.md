---
name: jeakyung_site_board
description: 재경로지스｜물류 그룹웨어 게시판("재경사이트 게시판기능", /groupware/boards/*) 작업 전용 참고 스킬 — 게시판 목록/글쓰기/상세, 리치 에디터(이미지·유튜브 임베드), 첨부파일, 세밀한 권한 룰, 관리자 게시판 빌더. 게시판이 아닌 다른 그룹웨어 화면은 jeakyung_site_groupware, 전자결재는 jeakyung_site_approval 스킬을 쓸 것.
---

# 재경사이트 — 게시판(Board)

부모 스킬 `jeakyung_site`(전역 규칙)와 `jeakyung_site_groupware`(인증/권한 게이팅 관용구, 팝업과의 차이점)를 먼저 참고.

## 페이지 & 라우팅

`source/src/groupware/pages/internal/`:
- `BoardsPage.jsx` — 게시판 디렉터리. `getVisibleBoards()`로 한 번 불러와 `board.group_name`으로 그룹핑, `getBoardType()` 라벨 표시.
- `BoardPage.jsx` — 한 게시판의 글 목록. **`boardSlug`/`onOpenPost` props로 임베드 가능**(라우트 없이 다른 화면 안에 그대로 넣을 수 있음 — 링크페이지 팝업 등에서 이 방식 사용). 쿼리파라미터 `q`(검색)/`category`/`page`/`scope`(`all/title/author`). `board_type`에 따라 표/갤러리(썸네일 그리드)/디스커션(댓글수 우선, activity 정렬) 3가지 레이아웃 중 하나로 렌더.
- `PostDetailPage.jsx` — 글 상세(마찬가지로 임베드 가능). 댓글 CRUD(1단계 대댓글만), 첨부파일 업로드/다운로드/삭제, 글 삭제(`can_delete`는 서버 계산), 편집 링크(`can_edit`).
- `PostWritePage.jsx` — 글쓰기/수정. 마운트 시 postId 없으면 `createBoardPostDraft(boardId)`로 초안 글 id를 먼저 받아둠(첨부/인라인이미지가 postId를 필요로 함). `submit(status)`에서 `saveBoardPost(...)`, `status: 'published'|'draft'`.
- `BoardAdminPage.jsx` — 조직 디렉터리 로드 후 `BoardBuilderPanel`에 넘기는 얇은 래퍼.
- 라우터(`groupware/App.jsx`): `boards`→BoardsPage, `boards/:boardSlug`→BoardPage, `boards/:boardSlug/posts/:postId`→PostDetailPage, `.../edit`·`boards/:boardSlug/write`→lazy `PostWritePage`, `admin/boards`(AdminRoute 안)→lazy `BoardAdminPage`.

## 서비스 레이어 — `services/boardService.js`

| 함수 | RPC/대상 |
|---|---|
| `getVisibleBoards()` | `get_my_visible_boards` |
| `getRecentBoardPosts(limit=5)` | `get_my_recent_board_posts`(대시보드 피드) |
| `searchBoardPosts(query, limit=30)` | `search_board_posts`(전체 게시판 검색) |
| `getBoardOverview(slug)` | `get_board_overview`(메타+카테고리+`permissions`) |
| `getBoardPosts(slug, {search,category,page,scope})` | `get_board_posts` |
| `getAlbumHighlights(slug, limit=12)` | `get_album_highlights`(대시보드 앨범 스트립, 권한 오류는 조용히 `[]`) |
| `getBoardPost(postId)` | `get_board_post`(조회수 증가) |
| `createBoardPostDraft(boardId)` | `create_board_post_draft` |
| `saveBoardPost(post)` | `save_board_post` |
| `deleteBoardPost(postId)` | `delete_board_post`(소프트 삭제) |
| `saveBoardComment(comment)` / `deleteBoardComment(id)` | `save_board_comment` / `delete_board_comment` |
| `getBoardAdminCatalog()` / `saveBoardDefinition(...)` / `saveBoardGroup(...)` / `previewBoardPermissions(...)` / `deleteOrArchiveBoard(...)` | 관리자용, 아래 §관리자 참고 |
| `toggleBoardReaction(postId, type='like')` / `getBoardReactions(postId)` | 반응(좋아요 등) — **주의: 세션 초반에 "모든 게시판에서 반응 버튼 제거" 결정이 있었으므로, 화면에 다시 노출시키기 전에 그 결정이 아직 유효한지 확인할 것** |
| `uploadBoardAttachment({boardId,postId,file,userId,maxSizeMb})` | Storage `groupware-board-attachments/{boardId}/{userId}/general/{postId}/{uuid}-{name}` 업로드 + `register_board_attachment`, 실패 시 스토리지 롤백. `.exe/.dll/.bat/.cmd/.com/.scr/.msi/.js/.jar/.sh/.ps1` 확장자 차단 |
| `uploadInlineBoardImage(...)` | **Edge Function** `board-image-upload` 경유(직접 스토리지 업로드 아님 — 서버측 리사이즈/검증) |
| `getAttachmentViewUrl(id)` / `downloadAttachment(id)` | `get_board_attachment_path` RPC + 60초 서명 URL(다운로드는 blob 강제 다운로드로 한글 파일명 Content-Disposition 깨짐 우회) |
| `getInlineAttachmentUrls(attachments)` | 인라인 이미지 서명 URL 일괄 해석(`Promise.allSettled`) |
| `describeUploadError(code)` | Postgres/RLS 에러 코드 → 한글 메시지 매핑(`attachment_upload_denied` 등) |

`notifyBoardCatalogChanged()`/`BOARD_CATALOG_CHANGED_EVENT` — 관리자 편집 후 사이드바/네비 갱신용 `window` CustomEvent `groupware:boards-changed`.

## 관리자 빌더 — `components/admin/BoardBuilderPanel.jsx`

게시판 하나당 관리하는 것:
1. **타입**(`config/boardTypes.js` `BOARD_TYPES`): `free`(통합, 표 목록) / `gallery`(이미지 카드 그리드, 첨부파일 없음) / `discussion`(댓글형, activity 정렬). 레거시 타입(general/notice/files/anonymous/qna/project/department/custom)은 표시만 되고 신규 선택 불가.
2. 기본 정보(이름/슬러그 `^[a-z0-9][a-z0-9-]{1,79}$`/그룹/정렬/설명), 카테고리 탭(`board_categories`).
3. **권한 매트릭스**(단순화된 읽기/쓰기/댓글 체크박스, `boardPermissions.js` 유틸)가 실제로는 세밀한 `board_permission_rules`(22개 액션)로 매핑됨. "고급 권한 설정"에서 이 22개 액션을 직접 편집 가능(대상: `all/role/department/position/job_title/user/board_manager/author`, 거부가 허용보다 우선).
4. 기능 토글(`allow_comments/allow_attachments/allow_images/allow_anonymous`), `show_in_sidebar`(사이드바 숨김일 뿐 직접 URL 접근은 안 막힘), `is_active`/`archived`.
5. 설정 그리드: `default_sort`, `page_size`, `max_file_size_mb`, `max_inline_images`, `max_total_attachment_mb` (그 외 `max_inline_image_size_mb`, `preserve_image_originals`, `use_prefix`, `use_pinned`, `department_only` 등은 `settings` jsonb에는 있지만 이 UI에 전부 노출되진 않음).
6. 게시판 관리자(`board_managers`), 게시판 그룹 관리(super_admin 전용), 권한 미리보기(특정 유저 기준 read/write/comment 시뮬레이션), 안전 삭제(사용 이력 있으면 삭제 대신 자동 보관), 복제.

## 리치 에디터 & 렌더러 — **게시판은 팝업과 다른 소독 방식을 쓴다**

**에디터** `components/editor/BoardPostEditor.jsx`(Tiptap `@tiptap/react`+`StarterKit`): 커스텀 노드 3종 —
- `InlineAttachmentImage`(업로드 이미지, attrs: alignment/size/width/flow) — 40MP 이하만, 긴 변 2560px로 캔버스 다운스케일(GIF·`preserve_image_originals` 게시판은 리사이즈 생략) 후 `uploadInlineBoardImage`.
- `ExternalImage`(URL 링크 이미지, 파일 저장 없음, `src`는 반드시 `https://`).
- `YouTubeEmbed`(영상 ID 11자만 저장, 재생은 `youtube-nocookie.com/embed/{id}`로 재구성 — 원본 URL을 저장하지 않음).
- `useImageResize.js` 훅으로 드래그 리사이즈(포인터 이벤트, pointerup에만 커밋, 폭 80~2560px 클램프, 방향키 리사이즈 지원).
- 툴바: bold/italic/underline/strike, H2, 인용, 목록, 정렬, 텍스트색/하이라이트색(고정 팔레트), 폰트(시스템 폰트만), 링크(http/https만), 구분선.

**렌더러** `components/editor/BoardDocumentRenderer.jsx`: **HTML 문자열이 아니라 Tiptap/ProseMirror의 JSON 트리(`content_document` 컬럼)를 그대로 재귀 순회하며 React 엘리먼트로 변환**하는 방식 — 안전성은 "알려진 노드/마크 타입만 렌더"라는 구조 자체로 확보되고, 추가로 `SAFE_HREF`/`SAFE_IMAGE_SRC` 정규식(http/https만), 하이라이트/텍스트색 hex 검증, 유튜브 ID 재검증을 함.

> **팝업(`sanitizePopupHtml`)과 혼동 금지**: 팝업은 HTML 문자열 소독기, 게시판은 JSON 스키마 화이트리스트 검증기(`validate_board_document` RPC, 서버에서 노드 타입/마크/attrs를 재귀 CTE로 검증, 문서 크기 ≤2MB, 인라인 이미지 최대 20개)다. 붙여넣기 시점에만 별도의 얕은 HTML 클리너(`utils/boardDocument.js`의 `sanitizePastedHtml`)가 한 번 더 도는데, 이건 Tiptap이 JSON으로 변환하기 전 DOM 단계 정리용이고 저장되는 건 어디까지나 JSON이다.

## Supabase 스키마

기반 마이그레이션 `202607310001_groupware_dashboards_boards.sql` + 다수 후속 확장.

- `board_groups(id,name,code UNIQUE,description,sort_order,is_system,is_active,archived_at)`
- `boards(id,group_id,name,slug UNIQUE,description,board_type,settings jsonb,sort_order,is_active,archived_at,created_by)`
- `board_categories(id,board_id,name,code,sort_order,is_active)`
- `board_permission_rules(id,board_id,action,target_type,target_id,effect(allow|deny),created_by)` — action 22종: `sidebar_view,list_read,detail_read,post_create,own_post_update,own_post_delete,other_post_update,other_post_delete,comment_create,own_comment_update,own_comment_delete,other_comment_update,other_comment_delete,attachment_view,attachment_download,attachment_upload,notice_manage,pin_manage,category_manage,permission_manage,board_setting_manage,archive_manage,board_delete`
- `board_managers(board_id,user_id,assigned_by,assigned_at)`, `board_favorites`, `board_recent_visits`
- `board_posts(id,board_id,category_id,author_user_id,title(1-240자),content text(구버전 평문 미러),content_document jsonb(기본 `{"type":"doc","content":[{"type":"paragraph"}]}`),post_prefix,is_anonymous,is_notice,is_important,is_pinned,view_count,comment_count,attachment_count,status(draft|published|hidden|deleted),published_at,edited_at,deleted_at,cover_attachment_id)`
- `board_comments(id,board_id,post_id,parent_comment_id(1단계 대댓글),author_user_id,content(1-5000자),is_anonymous,deleted_at)`
- `board_reactions(id,board_id,post_id,user_id,reaction_type(like|helpful|support))` unique(post_id,user_id,reaction_type)
- `board_post_views(post_id,user_id,viewed_on date)` — 하루 1회만 조회수 증가
- `board_attachments(id,board_id,post_id,comment_id,storage_path UNIQUE,original_name,mime_type,file_size(≤20MB),uploaded_by,purpose(inline_image|general_attachment),lifecycle_status,alt_text,caption,alignment,display_size,display_width(80-2560),image_width/height/format,cleanup_after,removed_at)`

Storage 버킷 `groupware-board-attachments`(private, 20MB, 확장자 화이트리스트). RLS: insert는 `can_access_board(folder[1]::uuid,'attachment_upload')`+업로더 폴더 일치, select는 `can_read_board_attachment_path(name)`, delete는 업로더 본인만.

**핵심 RPC**(전부 `security definer`, `authenticated`만 실행 가능):
- 권한 코어: `board_target_matches`, `evaluate_board_access(board_id,action,user_id)`, `can_access_board(board_id,action)` — **승인 회원 + (super_admin 우회 OR (allow 규칙 매치 AND deny 규칙 불매치))** 패턴. `is_approved_member()` 체크가 이 함수 안에 인라인되어 있음(별도 헬퍼 호출 아님) — 그룹웨어 코어 스킬에서 설명한 일반 패턴과 살짝 다른 위치에 있으니 주의.
- 조회: `get_my_visible_boards`, `get_board_overview`, `get_board_posts`(scope 파라미터는 후속 마이그레이션에서 추가), `get_board_post`, `get_my_recent_board_posts`, `search_board_posts`, `get_album_highlights`.
- 쓰기: `create_board_post_draft`, `save_board_post`(→`validate_board_document()`→`reconcile_board_inline_images()`로 첨부↔문서 참조 및 커버이미지 동기화), `delete_board_post`, `save_board_comment`, `delete_board_comment`, `toggle_board_favorite`, `toggle_board_reaction`.
- 첨부: `register_board_attachment`(경로 접두사·확장자·용량 검증), `get_board_attachment_path`, `delete_board_attachment`, `can_read_board_attachment_path`.
- 관리자: `manage_board(board,rules,categories,managers)`(감사 로그 기록), `get_board_admin_catalog`, `manage_board_group`, `preview_board_permissions`, `delete_or_archive_board`.
- `validate_board_document(p_document jsonb)`: `type='doc'`, ≤2MB, 재귀 CTE로 노드 타입 화이트리스트(`doc/paragraph/text/heading/bulletList/orderedList/listItem/blockquote/codeBlock/horizontalRule/hardBreak/inlineImage/externalImage/youtubeEmbed`), 인라인 이미지 최대 20개(attachmentId 중복 불가), 마크는 `bold/italic/strike/code/underline/link/highlight/textStyle`만(링크 href http/https ≤2000자, 색상은 hex만).

## 현재 실제 운영 상태 — legacy 이관 진행 중

- **예전 외부 인트라넷**은 `https://jeakyung.quv.kr/`(QUV 호스팅, 현재도 실제 운영 중, 이 저장소의 새 그룹웨어와는 별개 플랫폼). `https://jeakyung.com/22`, `https://webmail.jeakyung.com/intro.php`는 이미 404(폐기됨).
- 이 저장소의 **새 게시판 기능은 완성되어 있고, 신규 작성 글은 전부 새 게시판을 쓰도록 이미 안내됨**(`notice/index.html`). 다만 **예전 quv.kr 게시글을 새 게시판으로 옮기는 이관(백업) 작업은 여전히 진행 중**이며, 완료 전까지는 "이전 인트라넷" 버튼(quv.kr, 새 로그인 아이디 그대로 사용 가능)으로 기존 업무를 계속 처리하도록 안내되어 있다. 완료되면 그룹웨어 팝업으로 재공지 예정.
- 이관 자체를 자동화하는 코드/RPC는 저장소에 없음(수동/백업 방식 이전) — 새 기능을 만들 때 "예전 글이 자동으로 들어올 것"이라 가정하지 말 것.
