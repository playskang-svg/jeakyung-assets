# 읽기 전용 프로젝트 인수인계 스냅샷

> 이 파일은 2026-07-31 시점의 통합 스냅샷입니다.  
> 최신 기준은 상위 폴더의 개별 문서와 `00_INDEX.md`를 확인하세요.

---

---

## FILE: 00_README.md

# 재경닷컴 프로젝트 문서 체계

이 폴더는 재경닷컴 공개 웹사이트와 사내 그룹웨어 개발을 누구라도 일관된 방식으로 이어갈 수 있도록 만든 기준 문서 모음이다.

## 먼저 읽을 순서

1. [프로젝트 전체 맥락](./01_PROJECT_CONTEXT.md)
2. [현재 상태](./02_CURRENT_STATUS.md)
3. [전체 개발 계획](./03_MASTER_PLAN.md)
4. [결정 사항과 절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md)
5. [진행 로그](./05_PROGRESS_LOG.md)
6. [작업자에게 전달할 핵심 지시](./06_WORK_INSTRUCTION_CORE.md)
7. [새 작업 지시서 템플릿](./07_WORK_ORDER_TEMPLATE.md)
8. [다음 단계 G4 전자결재 계획](./08_G4_APPROVAL_PLAN.md)
9. [유지보수·디자인 시스템 계획](./09_MAINTENANCE_AND_DESIGN_PLAN.md)
10. [남은 위험과 확인 항목](./10_OPEN_ITEMS_AND_RISKS.md)

## 문서 역할

- `01_PROJECT_CONTEXT.md`: 왜 이 프로젝트를 만들고 어떤 구조로 진행하는지 설명한다.
- `02_CURRENT_STATUS.md`: 현재 브랜치, 커밋, 배포, Supabase, 완료 기능을 기록한다.
- `03_MASTER_PLAN.md`: 앞으로 어떤 순서로 무엇을 구현할지 정의한다.
- `04_DECISIONS_AND_GUARDRAILS.md`: 작업자가 절대로 어기면 안 되는 규칙을 모은다.
- `05_PROGRESS_LOG.md`: 날짜별 주요 작업과 결과를 남긴다.
- `06_WORK_INSTRUCTION_CORE.md`: 새 AI나 개발자에게 가장 먼저 전달할 짧은 핵심 문서다.
- `07_WORK_ORDER_TEMPLATE.md`: 새로운 Phase 또는 보완 작업의 지시서를 작성할 때 사용한다.
- `08_G4_APPROVAL_PLAN.md`: 현재 다음 작업인 전자결재의 목표와 범위를 정리한다.
- `09_MAINTENANCE_AND_DESIGN_PLAN.md`: 그룹웨어 완성 후 공개 사이트와 그룹웨어의 유지보수성을 높이는 계획이다.
- `10_OPEN_ITEMS_AND_RISKS.md`: 아직 해결하지 않은 항목과 운영 전 확인 사항이다.

## 업데이트 규칙

작업이 끝날 때마다 최소한 다음 파일을 갱신한다.

- `02_CURRENT_STATUS.md`
- `05_PROGRESS_LOG.md`
- 해당 Phase 계획 문서
- 변경된 결정이 있으면 `04_DECISIONS_AND_GUARDRAILS.md`

작업 지시를 새로 만들 때는 `06_WORK_INSTRUCTION_CORE.md`와 `07_WORK_ORDER_TEMPLATE.md`를 먼저 참고한다.

## 기준 시각

마지막 정리 시각: **2026-07-31 19:18 KST**


---

## FILE: 01_PROJECT_CONTEXT.md

# 프로젝트 전체 맥락

