# 14. 그룹웨어 UI 작업 명세 (소스 저장소용)

이 저장소(`playskang-svg/jeakyung-assets`)는 **빌드 산출물**을 담고 있다.
소스는 `jeakyungdrive01-art/jeakyung-assets` 저장소의 **`groupware/approval` 브랜치**에 있다.
공개 저장소라 clone은 되지만 이 세션에는 그 저장소로의 **push 권한이 없다.**
그래서 소스 전체를 `source/`(`.vercelignore` 대상, 배포에 포함되지 않음) 아래
그대로 벤더링해 두고, 이후 작업은 전부 `source/`에서 하고 빌드해서 `assets/` 와
`groupware/index.html`에만 산출물을 복사하는 방식으로 진행한다.
소스 저장소 쪽에 반영하는 건 별도로 패치를 전달해 사람이 적용해야 한다.

## 14.0 처리 현황 (2026-08-23)

| 항목 | 상태 |
| --- | --- |
| 14.1 대시보드 게시판 최상단 | **완료** — 소스 수정 후 빌드 반영 |
| 14.2 세로 여백 축소 | **완료** — 소스 수정 후 빌드 반영 |
| 14.3 첨부 팝업 | 보류 (상한 20MB 유지) |
| 14.4 모바일 미디어쿼리 | **완료** — 빌드 타깃 조정으로 근본 해결 |
| 14.6 링크 페이지 (게시판 탭형) | **완료** — 마이그레이션 적용, 배포 반영 |
| 14.7 버튼 박스 (링크 페이지·대시보드 겸용) | **완료** — 마이그레이션 적용, 배포 반영 |
| 14.8 메일 화면 내장 | **막힘** — 메일 서비스 확인 필요 (14.8 참고) |

소스 변경분은 `groupware/approval` 브랜치 기준 패치로 전달했다.
**소스 저장소에 반영하는 것은 별도 작업이다** — push 권한이 없어 이 저장소의
빌드 산출물만 갱신된 상태다. 소스에 반영하지 않으면 다음 빌드 때 되돌아간다.

### 빌드 재현 방법

```
git clone https://github.com/jeakyungdrive01-art/jeakyung-assets.git
git checkout groupware/approval
npm ci && npm run build
```

산출물 중 **`dist/assets/` 와 `dist/groupware/index.html` 만** 이 저장소에 복사한다.
공개 사이트는 빌드본이 아니라 원본 `index.html` + `css/style.css` + `js/main.js` +
`public/` 을 그대로 쓰므로 건드리지 않는다. `vercel.json`, `.vercelignore`, `docs/` 도
이 저장소에만 있는 파일이라 덮어쓰면 안 된다.

### ⚠️ 빌드 시 환경변수를 반드시 넣을 것

`src/groupware/lib/supabase.js`는 빌드 타임 환경변수를 읽는다.

```js
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabase = isSupabaseConfigured ? createClient(...) : null;
```

`.env` 없이 빌드하면 **오류 없이 빌드가 성공하지만 `supabase`가 `null`이 되어
그룹웨어 전체가 동작하지 않는다.** 로그인부터 막힌다. `.env`는 `.gitignore` 대상이라
저장소를 clone 해도 딸려오지 않으므로, 빌드 전에 직접 만들어야 한다.

```
VITE_SUPABASE_URL=https://vzswlvumcdxnryrfwkkl.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable 키>
```

두 값 모두 배포된 번들에 그대로 들어 있는 공개 값이다
(`assets/supabaseAnon-*.js`에서 확인할 수 있다).

### 빌드 결과 검증 체크리스트

환경변수 누락은 빌드 로그에 아무 경고도 남기지 않으므로, 산출물을 직접 확인한다.

| 확인 항목 | 기대값 |
| --- | --- |
| `grep -o 'https://[a-z0-9]*\.supabase\.co' dist/assets/*.js` | 프로젝트 URL이 나와야 함 |
| `dist/assets/` 에 `dist-*.js` 207KB 청크 | 존재해야 함 (Supabase 청크) |
| `grep -c uploadToSignedUrl dist/assets/*.js` | 1 이상 |
| `grep -c 'width<=' dist/assets/*.css` | 0 |

환경변수가 빠지면 Supabase 코드가 트리셰이킹으로 통째로 사라져
`dist-*.js`(207KB) 청크가 없어지고 `groupware-*.js` 청크 크기도 달라진다.
이 차이가 누락을 알아채는 가장 빠른 신호다.

