# 결정 사항과 절대 규칙

[문서 목록](./00_INDEX.md) · [핵심 작업 지시](./06_WORK_INSTRUCTION_CORE.md) · [작업 템플릿](./07_WORK_ORDER_TEMPLATE.md)

이 문서는 새로운 개발자나 AI가 가장 먼저 따라야 하는 변경 금지 규칙이다.

## Git 규칙

- 기능별 새 브랜치에서 작업한다.
- 기준 브랜치와 기준 HEAD를 작업 전 확인한다.
- `main`은 명시적 승인 없이 수정·Push·병합하지 않는다.
- force push 금지
- 사용자가 승인하지 않은 PR 생성 금지
- 검증 실패 상태에서 Push 금지
- 커밋은 한 Phase당 보통 1~2개로 묶는다.
- 커밋 전 `npm run build`와 `git diff --check`를 실행한다.

## Production과 도메인

명시적 별도 승인 없이는 다음을 하지 않는다.

- Production 승격
- Production 환경 변수 수정
- CNAME 수정
- DNS 수정
- 운영 도메인 변경
- 공개 홈페이지 그룹웨어 링크 교체
- Supabase/Vercel 결제·플랜 변경

## 데이터베이스

- 모든 DB 변경은 새 `supabase/migrations/*.sql` 파일로 관리한다.
- 원격에 적용된 과거 마이그레이션을 수정하지 않는다.
- destructive operation은 별도 승인 전 금지한다.
- 실제 사용 기록이 있는 데이터는 hard delete보다 archive를 사용한다.
- 첨부파일은 soft delete와 정리 후보를 우선한다.
- 모든 신규 public 테이블에 RLS를 활성화한다.
- `SECURITY DEFINER` 함수는 고정 `search_path`, 호출자 재검증, 최소 권한을 사용한다.
- 불필요한 `PUBLIC EXECUTE`를 제거한다.
- 임의 `user_id` 매개변수로 타인 권한을 조회하지 못하게 한다.

## 보안

브라우저 금지 항목:

- Supabase `service_role`
- secret key
- Management API token
- 비밀번호
- 장기 signed URL
- IMAP/SMTP 계정 비밀번호
- 민감한 관리자 토큰

권한 원칙:

- 기본 deny
- 명시적 deny가 allow보다 우선
- 화면 숨김과 서버 차단을 모두 구현
- 현재 활성 역할을 서버에서 검증
- 사용자가 보유한 고권한 역할을 암묵 적용하지 않음
- employee 모드에서는 관리자 RPC와 경로를 차단
- localStorage 조작으로 권한 상승 불가
- 마지막 super_admin 제거 차단
- audit_logs 일반 사용자 수정·삭제 차단

## 개인정보

저장하지 않거나 별도 정책 전 보류:

- 주민등록번호
- 계좌번호
- 급여 원문
- 개인 주소
- 과도한 비상 연락처 정보
- 비밀번호와 JWT

감사 로그에는 문서 본문 전체, 전화번호 전체, 첨부 원문, signed URL을 넣지 않는다.

## Storage

- 그룹웨어 파일은 비공개 버킷을 사용한다.
- 권한 확인 후 짧은 signed URL을 발급한다.
- 원본 파일명을 저장 경로로 신뢰하지 않는다.
- MIME type, 확장자, 실제 디코딩을 검증한다.
- Base64나 data URL을 본문에 저장하지 않는다.
- 다른 게시글·문서의 attachment ID 도용을 서버에서 차단한다.

## 공개 사이트 보호

그룹웨어 Phase에서 다음 파일을 수정하지 않는다.

```text
index.html
privacy/index.html
css/style.css
src/public-site/**
public/images/**
public/videos/**
js/main.js
CNAME
```

공개 사이트 변경 필요성이 발견되면 이유와 최소 대안만 보고한다.

## 미추적 Placeholder 11개

다음 0바이트 파일은 의도적인 Placeholder다. 수정·삭제·커밋하지 않는다.

```text
references/documents/company-introduction.pdf
references/documents/service-information.pdf
references/images/company-reference.jpg
references/images/hero-reference.jpg
references/images/service-reference-01.jpg
references/screenshots/homepage-desktop.png
references/screenshots/homepage-mobile.png
references/screenshots/service-section.png
references/text/company-profile.md
references/text/service-description.md
references/videos/hero-reference.mp4
```

## 테스트 파일

- 검증 스크립트와 임시 산출물은 `/private/tmp`에만 둔다.
- 저장소에 포함하지 않는다.
- 테스트 사용자, 게시판, 첨부파일은 검증 후 정리하거나 archive한다.
- 실사용 최고 관리자와 기존 데이터는 손상시키지 않는다.
- 사용자의 비밀번호를 요청하거나 출력하지 않는다.

## 모바일

모든 신규 화면은 다음 폭에서 검증한다.

```text
1440px
1024px
390px
320px
```

- 가로 넘침 금지
- 터치 영역 확보
- hover에만 의존 금지
- Drawer와 Dialog 접근성
- 모바일 키보드 고려
- 실제 iPhone·Android 검수는 운영 전 필수

## 작업 방식

- 관련 기능은 큰 묶음으로 처리한다.
- 정상 진행 상황을 장문으로 반복 보고하지 않는다.
- 중간 승인은 destructive 변경, 인증 만료, 운영 설정, 결제 등에서만 요청한다.
- 작업 완료 보고는 브랜치, 마이그레이션, 보안, 테스트, 커밋, Push, Preview 상태 중심으로 한다.
