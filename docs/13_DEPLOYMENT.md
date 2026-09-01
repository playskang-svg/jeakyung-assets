# 13. 배포 및 운영 (Vercel)

이 저장소(`playskang-svg/jeakyung-assets`)는 **빌드 완료된 정적 산출물**을 담고 있다.
별도의 빌드 단계 없이 저장소 루트가 그대로 서빙되며, Vercel Git 연동으로 자동 배포된다.

## 13.1 배포 대상

| 항목 | 값 |
| --- | --- |
| Vercel 팀 | `playskang-6383s-projects` (`team_EEaHa7nJq0hm29jtOEDAioQ4`) |
| Vercel 프로젝트 | `jeakyung-assets` (`prj_UL3afJMXg2TFTx2CQ94UNlnEX4Ej`) |
| 연결 저장소 | `playskang-svg/jeakyung-assets` (GitHub) |
| 프로덕션 브랜치 | `main` |
| 프로덕션 URL | https://jeakyung-assets-playskang-6383s-projects.vercel.app |
| 대시보드 | https://vercel.com/playskang-6383s-projects/jeakyung-assets |
| 프레임워크 프리셋 | 사용 안 함 — `vercel.json`이 빌드 없이 저장소 루트를 서빙하도록 지정한다 |

### 저장소·프로젝트 이전 이력

- 과거 배포는 `jeakyungdrive01-art/jeakyung-assets`(브랜치 `groupware/approval`)에서
  `jeakyung-preview` 프로젝트로 이루어졌고, 그 Git 연결은 끊어진 상태다.
- 운영 저장소를 `playskang-svg/jeakyung-assets`로 옮기면서 **`jeakyung-assets` 프로젝트를 신설**해
  Git 연동을 다시 구성했다. Vercel API로는 기존 프로젝트에 저장소를 다시 붙일 수 없어
  `jeakyung-preview`를 재사용하지 않았다.
- `jeakyung-preview`는 더 이상 사용하지 않는다. 과거 배포 이력을 보관할 필요가 없으면
  대시보드에서 삭제한다.

## 13.2 자동 배포 규칙

- `main`에 push → **프로덕션 배포**가 자동 생성된다.
- 그 외 브랜치에 push → **프리뷰 배포**가 자동 생성되고, PR에 프리뷰 URL이 코멘트로 붙는다.
- 저장소에 소스가 아닌 빌드 산출물이 커밋되므로, 화면을 바꾸려면
  **원본 프로젝트에서 빌드한 결과물을 이 저장소에 반영**한 뒤 push 한다.
  (`/assets/*.js`, `/assets/*.css` 파일명은 해시가 포함되어 매 빌드마다 바뀐다.)

## 13.3 `vercel.json` 설정 요약

- **출력 디렉터리 고정**: `outputDirectory: "."`
  - Vercel 제로컨피그는 저장소에 `public/` 폴더가 있으면 그것을 출력 디렉터리로 간주한다.
    그대로 두면 루트를 포함한 모든 경로가 404가 되므로 반드시 루트로 고정해야 한다.
  - `framework`, `buildCommand`, `installCommand`는 `null` — 빌드 단계 없음.
- **SPA 리라이트**: `/groupware`, `/groupware/**` → `/groupware/index.html`
  - 그룹웨어는 React Router(history 모드) 기반이므로 `/groupware/login` 같은 경로로
    직접 접속하거나 새로고침해도 URL이 유지된 채 앱이 부팅된다.
  - GitHub Pages용 `404.html` 우회 스크립트는 Pages 호환을 위해 그대로 두지만,
    Vercel에서는 리라이트가 먼저 매칭되므로 동작하지 않는다.
- **옛 서브도메인 리다이렉트**: `groupware.jeakyung.com/**` → `https://jeakyung.com/**`
  - 그룹웨어가 예전에 쓰던 주소다. 직원 북마크가 남아 있어 죽이지 않고 넘겨준다.
  - 루트(`/`)만 따로 `/groupware/`로 보낸다. 옛 주소의 루트는 그룹웨어 첫 화면이었으므로
    공개 사이트 홈이 아니라 그룹웨어로 가야 한다. 규칙 순서가 그래서 중요하다.
  - `has: host` 조건이 붙어 있어 `jeakyung.com`으로 들어온 요청에는 매칭되지 않는다.
  - 307(임시)이다. 옛 주소를 정리할 때 되돌릴 수 있게 두었고, 굳히려면 `permanent: true`로 바꾼다.
  - 이 규칙은 `groupware.jeakyung.com`이 **이 프로젝트에 도메인으로 붙어 있어야** 동작한다.
    (2026-09-01에 `jeakyung-preview` 프로젝트에서 넘겨받았다.)
- **캐시 정책**
  - `/assets/*` : `max-age=31536000, immutable` (파일명 해시로 무효화)
  - `/public/*` : 1주 캐시 + stale-while-revalidate (이미지·영상)
  - `/css/*`, `/js/*`, `*.html` : `max-age=0, must-revalidate` (해시 없음 → 즉시 반영)
- **보안 헤더**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
- **검색 노출 차단**: `/groupware/*`에 `X-Robots-Tag: noindex, nofollow`
- `.vercelignore`로 `WEBSITE_SPEC.md`, `docs/`, `CNAME`은 배포 산출물에서 제외한다.

## 13.4 도메인 전환 (GitHub Pages → Vercel, DNS는 Cloudflare)

`jeakyung.com`의 DNS는 **Cloudflare**에서 관리한다.
2026-08-23에 GitHub Pages → Vercel 전환을 완료했으며, apex는 `www`로 308 리다이렉트된다.
아래는 당시 수행한 절차이자 재현·롤백 기준이다.

