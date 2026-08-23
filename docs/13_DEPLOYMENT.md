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
| 프레임워크 프리셋 | 없음(정적 파일 서빙, 빌드 명령 없음) |

> 참고: 기존 `jeakyung-preview` 프로젝트는 다른 저장소(`jeakyungdrive01-art/jeakyung-assets`)에서
> 배포되던 것이며 현재 Git 연결이 끊겨 있다. 신규 작업은 `jeakyung-assets` 프로젝트를 기준으로 한다.

## 13.2 자동 배포 규칙

- `main`에 push → **프로덕션 배포**가 자동 생성된다.
- 그 외 브랜치에 push → **프리뷰 배포**가 자동 생성되고, PR에 프리뷰 URL이 코멘트로 붙는다.
- 저장소에 소스가 아닌 빌드 산출물이 커밋되므로, 화면을 바꾸려면
  **원본 프로젝트에서 빌드한 결과물을 이 저장소에 반영**한 뒤 push 한다.
  (`/assets/*.js`, `/assets/*.css` 파일명은 해시가 포함되어 매 빌드마다 바뀐다.)

## 13.3 `vercel.json` 설정 요약

- **SPA 리라이트**: `/groupware`, `/groupware/**` → `/groupware/index.html`
  - 그룹웨어는 React Router(history 모드) 기반이므로 `/groupware/login` 같은 경로로
    직접 접속하거나 새로고침해도 URL이 유지된 채 앱이 부팅된다.
  - GitHub Pages용 `404.html` 우회 스크립트는 Pages 호환을 위해 그대로 두지만,
    Vercel에서는 리라이트가 먼저 매칭되므로 동작하지 않는다.
- **캐시 정책**
  - `/assets/*` : `max-age=31536000, immutable` (파일명 해시로 무효화)
  - `/public/*` : 1주 캐시 + stale-while-revalidate (이미지·영상)
  - `/css/*`, `/js/*`, `*.html` : `max-age=0, must-revalidate` (해시 없음 → 즉시 반영)
- **보안 헤더**: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
- **검색 노출 차단**: `/groupware/*`에 `X-Robots-Tag: noindex, nofollow`
- `.vercelignore`로 `WEBSITE_SPEC.md`, `docs/`, `CNAME`은 배포 산출물에서 제외한다.

## 13.4 도메인 현황

- `jeakyung.com`은 현재 저장소 루트의 `CNAME` 파일에 따라 **GitHub Pages**로 서빙 중이다.
- Vercel로 옮기려면 별도 작업이 필요하다(아직 적용하지 않음).
  1. Vercel 프로젝트 → Settings → Domains에 `jeakyung.com`, `www.jeakyung.com` 추가
  2. DNS를 Vercel이 안내하는 A/CNAME 레코드로 변경
  3. 전환 확인 후 GitHub Pages 설정 비활성화 및 저장소의 `CNAME` 파일 제거
- 전환 전까지는 Vercel URL과 GitHub Pages(`jeakyung.com`)가 **동시에 서비스**되므로,
  두 곳의 산출물이 어긋나지 않도록 항상 `main`에 함께 반영한다.

## 13.5 운영 체크리스트

- 배포 상태·로그 확인: https://vercel.com/playskang-6383s-projects/jeakyung-assets
- 문제가 생긴 배포는 Vercel 대시보드의 **Instant Rollback**으로 직전 프로덕션으로 되돌린다.
- 그룹웨어는 Supabase(`https://vzswlvumcdxnryrfwkkl.supabase.co`)를 직접 호출한다.
  키가 번들에 포함되어 있으므로 Vercel 환경변수 설정은 필요 없다.
  대신 Supabase 쪽 **RLS 정책과 허용 Origin 목록에 새 Vercel 도메인을 추가**해야
  프리뷰/프로덕션 URL에서 로그인이 정상 동작한다.
- 배포 후 확인 경로: `/`, `/privacy/`, `/groupware/login`(새로고침 포함), 메인 영상·이미지 로딩
