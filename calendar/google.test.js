import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { DOCS_FOLDER_ID, eventTimes, handleCalendarWrite, handleDocs, mapEvent } from './google.js';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

const form = (o) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

test('입력 폼을 구글 일정 시각으로 바꾼다(종일은 끝 다음 날, 시간은 한국 시각)', () => {
  assert.deepEqual(eventTimes(form({ date: '2026-11-05', allDay: '1' })), { start: { date: '2026-11-05' }, end: { date: '2026-11-06' } });
  assert.deepEqual(eventTimes(form({ date: '2026-11-05', endDate: '2026-11-07', allDay: '1' })).end, { date: '2026-11-08' });
  assert.equal(eventTimes(form({ date: '2026-11-05', startTime: '10:00', endTime: '11:30' })).start.dateTime, '2026-11-05T10:00:00+09:00');
  assert.equal(eventTimes(form({ date: '2026-11-05', startTime: '11:00', endTime: '10:00' })), null);
  assert.equal(eventTimes(form({ date: 'x' })), null);
});

test('구글 일정을 화면용으로 바꾸고, 수정 권한은 등록자·관리자에게만 준다', () => {
  const item = { id: 'e1', summary: '회의', start: { dateTime: '2026-11-04T01:00:00Z' }, end: { dateTime: '2026-11-04T02:00:00Z' },
    attachments: [{ fileId: 'f1', title: '안건.pdf', mimeType: 'application/pdf' }], extendedProperties: { private: { createdBy: 'u1' } } };
  const own = mapEvent(item, { id: 'u1', isAdmin: false });
  assert.equal(own.start, '2026-11-04T10:00');
  assert.equal(own.canEdit, true);
  assert.equal(own.attachments[0].title, '안건.pdf');
  assert.equal(mapEvent(item, { id: 'u2', isAdmin: false }).canEdit, false);
  assert.equal(mapEvent(item, { id: 'u2', isAdmin: true }).canEdit, true);
});

test('승인 회원이 아니면 등록·문서 만들기를 막는다', async () => {
  globalThis.fetch = async () => new Response('{}', { status: 401 });
  const w = await handleCalendarWrite(new Request('https://jeakyung.com/api/calendar/events', { method: 'POST', headers: { Authorization: 'Bearer t' } }), { GOOGLE_OAUTH: '{}' }, new URL('https://jeakyung.com/api/calendar/events'));
  assert.equal(w.status, 403);
  const d = await handleDocs(new Request('https://jeakyung.com/api/docs', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: '{}' }), { GOOGLE_OAUTH: '{}' });
  assert.equal(d.status, 403);
});

// 회원 확인·토큰·기록은 통과시키고, 드라이브 파일 만들기 요청 본문만 모은다.
function mockGoogle(folderStatus) {
  const creates = [];
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/auth/v1/user')) return new Response('{"id":"u1"}');
    if (u.includes('/rpc/is_approved_member')) return new Response('true');
    if (u.includes('/rpc/')) return new Response('false');
    if (u.includes('oauth2.googleapis.com')) return new Response('{"access_token":"a","expires_in":3600}');
    if (u.includes('/permissions')) return new Response('{}');
    const body = JSON.parse(init.body);
    creates.push(body);
    if (body.parents && folderStatus !== 200) return new Response('{}', { status: folderStatus });
    return new Response(JSON.stringify({ id: 'f1', name: body.name, webViewLink: 'https://docs.google.com/x' }));
  };
  return creates;
}
const docReq = () => new Request('https://jeakyung.com/api/docs', { method: 'POST', headers: { Authorization: 'Bearer t' }, body: JSON.stringify({ type: 'doc', name: '회의록' }) });

test('문서는 공용 폴더에 만든다', async () => {
  const creates = mockGoogle(200);
  const res = await handleDocs(docReq(), { GOOGLE_OAUTH: '{}' });
  assert.equal(res.status, 201);
  assert.deepEqual(creates.map((c) => c.parents), [[DOCS_FOLDER_ID]]);
});

test('공용 폴더에 넣을 권한이 없으면(404·403) 루트에 만든다', async () => {
  for (const status of [404, 403]) {
    const creates = mockGoogle(status);
    const res = await handleDocs(docReq(), { GOOGLE_OAUTH: '{}' });
    assert.equal(res.status, 201);
    assert.deepEqual(creates.map((c) => c.parents), [[DOCS_FOLDER_ID], undefined]);
  }
});
