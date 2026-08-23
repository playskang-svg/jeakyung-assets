# 프로젝트 문서 색인

## 문서 운영 원칙

- 공개 사이트 전체 요구사항의 기준 문서는 [`WEBSITE_SPEC.md`](../WEBSITE_SPEC.md)이다.
- 그룹웨어 세부 요구사항은 아래 담당 문서가 단일 기준이다.
- 문서 간 중복 대신 링크를 사용하고, 미확정 정보는 `[미정]`으로 표시한다.
- 구현 상태 표기는 `확정`, `골격 구현`, `연동 대기`, `미정`을 사용한다.

## 그룹웨어 문서

| 문서 | 고유 목적 | 상태 |
| --- | --- | --- |
| [`21_RESPONSIVE_SYSTEM.md`](21_RESPONSIVE_SYSTEM.md) | 화면 폭, App Shell 전환과 접근성 기준 | 확정 |
| [`22_NAVIGATION_AND_LINKS.md`](22_NAVIGATION_AND_LINKS.md) | 공개·인증·보호 경로와 링크 정책 | 확정 |
| [`23_PAGE_CONTENT_PLAN.md`](23_PAGE_CONTENT_PLAN.md) | 페이지별 콘텐츠와 빈 상태 구성 | 확정 |
| [`24_USER_FLOWS.md`](24_USER_FLOWS.md) | 가입, 승인, 로그인, 재설정과 내비게이션 흐름 | 확정 |
| [`27_AUTH_AND_MEMBERSHIP.md`](27_AUTH_AND_MEMBERSHIP.md) | 회원 상태와 인증 수명주기 | G2 구현·실연결 검증 대기 |
| [`28_ROLE_AND_PERMISSION_MATRIX.md`](28_ROLE_AND_PERMISSION_MATRIX.md) | 역할별 허용 작업과 권한 판정 원칙 | G2 기본 역할 구현 |
| [`29_BOARD_SYSTEM.md`](29_BOARD_SYSTEM.md) | 게시판 빌더와 Sidebar 그룹 기준 | 후속 구현 기준 확정 |
| [`30_DATABASE_SCHEMA.md`](30_DATABASE_SCHEMA.md) | Supabase 인증·조직·역할 논리 데이터 모델 | G2 마이그레이션 작성 |
| [`31_SECURITY_AND_RLS.md`](31_SECURITY_AND_RLS.md) | RLS, 서버 함수, 비밀정보와 감사 기준 | G2 기본 정책 작성 |
| [`32_ADMIN_SYSTEM.md`](32_ADMIN_SYSTEM.md) | 관리자 기능, 보관과 안전한 삭제 절차 | G2 회원·조직 UI 구현 |
| [`33_MAIL_INTEGRATION.md`](33_MAIL_INTEGRATION.md) | IWINV Terra Mail 연동 우선순위와 보안 | 확정·연동 대기 |
| [`34_POPUP_DOCUMENTS.md`](34_POPUP_DOCUMENTS.md) | 관리자 팝업 문서 작성·예약·공개/그룹웨어 노출 기준 | 구현·DB 적용 대기 |

## 보조 문서

- [`11_ASSET_MANIFEST.md`](11_ASSET_MANIFEST.md): 공개 자산 등록 및 사용 상태
- [`12_REFERENCES.md`](12_REFERENCES.md): 참고 자료의 출처와 적용 범위
- 루트 `CONTENT.md`, `REFERENCES.md`: 초기 빈 문서이며 상세 기준은 위 담당 문서를 우선한다.

## Phase G0–G1 범위

- 구현: React Router SPA, 인증 UI, 보호 경로, App Shell과 내부 페이지 골격.
- 미구현: Supabase, 실제 회원·권한·데이터, 게시판 CRUD, 전자결재, 일정·파일, 실제 메일 연동.
- 공개 사이트는 현재 상태로 동결하며 새 그룹웨어 운영 전환 전까지 기존 외부 그룹웨어 링크를 유지한다.

## Phase G2 범위

- 구현: Supabase Auth 클라이언트, 가입·로그인·로그아웃·비밀번호 복구, 회원 상태 보호 경로, 관리자 승인·거절, 부서·직급·직책, 고정 역할, RLS·RPC·감사 로그 마이그레이션.
- 실연결 대기: Supabase 프로젝트 값, 마이그레이션 적용, 최초 최고 관리자 부트스트랩, Preview 환경 변수와 실제 인증·RLS 통합 검증.
- 미구현: 게시판·위젯 빌더, 전자결재, 일정, 파일, 실제 메일 연동과 Auth Admin API.

## 프로젝트 운영·인수인계

- [프로젝트 관리 문서 시작점](./90_PROJECT_MANAGEMENT/00_INDEX.md)
- [현재 개발 상태](./90_PROJECT_MANAGEMENT/02_CURRENT_STATUS.md)
- [전체 개발 계획](./90_PROJECT_MANAGEMENT/03_MASTER_PLAN.md)
- [결정 사항과 변경 금지 규칙](./90_PROJECT_MANAGEMENT/04_DECISIONS_AND_GUARDRAILS.md)
- [진행 로그](./90_PROJECT_MANAGEMENT/05_PROGRESS_LOG.md)
- [작업자 핵심 지시](./90_PROJECT_MANAGEMENT/06_WORK_INSTRUCTION_CORE.md)
