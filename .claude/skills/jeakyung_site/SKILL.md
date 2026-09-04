---
name: jeakyung_site
description: 재경로지스｜물류(jeakyung.com) 웹사이트/그룹웨어 전체 저장소(playskang-svg/jeakyung-assets)에 대한 인덱스 스킬. 이 저장소와 관련된 모든 작업 — 공개 홈페이지 수정, 그룹웨어(인트라넷) 기능 추가, 게시판/전자결재 손보기, 배포, DB 마이그레이션 등 — 을 할 때는 반드시 이 스킬을 가장 먼저 불러올 것. 사용자가 "재경사이트", "재경로지스 사이트", "jeakyung.com", "이 사이트/그룹웨어" 라고만 말해도 이 스킬이 대상이다. 더 구체적으로 "재경사이트 프론트"/"홈페이지"라면 jeakyung_site_front, "재경사이트 그룹웨어"라면 jeakyung_site_groupware, "재경사이트 게시판기능"이라면 jeakyung_site_board, "재경사이트 전자결재"라면 jeakyung_site_approval 스킬을 이어서 불러와 세부 작업을 진행한다.
---

# 재경사이트 (jeakyung-assets) — 인덱스

이 저장소는 **재경로지스｜물류**(3PL 물류회사)의 (1) 공개 마케팅 홈페이지 `jeakyung.com`과 (2) 내부 직원용 그룹웨어(인트라넷) `jeakyung.com/groupware`를 **하나의 저장소, 하나의 Vercel 배포**로 함께 서빙한다. 백엔드는 Supabase(프로젝트 ref `vzswlvumcdxnryrfwkkl`) 하나를 공유한다.

## 하위 스킬 (실제 작업은 여기로)

| 부를 때 | 스킬 | 다루는 범위 |
|---|---|---|
| "재경사이트 프론트", "재경사이트 홈페이지" | `jeakyung_site_front` | 공개 홈페이지(`/`, `/news/`, `/services/`, `/privacy/`), 마케팅 카피, 디자인, SEO |
| "재경사이트 그룹웨어" | `jeakyung_site_groupware` | 로그인/인증, 대시보드, 관리자 화면, 팝업 공지, 프로필/조직도/근태 등 그룹웨어 공통 코어 (게시판·전자결재 제외) |
| "재경사이트 게시판기능" | `jeakyung_site_board` | 그룹웨어 내 게시판(`/groupware/boards/*`) — 목록/글쓰기/에디터/첨부파일/권한 |
| "재경사이트 전자결재" | `jeakyung_site_approval` | 그룹웨어 내 전자결재(`/groupware/approval/*`) — 기안/결재선/승인·반려/도장서명 |

작업 대상이 애매하면 파일 경로로 판단한다: `source/src/public-site/**` → front, `source/src/groupware/**` (board/approval 페이지·서비스 제외) → groupware, `.../pages/internal/Board*Page.jsx`·`services/boardService.js` → board, `.../pages/internal/Approval*Page.jsx`·`services/approvalService.js` → approval.

## 저장소 전체 구조

```
/                         ← Vercel이 실제로 서빙하는 정적 루트 (outputDirectory: ".")
  index.html, news/, services/, privacy/   ← 손으로 유지하는 HTML 셸 (Vite가 빌드 후 자산만 갈아끼움)
  groupware/index.html    ← Vite가 통째로 빌드한 SPA 산출물 (build artifact, 직접 수정 금지)
  assets/                 ← 해시된 JS/CSS (배포 시 전량 교체)
  notice/, legacy/, hl-safety-eval/   ← Vite 파이프라인 밖의 손수 작성 정적 페이지 (noindex)
  vercel.json             ← rewrites(그룹웨어 SPA fallback) + headers(캐시/보안/noindex) 전부 여기
source/                   ← 실제 개발 소스 (Vite 프로젝트). .vercelignore 로 배포 대상에서 제외됨
  src/public-site/**      ← 공개 홈페이지 (jeakyung_site_front)
  src/groupware/**        ← 그룹웨어 SPA (jeakyung_site_groupware / board / approval)
  src/shared/**           ← 둘이 공유하는 코드 (팝업 시스템, site_articles, supabaseAnon)
  supabase/migrations/*.sql   ← DB 스키마 전부 (config.toml 없이 날짜순 SQL 파일 나열식 관리)
  scripts/sync-build.mjs  ← "npm run release" 시 dist/ → 저장소 루트로 반영하는 스크립트
```