---

## 14.1 대시보드 게시판 섹션을 최상단으로

### 현재 구조

대시보드 페이지(`/groupware`)의 렌더 순서는 다음과 같다.

```
<article class="gw-page">
  <header class="gw-page-header">   ← h1 "대시보드" + 설명 문구
  <컴포넌트>                          ← 헤더 직후 렌더되는 별도 컴포넌트
  {오류 있을 때} <div class="gw-notice gw-notice--warning">
  <section class="gw-dashboard-widget gw-dashboard-widget--full"
           aria-labelledby="dashboard-boards-title">   ← 게시판 섹션 (현재 위치)
     <div class="gw-dashboard-widget-heading">
        <h2 id="dashboard-boards-title">게시판</h2> <Link to="/boards">이동하기</Link>
     <ul class="gw-dashboard-board-list">
  <div class="gw-dashboard-grid">   ← 관리자 배포 위젯들
  {숨긴 위젯} <section class="gw-hidden-widgets">
```

게시판 섹션은 **이미 위젯 그리드보다 위**에 있다. 요청은 이보다 더 위 —
`gw-page-header`(제목 블록)보다 앞으로 올리는 것으로 이해했으며, **확인이 필요하다.**

### grep 앵커

- `dashboard-boards-title`
- `gw-dashboard-board-list`
- `관리자가 배포한 업무 위젯을 내 표시 설정으로 확인합니다.`

### 작업

게시판 `<section>` JSX 블록을 `<header className="gw-page-header">` 앞으로 이동한다.
CSS `order`로 우회하지 말 것 — `.gw-page`는 일반 block 컨테이너라
flex/grid로 바꾸면 `.gw-page`를 쓰는 다른 화면(파일·조직도·프로필 등)에 영향이 간다.

### 확인 필요

- [ ] "맨 위"가 제목 블록보다 위가 맞는지
- [ ] 대시보드 화면이 맞는지 (전자결재 화면 번들 `ApprovalRoutes-*.js`에는 게시판 마크업이 전혀 없음)

---

## 14.2 세로 여백 축소

글자 크기는 유지하고 **padding / margin / gap만** 줄여 세로 점유를 낮춘다.

| 셀렉터 | 현재 값 | 비고 |
| --- | --- | --- |
| `.gw-approval-card` | `padding:24px` · `border-radius:20px` · `box-shadow:0 10px 28px #0b15530d` | 가장 두꺼운 박스 |
| `.gw-approval-card>h2`, `.gw-approval-card-heading h2` | `margin:0 0 18px` · `font-size:21px` | 제목 아래 여백 |
| `.gw-dashboard-widget` | `padding:10px 0 12px` | |
| `.gw-dashboard-grid` | `gap:0 24px` · `margin-top:8px` | |
| `.gw-dashboard-board-list` | `gap:6px` · `margin:8px 0 0` | |
| `.gw-dashboard-board-list a` | `padding:4px 10px` · `min-height:var(--gw-control-h-sm)` | |
| `.gw-approval-summary` | `gap:14px` | |
| `.gw-approval-summary>a` | `padding:14px 16px` · `min-height:96px` (모바일 `118px`) · `border-radius:14px` | |
| `.gw-approval-summary strong` | `font-size:34px` · `line-height:1.1` | 숫자 크기가 카드 높이를 지배 |
| `.gw-approval-facts>div`, `.gw-approval-form-data>div` | `padding:14px` · `gap:12px` | |
| `.gw-approval-lines`, `.gw-approval-assignees` | `gap:10px` | |
| `.gw-approval-table th/td` | `padding:11px 14px` | |
| `.gw-notice`, `.gw-form-status` | `padding:13px 15px` | |
| `.gw-empty-state` | `padding:24px` | |
| `.gw-page`, `.gw-approval-page` | `padding:.65rem .85rem` | 페이지 외곽 |

### 접근 방향

- 개별 수치를 흩어서 고치지 말고, 간격 토큰(예: `--gw-gap-*`, `--gw-pad-*`)을 도입해
  한곳에서 조절 가능하게 만드는 편이 이후 조정에 유리하다.
- `min-height`가 걸린 항목(`.gw-approval-summary>a`, 리스트 링크)은 padding만 줄여도
  높이가 안 줄어든다. `min-height`를 함께 낮춰야 한다.
