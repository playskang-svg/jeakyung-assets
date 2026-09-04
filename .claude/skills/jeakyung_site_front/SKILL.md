---
name: jeakyung_site_front
description: 재경로지스｜물류 공개 마케팅 홈페이지("재경사이트 프론트", "재경사이트 홈페이지", jeakyung.com의 /, /news/, /services/, /privacy/) 작업 전용 참고 스킬. 홈페이지 문구/섹션/디자인 수정, 소식·정보(뉴스) 글 추가·수정, 서비스 소개 페이지, 개인정보처리방침, SEO/robots, 다크모드 없는 스타일시트, Vite 빌드→정적 루트 동기화(sync-build) 관련 작업이면 반드시 이 스킬을 불러온다. 그룹웨어(로그인 이후 화면)는 jeakyung_site_groupware 스킬을 대신 사용할 것.
---

# 재경사이트 — 프론트(공개 홈페이지)

React 19 기반 **MPA**(클라이언트 라우팅 없음, 페이지별 Vite 엔트리가 정적 HTML 셸에 마운트). 부모 스킬 `jeakyung_site`의 배포/전역 규칙을 먼저 따른다.

## 구조

- `source/src/public-site/pages/` — `HomePage.jsx`, `NewsPage.jsx`(`/news/`), `ServicesPage.jsx`(`/services/?service=<key>`), `PrivacyPolicyPage.jsx`
- `source/src/public-site/components/home/` — 홈 섹션 1파일 1섹션: `HeroSection`(+`HeroNetwork` 캔버스 배경), `CeoGreeting`, `HistorySection`, `CompanyOverview`, `CoreValues`, `NewsSection`, `ServicesSection`, `ServiceColumns`, `AudienceSection`, `PartnersSection`, `StatementSection`, `GuideSection`, `FAQSection`, `ContactSection`, `LocationSection`
- `components/layout/` — `PublicHeader.jsx`, `PublicFooter.jsx`; `components/common/Brand.jsx`
- `data/navigation.js` — `WORK_SYSTEM_URL`, `CONSULTATION_URL`(카카오 채널), 페이지별 헤더/푸터 네비 배열
- `data/services.js` — `SERVICE_NAMES`(`3pl/fresh/transport/storage/consulting` → 한글 라벨. 이 key가 그대로 `site_articles.service_key` 값), `serviceName()`, `withObjectParticle()`(을/를 조사 처리)
- `hooks/` — `useRevealOnScroll.js`(스크롤 등장 애니메이션, `.reveal`→`.is-visible`, `prefers-reduced-motion` 존중), `useHeaderNavigation.js`(모바일 메뉴/스크롤 상태), `useSectionNavigation.js`(홈 전용, in-page 앵커 하이라이트)
- `entries/` — `home.jsx`/`news.jsx`/`services.jsx`/`privacy.jsx`: 각각 `createRoot`+`flushSync`로 `#header`/`#main-content`/`.site-footer`에 마운트하고, `mountPublicPopupLayer(target)` 호출(§팝업 참고)

## HomePage 섹션 순서

`HeroSection(#top)` → intro(`#about`: CeoGreeting→HistorySection→CompanyOverview→CoreValues) → `NewsSection(#news)` → `ServicesSection(#services)` → `AudienceSection(#audience)` → `PartnersSection(#partners)` → `StatementSection` → `GuideSection(#guide)` → `FAQSection(#faq)` → `ContactSection(#contact)` → `LocationSection(#location)`.

- **PartnersSection**: `PARTNER_COMPANIES` 배열(웰스토리, 현대그린푸드, 동원식품, HL홀딩스, 현대홈쇼핑)을 `.partners-list` 그리드 카드로 렌더링. **로고 이미지 없음 — 의도적**("실제 로고 파일이 오기 전까지는 텍스트 블록 카드가 정확하다"는 이유. 로고를 넣어야 한다면 각사 실제 로고 파일을 받아서 넣을 것, 임의 대체 이미지 금지). hover 시 `--navy-800` 배경+흰 글자로 전체 반전.
  - CSS: `.partners-list { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); }`
