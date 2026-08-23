# 작업 이어받기 스냅샷 — 2026-08-15

> 이 파일은 로컬 세션에서 진행하던 작업을 다른 기기(클로드 모바일 / 웹)에서 그대로
> 이어받기 위한 인수인계다. 아래 "지금 상태"부터 읽으면 된다.

---

## 지금 상태

| 브랜치 | 커밋 | 내용 |
|--------|------|------|
| `groupware/approval` | `5db5a9e` | 소스 (React/Vite + Supabase). origin과 동일 |
| `main` | `1829fa0` | GitHub Pages 배포본. origin과 동일 |

로컬에만 남은 작업물은 없다. 모두 push 완료.

적용 완료된 마이그레이션:

- `202608150002_effective_role_is_highest_assigned` — 역할 전환 제거
- `202608150003_popup_document_size` — 팝업 크기 + 공개 사이트 타깃

---

## 이번 세션에서 끝낸 것

### 1. 최고관리자 화면 (배포됨)

- `/admin` 첫 화면을 **관리 기능 점검** 목록으로 교체. 관리 기능 8개를 한 줄씩
  2열로 배치하고 각 항목의 현재 상태(승인 대기, 미등록 기준 정보, 정리 대상)를
  함께 표시한다. 항목을 누르면 해당 패널만 아래에 펼친다.
- 전자결재 관리(`/approval/admin`)는 그동안 어디에서도 링크되지 않아 사실상
  숨어 있던 기능이었다. 점검 목록에 포함시켰다.
- 조직·사용량·전자결재·팝업 조회를 `AdminPage`에서 한 번만 수행하고 패널에
  내려준다(`services/adminOverviewService.js`). 항목 하나가 실패해도 나머지
  상태는 그대로 보여준다.
- 관리자 영역과 페이지 제목·본문 간격을 밀도 기준에 맞춰 축소.

### 2. 역할 전환 제거 (배포됨 + DB 반영됨)

권한은 **보유 역할 중 가장 높은 역할**로 고정된다. 사용자는 자신의 역할을
확인만 한다.

RLS 전반이 `has_role()` → `user_has_active_role()` → `get_user_active_role()`을
거치므로 이 함수 하나를 계산식으로 바꿔 화면과 서버 권한이 어긋나지 않게 했다.
`set_my_active_role`은 `authenticated` 실행 권한을 회수했다.

담당 문서: `docs/28_ROLE_AND_PERMISSION_MATRIX.md`

### 3. 대시보드·게시판 정리 (배포됨)

- 대시보드 위젯의 테두리·그림자·라운드를 없애고 얇은 선으로만 구분. 영문 위젯
  라벨 제거. ↑↓ 순서 이동 버튼 제거. 숨김 대신 **접기/펼치기** 글자 토글.
  이동하기 링크를 제목과 같은 줄로.
- **게시판 목록을 대시보드에 추가.** 목록이 사이드바에만 있어 드로어가 닫히는
  모바일에서는 게시판으로 들어갈 길이 없었다. (게시판 권한 문제가 아니었다 —
  4개 게시판 모두 `all/allow`로 정상)
- 게시판 머리글을 한 줄로 통합: `‹ 제목 … [분류 콤보박스] [검색] [목록 이동] [글쓰기]`.
  분류 탭 → 콤보박스, 검색은 폭 150px·높이 32px로 축소, 권한 칩 제거.

### 4. 팝업 문서 (배포됨 + DB 반영됨)

- 팝업 크기 선택(작게 480 / 보통 720 / 크게 960 / 넓게 90%).
- 노출 위치에 공개 사이트 3종(`public_all`, `public_home`, `public_privacy`) 추가.
  DB에는 원래 있었고 관리자 화면 선택지에서만 빠져 있었다.
- 공개 사이트용 익명 Supabase 클라이언트(`src/shared/supabaseAnon.js`)와 지연
  로딩 마운트(`src/shared/popup/mountPublicPopupLayer.jsx`) 추가. 마케팅 페이지
  초기 번들 크기는 그대로 두고 idle 시점에 받는다.

---

## 반드시 알아야 할 것 — 공개 사이트 구조

**배포 중인 jeakyung.com은 `src/public-site`의 React 빌드가 아니다.**
main 루트의 손으로 관리하는 `index.html` + `css/style.css` + `js/main.js`가
그대로 서비스된다. `assets/`의 `home-*.js`, `PublicHeader-*.js`는 배포본에
올라가 있지만 어떤 페이지도 불러오지 않는다.

2026-08-15 기준 main의 `index.html`과 소스 브랜치의 `index.html`은 36줄 추가 /
31줄 삭제만큼 갈라져 있다. **main에만 있는 것**: 파트너사 섹션, 카카오톡 상담
링크 10개, 그룹웨어 링크 3곳, 히어로 영상. `ca72750`, `4b8494e`가 main에서 직접
커밋되고 소스 브랜치로 돌아오지 않았기 때문이다.

### 배포 절차 (이 순서를 지킬 것)

1. `groupware/approval`에서 수정 → `npm run build` → 커밋/푸시
2. `dist/groupware`, `dist/assets` **만** main 기반 브랜치로 복사
   — `index.html`과 `privacy/index.html`은 **절대 덮어쓰지 않는다**
