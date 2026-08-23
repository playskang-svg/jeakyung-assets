# 재경닷컴 저장소 작업 규칙

## 기준 문서

- 공개 사이트의 최상위 기준은 `WEBSITE_SPEC.md`이다.
- 문서의 역할과 최신 상태는 `docs/00_INDEX.md`에서 확인한다.
- 그룹웨어의 인증, 권한, 데이터, 보안 기준은 `docs/27_AUTH_AND_MEMBERSHIP.md`부터 `docs/33_MAIL_INTEGRATION.md`까지의 담당 문서를 따른다.
- 같은 요구사항을 여러 문서에 복사하지 말고 담당 문서를 링크한다.

## 영역 분리

- 공개 사이트: `/`, `/privacy/`, `src/public-site/**`, `css/style.css`.
- 그룹웨어: `/groupware/*`, `groupware/index.html`, `src/groupware/**`.
- 그룹웨어 작업으로 공개 사이트의 문구, 디자인, 링크 또는 자산을 변경하지 않는다.
- 새 그룹웨어 운영 전환 승인 전까지 공개 사이트의 `https://jeakyung.quv.kr` 링크를 유지한다.

## 개발 원칙

- 패키지 관리자는 npm을 사용한다.
- 그룹웨어는 React Router 기반 SPA이며 공개 사이트 Vite MPA와 별도 진입점을 사용한다.
- 인증과 권한을 `localStorage`, 임의 사용자 또는 화면 숨김만으로 가장하지 않는다.
- Supabase 연결 전 보호 경로는 로그인 화면으로 이동시킨다.
- `service_role`, 비밀번호, 토큰과 비밀 키를 브라우저 코드나 Git에 포함하지 않는다.
- 관리자, 삭제, 권한 변경은 향후 서버 함수와 Supabase RLS를 모두 통과해야 한다.
- 그룹웨어 스타일은 `src/groupware/styles/**`에 두고 공개 사이트 선택자와 공유하지 않는다.

## 검증 및 Git

- 최소 1440px, 1024px, 390px, 320px에서 레이아웃·키보드·가로 스크롤을 확인한다.
- `/`, `/privacy/`, `/groupware/*` 직접 접근과 `npm run build`를 확인한다.
- 목적별 변경만 스테이징하고 0바이트 참고 Placeholder는 커밋하지 않는다.
- Phase 승인 없이 main 병합, Production 승격, CNAME·DNS 변경 또는 실제 외부 서비스 연결을 하지 않는다.
