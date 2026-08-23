# 재경닷컴 프로젝트 문서 체계

이 폴더는 재경닷컴 공개 웹사이트와 사내 그룹웨어 개발을 누구라도 일관된 방식으로 이어갈 수 있도록 만든 기준 문서 모음이다.

## 저장 위치

이 폴더는 저장소의 다음 위치에 둔다.

```text
docs/PROJECT_MANAGEMENT/
```

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
11. [게시판 운영 인수 검수 체크리스트](./11_BOARD_ACCEPTANCE_CHECKLIST.md)

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
- `11_BOARD_ACCEPTANCE_CHECKLIST.md`: 게시판 유형·권한·직접 접근·모바일 인수 조건을 정의한다.

## 업데이트 규칙

작업이 끝날 때마다 최소한 다음 파일을 갱신한다.

- `02_CURRENT_STATUS.md`
- `05_PROGRESS_LOG.md`
- 해당 Phase 계획 문서
- 변경된 결정이 있으면 `04_DECISIONS_AND_GUARDRAILS.md`

작업 지시를 새로 만들 때는 `06_WORK_INSTRUCTION_CORE.md`와 `07_WORK_ORDER_TEMPLATE.md`를 먼저 참고한다.

## 기준 시각

마지막 정리 시각: **2026-08-05 KST**