### 13.4.1 사전 조건

- `main`에 `vercel.json`이 반영되어 있고 프로덕션 배포가 정상이어야 한다.
  (도메인을 먼저 붙이면 404를 가리키게 된다.)
- Vercel 팀이 **Hobby 플랜**이면 상업적 용도 약관 확인이 필요하다. 필요 시 Pro로 전환한다.

### 13.4.2 Vercel에 도메인 추가

1. Vercel → `jeakyung-assets` → Settings → Domains
2. `jeakyung.com` 추가 → `www.jeakyung.com`의 리다이렉트 구성 여부를 함께 선택
3. Vercel이 화면에 표시하는 **필요 DNS 레코드 값을 그대로 사용한다.**
   (apex는 A 레코드, `www`는 CNAME. CNAME 대상은 계정·시점에 따라
   `cname.vercel-dns.com` 또는 `cname.vercel-dns-0.com` 등으로 다르므로 화면 값을 따른다.)

### 13.4.3 Cloudflare DNS 변경

1. Cloudflare → `jeakyung.com` → DNS → Records
2. **기존 GitHub Pages 레코드를 제거**한다.
   - apex `@` A 레코드: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - apex `@` AAAA 레코드: `2606:50c0:8000::153` ~ `2606:50c0:8003::153`
   - `www` CNAME: `<GitHub 사용자>.github.io`
3. Vercel이 안내한 레코드를 추가한다.
4. 실제 적용된 apex 레코드는 A가 아니라 **CNAME**이었다
   (`@` → `050ebfa8358cbaec.vercel-dns-017.com`). Cloudflare가 apex CNAME을 flattening 하므로 동작한다.
   기존 A/AAAA를 지우기 전에는 `An A, AAAA, or CNAME record with that host already exists` 오류가 나므로,
   **삭제 → 추가 순서**를 지켜야 한다.
5. **Proxy status를 반드시 `DNS only`(회색 구름)로 둔다.**
   주황색 구름(프록시)이면 Vercel의 인증서 발급이 실패하거나 리다이렉트 루프가 발생한다.
   이것이 Cloudflare + Vercel 조합에서 가장 흔한 실패 원인이다.
6. TTL은 `Auto`로 둔다.

> MX·TXT(SPF/DKIM) 등 **메일 관련 레코드는 건드리지 않는다.** 웹 호스팅만 옮기는 작업이다.

### 13.4.4 전환 확인 및 마무리

1. Vercel Domains 화면이 **Valid Configuration**으로 바뀌고 SSL 인증서가 발급될 때까지 기다린다(보통 수 분).
2. `https://jeakyung.com/`, `https://jeakyung.com/privacy/`,
   `https://jeakyung.com/groupware/login`(새로고침 포함)을 확인한다.
3. 정상 확인 후에만 아래를 진행한다. (완료: `CNAME` 파일 제거)
   - 저장소 루트의 `CNAME` 파일 제거
   - GitHub 저장소 Settings → Pages에서 배포 비활성화
4. Supabase 인증 URL에 `https://jeakyung.com`을 등록한다(13.5 참고).

### 13.4.5 롤백

전환 중 문제가 생기면 Cloudflare에서 13.4.3의 GitHub Pages 레코드를 되돌린다.
`CNAME` 파일과 Pages 설정을 마지막 단계까지 그대로 두는 이유가 이것이다.

## 13.5 Supabase 연동

- 그룹웨어는 Supabase(`https://vzswlvumcdxnryrfwkkl.supabase.co`)를 브라우저에서 직접 호출한다.
- 프로젝트 URL과 anon 키가 번들에 포함되어 있으므로 **Vercel 환경변수 설정은 필요 없다.**
- 다만 새 도메인에서 로그인·인증 리다이렉트가 동작하려면 Supabase 쪽
  **Authentication → URL Configuration**에 아래 URL을 등록해야 한다.

| 구분 | URL |
| --- | --- |
| Site URL | `https://www.jeakyung.com` (실제 콘텐츠가 서빙되는 호스트) |
| Redirect URLs | `https://www.jeakyung.com/**` |
| Redirect URLs | `https://jeakyung.com/**` (apex는 www로 308 리다이렉트되지만 함께 등록해 둔다) |
| Redirect URLs | `https://jeakyung-assets-playskang-6383s-projects.vercel.app/**` |
| Redirect URLs | `https://jeakyung-assets-*-playskang-6383s-projects.vercel.app/**` (프리뷰 배포용) |

- 비밀번호 재설정 경로는 `/groupware/reset-password/update`이므로 해당 경로가
  리다이렉트 허용 패턴에 포함되는지 확인한다.

## 13.6 운영 체크리스트

- 배포 상태·로그 확인: https://vercel.com/playskang-6383s-projects/jeakyung-assets
- 문제가 생긴 배포는 Vercel 대시보드의 **Instant Rollback**으로 직전 프로덕션으로 되돌린다.
- 배포 후 확인 경로: `https://www.jeakyung.com/`, `/privacy/`,
  `/groupware/login`(새로고침 포함), 메인 영상·이미지 로딩

### 알려진 불일치

`index.html`과 `privacy/index.html`의 `<link rel="canonical">`은 apex(`https://jeakyung.com/...`)를
가리키는데, 실제 서빙 호스트는 `www`이고 apex는 그쪽으로 308 리다이렉트된다.
Vercel Domains에서 apex를 기본 도메인으로 바꾸거나, canonical을 `www`로 맞춰 정리해야 한다.