- **ServiceColumns.jsx**(서비스 카드 안의 이미지 스트립): `mode="paged"`(현재 전부 이 모드)와 `mode="flow"`(연속 자동 스크롤, 미사용) 두 모드. paged는 이전/다음 버튼이 스크롤 끝에서 자동 비활성화. **마운트 700ms 후 "살짝 밀었다 되돌리기" 넛지 애니메이션**으로 좌우로 넘길 수 있음을 암시(콘텐츠가 실제로 넘칠 때만, `prefers-reduced-motion` 아닐 때만 실행). `scroll-snap-type: x proximity`가 작은 `scrollTo()` 호출을 무시해버리는 브라우저 버그가 있어 넛지 도중에는 `scrollSnapType='none'`으로 껐다가 되돌린다 — 스크롤 관련 애니메이션을 이 컴포넌트에 추가할 때 반드시 참고.
  - `getPublicServiceArticles(client, serviceKey, 12)`로 `site_articles`(`service_key` 있는 것만) 조회, 이미지 전용 타일(제목은 alt/aria-label에만).

## 스타일 — `source/css/style.css` (4000+줄, Vite 미가공 원본 그대로 링크)

디자인 토큰(`:root`):
```css
--navy-950:#050a2b; --navy-900:#071044; --navy-800:#0b1560;
--blue-600:#1a46ff; --blue-500:#315cff; --blue-100:#e8edff;
--ink-950:#10121a; --ink-700:#3c404b; --ink-500:#6a707c;
--line:#dfe3eb; --surface:#f5f7fb; --white:#fff;
--content-width:1400px; --page-gutter:clamp(20px,4vw,64px);
--section-space:clamp(96px,10vw,168px);
--radius-sm:12px; --radius-md:24px; --radius-lg:36px;
```
- **다크모드 없음** — `prefers-color-scheme` 쿼리가 아예 없는 라이트 전용 고정 팔레트. (다크모드는 `notice/index.html` 등 Vite 밖의 손수 작성 페이지에만 있으며, 거기서 "배경용 토큰과 텍스트용 토큰을 겸용하면 다크모드에서 안 보인다"는 버그를 `--heading` 토큰 분리로 고쳤다 — 이 사이트 본 CSS에 다크모드를 넣게 되면 그 패턴을 참고할 것.)
- 공통 유틸리티: `.content-width`, `.section`, `.eyebrow`/`.eyebrow-light`, `.reveal`/`.is-visible`.

## 콘텐츠 데이터 흐름 — `site_articles`("소식/정보")

- 테이블 `public.site_articles`: `id, title, category, summary, thumbnail_url, content_mode(editor|html), content_html, author, service_key(nullable, ^[a-z0-9_-]{1,40}$), published_at, sort_order, is_active, archived_at, created_by/updated_by`. RLS로 테이블 직접 접근 전부 차단, **RPC로만** 접근.
- 공개 RPC(anon+authenticated): `get_public_site_articles(p_limit=12)`(service_key **없는** 것만, 뉴스/홈 피드), `get_public_service_articles(p_service_key, p_limit=12)`, `get_public_site_article(p_id)`(단건, content_html 포함). 모두 `is_active AND archived_at IS NULL AND published_at<=now()` 조건.
- 관리자 RPC(`is_membership_admin()` 게이팅): `get_site_article_admin_catalog()`, `manage_site_article(jsonb)`(HTML 소독 정규식 내장), `delete_site_article(uuid)`.
- 클라이언트 래퍼: `source/src/shared/siteArticles/siteArticleService.js` (`getPublicSiteArticles`, `getPublicServiceArticles`, `getPublicSiteArticle`).
- 소비처: `NewsSection.jsx`(홈, 최근 9개, 모달 상세), `NewsPage.jsx`(`/news/`, 카테고리 탭+전체 목록+`?article=<id>` 인페이지 상세), `ServiceColumns.jsx`(서비스 카드 이미지 스트립), `ServicesPage.jsx`(`/services/?service=<key>`, 단일 서비스 목록/상세).
- **글 작성/수정은 그룹웨어 관리자 화면**(`SiteArticleAdminPanel.jsx`, jeakyung_site_groupware 스킬 참고)에서 한다 — 이 저장소 안에 별도 CMS는 없음.

