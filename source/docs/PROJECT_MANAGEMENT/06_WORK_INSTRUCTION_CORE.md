# 작업자에게 전달할 핵심 지시

[문서 목록](./00_INDEX.md) · [절대 규칙](./04_DECISIONS_AND_GUARDRAILS.md) · [작업 템플릿](./07_WORK_ORDER_TEMPLATE.md)

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
