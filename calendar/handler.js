// 사내일정: 구글 캘린더의 iCal 비공개 주소를 서버에서 읽어 그룹웨어 회원에게만 돌려준다.
// 주소는 Worker 비밀값 GOOGLE_CALENDAR_ICS_URL 에만 두고 브라우저로 내보내지 않는다.
const SUPABASE_URL = 'https://vzswlvumcdxnryrfwkkl.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd';
const FEED_TTL_MS = 60_000;
const MAX_RANGE_DAYS = 100;
const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 3_600_000;

let feedCache = { url: '', at: 0, events: null };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function unescapeText(value) {
  return value.replace(/\\([\\;,nN])/g, (_, ch) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

// 시각은 모두 "한국 시각 벽시계"를 UTC 칸에 담은 ms 값으로 다룬다. 시간대 라이브러리 없이
// 날짜 칸 계산을 단순하게 하려는 것.
// shortcut: TZID가 붙은 시각과 시간대 없는 시각은 모두 한국 시각으로 본다. 해외 시간대 일정이 생기면 VTIMEZONE 해석을 붙인다.
function parseDateValue(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = '0', mi = '0', s = '0', z] = m;
  const allDay = params.VALUE === 'DATE' || m[4] === undefined;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  if (z) ms += KST_OFFSET_MS;
  return { ms, allDay };
}

function parseDuration(value) {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m) return 0;
  const [, sign, w = 0, d = 0, h = 0, mi = 0, s = 0] = m;
  const total = ((+w * 7 + +d) * 24 * 3600 + +h * 3600 + +mi * 60 + +s) * 1000;
  return sign === '-' ? -total : total;
}

export function parseIcs(text) {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const events = [];
  let current = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = { exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (current) events.push(current); current = null; continue; }
    if (!current) continue;
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const [name, ...paramParts] = line.slice(0, colon).split(';');
    const params = Object.fromEntries(paramParts.map((part) => part.split('=')).map(([k, v = '']) => [k.toUpperCase(), v]));
    const value = line.slice(colon + 1);
    switch (name.toUpperCase()) {
      case 'UID': current.uid = value; break;
      case 'SUMMARY': current.title = unescapeText(value); break;
      case 'DESCRIPTION': current.description = unescapeText(value); break;
      case 'LOCATION': current.location = unescapeText(value); break;
      case 'STATUS': current.status = value.toUpperCase(); break;
      case 'DTSTART': current.start = parseDateValue(value, params); break;
      case 'DTEND': current.end = parseDateValue(value, params); break;
      case 'DURATION': current.duration = parseDuration(value); break;
      case 'RRULE': current.rrule = Object.fromEntries(value.split(';').map((part) => part.split('=')).map(([k, v = '']) => [k.toUpperCase(), v])); break;
      case 'EXDATE': for (const item of value.split(',')) { const parsed = parseDateValue(item, params); if (parsed) current.exdates.push(parsed.ms); } break;
      case 'RECURRENCE-ID': current.recurrenceId = parseDateValue(value, params)?.ms ?? null; break;
      default: break;
    }
  }
  return events.filter((event) => event.start && event.status !== 'CANCELLED');
}

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function nthWeekdayOfMonth(year, month, weekday, nth) {
  if (nth > 0) {
    const first = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const day = 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7;
    return day <= new Date(Date.UTC(year, month + 1, 0)).getUTCDate() ? day : null;
  }
  const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const last = new Date(Date.UTC(year, month, lastDate)).getUTCDay();
  const day = lastDate - ((last - weekday + 7) % 7) + (nth + 1) * 7;
  return day >= 1 ? day : null;
}

