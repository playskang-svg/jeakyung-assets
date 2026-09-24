# 13. 배포 및 운영

> **현재 운영 기준 (2026-09-24):** `jeakyung.com`과 `www.jeakyung.com`은
> `wrangler.jsonc`의 Cloudflare Worker `jeakyung`이 저장소 루트를 정적 자산
> 디렉터리(`assets.directory: "."`)로 직접 서비스한다. 운영 계정은
> `380b1bc6d94eaf5f614ceffbdd5ef479`이다. Cloudflare **Workers Builds**
> Git 연동이 `main`에 연결되어 있어, `main`에 push하면 Cloudflare가 저장소를
> 그대로 체크아웃해 `npx wrangler deploy`를 자동 실행한다 — 별도 로컬
> `wrangler deploy`나 스테이징 폴더 복제가 더 이상 필요 없다.
> 배포 확인은 GitHub PR/커밋의 **"Workers Builds: jeakyung"** 체크와 실제
> 도메인의 신규 번들 해시로 한다. 저장소 전용 최신 절차는
> `.agents/skills/jeakyung-publish/SKILL.md`를 따른다.
>
> **Vercel 파이프라인은 폐기했다 (2026-09-24).** `vercel.json`, `.vercelignore`를
> 저장소에서 삭제했고 `.assetsignore`에서도 관련 항목을 뺐다. jeakyung.com은
> 더 이상 Vercel을 거치지 않는다. 다만 Vercel 프로젝트(`playskang-6383s-projects`
> 팀의 `jeakyung-assets`) 자체의 삭제·Git 연동 해제는 Vercel 대시보드에서
> 계정 권한이 있는 사람이 직접 해야 한다 — Settings → Git → Disconnect,
> 또는 Settings → Advanced → Delete Project
> (https://vercel.com/playskang-6383s-projects/jeakyung-assets/settings).
> 해제 전까지는 `main`과 다른 브랜치에 push할 때 Vercel이 계속 빌드를 시도하고
> PR에 `vercel[bot]` 코멘트가 남을 수 있는데, jeakyung.com 서빙과는 무관하므로
> 무시해도 된다.

## 13.0 현재 Cloudflare Worker 배포

1. `source/`에서 `npm run release`로 빌드 및 루트 산출물 동기화를 완료한다 (`assets/`, `groupware/index.html` 등 저장소 루트 파일이 곧 배포 대상이다).
2. 변경된 루트 산출물과 소스를 커밋해 `main`에 push한다.
3. GitHub 커밋/PR의 **"Workers Builds: jeakyung"** 체크가 성공(success)으로 뜨는지 확인한다 — Cloudflare가 저장소 루트를 `.assetsignore` 기준으로 걸러 자동 배포한 결과다.
4. `https://jeakyung.com/groupware/login`이 새 JS/CSS 해시를 제공하는지 확인한다.

수동 배포가 필요한 경우(Workers Builds 실패, 계정 자격 증명 직접 확인 등)에는 13.0.1을 따른다.

### 13.0.1 수동 배포 (Fallback)

Workers Builds가 실패하거나 로컬에서 직접 배포해야 할 때만 사용한다.

1. `.assetsignore` 기준으로 배포 루트를 임시 스테이징 폴더에 복제한다 (저장소 루트를 직접 배포 대상으로 쓰므로, 보통은 이 단계 없이 저장소 루트에서 바로 배포해도 된다).
2. `wrangler whoami`에서 운영 계정 `380b1bc6d94eaf5f614ceffbdd5ef479` 접근을 확인한다.
3. `npx wrangler deploy`를 실행한다.
4. `https://jeakyung.com/groupware/login`이 새 JS/CSS 해시를 제공하는지 확인한다.

## 13.1 이전 Vercel 배포 (폐기됨, 참고용 이력)

아래 13.1~13.6은 jeakyung.com이 Vercel을 통해 서빙되던 시절(2026-08-23 ~ 2026-09-24)의
설정과 절차를 그대로 남긴 이력이다. 지금은 적용되지 않으며, `vercel.json`·`.vercelignore`도
저장소에서 삭제됐다. 새로 참고할 필요는 없고, 과거 DNS·도메인 전환 판단 근거로만 남긴다.

### 13.1.1 배포 대상 (당시)

| 항목 | 값 |
| --- | --- |
| Vercel 팀 | `playskang-6383s-projects` (`team_EEaHa7nJq0hm29jtOEDAioQ4`) |
| Vercel 프로젝트 | `jeakyung-assets` (`prj_UL3afJMXg2TFTx2CQ94UNlnEX4Ej`) |
| 연결 저장소 | `playskang-svg/jeakyung-assets` (GitHub) |
| 프로덕션 브랜치 | `main` |
| 프로덕션 URL | https://jeakyung-assets-playskang-6383s-projects.vercel.app |
| 대시보드 | https://vercel.com/playskang-6383s-projects/jeakyung-assets |
| 프레임워크 프리셋 | 사용 안 함 — `vercel.json`이 빌드 없이 저장소 루트를 서빙하도록 지정했다 |

#### 저장소·프로젝트 이전 이력

- 과거 배포는 `jeakyungdrive01-art/jeakyung-assets`(브랜치 `groupware/approval`)에서
  `jeakyung-preview` 프로젝트로 이루어졌고, 그 Git 연결은 끊어진 상태다.
- 운영 저장소를 `playskang-svg/jeakyung-assets`로 옮기면서 **`jeakyung-assets` 프로젝트를 신설**해
  Git 연동을 다시 구성했다. Vercel API로는 기존 프로젝트에 저장소를 다시 붙일 수 없어
  `jeakyung-preview`를 재사용하지 않았다.
- `jeakyung-preview`는 **2026-09-01에 삭제했다.**
- 그때까지 그 프로젝트가 서빙하던 `groupware.jeakyung.com`(그룹웨어 옛 주소)도 함께 폐기했다.
  그룹웨어는 `jeakyung.com/groupware/`로 옮겨졌고 사이트 어디에서도 옛 주소로 보내지 않으므로
  서브도메인을 유지할 이유가 없다. Cloudflare의 `groupware` CNAME 레코드도 같은 날 삭제했다.

### 13.1.2 자동 배포 규칙 (당시)

- `main`에 push → **프로덕션 배포**가 자동 생성됐다.
- 그 외 브랜치에 push → **프리뷰 배포**가 자동 생성되고, PR에 프리뷰 URL이 코멘트로 붙었다.

### 13.1.3 `vercel.json` 설정 요약 (삭제된 파일, 참고용)

- **출력 디렉터리 고정**: `outputDirectory: "."`
  - Vercel 제로컨피그는 저장소에 `public/` 폴더가 있으면 그것을 출력 디렉터리로 간주한다.
    그대로 두면 루트를 포함한 모든 경로가 404가 되므로 반드시 루트로 고정해야 했다.
  - `framework`, `buildCommand`, `installCommand`는 `null` — 빌드 단계 없음.
- **SPA 리라이트**: `/groupware`, `/groupware/**` → `/groupware/index.html`
- **캐시 정책**: `/assets/*`는 `max-age=31536000, immutable`, `*.html`은 `max-age=0, must-revalidate` 등.
- **보안 헤더**·**검색 노출 차단**(`/groupware/*`에 `X-Robots-Tag: noindex, nofollow`) 설정.

Cloudflare Worker(`worker.js`)가 SPA 폴백과 캐시 헤더를 자체적으로 처리하므로 위 설정은
더 이상 필요 없다.

### 13.1.4 도메인 전환 이력 (GitHub Pages → Vercel, DNS는 Cloudflare)

`jeakyung.com`의 DNS는 **Cloudflare**에서 관리한다.
2026-08-23에 GitHub Pages → Vercel 전환을 완료했으며, apex는 `www`로 308 리다이렉트됐다.
이후 2026-09-24에 Vercel에서 Cloudflare Worker로 다시 전환했다(위 13.0 참고).
아래는 GitHub Pages → Vercel 전환 당시 수행한 절차 기록이다.

- Cloudflare에서 기존 GitHub Pages 레코드(A/AAAA, `www` CNAME)를 제거하고 Vercel이 안내한
  레코드로 교체했다. 실제 적용된 apex 레코드는 A가 아니라 CNAME(`050ebfa8358cbaec.vercel-dns-017.com`,
  Cloudflare가 flattening)이었다.
- Proxy status는 `DNS only`(회색 구름)로 둬야 Vercel 인증서 발급이 성공했다.
- MX·TXT(SPF/DKIM) 등 메일 관련 레코드는 건드리지 않았다.
- 전환 확인 후 저장소 루트의 `CNAME` 파일을 제거하고 GitHub Pages 배포를 비활성화했다.

### 13.1.5 Supabase 연동 (당시)

- 그룹웨어는 Supabase(`https://vzswlvumcdxnryrfwkkl.supabase.co`)를 브라우저에서 직접 호출하므로
  Vercel 환경변수 설정은 필요 없었다(지금도 마찬가지로, Cloudflare Worker 쪽도 환경변수가 필요 없다).
- Supabase **Authentication → URL Configuration**에 등록했던 Vercel 프리뷰용 Redirect URL
  (`https://jeakyung-assets-*-playskang-6383s-projects.vercel.app/**`)은, Vercel 프로젝트를
  실제로 삭제한 뒤에는 정리해도 된다. `https://www.jeakyung.com/**`, `https://jeakyung.com/**`
  등 실제 도메인 항목은 그대로 둔다.

### 13.1.6 운영 체크리스트 (당시, 폐기)

- 배포 상태·로그 확인은 Vercel 대시보드 대신 GitHub 커밋/PR의 "Workers Builds: jeakyung" 체크와
  Cloudflare 대시보드(https://dash.cloudflare.com/380b1bc6d94eaf5f614ceffbdd5ef479/workers/services/view/jeakyung/production)를 사용한다.
- 문제가 생긴 배포는 Cloudflare 대시보드에서 이전 Worker 버전으로 롤백한다(Vercel Instant Rollback은 더 이상 해당 없음).

### 알려진 불일치

`index.html`과 `privacy/index.html`의 `<link rel="canonical">`은 apex(`https://jeakyung.com/...`)를
가리키는데, 실제 서빙 호스트는 `www`이고 apex는 그쪽으로 308 리다이렉트된다. Cloudflare Worker의
`routes`에서 apex를 기본으로 바꾸거나, canonical을 `www`로 맞춰 정리해야 한다.
