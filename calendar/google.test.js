import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { eventTimes, handleCalendarWrite, handleDocs, mapEvent } from './google.js';

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