// 반복 일정 펼치기. 구글 캘린더가 만드는 흔한 꼴(매일·매주 요일·매월 n째 요일/날짜·매년)만 다룬다.
// shortcut: BYMONTH·BYSETPOS·BYYEARDAY 등은 무시한다. 그런 반복이 실제로 쓰이면 그때 붙인다.
export function expandOccurrences(event, rangeStart, rangeEnd) {
  const start = event.start.ms;
  const rule = event.rrule;
  if (!rule) return [start];
  const interval = Math.max(1, parseInt(rule.INTERVAL || '1', 10));
  const count = rule.COUNT ? parseInt(rule.COUNT, 10) : Infinity;
  const until = rule.UNTIL ? parseDateValue(rule.UNTIL, {})?.ms ?? Infinity : Infinity;
  const timeOfDay = start % DAY_MS;
  const byDay = (rule.BYDAY || '').split(',').filter(Boolean).map((token) => {
    const m = /^([+-]?\d+)?([A-Z]{2})$/.exec(token);
    return m ? { nth: m[1] ? parseInt(m[1], 10) : 0, weekday: WEEKDAYS.indexOf(m[2]) } : null;
  }).filter((item) => item && item.weekday >= 0);
  const byMonthDay = (rule.BYMONTHDAY || '').split(',').filter(Boolean).map((v) => parseInt(v, 10));

  const out = [];
  let seen = 0;
  const take = (ms) => {
    if (ms < start || ms > until || seen >= count) return;
    seen += 1;
    if (ms <= rangeEnd && ms >= rangeStart - DAY_MS * 366) out.push(ms);
  };
  const s = new Date(start);
  for (let step = 0; step < 5000 && seen < count; step += 1) {
    let candidates = [];
    if (rule.FREQ === 'DAILY') {
      candidates = [start + step * interval * DAY_MS];
    } else if (rule.FREQ === 'WEEKLY') {
      // 주는 월요일에 시작한다(WKST 기본값).
      const weekStart = start - timeOfDay - ((s.getUTCDay() + 6) % 7) * DAY_MS + step * interval * 7 * DAY_MS;
      const days = byDay.length ? byDay.map((item) => item.weekday) : [s.getUTCDay()];
      candidates = days.map((weekday) => weekStart + ((weekday + 6) % 7) * DAY_MS + timeOfDay).sort((a, b) => a - b);
    } else if (rule.FREQ === 'MONTHLY') {
      const year = s.getUTCFullYear() + Math.floor((s.getUTCMonth() + step * interval) / 12);
      const month = (s.getUTCMonth() + step * interval) % 12;
      const lastDate = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
      let days;
      if (byDay.length) days = byDay.map((item) => nthWeekdayOfMonth(year, month, item.weekday, item.nth || 1));
      else if (byMonthDay.length) days = byMonthDay.map((d) => (d < 0 ? lastDate + d + 1 : d));
      else days = [s.getUTCDate()];
      candidates = days.filter((d) => d && d >= 1 && d <= lastDate).sort((a, b) => a - b).map((d) => Date.UTC(year, month, d) + timeOfDay);
    } else if (rule.FREQ === 'YEARLY') {
      const year = s.getUTCFullYear() + step * interval;
      const ms = Date.UTC(year, s.getUTCMonth(), s.getUTCDate()) + timeOfDay;
      candidates = new Date(ms).getUTCMonth() === s.getUTCMonth() ? [ms] : [];
    } else {
      return [start];
    }
    if (candidates.length && candidates[0] > rangeEnd) break;
    if (candidates.length && candidates[0] > until) break;
    candidates.forEach(take);
  }
  return out;
}

export function eventsInRange(events, rangeStart, rangeEnd) {
  const overridden = new Set(events.filter((e) => e.recurrenceId != null).map((e) => `${e.uid}|${e.recurrenceId}`));
  const result = [];
  for (const event of events) {
    const allDay = event.start.allDay;
    const length = event.end ? event.end.ms - event.start.ms
      : event.duration ? event.duration
      : allDay ? DAY_MS : 0;
    const occurrences = event.recurrenceId != null ? [event.start.ms] : expandOccurrences(event, rangeStart, rangeEnd);
    for (const ms of occurrences) {
      if (event.recurrenceId == null && (event.exdates.includes(ms) || overridden.has(`${event.uid}|${ms}`))) continue;
      const endMs = ms + Math.max(0, length);
      // 종일 일정의 끝은 다음 날 0시(포함 안 함)다.
      if (endMs < rangeStart || (allDay ? endMs <= rangeStart : false) || ms > rangeEnd) continue;
      const iso = (value) => new Date(value).toISOString().slice(0, allDay ? 10 : 16);
      result.push({
        id: `${event.uid || event.title}|${ms}`,
        title: event.title || '(제목 없음)',
        allDay,
        start: iso(ms),
        end: iso(endMs),
        location: event.location || '',
        description: event.description || '',
      });
    }
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}

async function isApprovedMember(token) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_approved_member`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return response.ok && (await response.json()) === true;
}

async function loadEvents(url) {
  if (feedCache.url === url && feedCache.events && Date.now() - feedCache.at < FEED_TTL_MS) return feedCache.events;
  const response = await fetch(url, { headers: { Accept: 'text/calendar' } });
  if (!response.ok) throw new Error(`calendar_feed_${response.status}`);
  const events = parseIcs(await response.text());
  feedCache = { url, at: Date.now(), events };
  return events;
}

export async function handleCalendar(request, env) {
  if (request.method !== 'GET') return json({ error: 'method_not_allowed' }, 405);
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'login_required' }, 401);
  const url = new URL(request.url);
  const startParam = url.searchParams.get('start') || '';
  const endParam = url.searchParams.get('end') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam) || !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) return json({ error: 'invalid_range' }, 400);
  const rangeStart = Date.parse(`${startParam}T00:00:00Z`);
  const rangeEnd = Date.parse(`${endParam}T23:59:59Z`);
  if (!(rangeEnd >= rangeStart) || rangeEnd - rangeStart > MAX_RANGE_DAYS * DAY_MS) return json({ error: 'invalid_range' }, 400);
  if (!(await isApprovedMember(token))) return json({ error: 'forbidden' }, 403);
  if (!env?.GOOGLE_CALENDAR_ICS_URL) return json({ available: false, events: [] }, 503);
  try {
    const events = await loadEvents(env.GOOGLE_CALENDAR_ICS_URL);
    return json({ available: true, events: eventsInRange(events, rangeStart, rangeEnd) });
  } catch {
    return json({ error: 'calendar_unavailable' }, 502);
  }
}
