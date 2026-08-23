# 내비게이션과 링크

## URL 영역

- 공개 MPA: `/`, `/privacy/`.
- 그룹웨어 SPA 진입: `/groupware/`.
- 공개 사이트의 기존 `https://jeakyung.quv.kr` 링크는 운영 전환 승인 전까지 변경하지 않는다.

## 그룹웨어 경로

### 인증 없이 접근 가능한 경로

| 경로 | 목적 |
| --- | --- |
| `/groupware/login` | 로그인 UI |
| `/groupware/signup` | 임직원 가입 신청 UI |
| `/groupware/pending` | 관리자 승인 대기 안내 |
| `/groupware/reset-password` | 재설정 요청 UI |

`/groupware`와 `/groupware/`는 현재 `/groupware/login`으로 이동한다.

### 인증이 필요한 경로

- `/groupware/dashboard`
- `/groupware/mail`
- `/groupware/organization`
- `/groupware/boards`
- `/groupware/boards/:boardSlug`
- `/groupware/boards/:boardSlug/posts/:postId`
- `/groupware/boards/:boardSlug/write`
- `/groupware/approval`
- `/groupware/calendar`
- `/groupware/files`
- `/groupware/admin`

Phase G0–G1에서는 실제 세션이 없으므로 모든 보호 경로를 로그인으로 이동시키며 `state.from`에 원래 위치만 보존한다. 가짜 로그인이나 `localStorage` 인증은 금지한다.

## Sidebar 순서

1. 대시보드
2. 이메일
3. 조직도
4. 게시판
5. 전자결재
6. 일정
7. 파일
8. 관리자

관리자 항목은 향후 권한 판정 결과를 주입받는 구조로 두며 현재 가짜 역할로 노출 여부를 결정하지 않는다. 게시판 하위 그룹은 [`29_BOARD_SYSTEM.md`](29_BOARD_SYSTEM.md)를 따른다.

## 링크 기준

- 내부 이동은 React Router의 `Link` 또는 `NavLink`를 사용한다.
- 외부 새 창 링크에는 `noopener noreferrer`와 새 창 안내를 제공한다.
- 버튼은 동작, 링크는 이동에 사용한다.
- 활성 경로는 `aria-current="page"`로 표시한다.

## Vercel 직접 접근

- `/groupware`, `/groupware/`, `/groupware/*`만 `/groupware/index.html`로 Rewrite한다.
- `/assets/*`, `/privacy/`, 공개 사이트와 API 경로는 Rewrite하지 않는다.
- 전역 SPA fallback은 사용하지 않는다.
