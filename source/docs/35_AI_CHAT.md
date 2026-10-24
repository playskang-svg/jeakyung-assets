# 공개 사이트 AI 상담 운영

## 구성

- 화면: `src/public-site/components/common/ChatWidget.jsx`, `chatWidget.css`. 공개 페이지 공통 푸터에 장착된다.
- 서버: 저장소 루트 `worker.js`가 `/api/chat` 요청을 `chat/handler.js`로 전달한다.
- 기본 답변 기준: `chat/systemPrompt.js`. 상세 자료와 사람 담당자 연결 기준을 받으면 여기서 갱신한다.
- 모델: `claude-sonnet-4-6`. 서버에서만 Claude Messages API를 호출한다.

## 운영 활성화

1. jeakyung.com 운영 Cloudflare 계정(`jeakyungdrive01@gmail.com`, 계정 ID는 `wrangler.jsonc`)의 Worker `jeakyung`에 `ANTHROPIC_API_KEY`를 **Secret**으로 등록한다. 값은 Git, Vite 환경 변수, 브라우저 코드에 넣지 않는다.
2. Claude API 계정의 결제·사용 한도를 확인한다.
3. 운영 도메인에서 동의 후 메시지를 전송하여 실제 Claude 답변, 에러 시 카카오톡 연결, 모바일 화면을 확인한다.

키가 없으면 API는 503을 반환하며 가짜 답변을 생성하지 않는다. 현재 대화 원문은 브라우저 메모리에서만 유지되고 새로고침 시 사라진다. 서버는 문의 원문을 기록하지 않는다.

공개 화면은 `/api/chat/status`가 `available: true`를 반환할 때만 AI 상담 버튼을 보여준다. 키가 없으면 기존 카카오톡 상담 동선이 유지되며, 키 등록 후 새로고침하면 AI 상담 버튼이 나타난다.

요청당 최대 12개 메시지, 사용자 메시지당 700자, 출력 450토큰을 적용한다. Worker 인스턴스 메모리 기반의 분당 제한은 기초 방어일 뿐 전역 사용량 제한은 아니다. 실제 비용 보호에는 Claude 계정 한도와 Cloudflare 계정의 별도 전역 제한이 필요하다.

## 추후 자료 반영

사용자가 제공할 검증된 회사 정보, FAQ, 답변 금지 또는 담당자 연결 기준을 `chat/systemPrompt.js`에 반영한다. 긴 자료나 자주 갱신되는 자료는 별도 지식 저장소로 옮기고 출처·갱신일을 관리한다. 지금 구현은 대화를 학습하거나 운영자에게 자동 전송하지 않는다.