3. main으로 push (자동 배포)
4. 무결성 확인: `curl -s https://jeakyung.com/ | grep -c partners-list` → `1`

---

## 남은 작업

### B. 공개 사이트 — 방식 결정 대기 중

사장님 확인이 필요한 상태에서 멈춰 있다. 위 "공개 사이트 구조" 때문에
`src/public-site`를 고쳐도 라이브에 반영되지 않는다. 두 갈래:

- (가) main의 레거시 정적 파일을 직접 수정 — 위험 낮고 바로 보임
- (나) React 공개 사이트를 실제 배포로 전환 — main에만 있는 콘텐츠를 React 쪽으로
  옮기는 선행 작업 필요

요청 내용:

1. 회사위치/지도를 카카오맵으로 연결 + 지도 임베드
   — **카카오맵 JavaScript 앱키 필요.** 사장님이 "키 없음, 링크만 먼저"로 답하셨다.
     `map.kakao.com` 링크는 키 없이 되고, 임베드는 키를 받아야 한다.
   — 현재 위치 정보는 `src/public-site/components/home/LocationSection.jsx`에 있다
     (본사 광주 앰코로 35 / 평택 비전2로 79 / 여수 여수산단로 140). 지금은 Google 지도 링크.
2. 중단에 다이나믹 이미지 배경으로 입체감
3. 이미지 하단쯤에 큰 라운드 "회사 소개 더보기" 버튼
4. 버튼 클릭 → 공개 게시판(**전면회사소개**) 팝업(화면 80%), 게시물 클릭 시 팝업으로
   열림, 우측 X로 닫기
5. 이 게시판은 관리자 페이지에서 설정 가능하고 **아무 권한 없이** 열려야 한다
6. 공개 게시판은 **오직 1개**만 존재하며, 관리자가 생성하지 않아도 고정으로 있어야 한다

> 5·6은 로그인 없이 DB를 읽는 첫 경로다. 해당 게시판 하나로만 범위를 좁힌
> 익명 읽기 RLS를 새로 열어야 한다. 팝업 문서의 `get_active_popup_documents`가
> 이미 `anon`에게 열려 있으므로 그 패턴을 참고할 것.

### C. 결재 관련 (노트 기반) — 1번만 완료

출처: getupnote 공유 노트. 페이지를 가져올 때 **요약 형태로만** 들어와서 세부
문구가 유실됐을 수 있다. 진행 전 원문 확인 권장.

1. ~~팝업 문서 위치를 공개 사이트 홈도 선택 가능 + 게시 기간 + 크기~~ → **완료**
2. **결재 알림** — 알림 팝업 크기 축소, 항목별 삭제(휴지통 아이콘), 관리자는
   전체 사용자 결재 조회
3. **기안 양식 재설계** — 목적·예상비용·희망처리일 제거, 상세 내용 작성에 집중.
   순서: 결재양식 → 결재선 지정 → 제목 → 내용 → 등록
4. **결재선 구성** — 우측으로 확장되는 결재 박스, 승인/합의 구분, 이름 검색으로
   결재자 선택(이름+직책 표시), +/− 로 박스 추가·삭제, 수정 가능, 참조자 목록
5. **결재 진행** — 자기 차례일 때 승인/반려/보류 + 의견 + 자동 시각. 차례가 아니면
   비활성. 최종 완료 시 참조자 전원 알림 + 결재 이력 열람

관련 파일: `src/groupware/pages/internal/ApprovalDraftPage.jsx` (524줄),
`ApprovalDocumentPage.jsx` (208줄), `ApprovalAdminPage.jsx`,
`src/groupware/services/approvalService.js`

### 기타 발견된 버그 (별도 작업으로 분리됨)

`src/groupware/pages/internal/ApprovalRoutes.jsx:24`의
`<Navigate to="/groupware/approval">`는 basename이 이미 `/groupware`라 경로가
중복된다. 전자결재 하위 경로를 잘못 입력하면 로그인 화면으로 튕긴다.
`/approval`로 고쳐야 한다.

---

## 다른 기기에서 이어받을 때 주의

이 저장소를 클론한 새 환경에는 다음이 **없다** (모두 gitignore):

| 항목 | 영향 | 해결 |
|------|------|------|
| `.env.local` | 그룹웨어 화면이 "Supabase 연결 설정이 필요합니다"로 뜬다. 빌드는 정상 | Supabase 대시보드 → Project Settings → API에서 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 설정 |
| `supabase/.temp` (링크 정보) | `npx supabase db push --linked` 불가 | `npx supabase link --project-ref vzswlvumcdxnryrfwkkl` (DB 비밀번호 필요) |
| `node_modules` | — | `npm install` |

### 참고 명령

```bash
npm install
npm run build
npm run dev            # http://localhost:5173/groupware/login
npx supabase db query --linked "select ..."
npx supabase db push --linked
gh api repos/jeakyungdrive01-art/jeakyung-assets/pages/builds/latest
```

GitHub 계정이 두 개 로그인되어 있어 push 전에 전환이 필요할 수 있다:
`gh auth switch --user jeakyungdrive01-art`
