import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { handleChat, handleChatStatus } from './handler.js';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

function request(messages, origin = 'https://jeakyung.com') {
  return new Request('https://jeakyung.com/api/chat', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' },
    body: JSON.stringify({ messages }),
  });
}

test('API key가 없으면 외부 호출 없이 503을 반환한다', async () => {
  globalThis.fetch = () => { throw new Error('must not call API'); };
  const response = await handleChat(request([{ role: 'user', content: '안녕하세요' }]), {});
  assert.equal(response.status, 503);
});

test('상담 가능 상태는 키 값 없이 불리언만 반환한다', async () => {
  const statusRequest = new Request('https://jeakyung.com/api/chat/status');
  assert.deepEqual(await (await handleChatStatus(statusRequest, {})).json(), { available: false });
  const ready = await handleChatStatus(statusRequest, { ANTHROPIC_API_KEY: 'private-test-key' });
  assert.deepEqual(await ready.json(), { available: true });
});

test('다른 출처와 잘못된 대화 형식을 거부한다', async () => {
  assert.equal((await handleChat(request([{ role: 'user', content: 'x' }], 'https://other.example'), { ANTHROPIC_API_KEY: 'test' })).status, 403);
  assert.equal((await handleChat(request([{ role: 'assistant', content: 'x' }]), { ANTHROPIC_API_KEY: 'test' })).status, 400);
});

test('서버에서만 API 키를 사용하고 답변 텍스트만 반환한다', async () => {
  let sent;
  globalThis.fetch = async (_url, options) => {
    sent = options;
    return new Response(JSON.stringify({ content: [{ type: 'text', text: '담당자 상담을 안내드립니다.' }] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  };
  const response = await handleChat(request([{ role: 'user', content: '견적 문의' }]), { ANTHROPIC_API_KEY: 'private-test-key' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: '담당자 상담을 안내드립니다.' });
  assert.equal(sent.headers['x-api-key'], 'private-test-key');
  assert.equal(JSON.parse(sent.body).model, 'claude-sonnet-4-6');
  assert.ok(!JSON.stringify(response.headers).includes('private-test-key'));
});

test('Claude 오류는 원문 없이 진단 코드만 반환한다', async () => {
  globalThis.fetch = async () => new Response('{"error":{"message":"private upstream detail"}}', { status: 401 });
  const response = await handleChat(request([{ role: 'user', content: '안내 부탁드립니다' }]), { ANTHROPIC_API_KEY: 'private-test-key' });
  assert.equal(response.status, 502);
  const data = await response.json();
  assert.equal(data.code, 'upstream_auth');
  assert.ok(!JSON.stringify(data).includes('private upstream detail'));
  assert.ok(!JSON.stringify(data).includes('private-test-key'));
});
