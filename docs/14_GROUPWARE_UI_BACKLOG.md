# 14. 그룹웨어 UI 작업 명세 (소스 저장소용)

이 저장소(`playskang-svg/jeakyung-assets`)는 **빌드 산출물만** 담고 있다.
소스는 `jeakyungdrive01-art/jeakyung-assets` 저장소의 **`groupware/approval` 브랜치**에 있다
(공개 저장소라 clone은 가능하나, push 권한은 없다).

## 14.0 처리 현황 (2026-08-23)

| 항목 | 상태 |
| --- | --- |
| 14.1 대시보드 게시판 최상단 | **완료** — 소스 수정 후 빌드 반영 |
| 14.2 세로 여백 축소 | **완료** — 소스 수정 후 빌드 반영 |
| 14.3 첨부 팝업 | 보류 (상한 20MB 유지) |
| 14.4 모바일 미디어쿼리 | **완료** — 빌드 타깃 조정으로 근본 해결 |

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

## 14.4 소스 저장소 접근

- 이 세션에 연결된 GitHub 계정은 `playskang-svg`이며, 해당 계정의 저장소 목록에
  그룹웨어 소스 저장소가 없다.
- 과거 Vercel 배포 메타데이터상 소스는 `jeakyungdrive01-art/jeakyung-assets`
  (브랜치 `groupware/approval`)로 보이나, **접근 권한이 없어 확인하지 못했다.**
- 작업하려면 해당 저장소를 소유한 계정으로 세션을 시작하거나,
  `playskang-svg`의 Claude GitHub 연동에 그 저장소 접근 권한을 부여해야 한다.
