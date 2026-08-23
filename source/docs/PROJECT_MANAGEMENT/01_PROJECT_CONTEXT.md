# 프로젝트 전체 맥락

[문서 목록](./00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

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
