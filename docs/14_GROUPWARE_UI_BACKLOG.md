# 14. 그룹웨어 UI 작업 명세 (소스 저장소용)

이 저장소(`playskang-svg/jeakyung-assets`)는 **빌드 산출물만** 담고 있어 아래 작업을 수행할 수 없다.
그룹웨어 React 소스 저장소에서 작업한 뒤, 빌드 결과를 이 저장소에 반영해야 한다.

아래의 셀렉터·문자열·상수는 **현재 배포된 번들에서 직접 추출한 값**이다.
소스에서 해당 값을 grep 하면 수정 지점을 바로 찾을 수 있다.

- 추출 대상: `assets/groupware-DLYMr5bm.js`, `assets/ApprovalRoutes-CKDbVJIr.js`,
  `assets/PostWritePage-DMMx_6JY.js`, `assets/groupware-C9T2gLy3.css`
- 기준 커밋: `main` @ 2026-08-23

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

### 요청과의 충돌

요청은 "50MB 초과 시 팝업"인데, **20MB 검사가 먼저 걸러내므로 50MB 조건은 절대 성립하지 않는다.**
아래 중 하나를 정해야 한다.

- **(a) 상한을 50MB로 상향** — `20971520` → `52428800`으로 바꾸고, 초과 시 팝업.
  UI 문구의 "파일당 20MB"도 함께 수정.
- **(b) 현재 20MB 유지** — 기존 예외 메시지를 팝업으로 대체 (숫자는 20MB).

### (a)를 택할 경우 함께 확인할 것

- **Supabase Storage 버킷의 file size limit.** 버킷별 상한이 따로 있어 앱만 고치면
  업로드가 스토리지 단에서 실패한다. 관련 버킷: `groupware-approval-attachments`,
  `groupware-board-attachments`.
- 요금제별 업로드 상한.

### 작업

- 예외 throw 대신 **팝업(모달)** 으로 안내한다. 문구는 짧게, 구글드라이브 링크를 포함한다.
- 적용 범위는 "첨부파일 등록하는 모든 곳" — 전자결재 첨부, 게시글 첨부 양쪽.

### grep 앵커

- `20971520`
- `파일 용량은 20MB 이하만 첨부할 수 있습니다.`
- `새 파일 추가 (최대 10개, 파일당 20MB)`
- `maxTotalBytes`

### 확인 필요

- [ ] (a) 상한 50MB 상향인지 (b) 현행 20MB 유지인지
- [ ] 팝업에 넣을 구글드라이브 주소 (공유 폴더 링크 / 안내 페이지)
- [ ] Supabase Storage 버킷 상한 현재값

---

## 14.4 소스 저장소 접근

- 이 세션에 연결된 GitHub 계정은 `playskang-svg`이며, 해당 계정의 저장소 목록에
  그룹웨어 소스 저장소가 없다.
- 과거 Vercel 배포 메타데이터상 소스는 `jeakyungdrive01-art/jeakyung-assets`
  (브랜치 `groupware/approval`)로 보이나, **접근 권한이 없어 확인하지 못했다.**
- 작업하려면 해당 저장소를 소유한 계정으로 세션을 시작하거나,
  `playskang-svg`의 Claude GitHub 연동에 그 저장소 접근 권한을 부여해야 한다.