## 팝업 시스템 (공개 사이트에서는 읽기 전용)

공유 코드 `source/src/shared/popup/**`(자세한 소독 규칙은 `jeakyung_site_groupware` 스킬 §5 참고). 공개 사이트는 `mountPublicPopupLayer(target)`로 **anon 클라이언트**를 통해 읽기 전용으로 마운트한다:
- `home.jsx` → `public_home`
- `news.jsx` / `services.jsx` → `public_all`
- `privacy.jsx` → `public_privacy`

공개 사이트 쪽에서 팝업을 새로 추가/수정할 필요는 거의 없고, 관리자 화면(`PopupAdminPage.jsx`)에서 target을 `public_home`/`public_all`/`public_privacy` 중 골라 작성하면 그대로 반영된다.

## SEO / robots

- 루트 `robots.txt`: `Allow: /` + 사이트맵 링크. `sitemap.xml`엔 `/`와 `/privacy/`만 등재(뉴스/서비스/비공개 영역은 의도적으로 제외).
- `vercel.json` headers에서 `X-Robots-Tag: noindex, nofollow`를 `/groupware/(.*)`, `/hl-safety-eval/(.*)`, `/legacy/(.*)`, `/notice/(.*)`에 적용 — **비공개/미등재 페이지를 새로 추가하면 여기에도 규칙을 추가할 것** (실제로 `/notice/` 추가 시 이렇게 했음).

## 빌드/배포 파이프라인 (front 고유 이슈들)

- `source/vite.config.js`:
  - `build.cssTarget`을 `['chrome87','edge88','firefox78','safari14']`로 **의도적으로 낮춤** — esbuild 기본 타깃이면 CSS Level 4 media-query range 문법(`(width<=1023px)`)을 내보내는데, iOS Safari 16.4 미만은 이를 통째로 무시해서 반응형이 조용히 깨진다. 이 설정을 건드리지 말 것.
  - `rollupOptions.input`에서 서비스 페이지 엔트리 이름은 `servicesPage`(그냥 `services`가 아님) — `src/public-site/data/services.js`라는 공유 청크 이름과 충돌해서 실제로 "서비스 페이지가 빈 화면으로 나오는" 장애가 있었던 자리. 엔트리 이름을 바꾸지 말 것.
  - 커스텀 플러그인 `preserve-legacy-script`(레거시 `<script src="js/main.js">`를 모듈로 재작성), `groupware-spa-fallback`(dev/preview에서 `/groupware*` 비파일 요청을 `groupware/index.html`로 서빙).
- **`scripts/sync-build.mjs`**(`npm run sync`/`release`): `dist/assets`를 루트 `assets/`로 전량 교체, `dist/groupware/index.html`을 루트로 복사, 손수 작성 HTML(`index.html`,`news/index.html`,`services/index.html`,`privacy/index.html`)에 박힌 해시 자산 참조를 새 해시로 재기록(파일명 끝 `-<8자해시>` 스트립 후 매칭, 모호하면 `fail()`), 마지막에 모든 참조가 실제 존재하는지 무결성 검사. **front 코드를 고친 뒤엔 이 스크립트까지 실행해야 실제 사이트에 반영된다** (Vite build만으로는 안 됨).
- Vite 파이프라인 완전히 밖에 있는 손수 HTML: `/notice/index.html`, `/legacy/index.html`, `/hl-safety-eval/`(별도 미니 프로젝트, 자체 `build.mjs`/`netlify.toml`), `/404.html` — 이런 페이지는 `sync-build.mjs`의 `HAND_WRITTEN` 목록에도 없고 `vite.config.js`의 `rollupOptions.input`에도 없다. 새 정적 페이지를 추가할 땐 이 방식(파일을 루트에 직접 두고 `vercel.json` headers에 noindex 규칙만 추가)을 따르면 빌드 파이프라인 의존 없이 즉시 배포 가능.
