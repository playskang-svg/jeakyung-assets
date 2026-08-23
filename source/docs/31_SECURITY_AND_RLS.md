# 보안과 Supabase RLS

## 기본 원칙

- 모든 업무 테이블은 RLS를 활성화하고 기본 거부 정책을 사용한다.
- 브라우저가 보낸 역할, 부서, 작성자 ID를 신뢰하지 않는다.
- UI에서 메뉴나 버튼을 숨기는 것은 보안 통제가 아니다.
- `service_role`과 서버 비밀은 브라우저 번들, 저장소와 로그에 포함하지 않는다.

## 계층별 책임

1. React UI: 사용 가능한 작업을 안내하고 입력을 검증하되 최종 권한을 판정하지 않는다.
2. Supabase Auth: 세션과 사용자 식별을 제공한다.
3. RLS: 사용자·조직·리소스 관계로 행 읽기·쓰기를 제한한다.
4. 서버 함수: 관리자 승인, 권한 변경, 잠금, 보관과 최종 삭제 같은 고위험 작업을 수행한다.
5. 감사 로그: 누가 언제 무엇을 왜 변경했는지 기록한다.

## RLS 정책 영역

- 프로필: 본인 조회·허용 필드 수정, 관리자 범위 조회.
- 조직: 활성 조직 기본 조회, 관리자만 변경.
- 게시판: 게시판 읽기 권한과 글·댓글 권한을 모두 통과.
- 결재: 기안자, 결재선, 참조자와 관리자 범위만 조회.
- 일정·파일: 소유자, 공유 범위, 부서와 명시 권한으로 제한.
- 보관 데이터: 일반 목록에서 제외하고 별도 보관 권한 필요.

## 서버 함수가 필요한 작업

- 가입 승인·거절, 계정 잠금·해제와 퇴사 처리
- 역할 부여·회수와 관리자 승격
- 부서 이동, 보관과 안전한 최종 삭제
- 게시판 생성·권한 변경·최종 삭제
- 메일 계정 자동화가 공식 API로 승인된 경우의 계정 작업

## 웹 보안

- 비밀번호는 평문 저장·로깅하지 않는다.
- 세션 토큰을 URL에 넣지 않는다.
- 사용자 콘텐츠는 HTML로 직접 주입하지 않는다.
- 업로드는 확장자뿐 아니라 MIME, 크기, 접근 권한과 악성 파일 검사를 적용한다.
- 인증·재설정·관리 작업에 속도 제한, 재인증과 CSRF 위협을 검토한다.
- 오류 응답으로 계정 존재 여부와 내부 권한 정보를 과도하게 노출하지 않는다.

## G0–G1 상태

G0–G1에서는 Supabase URL, 공개 키, 스키마와 RLS를 연결하지 않았다.

## G2 정책과 함수

- `departments`, `positions`, `job_titles`, `profiles`, `roles`, `user_role_assignments`, `audit_logs`에 RLS를 활성화한다.
- 사용자는 본인 프로필만 읽고 열 수준 권한으로 이름·연락처만 수정할 수 있다. 상태·조직·승인자·역할은 직접 수정할 수 없다.
- 활성 조직 조회는 승인 회원에게만 허용하고 가입 선택지는 최소 필드만 반환하는 `get_signup_options()` RPC를 사용한다.
- `has_role()`, `is_approved_member()`, `is_membership_admin()`은 사용자 수정 가능 metadata가 아닌 DB 행을 확인한다.
- `approve_membership()`, `reject_membership()`, `upsert_organization_item()`은 `SECURITY DEFINER`, 고정 `search_path`, 호출자 재검증과 감사 기록을 사용한다.
- 함수 실행 권한은 `anon`·`authenticated`에 필요한 범위만 부여하고 감사 로그의 일반 수정·삭제는 허용하지 않는다.
- 브라우저에는 `VITE_SUPABASE_URL`과 publishable key만 제공하며 실제 값은 Git에 저장하지 않는다.

실제 프로젝트에서의 정책 공격 시나리오 검증은 마이그레이션 적용과 관리자 부트스트랩 후 수행한다.

## G3 대시보드·게시판 보안

