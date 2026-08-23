# Phase G4 전자결재 계획

[문서 목록](./00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [전체 계획](./03_MASTER_PLAN.md)

상태: **G4 전자결재 실사용 기능 로컬 구현 완료, 통합 DB 적용 검증 대기**

## G4-2 로컬 구현 (2026-08-05)

추가 마이그레이션:

```text
202607310012_groupware_approval_workflow_guards_pending.sql
202608050003_approval_workflow_delivery.sql
202608050004_approval_signatures_notifications.sql
```

완료 범위:

- 관리자 분류·양식·동적 필드·기본 결재선 설정과 버전 발행
- 일반 품의서 예시 양식
- 서버 트랜잭션 기반 임시 저장, Revision과 결재선 Snapshot 생성
- 연도별 중복 방지 문서번호 발급과 제출
- 순차·병렬 전체·필수 인원 결재 진행
- 승인·반려·보류·보류 해제·회수·보관
- 본인 결재와 차례가 아닌 처리 차단
- 결재 요청·승인·반려·보류 내부 알림
- 실제 데이터 기반 결재 홈, 결재함, 문서 상세와 처리 이력
- 관리자 경로 `/groupware/approval/admin/templates`
- 이름·부서·직급 검색형 사용자 지정 결재선과 순서 변경
- 개인 도장 이미지·직접 그린 서명 등록, 승인 시 사용 표시 Snapshot 기록
- 전자결재 메뉴 원형 대기 건수와 상단 개인 알림·읽음 처리
- 기간·범위별 대결·위임 등록과 해제

2026-08-06 추가 완료:

- 기안 첨부파일 최대 10개, 파일당 20MB 비공개 업로드·다운로드·초안 삭제
- 문서 참여자 의견 등록과 작성자 삭제
- 이름 검색형 참조·열람자 지정, 참조함과 읽음 처리·알림
- 결재 문서 인쇄 최적화
- 활성 최고관리자의 사유 필수 강제 취소와 감사·알림

추가 마이그레이션은 `202608060001_approval_completion.sql`이다. 현재 환경에는 Docker 또는 Podman이 없어 신규 마이그레이션 전체 재적용은 대기 중이며 원격 Supabase 적용 여부도 별도로 확인한다.

## 현재 기준

현재 브랜치:

```text
groupware/approval
```

현재 HEAD:

```text
b10fac9 fix(groupware): align delegated approval document access
```

직전 기능 커밋:

```text
779084e feat(groupware): secure approval inbox and policies
```

기준 상태:

- 원격 `origin/groupware/approval`과 동기화 완료
- `main` 미변경
- Supabase 원격 미적용
- Vercel Preview 미배포
- Production 미변경

## G4-1 완료 범위

### 데이터 기반

작성 완료:

```text
202607310008_groupware_approval_core.sql
202607310009_groupware_approval_notifications_storage.sql
202607310010_groupware_approval_security_logic.sql
202607310011_groupware_approval_rls_inbox.sql
```

포함 영역:

- 결재 분류
- 결재 양식
- 양식 버전
- 문서번호 시퀀스
- 결재 문서
- 문서 Revision
- 결재 단계
- 단계별 결재자
- 결재 처리 이력
- 참조·열람
- 의견
- 첨부파일
- 대결·위임
- 전결 규칙
- 개인 저장 결재선
- 내부 알림 기반
- 비공개 Storage 기반

### 결재함

완료:

- 서버 RPC 기반 결재함
- 직접 배정 문서 조회
- 유효한 위임 문서 조회
- 진행 중 및 보류 문서 조회
- 활성 결재 단계 조회
- 결재자 상태 조회
- 위임 여부 표시
- 기안자 이름 표시
- 문서번호 미발급 처리
- 로딩·빈 상태·오류·재시도 UI

### 보안

완료:

- 승인된 회원만 전자결재 기본 데이터 조회
- 관리자 비활성·보관 양식 조회 허용
- 문서 참여자 기반 열람 정책
- 문서 하위 엔터티의 문서 권한 상속
- 기안자 수정 가능 상태 제한
- 함수 실행 권한 제한
- 위임 결재함과 문서 상세 접근 규칙 통일
- 위임 기간·상태·범위 검증
- `SECURITY DEFINER` 함수의 명시적 `search_path`
- 관련 함수의 RLS 재귀 방지 설정

### 검증

완료:

- `npx supabase db reset`
- 전체 마이그레이션 `001`부터 `011` 적용
- Vite Production build
- `git diff --check`
- 원격 브랜치 Push

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

## 마이그레이션

현재 작성된 파일:

```text
202607310008_groupware_approval_core.sql
202607310009_groupware_approval_notifications_storage.sql
202607310010_groupware_approval_security_logic.sql
202607310011_groupware_approval_rls_inbox.sql
202607310012_groupware_approval_workflow_guards_pending.sql
202608050003_approval_workflow_delivery.sql
202608050004_approval_signatures_notifications.sql
202608060001_approval_completion.sql
```

원격 적용은 아직 하지 않았다.

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

## G4-2 다음 검증 순서

### 1. 직접 결재자 시나리오

- 기안자 문서 생성
- 문서 제출
- 첫 결재 단계 활성화
- 지정 결재자 결재함 노출
- 지정 결재자 문서 상세 접근
- 비지정 사용자 결재함 미노출
- 비지정 사용자 직접 URL 차단

### 2. 위임 결재자 시나리오

- 전체 범위 위임
- 특정 양식 위임
- 특정 부서 위임
- 시작 전 위임 미적용
- 유효 기간 내 위임 적용
- 종료 후 위임 미적용
- 취소된 위임 미적용
- 위임받은 사용자의 결재함 노출
- 위임받은 사용자의 문서 상세 접근
- 원 결재자와 실제 처리자 기록

### 3. 참조·열람 시나리오

- 참조자 문서 조회
- 열람자 문서 조회
- 관계없는 사용자 직접 URL 차단
- 읽음 시각 기록
- 읽지 않은 참조 개수
- 참조·열람함 전용 RPC

### 4. 다음 구현

- 실제 대결·위임 관리 화면
- 위임 생성·수정·취소 RPC
- 순환 위임 차단
- 중복 기간 위임 검증
- 기안 생성 트랜잭션 RPC
- 승인·반려·보류·회수 처리 RPC
- 양식 빌더
- 양식 버전 발행
- 첨부파일 업로드
- 내부 알림

## 제외

- 메일 발송
- mail.jeakyung.com 연동
- 일정 연동
- 모바일 Push
- 일반 파일함
- 급여·인사평가·근태
- 공인전자서명 주장
- Production과 도메인

## 현재 제한 및 승인 대기 항목

현재 G4 착수 장애는 없다.

G4-1 보안 기반과 로컬 마이그레이션 검증은 완료됐다. 다음 단계는 실제 테스트 데이터를 사용한 권한 및 결재 흐름 검증이다.

사용자 승인 전에는 다음 작업을 진행하지 않는다.

- Supabase 원격 마이그레이션 적용
- Vercel Preview 배포
- Production 배포
- PR 생성
- `main` 병합
- 공개 홈페이지 변경
- 도메인·DNS·CNAME 변경

원격 적용 전 필수 조건:

- 직접 결재자 시나리오 통과
- 위임 결재자 시나리오 통과
- 권한 없는 사용자 접근 차단 확인
- 참조·열람 권한 설계 확정
- 마이그레이션 재실행 가능성 확인
- 프런트엔드 회귀 검사 통과
