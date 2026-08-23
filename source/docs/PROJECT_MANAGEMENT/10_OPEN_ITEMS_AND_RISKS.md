# 남은 항목과 위험

[문서 목록](./00_INDEX.md) · [현재 상태](./02_CURRENT_STATUS.md) · [G4 계획](./08_G4_APPROVAL_PLAN.md)

## 즉시 다음 작업

1. Supabase 원격 DB `202608060002_approval_workflow_contract_repair.sql` 적용 완료 확인 및 DB lint (0 error) 검증 완료
2. 직접·위임 결재자의 제출·승인·반려·보류·회수 v2 RPC 상태 전이 검증 완료
3. 최고관리자 게시판 생성과 역할·부서·사용자별 권한 시나리오 검증 완료
4. 1440px·1024px·390px·320px 관리자와 사용자 화면 레이아웃 및 키보드 접근성 통과
5. Vercel Preview 배포 준비 및 회귀 검증 진행

Supabase 원격 마이그레이션 목록은 `202607300001`부터 `202608060002`까지 19개 전체가 무결하게 적용된 상태이며, 원격 DB lint error 0건 및 `npx supabase db push --linked --dry-run` upToDate 상태를 확인했다.

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
