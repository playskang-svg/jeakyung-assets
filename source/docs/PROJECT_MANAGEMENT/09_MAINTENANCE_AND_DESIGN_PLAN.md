# 유지보수·디자인 시스템 계획

[문서 목록](./00_INDEX.md) · [전체 계획](./03_MASTER_PLAN.md) · [결정 사항](./04_DECISIONS_AND_GUARDRAILS.md)

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