- `.gw-approval-summary strong`의 `34px`는 카드 높이의 주요 원인이므로 축소 대상에 포함한다.

---

## 14.3 첨부파일 용량 초과 시 구글드라이브 안내 팝업

### 현재 동작

업로드 함수에 **파일당 20MB가 하드코딩**되어 있고, 초과 시 예외를 던진다.

```js
if (!t || t.size < 1 || t.size > 20971520)
  throw Error(`파일 용량은 20MB 이하만 첨부할 수 있습니다.`)
```

전자결재 첨부 UI 문구: `새 파일 추가 (최대 10개, 파일당 20MB)` / `파일 선택 (최대 10개, 파일당 20MB)`
게시글 작성(`PostWritePage`)은 별도로 본문 이미지 + 첨부 **합계** 제한(`maxTotalBytes`)을 사용하며,
값은 관리자 설정(`max_inline_image_size_mb` 등)에서 온다.

### 결정: 상한은 20MB 유지 (2026-08-23)

당초 요청은 "50MB 초과 시 팝업"이었으나, **20MB 검사가 먼저 걸러내므로 50MB 조건은
성립하지 않는다.** 논의 결과 **상한을 올리지 않고 현행 20MB를 유지**하기로 했다.
따라서 이 작업은 "20MB 초과 시, 기존 예외 메시지를 구글드라이브 안내 팝업으로 대체"가 된다.

상한 상향(50MB)은 보류한다. 나중에 올리게 되면 아래를 함께 처리해야 한다.

- `20971520` → `52428800`, UI 문구의 "파일당 20MB"도 수정
- **Supabase Storage 버킷의 file size limit.** 버킷별 상한이 따로 있어 앱만 고치면
  업로드가 스토리지 단에서 실패한다. 관련 버킷: `groupware-approval-attachments`,
  `groupware-board-attachments`
- 요금제별 업로드 상한

### 작업

- 20MB 초과 시 예외 throw 대신 **팝업(모달)** 으로 안내한다.
  문구는 짧게, 구글드라이브 링크를 포함한다.
- 적용 범위는 "첨부파일 등록하는 모든 곳" — 전자결재 첨부, 게시글 첨부 양쪽.
- 우선순위: **보류.** 나중에 진행한다.

### grep 앵커

- `20971520`
- `파일 용량은 20MB 이하만 첨부할 수 있습니다.`
- `새 파일 추가 (최대 10개, 파일당 20MB)`
- `maxTotalBytes`

### 확인 필요

- [x] 상한은 현행 20MB 유지 (50MB 상향은 보류)
- [ ] 팝업에 넣을 구글드라이브 주소. **업로드가 가능한 링크여야 한다** —
      "링크가 있는 모든 사용자: 편집자" 권한이거나 Drive 파일 요청 링크.
      보기 전용 링크면 직원이 열어도 파일을 올릴 수 없다.

---

## 14.4 모바일 레이아웃이 적용되지 않는 문제 (근본 원인)

### 증상

모바일에서 데스크톱과 동일한 화면 구성이 나오고, 좌측 내비게이션이
햄버거 드로어로 바뀌지 않는다.

### 원인

빌드된 CSS가 미디어쿼리를 **Media Queries Level 4 range 문법**으로 출력한다.

```css
@media (width<=1023px) { … }   /* assets/groupware-C9T2gLy3.css */
```

이 문법은 **Chrome/Edge 104+, Safari 16.4+, Firefox 102+** 에서만 인식된다.
그보다 낮은 브라우저는 블록 전체를 무시하므로 모바일 스타일이 하나도 적용되지 않는다.
iOS Safari 16.4는 2023년 3월 릴리스라, 그 이전 iOS 기기·구형 안드로이드 브라우저가
전부 여기에 해당한다.

대조군: 손으로 작성한 공개 사이트 CSS(`css/style.css`)는 `@media (max-width: 900px)`
형태라 정상 동작한다. **빌드를 거친 CSS만** range 문법으로 바뀌어 있다
(lightningcss가 빌드 타깃에 맞춰 축약한 결과).

영향받는 파일과 블록:

| 파일 | 블록 |
| --- | --- |
| `assets/groupware-C9T2gLy3.css` | `1023px`, `900px`, `720px`, `640px`, `600px`, `360px` |
| `assets/PopupLayer-BgWbIifg.css` | `640px` |
| `assets/mountPublicPopupLayer-*.css` | `1100px`, `900px`, `640px` |

