# 새 작업 지시서 템플릿

[문서 목록](./00_INDEX.md) · [핵심 지시](./06_WORK_INSTRUCTION_CORE.md) · [절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md)

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