[문서 목록](../00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

## 프로젝트 목적

재경닷컴은 두 영역으로 구성한다.

1. **공개 홈페이지**
   - 회사 소개와 서비스 안내
   - 개인정보 처리방침
   - 향후 이미지, 문구, 색상, 팝업을 쉽게 변경할 수 있는 유지보수 구조

2. **사내 그룹웨어**
   - 임직원 전용 로그인
   - 회원 승인과 조직 관리
   - 역할 전환과 직원 프로필
   - 대시보드, 게시판, 전자결재, 일정, 파일, 메일 연동
   - 모바일과 데스크톱 모두 대응

## 사용자 상황

- 사용자는 전문 개발자가 아니므로 작업자는 설명보다 **정확한 실행 지시와 승인 문구**를 제공해야 한다.
- 가능한 작업은 Codex가 로컬 저장소, Supabase CLI, Git, Vercel Preview에서 처리한다.
- 사용자가 직접 Supabase나 Vercel 화면을 조작하는 일은 최소화한다.
- 결제, Production, 도메인, 계정 소유자 확인이 필요한 경우에만 사용자 조작을 요청한다.

## 저장소와 기본 구조

저장소:

```text
/Users/sgk/Documents/GitHub/jeakyung-assets
```

공개 사이트:

```text
/
/privacy/
```

그룹웨어:

```text
/groupware/*
```

기술 구조:

- Vite + React
- 공개 사이트: 다중 페이지 빌드
- 그룹웨어: React Router SPA
- Supabase: Auth, PostgreSQL, RLS, Storage, Edge Functions
- GitHub: 기능별 브랜치
- Vercel: Preview 검증 후 마지막 단계에서 Production

## 핵심 아키텍처

- 공개 사이트 라우트와 그룹웨어 라우트를 분리한다.
- `/groupware/*`만 `/groupware/index.html`로 rewrite한다.
- 브라우저에는 Supabase Publishable Key만 사용한다.
- `service_role`, secret key, Management API token은 브라우저에 넣지 않는다.
- 모든 신규 public 테이블은 RLS를 활성화한다.
- 서버 권한은 PostgreSQL RPC 또는 Edge Function에서 다시 확인한다.
- DB 변경은 `supabase/migrations`의 새 파일로만 관리한다.
- 원격에 적용된 과거 마이그레이션은 수정하지 않는다.

## 제품 원칙

- 모바일 우선 반응형
- 기본 deny 권한 모델
- 명시적 deny가 allow보다 우선
- 데이터 삭제보다 archive와 soft delete 우선
- 감사 로그는 사용자 수정·삭제 불가
- 화면에서 숨기는 것과 서버에서 막는 것을 모두 구현
- 관리자도 승인된 기록을 조용히 바꾸지 못하게 한다.
- 테스트 데이터는 실제 운영 데이터와 분리하고 검증 후 정리한다.

## 현재 큰 흐름

- 공개 사이트 React 전환: 완료
- 그룹웨어 기반, 인증, 조직, 다중 역할, 프로필, 대시보드, 게시판: 완료
- 다음 단계: 전자결재
- 이후: 일정·알림, 파일함·메일, 운영 전환, 유지보수·디자인 시스템 보완

현재 세부 상태는 [현재 상태](./02_CURRENT_STATUS.md)를 기준으로 한다.


---

## FILE: 02_CURRENT_STATUS.md

# 현재 상태

[문서 목록](../00_INDEX.md) · [전체 계획](./03_MASTER_PLAN.md) · [진행 로그](./05_PROGRESS_LOG.md)

기준 시각: **2026-07-31 19:18 KST**

## 전체 진행률

전체 기능 기준 약 **55~60% 완료**로 추정한다.

완료된 기반의 비중이 크기 때문에 이후 기능 개발은 초반보다 빨라질 수 있으나, 전자결재·일정·메일·운영 전환은 별도 검증이 필요하다.

## 현재 Git 상태

현재 완료 브랜치:

```text
groupware/dashboard-boards
```

현재 완료 커밋:

```text
25f47d13def530f65d5641ad6389a34753d90b88
feat: add role switching and employee profiles
```

확인된 상태:

- 로컬·원격 차이: `0/0`
- 추적 파일: 깨끗함
- 기존 0바이트 Placeholder 11개만 미추적
- `main` 미변경
- Production 미변경
- 도메인, CNAME, DNS 미변경
- PR 미생성
- force push 없음

## Supabase 상태

프로젝트:

```text
jeakyung-dotcom
```

Project Ref:

```text
vzswlvumcdxnryrfwkkl
```

원격 적용 완료 마이그레이션:

```text
202607300001_groupware_auth_membership.sql
202607310001_groupware_dashboards_boards.sql
202607310002_fix_board_author_permissions.sql
202607310003_board_inline_images.sql
202607310004_admin_system_usage.sql
202607310005_fix_inline_upload_policy_lint.sql
202607310006_multi_roles_and_employee_profiles.sql
202607310007_admin_file_cleanup_details.sql
```

활성 Edge Functions:

```text
board-image-upload
profile-photo-upload
```

확인 결과:

- 원격 DB 최신 상태
- DB lint 오류 0건
- 신규 public 테이블 RLS 검증 완료
- JWT 검증 활성화
- 비인증 업로드 401
- 일반 사용자의 관리자 RPC 차단
- 비공개 Storage 직접 접근 차단

## Vercel 상태

프로젝트:

```text
jeakyung-preview
```

최근 확인된 Preview:

```text
https://jeakyung-preview-9jp65p8q0-3372.vercel.app
```

상태:

- Preview 배포 성공
- Vercel Authentication 유지
- Shareable Link 없음
- Automation Bypass Secret 없음
- Production 승격 없음

## 공개 사이트 상태

완료:

- React 전환
- `/` 정상
- `/privacy/` 정상
- 반응형 검증
- Vercel Preview 검증

현재 운영 홈페이지의 기존 그룹웨어 링크:

```text
https://jeakyung.quv.kr
```

중요:

- 새 그룹웨어 운영 전환 승인 전까지 기존 링크를 유지한다.
- 공개 사이트 코드는 그룹웨어 Phase에서 수정하지 않는다.

## 그룹웨어 완료 기능

### 기반과 인증

- React Router SPA
- App Shell
- 모바일 Drawer
- 로그인·로그아웃
- 회원가입 신청
- 가입 승인·거절
- pending, approved, rejected, locked, resigned 상태
- 비밀번호 재설정
- ProtectedRoute
- AdminRoute
- 감사 로그

### 조직과 회원

- 부서
- 직급
- 직책
- 역할
- 조직 순서
- 활성·비활성
- 관리자 회원 승인
- 직원 프로필 관리

### 다중 역할과 프로필

- 한 사용자에게 여러 역할 배정
- `employee ↔ super_admin` 활성 역할 전환
- 새로고침 후 활성 역할 유지
- employee 모드에서 관리자 메뉴·경로·RPC 차단
- localStorage 조작 권한 상승 차단
- 마지막 super_admin 제거 차단
- 상단 이름·소속·현재 역할 표시
- 대시보드 최상단 프로필 카드
- 내 프로필 편집
- 프로필 사진 비공개 Storage
- 관리자 전용 필드 사용자 수정 차단

### 대시보드와 게시판

- 관리자 대시보드 위젯
- 사용자 위젯 설정
- 게시판 빌더
- 게시판 그룹·카테고리
- 게시판별 권한
- 동적 Sidebar
- 게시글·댓글
- 익명 게시판
- 본문 이미지
- 첨부파일
- 비공개 Storage
- signed URL
- 관리자 시스템 사용량
- 용량 경고와 정리 후보

## 모바일 상태

검증 화면:

```text
1440px
1024px
390px
320px
```

통과 항목:

- App Shell
- Drawer
- 사용자 메뉴
- 프로필 카드
- 게시판 목록·상세·작성
- 본문 이미지
- 관리자 화면
- 가로 넘침 없음
- 콘솔 오류 없음

실제 iPhone Safari와 Android 실기기 최종 검수는 운영 전 단계에서 수행한다.

## 아직 시작하지 않은 핵심 기능

- Phase G4 전자결재
- 일정·캘린더
- 공통 알림 확장
- 일반 파일함
- mail.jeakyung.com 연동
- 운영 Production 전환
- 공개 사이트 그룹웨어 링크 교체
- 유지보수·디자인 토큰·팝업 관리자

## 현재 중단 사유

Phase G4 지시문은 준비되었지만 실제 착수는 아직 확인되지 않았다.

최근 사용한 Gemini 3.1 Pro Preview는 다음 오류로 응답하지 못했다.

```text
HTTP 429
Quota exceeded
free tier request/input token limit: 0
```

이는 저장소나 코드 오류가 아니라 해당 Gemini API 프로젝트의 사용량·결제 설정 문제다.

다음 작업자는 사용 가능한 Codex 또는 다른 정상 모델에서 G4를 시작해야 한다.


---

## FILE: 03_MASTER_PLAN.md

# 전체 개발 계획

[문서 목록](../00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [다음 G4 계획](./08_G4_APPROVAL_PLAN.md)

## 최종 목표

재경닷컴 공개 홈페이지와 사내 그룹웨어를 하나의 유지보수 가능한 코드베이스로 운영한다.

최종 운영 형태:

```text
https://jeakyung.com/
https://jeakyung.com/privacy/
https://jeakyung.com/groupware/login
```

운영 전환 전까지 기존 그룹웨어 링크를 유지한다.

## 완료된 단계

### Phase P — 공개 사이트 React 전환

상태: 완료

- 공개 홈페이지 React 구조화
- Preview 배포
- 모바일 반응형
- 공개 라우트 분리
- 그룹웨어 개발과 공개 사이트 코드 분리

### Phase G0–G1 — 그룹웨어 기반

상태: 완료

- `/groupware/*` SPA
- 로그인·회원가입·대기 화면
- App Shell
- Sidebar
- 모바일 Drawer
- 보호 라우트

### Phase G2 — 인증과 조직

상태: 완료

- Supabase Auth
- 가입 승인
- 계정 상태
- 역할·부서·직급·직책
- 조직 관리
- RLS
- 감사 로그
- 최고 관리자 Bootstrap

### Phase G3 — 대시보드·게시판·프로필

상태: 완료

- 대시보드 위젯
- 게시판 빌더
- 게시판별 권한
- 게시글·댓글·첨부
- 본문 이미지
- 시스템 사용량
- 다중 역할
- 활성 역할 전환
- 직원 프로필
- 프로필 사진
- 관리자 직원 관리

## 다음 단계

### Phase G4 — 전자결재

상태: 미착수

목표:

- 결재 양식 빌더
- 기안과 임시 저장
- 결재선
- 순차·병렬·합의·협조
- 승인·반려·보류·회수
- Revision과 재기안
- 참조·열람
- 대결·위임
- 제한적 전결
- 결재 첨부파일
- 내부 알림
- 결재함
- 대시보드 실제 결재 현황
- 모바일·RLS·감사 로그

세부 계획: [G4 전자결재 계획](./08_G4_APPROVAL_PLAN.md)

### Phase G5 — 일정·캘린더와 공통 알림

목표:

- 개인 일정
- 부서 일정
- 회사 일정
- 일정 권한
- 반복 일정
- 참석자
- 일정 알림
- 결재·게시판·일정을 함께 처리하는 공통 알림 센터
- 모바일 캘린더
- 대시보드 일정 위젯 실제 연동

### Phase G6 — 일반 파일함과 메일

목표:

- 부서·프로젝트 파일함
- 파일 버전
- 폴더 권한
- 다운로드 감사
- Storage 사용량 연동
- mail.jeakyung.com 연동 조사
- 공식 SSO 또는 안전한 서버 방식 우선
- 브라우저에서 IMAP/SMTP 직접 사용 금지
- 비밀번호 평문 저장 금지

### Phase G7 — 운영 준비

목표:

- 실제 iPhone·Android 실기기 검수
- 전체 권한 E2E
- Supabase Free/Pro 용량 결정
- 백업·복구 절차
- 장애 대응
- Production 환경 변수
- 보안 헤더
- 운영 관리자 매뉴얼
- 데이터 보존 정책
- 직원 계정 운영 정책

### Phase G8 — Production 전환

목표:

- Production 배포
- `jeakyung.com/groupware/login` 최종 확인
- 공개 홈페이지 그룹웨어 링크 교체
- 기존 `quv.kr` 링크 종료 또는 안내
- DNS·도메인 검증
- 운영 모니터링
- 롤백 계획

Production, 도메인, 결제 변경은 반드시 별도 승인한다.

## 그룹웨어 완성 후 유지보수 보완

별도 Phase M으로 진행한다.

- 디자인 토큰
- 글자 크기와 여백 중앙 관리
- 전체 색상·톤 설정
- Hero 이미지·영상 교체
- 공통 Modal·Popup
- 관리자 팝업 등록
- 게시 예약
- 미리보기
- 버전 복구
- 공개 사이트 콘텐츠 관리
- 그룹웨어 개인 글자 크기 설정

세부 계획: [유지보수·디자인 계획](./09_MAINTENANCE_AND_DESIGN_PLAN.md)


---

## FILE: 04_DECISIONS_AND_GUARDRAILS.md

# 결정 사항과 절대 규칙

[문서 목록](../00_INDEX.md) · [핵심 작업 지시](./06_WORK_INSTRUCTION_CORE.md) · [작업 템플릿](./07_WORK_ORDER_TEMPLATE.md)

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


---

## FILE: 05_PROGRESS_LOG.md

# 진행 로그

[문서 목록](../00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

## 2026-07-29 — 초기 백업과 공개 사이트 기반

- 영구 백업 생성:

```text
/Users/sgk/Documents/jeakyung-backups/phase0-20260729/
```

- 공개 사이트 React 전환 진행
- 공개 사이트와 그룹웨어 라우트 분리
- Vercel Preview 준비
- 0바이트 Placeholder 11개는 의도적으로 미추적 유지

주요 공개 사이트 커밋:

```text
6bbf8f... refactor: complete public site React migration
795e851... feat: prepare public site for preview deployment
6da5d704c9a8df602919f0d1ef2e76aa10ff1f4b
fix: refine mobile headings and consultation buttons
```

## 2026-07-30 — Phase G2 인증·조직

브랜치:

```text
groupware/auth-membership
```

주요 커밋:

```text
e3a35f3 docs: refine groupware product requirements
bc077693a6734962810d45297d3ecc9938c23eb8
feat: connect groupware authentication and membership
```

완료:

- Supabase Auth
- 가입 신청·승인·거절
- 계정 상태
- 비밀번호 재설정
- 부서·직급·직책·역할
- 조직 관리
- 최고 관리자 Bootstrap
- 감사 로그
- RLS
- Preview 검증

원격 마이그레이션:

```text
202607300001_groupware_auth_membership.sql
```

## 2026-07-31 — Phase G3 대시보드·게시판

브랜치:

```text
groupware/dashboard-boards
```

초기 G3 완료 커밋:

```text
2bbad81b9d2ebb9e16a86c343bf76ac15ba52933
feat: add board inline images and admin usage monitoring
```

완료:

- 게시판 빌더
- 게시판 그룹·카테고리
- 게시판별 권한
- 게시글·댓글
- 본문 이미지
- Tiptap 기반 에디터
- 비공개 Storage
- 이미지 리사이즈와 검증
- attachment ID 도용 차단
- 시스템 사용량 화면
- Storage 정리 후보

원격 마이그레이션:

```text
202607310001_groupware_dashboards_boards.sql
202607310002_fix_board_author_permissions.sql
202607310003_board_inline_images.sql
202607310004_admin_system_usage.sql
202607310005_fix_inline_upload_policy_lint.sql
```

Edge Function:

```text
board-image-upload
```

## 2026-07-31 — Phase G3 보완: 다중 역할·프로필

최종 커밋:

```text
25f47d13def530f65d5641ad6389a34753d90b88
feat: add role switching and employee profiles
```

완료:

- 한 계정 여러 역할
- 활성 역할 전환
- employee ↔ super_admin 전환
- 새로고침 후 유지
- employee 모드 관리자 차단
- localStorage 권한 상승 차단
- 마지막 super_admin 보호
- 직원 프로필
- 회원가입 프로필 확장
- 상단 사용자 정보
- 대시보드 프로필 카드
- 프로필 사진 비공개 Storage
- 관리자 직원 검색·편집·역할 배정

원격 마이그레이션:

```text
202607310006_multi_roles_and_employee_profiles.sql
202607310007_admin_file_cleanup_details.sql
```

Edge Function:

```text
profile-photo-upload
```

검증:

- DB lint 오류 0건
- 1440·1024·390·320px 통과
- 공개 사이트 회귀 통과
- 게시판·이미지·사용량 회귀 통과
- 콘솔 오류 0건
- `npm run build` 성공
- Git 로컬·원격 차이 0/0

Preview:

```text
https://jeakyung-preview-9jp65p8q0-3372.vercel.app
```

## 2026-07-31 — Phase G4 준비

전자결재 전체 지시서 작성 완료.

예정 범위:

- 양식 빌더
- 기안
- 결재선
- 순차·병렬·합의·협조
- 승인·반려·보류·회수
- 대결·위임
- 제한적 전결
- 참조·열람
- 첨부파일
- 내부 알림
- 대시보드 연동
- 관리자 결재 시스템

실제 착수 전 모델 오류 발생:

```text
Gemini 3.1 Pro Preview
HTTP 429
Quota exceeded
free tier limit: 0
```

판단:

- 코드나 저장소 문제 아님
- 모델/API 프로젝트의 무료 할당량 또는 결제 설정 문제
- 사용 가능한 Codex 또는 다른 정상 모델에서 동일 G4 지시로 재개해야 함

## 다음 로그 작성 규칙

새 작업 완료 후 아래 형식으로 추가한다.

```text
## YYYY-MM-DD — Phase/작업명

브랜치:
커밋:
마이그레이션:
Edge Function:
완료 기능:
보안 검증:
UI 검증:
회귀 검사:
Push:
Preview:
남은 항목:
```


---

## FILE: 06_WORK_INSTRUCTION_CORE.md

# 작업자에게 전달할 핵심 지시

[문서 목록](../00_INDEX.md) · [절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md) · [작업 템플릿](./07_WORK_ORDER_TEMPLATE.md)

이 문서는 새로운 AI 또는 개발자에게 가장 먼저 전달하는 짧은 기준이다.

## 프로젝트

```text
저장소: /Users/sgk/Documents/GitHub/jeakyung-assets
Supabase: jeakyung-dotcom
Project Ref: vzswlvumcdxnryrfwkkl
Vercel Preview Project: jeakyung-preview
현재 완료 브랜치: groupware/dashboard-boards
현재 완료 HEAD: 25f47d13def530f65d5641ad6389a34753d90b88
```

## 현재 완료 상태

- 공개 사이트 React 전환 완료
- 그룹웨어 인증·가입 승인·조직 완료
- 대시보드·게시판·본문 이미지·사용량 완료
- 다중 역할·활성 역할 전환·직원 프로필 완료
- 모바일 1440·1024·390·320 검증 완료
- Supabase 마이그레이션 202607310007까지 적용 완료
- `board-image-upload`, `profile-photo-upload` ACTIVE
- `main`, Production, 도메인 미변경
- Placeholder 11개 미추적 유지

## 다음 목표

Phase G4 전자결재를 `groupware/approval` 브랜치에서 구현한다.

핵심 범위:

- 양식 빌더와 버전
- 기안·임시 저장·제출
- 결재선
- 순차·병렬·합의·협조
- 승인·반려·보류·회수
- Revision·재기안
- 참조·열람
- 대결·위임
- 제한적 전결
- 결재 첨부파일
- 내부 알림
- 결재함과 대시보드
- 관리자 결재 시스템
- RLS·RPC·감사 로그
- 모바일 검증

## 절대 규칙

- `main` 수정·Push·병합 금지
- Production·도메인·DNS·결제 변경 금지
- 공개 사이트 파일 수정 금지
- 원격 적용된 마이그레이션 수정 금지
- 새 additive migration만 사용
- 모든 신규 public 테이블 RLS
- 브라우저에 service_role·secret key 금지
- 권한은 서버에서 재검증
- 기본 deny, explicit deny 우선
- employee 모드 관리자 접근 차단
- 마지막 super_admin 보호
- 실제 데이터 hard delete 금지
- `/private/tmp` 테스트 파일 저장소 포함 금지
- Placeholder 11개 수정·삭제·커밋 금지
- 검증 실패 상태 Push 금지
- 비밀번호 요청·출력 금지

## 완료 조건

- `npm run build`
- `git diff --check`
- DB lint
- RLS/RPC 보안 테스트
- 실제 계정 E2E
- 1440·1024·390·320px
- 공개 사이트와 기존 그룹웨어 회귀
- 추적 파일 clean
- 현재 기능 브랜치만 Push
- Vercel Preview 성공
- Production·main·도메인 미변경 확인

상세 규칙은 반드시 [결정 사항과 절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md)을 함께 읽는다.


---

## FILE: 07_WORK_ORDER_TEMPLATE.md

# 새 작업 지시서 템플릿

[문서 목록](../00_INDEX.md) · [핵심 지시](./06_WORK_INSTRUCTION_CORE.md) · [절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md)

아래 템플릿을 복사해 새로운 Phase나 보완 작업 지시서를 작성한다.

---

# Phase [번호] — [작업명]

## 1. 목표

이번 단계에서 실제로 완성할 사용자 기능과 관리자 기능을 적는다.

```text
- 목표 1
- 목표 2
- 목표 3
```

이번 단계에서 하지 않을 항목도 명시한다.

```text
- 제외 1
- 제외 2
```

## 2. 시작 상태

```text
저장소: /Users/sgk/Documents/GitHub/jeakyung-assets
기준 브랜치:
기준 HEAD:
새 브랜치:
Supabase Project Ref: vzswlvumcdxnryrfwkkl
```

읽기 전용 확인:

- 현재 브랜치와 HEAD
- 로컬·원격 일치
- git status
- Placeholder 11개만 미추적
- 기존 마이그레이션 최신
- 공개 사이트 변경 없음
- 관련 Edge Function 상태

예상과 다르면 브랜치 생성 전 중단한다.

## 3. 기능 범위

### 사용자 기능

- 기능
- 경로
- 상태
- 모바일 동작

### 관리자 기능

- 생성·수정·보관
- 권한
- 감사 로그
- 위험 작업 확인 절차

### 데이터 모델

- 신규 테이블
- 상태 값
- 관계
- Snapshot
- archive·soft delete

### 서버 권한

- RLS
- RPC
- Edge Function
- 활성 역할
- 직접 URL
- ID 도용 차단

## 4. 보안 규칙

- 기본 deny
- explicit deny 우선
- auth.uid() 재검증
- 현재 활성 역할 재검증
- service_role 브라우저 금지
- secret key 금지
- signed URL 짧게
- 모든 public 테이블 RLS
- SECURITY DEFINER search_path 고정
- PUBLIC EXECUTE 최소화
- 감사 로그 수정·삭제 차단

## 5. 모바일·접근성

검증 폭:

```text
1440
1024
390
320
```

확인:

- 가로 넘침
- 키보드
- 터치 영역
- Drawer
- Dialog
- focus trap
- Escape
- 색상 외 상태 표현
- 긴 이름과 긴 제목

## 6. 마이그레이션

- 기존 원격 마이그레이션 수정 금지
- 새 additive migration
- destructive operation 금지
- SQL 문법
- RLS
- 함수 권한
- 기존 데이터 호환
- DB lint

## 7. 검증 시나리오

- 정상 흐름
- 권한 없는 사용자
- 직접 URL
- 중복 요청
- 실패 후 복구
- 모바일
- 기존 기능 회귀
- 공개 사이트 회귀

## 8. 변경 허용 범위

허용 파일:

```text
supabase/**
src/groupware/**
groupware/index.html
관련 docs/**
필요한 package 파일
```

금지 파일:

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

## 9. 커밋·Push

- 모든 검증 통과 후 커밋
- 보통 1~2개 커밋
- 현재 기능 브랜치만 Push
- force push 금지
- PR 금지
- main 병합 금지
- Production 금지

## 10. 완료 보고

반드시 포함:

1. 브랜치와 HEAD
2. 마이그레이션
3. Edge Function
4. 구현 기능
5. 권한 방식
6. RLS·RPC
7. 감사 로그
8. 모바일
9. E2E
10. build
11. 커밋
12. Push
13. Preview
14. git status
15. Placeholder 유지
16. main·Production·도메인 미변경
17. 다음 단계 가능 여부

## 11. 승인 문구

```text
위 Phase 범위의 로컬 구현, 신규 additive 마이그레이션 적용,
필요한 Edge Function 배포, 보안 검증, 실제 계정 E2E,
커밋과 현재 기능 브랜치 Push를 승인합니다.

Production, main, 도메인, 결제·플랜 변경은 승인하지 않습니다.
승인 범위를 벗어난 변경이 필요하면 수정하지 말고
이유, 영향 범위, 최소 대안만 보고하세요.
```


---

## FILE: 08_G4_APPROVAL_PLAN.md

# Phase G4 전자결재 계획

[문서 목록](../00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

상태: **지시서 준비 완료, 실제 착수 미확인**

## 시작 기준

기준 브랜치:

```text
groupware/dashboard-boards
```

기준 HEAD:

```text
25f47d13def530f65d5641ad6389a34753d90b88
```

새 브랜치:

```text
groupware/approval
```

## 목표

사내에서 실제 사용할 수 있는 전자결재 핵심 기능을 구현한다.

### 양식

- 양식 분류
- 양식 빌더
- 필드 설정
- 기본 결재선
- 양식 버전 발행
- 기존 문서 버전 고정
- 양식 비활성·보관·복원

### 문서

- 기안
- 임시 저장
- 제출
- 문서번호
- Revision
- 재기안
- 인쇄용 화면
- 첨부파일

### 결재 흐름

- 순차 결재
- 병렬 전체 승인
- 병렬 필수 인원
- 합의
- 협조
- 승인
- 반려
- 보류
- 보류 해제
- 회수
- 관리자 취소

### 권한과 조직

- 특정 사용자
- 기안자 부서장
- 팀장
- 특정 부서·역할
- 제출 시 실제 사용자 Snapshot
- 조직 변경 후에도 진행 문서 결재선 유지
- 본인 결재 기본 차단
- 차례가 아닌 결재 차단

### 대결·위임

- 기간
- 전체 또는 특정 양식
- 순환 위임 차단
- 만료
- 원 결재자와 실제 처리자 표시
- 감사 로그

### 전결

- 기본 비활성
- 양식·부서·역할·금액 조건
- 서버 재검증
- 적용 규칙 기록
- super_admin 자동 전결 금지

### 참조·열람

- 참조
- 열람자
- 읽음 시각
- 읽지 않은 개수
- 직접 URL 차단

### 알림

그룹웨어 내부 알림만 구현한다.

- 결재 요청
- 승인
- 반려
- 보류
- 회수
- 참조
- 위임
- Badge
- 읽음 처리
- 관련 문서 이동

외부 이메일, 모바일 Push는 제외한다.

### 대시보드

실제 데이터로 연결:

- 처리할 결재
- 보류
- 진행 중 기안
- 반려
- 최근 승인 완료
- 읽지 않은 참조
- 위임 상태

## 예상 데이터 영역

- `approval_categories`
- `approval_templates`
- `approval_template_versions`
- `approval_number_sequences`
- `approval_documents`
- `approval_document_revisions`
- `approval_lines`
- `approval_line_assignees`
- `approval_actions`
- `approval_references`
- `approval_comments`
- `approval_attachments`
- `approval_delegations`
- `approval_authority_rules`
- `approval_saved_lines`
- `groupware_notifications`

최종 스키마는 기존 조직·역할·감사 로그와 충돌하지 않게 조정할 수 있다.

## Storage

권장 비공개 버킷:

```text
groupware-approval-attachments
```

기본 제한:

- 파일당 20MB
- 문서당 10개
- 문서 합계 100MB
- 위험 파일 차단
- 짧은 signed URL
- 다른 문서 attachment ID 도용 차단
- soft delete와 고아 파일 후보

## 권장 마이그레이션

```text
202607310008_groupware_approval_core.sql
202607310009_groupware_approval_notifications_storage.sql
```

번호가 이미 사용되었으면 현재 원격 최신 번호 다음으로 조정한다.

## 주요 E2E

- 기안자
- 중간 결재자
- 최종 결재자
- employee 모드 관리자 차단
- super_admin 모드 관리자 허용
- 순차 조기 승인 차단
- 병렬 조건
- 반려 후 Revision
- 첫 처리 전 회수
- 처리 후 회수 차단
- 위임 기간·범위
- 전결 조건
- 첨부 직접 접근 차단
- 알림 타인 접근 차단

## 제외

- 메일 발송
- mail.jeakyung.com 연동
- 일정 연동
- 모바일 Push
- 일반 파일함
- 급여·인사평가·근태
- 공인전자서명 주장
- Production과 도메인

## 현재 착수 장애

최근 Gemini 3.1 Pro Preview 호출은 HTTP 429로 실패했다.

```text
Quota exceeded
free tier limit: 0
```

새 작업자는 사용 가능한 모델로 전환한 뒤 G4 지시를 다시 제출해야 한다. 동일 메시지 재전송만으로는 해결되지 않을 수 있다.


---

## FILE: 09_MAINTENANCE_AND_DESIGN_PLAN.md

# 유지보수·디자인 시스템 계획

[문서 목록](../00_INDEX.md) · [전체 계획](./03_MASTER_PLAN.md) · [결정 사항](./04_DECISIONS_AND_GUARDRAILS.md)

이 작업은 그룹웨어 핵심 기능과 운영 전환이 끝난 뒤 별도 Phase로 진행한다.

## 목표

개발자가 여러 파일을 찾아다니지 않고 다음 항목을 한곳에서 바꿀 수 있게 한다.

- 글자 크기
- 색상
- 여백
- 버튼
- 카드
- 입력창
- 표
- Popup
- Modal
- Hero 이미지·영상
- 회사 소개 문구
- 상단 메뉴
- 연락처
- 공개 사이트 공지

## 디자인 토큰

중앙 관리 대상:

```text
font-family
font-size-xs
font-size-sm
font-size-base
font-size-lg
font-size-xl
line-height
color-primary
color-secondary
color-background
color-surface
color-text
color-muted
color-danger
border-radius
spacing
shadow
button-height
input-height
sidebar-width
header-height
```

화면마다 임의 숫자를 반복하지 않고 CSS 변수 또는 Theme 설정으로 통일한다.

## 글자 크기

관리자 기본값:

- 작게
- 보통
- 크게

사용자 접근성 설정:

- 개인 글자 크기
- 화면 밀도
- 높은 대비
- 브라우저 확대와 충돌하지 않는 구조

회사 기본 디자인과 개인 접근성 설정을 분리한다.

## 공개 사이트 콘텐츠

관리자 또는 설정 파일에서 변경:

- Hero 이미지
- Hero 영상
- 제목
- 설명
- 버튼 문구
- 버튼 링크
- 회사 정보
- 서비스 소개
- 연락처
- Footer
- 상단 메뉴

이미지 교체 시:

- 권장 비율
- 권장 크기
- 용량 제한
- 모바일 미리보기
- 대체 텍스트
- 게시 전 검증

## Popup·Modal 공통 시스템

한 번 정의한 공통 컴포넌트를 재사용한다.

### Popup

- 제목
- 내용
- 이미지
- 링크
- 시작일·종료일
- 노출 페이지
- 대상
- PC·모바일
- 하루 동안 보지 않기
- 게시 예약
- 우선순위
- 활성·비활성

### Modal

- 확인
- 경고
- 삭제 확인
- 권한 변경 확인
- Form Dialog
- focus trap
- Escape
- Overlay
- 모바일 Bottom Sheet 대안

각 화면에서 새 Modal을 임의 구현하지 않는다.

## 버전과 게시

- 임시 저장
- 미리보기
- 예약 게시
- 게시
- 이전 버전
- 복구
- 변경자
- 변경 시각
- 감사 로그

## 구현 시점

다음 조건 이후 시작한다.

- 전자결재 완료
- 일정·알림 완료
- 파일·메일 방향 확정
- 운영 UI 구조 안정화
- 실제 사용자 피드백 확보

이 계획은 기능 개발 중 임시 스타일 변경을 막는 용도가 아니라, 최종 유지보수 구조를 별도 Phase로 집중 정리하기 위한 기준이다.


---

## FILE: 10_OPEN_ITEMS_AND_RISKS.md

# 남은 항목과 위험

[문서 목록](../00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [G4 계획](./08_G4_APPROVAL_PLAN.md)

## 즉시 다음 작업

1. 사용 가능한 AI 모델 확보
2. `groupware/dashboard-boards`와 HEAD 확인
3. `groupware/approval` 브랜치 생성
4. Phase G4 전자결재 착수

현재 Gemini 3.1 Pro Preview는 무료 할당량 0으로 HTTP 429가 발생하므로 그대로 재시도하지 않는다.

## 기술 위험

### 전자결재 상태 전이

위험:

- 중복 승인
- 차례가 아닌 승인
- 병렬 승인 Race Condition
- 반려·회수 충돌

대응:

- 서버 트랜잭션
- 조건부 업데이트
- 현재 문서·단계·결재자 상태 재검증
- 중복 요청 Idempotency

### 활성 역할

위험:

- 보유 역할 전체를 자동 합산
- employee 모드에서 관리자 RPC 허용

대응:

- 서버 저장 활성 역할
- 관리자 기능마다 활성 역할 재검증
- 결재자 identity와 관리자 역할을 분리

### 첨부파일

위험:

- Storage 용량 증가
- 다른 문서 ID 도용
- 장기 URL 노출

대응:

- 파일 제한
- 비공개 버킷
- 짧은 signed URL
- 문서 접근 권한 재검증
- 사용량 화면
- 70·85·95% 경고

### Supabase Free Plan

현재 운영 전 검토 필요:

- DB 용량
- Storage
- Egress
- 프로젝트 일시 중지 위험
- 백업·복구

실제 직원 업무를 시작하기 전 Pro 전환 여부를 결정한다. 자동 결제 전환은 금지한다.

### npm audit

기존 React Router RSC 관련 high 경고 2건이 남아 있다.

현재 Vite Client SPA는 해당 RSC API를 사용하지 않는 것으로 판단했지만, 운영 전 최신 권고와 실제 영향 여부를 다시 확인한다.

### 모바일 실기기

브라우저 폭 검증은 통과했지만 다음은 실제 기기 검증 필요:

- iPhone Safari 주소창 높이
- Android Chrome
- 모바일 키보드
- 카메라 사진 첨부
- 파일 다운로드
- 화면 회전
- 뒤로가기
- 홈 화면 추가 또는 PWA 여부

## 운영 위험

### 기존 그룹웨어 링크

현재:

```text
https://jeakyung.quv.kr
```

새 그룹웨어가 Production에서 완전히 검증될 때까지 유지한다.

### Production 전환

별도 체크리스트 필요:

- Production 환경 변수
- 도메인 rewrite
- Supabase Redirect URL
- 보안 헤더
- 관리자 계정
- 백업
- 롤백
- 모니터링
- 직원 공지

### 메일 연동

mail.jeakyung.com은 IWINV Terra Mail/Roundcube 기반이다.

우선순위:

1. 공식 SSO 또는 iframe
2. API/token
3. 서버 측 IMAP/SMTP

금지:

- 브라우저 IMAP/SMTP
- 평문 비밀번호 저장

### 유지보수 시스템

현재 코드는 개발자가 수정하기 쉬운 구조지만, 관리자가 이미지·팝업·전체 톤을 직접 관리하는 CMS 수준은 아직 아니다.

그룹웨어 완성 후 [유지보수·디자인 계획](./09_MAINTENANCE_AND_DESIGN_PLAN.md)을 실행한다.

## 문서 관리 위험

작업 후 문서를 갱신하지 않으면 다음 작업자가 오래된 HEAD나 완료되지 않은 계획을 기준으로 작업할 수 있다.

각 작업 완료 후 반드시:

- `02_CURRENT_STATUS.md`
- `05_PROGRESS_LOG.md`
- 해당 Phase 계획
- 변경된 의사결정 문서

를 갱신한다.