### 햄버거 메뉴는 이미 구현되어 있다

`@media (width<=1023px)` 블록 안에 드로어 UI가 이미 존재한다. 새로 만들 필요가 없다.

- `.gw-menu-button` — 햄버거 버튼
- `.gw-sidebar` — `transform:translate(-102%)` 로 숨김, `.is-open` 에서 `translate(0)`
- `.gw-drawer-overlay`, `.gw-drawer-close`
- `body.gw-drawer-open { overflow:hidden }`

즉 **기능이 없는 게 아니라, 미디어쿼리가 인식되지 않아 발동하지 않는 것**이다.

### 임시 조치 (이 저장소에 적용됨)

`css/groupware-mq-compat.css` — 위 블록들을 선언 내용 그대로
`(max-width: …)` 문법으로 다시 선언한 자동 생성 파일.
`groupware/index.html`에서 빌드 CSS 뒤, `groupware-tighten.css` 앞에 로드한다.
최신 브라우저에서는 같은 선언이 한 번 더 적용될 뿐 결과가 바뀌지 않는다.

### 근본 수정 (소스 저장소)

빌드 타깃을 낮춰 lightningcss가 range 문법을 쓰지 않게 한다.

- `package.json`의 `browserslist`, 또는 `vite.config`의 `build.target` /
  `css.lightningcss.targets` 를 조정한다.
- 기준 예: `safari >= 15`, `ios_saf >= 15` 를 포함하면 range 문법이 억제된다.
- 수정 후 빌드 산출물에 `width<=` 문자열이 없는지 확인한다:
  `grep -r 'width<=' dist/`
- 근본 수정이 반영되면 `css/groupware-mq-compat.css` 와 그 링크는 제거한다.

---

## 14.5 소스 저장소 접근

- 이 세션에 연결된 GitHub 계정은 `playskang-svg`이며, 해당 계정의 저장소 목록에는
  그룹웨어 소스 저장소가 없다.
- 소스는 `jeakyungdrive01-art/jeakyung-assets`(브랜치 `groupware/approval`)에 있고
  **공개 저장소라 clone은 된다.** 다만 push 권한은 없다.
- 그래서 `source/`(`.vercelignore` 대상)에 그 소스를 통째로 벤더링해 두고, 이후
  작업은 여기서 하고 빌드 산출물만 이 저장소에 반영한다. `source/` 쪽 변경분을
  실제 소스 저장소에 올리려면 패치 파일을 전달받아 사람이 적용해야 한다.
- `push` 권한 자체가 필요해지면(예: 소스 저장소에 직접 커밋해야 하는 경우)
  그 저장소를 소유한 계정으로 세션을 시작하거나, `playskang-svg`의 Claude
  GitHub 연동에 그 저장소 접근 권한을 부여해야 한다.

---

## 14.6 링크 페이지 (게시판 탭형) — 완료

`link_pages` / `link_page_items` 테이블 + `get_my_link_pages` / `get_link_page` /
`admin_get_link_pages` / `manage_link_page` / `delete_link_page` RPC. `/pages/:slug`에서
제목 아래 탭 버튼 줄을 두고, 버튼마다 게시판(분류 포함)을 연결한다. 관리자 화면의
"링크 페이지" 패널에서 구성한다. 마이그레이션(`202608230001_link_pages.sql`)을
운영 DB에 적용 완료.

---

## 14.7 버튼 박스 — 완료

제목과 URL만으로 이루어진 재사용 가능한 큰 버튼 묶음. 링크 페이지 본문과
대시보드 위젯 양쪽에서 그대로 골라 쓸 수 있다.

- `button_boxes` / `button_box_items` 테이블 + `get_button_box` /
  `admin_get_button_boxes` / `manage_button_box` / `delete_button_box` RPC.
  마이그레이션 `202608231000_button_boxes.sql`, 운영 DB 적용 완료.
- 디자인 3종: `cards`(번호 배지 + 알약 버튼, 화면 캡처로 요청받은 모양),
  `tiles`(제목만 있는 큰 상자), `list`(좁은 폭에 어울리는 한 줄씩).
- 항목 주소가 `/`로 시작하면 앱 안에서 이동(`Link`), 아니면 외부 주소로 보아
  새 탭으로 연다 (`ButtonBoxGrid.jsx`).
