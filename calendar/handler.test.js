import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { eventsInRange, handleCalendar, parseIcs } from './handler.js';

const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; });

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:allday@test',
  'DTSTART;VALUE=DATE:20261105',
  'DTEND;VALUE=DATE:20261107',
  'SUMMARY:창고 점검\\, 이천',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:utc@test',
  'DTSTART:20261104T010000Z',
  'DTEND:20261104T020000Z',
  'SUMMARY:주간 회의',
  'LOCATION:본사 회의실',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly@test',
  'DTSTART;TZID=Asia/Seoul:20261102T090000',
  'DTEND;TZID=Asia/Seoul:20261102T093000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=5',
  'EXDATE;TZID=Asia/Seoul:20261104T090000',
  'SUMMARY:아침 점호',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly@test',
  'RECURRENCE-ID;TZID=Asia/Seoul:20261109T090000',
  'DTSTART;TZID=Asia/Seoul:20261109T100000',
  'DTEND;TZID=Asia/Seoul:20261109T103000',
  'SUMMARY:아침 점호(시간 변경)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:monthly@test',
  'DTSTART;VALUE=DATE:20261030',
  'RRULE:FREQ=MONTHLY;BYDAY=-1FR',
  'SUMMARY:월말 정산',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:cancel@test',
  'DTSTART;VALUE=DATE:20261110',
  'STATUS:CANCELLED',
  'SUMMARY:취소됨',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const day = (s) => Date.parse(`${s}T00:00:00Z`);

test('종일·UTC·반복·예외·변경·취소 일정을 한국 시각으로 펼친다', () => {
  const events = eventsInRange(parseIcs(ICS), day('2026-11-01'), day('2026-11-30') + 86_399_000);
  const byTitle = (t) => events.filter((e) => e.title === t);
  assert.deepEqual(byTitle('창고 점검, 이천').map((e) => [e.start, e.end, e.allDay]), [['2026-11-05', '2026-11-07', true]]);
  assert.deepEqual(byTitle('주간 회의').map((e) => [e.start, e.end, e.location]), [['2026-11-04T10:00', '2026-11-04T11:00', '본사 회의실']]);
  // 11/2(월), 11/4(수, 제외), 11/9(월, 변경), 11/11(수), 11/16(월) — COUNT 5는 제외·변경분도 센다
  assert.deepEqual(byTitle('아침 점호').map((e) => e.start), ['2026-11-02T09:00', '2026-11-11T09:00', '2026-11-16T09:00']);
  assert.deepEqual(byTitle('아침 점호(시간 변경)').map((e) => e.start), ['2026-11-09T10:00']);
  assert.deepEqual(byTitle('월말 정산').map((e) => e.start), ['2026-11-27']);
  assert.equal(byTitle('취소됨').length, 0);
});

test('로그인 토큰이 없으면 막고, 승인 회원이 아니면 캘린더를 읽지 않는다', async () => {
  const req = (auth) => new Request('https://jeakyung.com/api/calendar?start=2026-11-01&end=2026-11-30', { headers: auth ? { Authorization: auth } : {} });
  assert.equal((await handleCalendar(req(null), {})).status, 401);
  let feedCalled = false;
  globalThis.fetch = async (url) => {
    if (String(url).includes('is_approved_member')) return new Response('false', { status: 200 });
    feedCalled = true;
    return new Response(ICS);
  };
  const denied = await handleCalendar(req('Bearer token'), { GOOGLE_CALENDAR_ICS_URL: 'https://example.com/private.ics' });
  assert.equal(denied.status, 403);
  assert.equal(feedCalled, false);
});

test('승인 회원에게는 일정만 주고 캘린더 주소는 내보내지 않는다', async () => {
  globalThis.fetch = async (url) => (String(url).includes('is_approved_member')
    ? new Response('true', { status: 200 })
    : new Response(ICS));
  const res = await handleCalendar(new Request('https://jeakyung.com/api/calendar?start=2026-11-01&end=2026-11-30', { headers: { Authorization: 'Bearer token' } }), { GOOGLE_CALENDAR_ICS_URL: 'https://example.com/secret-private.ics' });
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.ok(!text.includes('secret-private'));
  assert.ok(JSON.parse(text).events.length > 0);
});

test('기간이 잘못되면 거부한다', async () => {
  const res = await handleCalendar(new Request('https://jeakyung.com/api/calendar?start=2026-01-01&end=2026-12-31', { headers: { Authorization: 'Bearer t' } }), {});
  assert.equal(res.status, 400);
});