**빌드→배포 흐름**: `source/`에서 `npm run build`(vite build) → `npm run sync`(`scripts/sync-build.mjs`, root 자산 교체 + 손수 HTML의 해시된 자산 참조 재기록) → git commit/push → Vercel이 루트를 그대로 정적 서빙. `source/`는 `.vercelignore`로 배포에서 제외되므로 **반드시 sync까지 실행해야 실제 사이트에 반영**된다.

## 이 프로젝트 전역에서 반드시 지킬 규칙

1. **이미 배포된 기능을 절대 깨뜨리지 않는다.** 수정 전 관련 화면을 먼저 파악하고, 변경 후 빌드·로컬 확인까지 마친다.
2. **"완성되면 배포까지 바로"** — 기능이 끝나면 빌드 확인 → 커밋 → PR → 머지 → 브랜치 동기화까지 추가 확인 없이 이어서 진행하는 것이 이 프로젝트의 기본 운영 방식이다.
3. **생성하는 스톡 사진에는 사람을 넣지 않는다** — 한국인을 명시적으로 표현해야 하는 경우가 아니면 인물 없는 이미지를 쓴다.
4. **팝업(`popup_documents`)과 게시판 본문 저장 방식은 서로 다르다** — 팝업은 HTML 문자열을 `sanitizePopupHtml()`로 소독하고(`<style>` 기본 제거, `styleScope` 줄 때만 허용), 게시판은 Tiptap의 JSON 문서(`content_document`)를 구조적으로 검증(`validate_board_document`)한다. 둘을 혼동해 재사용하지 말 것.
5. **권한 게이팅은 전 영역에서 동일한 패턴**: 읽기 계열 RPC는 `is_approved_member()`, 관리자 계열 RPC는 `is_membership_admin()`(= 승인된 회원이면서 admin/super_admin 역할)을 함수 맨 앞에서 체크한다. 새 RPC를 추가할 때도 이 관례를 따른다.
6. **다크모드는 공개 홈페이지(`source/css/style.css`)에는 아직 없다** — 라이트 전용 고정 팔레트. 다크모드가 있는 곳은 Vite 파이프라인 밖의 손수 작성 페이지(`notice/index.html` 등)뿐이며, 거기엔 "패널 배경색과 제목 텍스트색에 같은 토큰(`--navy-900`)을 쓰면 다크모드에서 글자가 안 보인다"는 실제 겪은 버그가 있다 → 배경용 토큰과 `--heading` 텍스트 토큰을 분리해서 쓴다.
7. **legacy 인트라넷 병행 운영 중**: 예전 그룹웨어(`https://jeakyung.quv.kr/`)의 게시글을 새 게시판으로 옮기는 이관(백업) 작업이 진행 중이며, 완료 전까지는 신규 작성 글만 새 게시판에 쓰고 기존 업무는 "이전 인트라넷" 버튼(quv.kr)으로 계속 처리하도록 안내되어 있다(`notice/index.html` 참고). 전자결재는 legacy에 대응 기능이 없어 이관 대상이 아니며 이미 정식 기능으로 취급된다.
8. **최신 실제 진행 상태의 출처**: 저장소 루트/`source/`의 `WEBSITE_SPEC.md`와 `source/docs/00_INDEX.md`는 초기 기획 단계 문구(예: "전자결재는 미구현")가 그대로 남아있어 **오래되어 신뢰할 수 없다**. 실제 최신 현황은 `source/docs/PROJECT_MANAGEMENT/02_CURRENT_STATUS.md`를 봐야 한다.

## Supabase

- 프로젝트 ref: `vzswlvumcdxnryrfwkkl` (조직 `jeakyung-dotcom`), URL은 `source/.env`의 `VITE_SUPABASE_URL`.
- `config.toml` 없이 `source/supabase/migrations/*.sql`을 날짜순으로 직접 원격 프로젝트에 적용하는 방식.
- MCP `mcp__Supabase__execute_sql`로 직접 SQL 실행 시 RLS/RPC 검증을 완전히 우회하므로(풀 postgres 권한), RPC 계층이 강제하는 제약(길이 제한, targets 체크, HTML 소독 등)을 손으로 지켜가며 신중히 사용할 것.