- **링크 페이지에 붙이기**: `link_pages.button_box_id` 컬럼 추가. 관리자 화면에서
  "하위 게시판 탭" / "버튼 박스" 중 하나를 고른다. 버튼 박스를 고르면 기존
  탭+게시판 임베드 대신 이 버튼 박스가 본문에 그대로 렌더링된다
  (`LinkTreePage.jsx`).
- **대시보드에 붙이기**: 기존 `dashboard_widgets.widget_type` 체크 제약에
  `'button_box'`를 추가하고, `configuration.button_box_id`로 참조한다. 이
  위젯 유형은 이미 존재하던 범용 위젯 프레임(대상 배포 규칙, 크기, 순서 등)을
  그대로 쓴다 — 새 테이블을 따로 만들지 않았다. `DashboardPage.jsx`는 위젯
  목록에 없는 상세 데이터(제목·스타일·항목)를 `get_button_box`로 별도 조회한다.
- 관리자 화면 "버튼 박스" 패널(`ButtonBoxAdminPanel.jsx`)에서 박스를 만들고,
  링크 페이지·대시보드 위젯 양쪽의 관리 화면에서 드롭다운으로 골라 쓴다.

---

## 14.8 메일 화면 내장 — 보류, 새 탭 유지로 결정 (2026-08-29)

요청: 사이드바 "이메일" 메뉴(`https://mail.jeakyung.com`, 새 탭)를 새 탭이 아니라
그룹웨어 상단바 고정 틀 안에 iframe으로 띄워 일체감 있게 만든다.

**결정: 당장은 현행(새 탭 링크) 유지.** IMAP 기반 자체 메일 클라이언트를 새로
만드는 방안(아래 참고)을 검토했으나 공수가 커서(서버 컴포넌트 신설, 계정별
메일 비밀번호 보관, 발신/첨부/HTML sanitize 등) 보류하기로 했다. 재검토할
때는 아래 내용을 그대로 참고하면 된다.

**이미 예전에 확인된 차단 요인이 있다** — `AdminControlIndexPanel.jsx`의
"코드 밖에서 관리하는 설정" 목록에 다음이 이미 기록돼 있었다:

> 메일 화면 내장: 메일 서버가 x-frame-options로 iframe을 막고 있어 서버 설정
> 변경 필요

즉 `mail.jeakyung.com` 응답에 `X-Frame-Options`(또는 `Content-Security-Policy:
frame-ancestors`)가 걸려 있어, 그룹웨어 쪽 코드를 아무리 고쳐도 iframe이 뜨지
않는다. 이 세션의 네트워크 egress 프록시가 `mail.jeakyung.com`으로 나가는 요청
자체를 막고 있어(`curl`, `WebFetch` 둘 다 `EGRESS_BLOCKED`), 실제 헤더를 직접
확인하지 못했다.

### 진행하려면 확인이 필요한 것

- **`mail.jeakyung.com`이 어떤 서비스인가?**
  - Google Workspace/Gmail이면 구글이 보안상 강제 차단하는 것이라 **불가능**하다.
    대안은 iframe 포기, 또는 IMAP/Gmail API로 자체 메일 클라이언트를 새로 만드는
    (훨씬 큰) 작업뿐이다.
  - 자체 운영 웹메일(Roundcube, SOGo 등)이면 서버 설정(reverse proxy 등)에서
    `X-Frame-Options` 완화 또는 `frame-ancestors https://jeakyung.com
    https://www.jeakyung.com`을 넣으면 될 가능성이 높다. 이 경우 그 서버 접근
    권한이 있는 사람이 처리해야 한다.
  - 제3자 서비스(Zoho 등)면 서비스별로 iframe 허용 옵션이 있는지 문서를 따로
    확인해야 한다.
- 위 확인 후 실제로 embedding이 가능하다고 판단되면, 그룹웨어 쪽 작업은:
  - `config/navigation.js`의 `mail` 항목을 `external: true` 링크 대신 내부 경로
    (예: `/mail`)로 바꾸고,
  - 새 라우트(`MailPage.jsx`)를 추가해 `<iframe src="https://mail.jeakyung.com" .../>`를
    `AppShell`(상단바·사이드바가 유지되는 틀) 안에서 렌더링한다.
  - 공개 사이트 헤더(`index.html`)의 "그룹웨어 | 메일" 링크는 그룹웨어 로그인이
    선행돼야 하므로 그대로 `/groupware/login`을 가리키게 둔다(내부 라우트로
    바로 진입할 수 없음).