- G3의 신규 public 테이블 15개는 모두 RLS를 활성화하고, 일반 테이블 직접 권한은 자기 위젯 설정·즐겨찾기·최근 방문에 필요한 최소 범위만 부여한다.
- 위젯 배포는 `get_my_dashboard_widgets()`, 게시판 접근은 `evaluate_board_access()`와 호출 사용자 전용 `can_access_board()`에서 중앙 판정한다.
- 권한 기본값은 deny이며 일치하는 explicit deny가 하나라도 있으면 allow보다 우선한다. `user_metadata`는 판정에 사용하지 않는다.
- 익명 응답은 이름을 `익명`으로 치환하고 작성자 UUID를 일반 RPC 응답에서 제외한다. 실제 소유자 확인은 서버 함수 안에서 수행한다.
- 첨부는 비공개 Storage 버킷, 권한 확인 함수, 정규화한 UUID 기반 경로와 60초 signed URL을 사용한다. soft delete된 첨부 경로는 Storage 읽기 정책에서도 차단한다.
- 본문 이미지 업로드는 사용자 JWT로 보호된 `board-image-upload` Edge Function을 통한다. `attachment_upload`와 글 작성·수정 권한을 모두 확인하고, 브라우저 검증 뒤에도 서버에서 MIME·매직 바이트·ImageMagick WASM 디코딩·크기·개수·합산 용량을 재검증한다.
- Edge Function은 `@supabase/server` 1.4.1과 `@imagemagick/magick-wasm` 0.0.41을 고정해 사용한다. Storage insert 정책도 경로 소유권·게시글 편집 권한·형식·크기·장수·합산 용량을 확인하고, 교체 실패 시 신규 객체를 제거한다.
- 저장 본문에는 URL이나 Base64를 허용하지 않는다. 서버의 JSON 노드·mark 허용 목록과 동일 게시글 attachment 소유 검증으로 XSS와 다른 게시글 attachment ID 도용을 차단한다.
- 본문 이미지 조회는 `detail_read`와 `attachment_view`를 모두 통과한 뒤 짧은 signed URL을 발급한다. 일반 첨부 다운로드에는 `attachment_download`도 요구한다.
- 익명 글의 첨부 응답에는 `uploaded_by`를 포함하지 않는다. 이미지 등록 RPC는 Edge Function의 서버 전용 관리자 클라이언트만 실행하며 `service_role`·secret은 브라우저 번들, Git과 로그에 포함하지 않는다.
- 관리자 시스템 사용량 RPC는 `SECURITY DEFINER`와 고정 `search_path`를 사용하되 `is_membership_admin()`을 먼저 검증하고, 집계값 외의 사용자·파일 경로는 반환하지 않는다.
- 미등록 Storage 객체와 정리 후보는 개수·용량만 노출하며 관리자 화면에서 즉시 영구 삭제하지 않는다.
- 관리자 설정 변경·권한 변경·보관·안전 삭제는 감사 로그에 기록한다.

## 활성 역할과 프로필 사진 보안

- `has_role()`, `is_membership_admin()`, 대시보드 역할 대상과 게시판 역할 대상은 모든 보유 역할이 아니라 `user_active_roles`와 활성 배정 행을 함께 검증한다.
- `set_my_active_role()`은 `auth.uid()` 본인, 승인·재직 상태, 실제 활성 배정을 다시 확인한다. 임의 사용자 ID와 미배정·해제 역할은 받을 수 없다.
- 사용자 프로필 변경은 허용 필드 전용 RPC로만 처리하며 기존 직접 열 수정 권한은 회수한다. 공식 인사 정보와 다중 역할 편집은 활성 관리자 RPC만 수행한다.
- `groupware-profile-photos`는 private 버킷이다. 인증 사용자의 Storage 직접 업로드 정책은 두지 않고 Edge Function이 MIME, 매직 바이트, 실제 디코딩, 정사각형과 512px·5MB 제한을 통과한 객체만 기록한다.
- 사진 조회는 본인 또는 활성 관리자만 짧은 signed URL을 만들 수 있다. 교체된 사진은 읽기 정책에서 제외하고 정리 후보로 남긴다.
- 역할 부여·해제·전환, 관리자 역할 진입·복귀, 공식 프로필과 사진 변경, 마지막 최고 관리자 제거 차단을 감사한다. 전화번호 원문과 비밀정보는 감사 metadata에 넣지 않는다.