## 14.9 게시글 댓글 "저장이 안 되네" — 완료

신고: 게시글 상세에서 댓글을 입력하고 "등록"을 눌러도 저장이 안 되는 것처럼
보인다는 신고.

**DB로 직접 확인한 결과 저장 자체는 정상 동작했다.** `save_board_comment` RPC,
권한 함수(`can_access_board`/`evaluate_board_access`), RLS 설정 모두 문제
없었고, 실제로 신고 당시 입력했던 댓글이 `board_comments` 테이블에 정상
저장돼 있었다(같은 내용으로 3초 간격 2건 — 버튼을 두 번 누른 흔적).

**진짜 원인은 프런트엔드의 피드백 부재였다.** `submitComment`가 성공해도
성공 메시지가 전혀 없고, 새로 달린 댓글은 폼보다 **위쪽**(목록 맨 아래인
폼과 별개로 댓글 목록 안)에 추가되는데 모바일에서는 등록 버튼 근처만 보고
있으니 아무 반응이 없어 보였고, 그래서 사용자가 다시 눌러 중복 등록됐다.

수정 (`src/groupware/pages/internal/PostDetailPage.jsx`):
- 저장 중에는 버튼을 비활성화하고 "저장 중…"으로 표시해 중복 클릭(중복 등록)을
  막는다.
- 성공하면 폼 바로 아래 "댓글을 등록했습니다." / "댓글을 수정했습니다."를
  `gw-form-status`로 표시해 스크롤 없이도 바로 보이게 한다.
- 실패하면 기존처럼 경고를 띄우되, 서버가 준 실제 오류 메시지를 보여준다
  (이전에는 항상 같은 고정 문구였다).
- 신고 당시 테스트로 중복 저장된 "댓글 테스크" 2건은 DB에서 삭제 처리
  (soft delete)했다.

## 14.10 정보 및 동향 (공개 사이트 메인) — 완료

요청: ① 메인 메뉴에 "정보 및 동향"을 넣고 ② 관리자에서 그 페이지(웹문서)를
만들되 메인에 노출하고 모두 읽기만 되게 하며 ③ 히어로 이미지 아래에 썸네일과
일부 내용이 보이는 목록을 두고 누르면 팝업으로 본문이 뜨게 한다.

### 작업 중 확인된 중요한 사실 — 공개 사이트는 React 빌드가 아니다

이 저장소의 `index.html` / `privacy/index.html` / `css/style.css` / `js/main.js`는
**손으로 관리하는 정적 파일**이고, `source/`의 React 공개 사이트 빌드 결과가
아니다. 실제로 두 쪽은 이미 상당히 벌어져 있었다.

- 배포본에만 있는 것: 파트너사 섹션(웰스토리·현대그린푸드·동원식품·HL홀딩스·
  현대홈쇼핑), "카카오 상담"·"카카오톡으로 문의하기" 문구, 그룹웨어 링크
  `/groupware/login`
- source 쪽에만 있는 것: og/트위터 메타, 파비콘 링크, "빠른 상담하기" 문구,
  그룹웨어 링크 `https://groupware.jeakyung.com/groupware/login`(옛 서브도메인)
- `css/style.css`도 305줄이 다르다.

즉 **`dist/index.html`을 배포본에 덮어쓰면** 파트너사 섹션과 현재 CTA 문구가
사라지고, 그룹웨어 링크가 옛 프리뷰 주소(`jeakyung-preview-ten.vercel.app`)로
바뀌어 버린다. 그래서 공개 사이트 쪽은 **정적 파일에 직접 구현**했고,
`assets/`와 `groupware/index.html`(그룹웨어 SPA)만 빌드 산출물로 갱신했다.

React 소스(`source/`)에도 같은 기능을 넣어 두었으므로 나중에 공개 사이트를
React 빌드로 전환하더라도 기능은 그대로 따라간다. **두 곳을 함께 고쳐야 한다.**

### 데이터베이스 (`supabase/migrations/202608290001_site_articles.sql`, 적용 완료)

- `public.site_articles` 테이블: 제목·분류·요약·썸네일 주소·본문·게시일시·
  정렬·활성·보관. RLS 켜고 anon/authenticated 직접 접근은 모두 revoke.
- 익명 읽기 전용 RPC 2개 (anon 실행 허용):
  - `get_public_site_articles(p_limit)` — 카드용. 본문은 주지 않는다.
  - `get_public_site_article(p_id)` — 카드를 눌렀을 때 본문까지.
  - 둘 다 `is_active` / `archived_at is null` / `published_at <= now()` 만 반환.
- 관리자 전용 RPC 3개 (authenticated + `is_membership_admin()` 검사):
  `get_site_article_admin_catalog` / `manage_site_article` / `delete_site_article`.
  팝업 문서와 같은 기준으로 위험 태그·이벤트 핸들러를 서버에서도 막고
  `audit_logs`에 기록한다.
- 썸네일용 공개 버킷 `public-site-media`(5MB, 이미지 4종). 업로드·수정·삭제
  정책은 관리자에게만 준다. 읽기는 공개 버킷이라 로그인 없이 된다.
- 초기 안내 글 1건을 seed 해 두어 처음부터 빈 화면이 아니다.

권한은 `anon` 역할로 실제 실행해 확인했다: 목록·본문 조회는 되고,
`manage_site_article` / `delete_site_article` / 테이블 직접 조회는 모두
`insufficient_privilege`로 거부된다.

### 공개 사이트 (정적)

- `index.html`: 히어로 `</section>` 바로 뒤에 `#news` 섹션(제목 + 스켈레톤 카드
  3장)을 넣고, 데스크톱·모바일 메뉴 "재경닷컴 소개" 뒤에 "정보 및 동향" 추가.
  `privacy/index.html` 메뉴에도 같은 항목 추가.
- `js/news.js`(신규): supabase-js 없이 PostgREST RPC를 `fetch`로 직접 호출한다.
  목록을 카드로 그리고, 카드를 누르면 본문을 따로 받아 팝업으로 띄운다.
  본문은 화면에 넣기 전에 `popupHtml.js`와 같은 허용 태그 기준으로 한 번 더
  거른다. 실패하거나 글이 없으면 안내 문구만 남긴다.
- `css/style.css`: 카드·팝업 스타일 추가. 정적 페이지에는 React 쪽 `popup.css`가
  오지 않으므로 팝업 틀 스타일도 같은 값으로 함께 넣었다(한쪽을 고치면 다른
  쪽도 고쳐야 한다).

### 관리자 화면

- `SiteArticleAdminPanel.jsx`(신규): 목록·작성·수정·삭제. 제목/분류/요약/
  게시일시/정렬/활성/보관, 썸네일 업로드(또는 주소 직접 입력)와 미리보기,
  본문은 팝업 문서와 같은 일반 편집기 / HTML 편집기 전환.
- 관리자 점검 목록에 "정보 및 동향" 행 추가 → 같은 화면 아래에서 펼쳐진다.

## 14.11 정보 및 동향 전용 페이지 (/news/) — 완료

요청: 메인 메뉴를 눌렀을 때 섹션으로 스크롤되는 대신 **게시판을 포함한 페이지**로
가게 하고, **분류(카테고리)** 를 넣을 수 있게 하며, 글을 누르면 **그 화면에서**
열리고 **뒤로가기 / 목록 보기 / 닫기**로 돌아오게 한다.

### 구성

- **`/news/` 페이지 신설** (`news/index.html`). 헤더·푸터는 `privacy/` 페이지와
  같은 정적 셸을 쓴다. Vercel 설정 변경은 필요 없다 — `/privacy/`와 똑같이
  디렉터리 + `index.html`로 서빙된다.
- **메뉴 연결 변경**: 홈·개인정보처리방침 페이지의 "정보 및 동향" 메뉴가
  `#news` 앵커 대신 `news/`로 간다.
- **홈 히어로 아래 섹션은 그대로 미리보기로 유지**하고(누르면 팝업), 제목 아래에
  "전체 보기 →" 링크를 추가해 전용 페이지로 연결했다.
- **`js/news-page.js`(신규)**: 분류 탭 + 목록 + 같은 화면 본문.
  - 분류 탭은 글에 적힌 `category` 값에서 자동으로 만들어진다(전체 + 사용 중인 분류).
    스키마 변경 없이 관리자가 "분류" 칸에 적기만 하면 탭이 생긴다.
  - 글을 누르면 목록을 감추고 같은 화면에 본문을 연다. `history.pushState`로
    `?article=<id>`를 남겨 **브라우저 뒤로가기**도 목록으로 돌아온다.
    그 주소로 바로 들어오면 본문이 바로 열린다(딥링크).
  - 되돌아오는 방법 4가지: 뒤로가기 버튼 / 목록 보기 버튼(위·아래 2곳) /
    닫기(×) / Esc 및 브라우저 뒤로가기.
  - 본문은 화면에 넣기 전에 `js/news.js`와 같은 허용 태그 기준으로 거른다.

### React 소스에도 같은 페이지를 넣어 두었다

`source/news/index.html`, `src/public-site/pages/NewsPage.jsx`,
`src/public-site/entries/news.jsx`, `vite.config.js`의 `news` 입력,
`navigation.js`의 `news` 메뉴·푸터 세트. **14.10과 같은 이유로 공개 사이트는
정적 파일이 실제로 배포되므로 두 곳을 함께 고쳐야 한다.**

### 검증

정적 파일을 로컬 서버로 띄우고 Supabase 응답을 가로챈 뒤 **Chromium으로 직접
조작해 19개 항목을 확인했다**: 카드·분류 탭 렌더, 분류 필터링, 글 열기(목록 감춤·
본문 표시·제목·본문 렌더), 본문 안 `<script>` 제거, 주소·문서 제목 갱신,
목록 보기·뒤로가기·닫기 버튼, 브라우저 뒤로가기, 딥링크 진입, 홈 메뉴 링크.

## 14.12 버튼 대상 선택 + 새 탭 열기, "소식/정보" 이름 변경 — 완료

### 버튼마다 이동할 곳을 고른다

요청: "생성한 버튼을 클릭했을때 이동할 URL을 입력. 게시판이나 다른 페이지면
목록에서 선택, 외부면 URL 입력." + "버튼박스도 각 버튼별로 새 탭으로 이동."

링크 페이지 항목과 버튼 박스 항목이 **같은 대상 선택기**(`LinkTargetFields.jsx`)를
쓴다. 종류를 고르면 그에 맞는 입력만 나온다.

| 종류 | 입력 | 저장되는 주소 |
| --- | --- | --- |
| 게시판 | 게시판 목록에서 선택 | `/groupware/boards/<slug>` |
| 페이지 | 링크 페이지 목록에서 선택 | `/groupware/pages/<slug>` |
| 외부 주소 | 직접 입력 | 입력값 (http(s):// 또는 / 로 시작해야 함) |

**주소는 서버(`resolve_link_target`)가 만든다.** 화면은 `url`만 쓰면 되고,
`javascript:` 같은 위험한 값은 서버에서 걸러진다. 게시판·페이지의 slug가 바뀌어도
다음 저장 때 주소가 다시 만들어진다.

동작:
- **버튼 박스의 모든 버튼은 새 탭**으로 연다(`ButtonBoxGrid`에서 react-router
  `Link` 대신 `target="_blank"` 앵커로 통일).
- **링크 페이지**는 성격이 다르다. `게시판` 항목은 원래 목적대로 **그 페이지 안에서
  탭으로** 열리고(하위 게시판 탭 모드), `페이지`·`외부 주소` 항목만 새 탭으로 연다.
  게시판을 페이지 안에 끼워 넣는 것이 이 화면의 존재 이유라 그대로 두었다.
  이것도 새 탭으로 바꾸려면 `LinkTreePage.jsx`의 분기 한 줄만 고치면 된다.

DB (`202608300001_link_targets.sql`, `202608300002_link_targets_rpcs.sql`, 적용 완료):
- `link_page_items`에 `url`, `target_page_id` 추가. `item_type` 허용값을
  `board|page|external`로 확장하고 종류별 필수값 제약을 다시 걸었다.
- `button_box_items`에 `link_type`, `board_id`, `target_page_id` 추가
  (기존 항목은 `external`로 남는다 — 이전에 손으로 적던 주소가 그대로 동작한다).
- `resolve_link_target()` 신설, 관련 RPC 6개를 새 필드까지 다루도록 재정의.
- 기존 링크 페이지 항목은 전부 게시판형이었으므로 `url`을 채워 두었다.
- 페이지 버튼이 자기 자신을 가리키면 저장 단계에서 막는다.

### "정보 및 동향" → "소식/정보"

메뉴·페이지 제목·머리글·관리자 화면 라벨 등 **사람이 보는 문구만** 바꿨다.
주소(`/news/`), DOM id(`#news`), CSS 클래스(`news-*`), 테이블명(`site_articles`)은
그대로 두었다 — 바꾸면 기존 링크가 깨진다. DB에 있던 안내 글의 제목·본문도 함께
바꿨다.
