// jeakyungdrive01 구글 계정으로 일정 등록·수정·삭제, 첨부파일, 문서 만들기를 한다.
// 비밀값 GOOGLE_OAUTH = {"id","secret","refresh"} (OAuth 클라이언트 + 새로 고침 토큰,
// 범위: calendar.events, drive.file). 구글 토큰은 브라우저로 내보내지 않는다.
export const SUPABASE_URL = 'https://vzswlvumcdxnryrfwkkl.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Jl43SzCeIQ90W-yYKgCQNA_2bS1K7Sd';
export const CALENDAR_ID = '23da234101aae757627bf70746d31eaf4ea13c229f89dd04cfc1f95f2ecc5ccd@group.calendar.google.com';
const CAL = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`;
const KST_OFFSET_MS = 9 * 3_600_000;
const MAX_FILES = 5;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DOC_TYPES = {
  doc: { mime: 'application/vnd.google-apps.document', label: '문서' },
  sheet: { mime: 'application/vnd.google-apps.spreadsheet', label: '스프레드시트' },
  slide: { mime: 'application/vnd.google-apps.presentation', label: '프레젠테이션' },
};

let tokenCache = { value: '', until: 0 };

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}

async function supabaseRpc(token, name, body = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok ? res.json() : null;
}

// 로그인 토큰으로 사용자를 확인한다. 승인 회원이 아니면 null.
export async function getMember(request) {
  const token = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  if ((await supabaseRpc(token, 'is_approved_member')) !== true) return null;
  const isAdmin = (await supabaseRpc(token, 'is_membership_admin')) === true;
  return { id: user.id, token, isAdmin };
}

export function logActivity(member, kind, title, targetId, url) {
  return supabaseRpc(member.token, 'log_google_activity', { p_kind: kind, p_title: title, p_target_id: targetId ?? null, p_url: url ?? null });
}

export async function googleToken(env) {
  if (tokenCache.value && Date.now() < tokenCache.until) return tokenCache.value;
  const cfg = JSON.parse(env.GOOGLE_OAUTH);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: cfg.id, client_secret: cfg.secret, refresh_token: cfg.refresh, grant_type: 'refresh_token' }),
  });
  if (!res.ok) throw new Error(`google_token_${res.status}`);
  const data = await res.json();
  tokenCache = { value: data.access_token, until: Date.now() + (data.expires_in - 120) * 1000 };
  return tokenCache.value;
}

async function google(env, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${await googleToken(env)}` } });
  if (!res.ok && res.status !== 404) throw new Error(`google_${res.status}`);
  return res;
}

const kstWall = (iso) => new Date(Date.parse(iso) + KST_OFFSET_MS).toISOString().slice(0, 16);

export function mapEvent(item, member) {
  const allDay = Boolean(item.start?.date);
  const createdBy = item.extendedProperties?.private?.createdBy ?? null;
  return {
    id: item.id,
    title: item.summary || '(제목 없음)',
    allDay,
    start: allDay ? item.start.date : kstWall(item.start.dateTime),
    end: allDay ? item.end.date : kstWall(item.end.dateTime),
    location: item.location || '',
    description: item.description || '',
    attachments: (item.attachments || []).map((a) => ({ fileId: a.fileId, title: a.title, mimeType: a.mimeType })).filter((a) => a.fileId),
    canEdit: Boolean(member && (member.isAdmin || (createdBy && createdBy === member.id))),
  };
}

export async function listApiEvents(env, member, startDate, endDate) {
  const params = new URLSearchParams({
    singleEvents: 'true', orderBy: 'startTime', maxResults: '2500',
    timeMin: `${startDate}T00:00:00+09:00`, timeMax: `${endDate}T23:59:59+09:00`,
  });
  const res = await google(env, `${CAL}?${params}`);
  const data = await res.json();
  return (data.items || []).filter((i) => i.status !== 'cancelled').map((i) => mapEvent(i, member));
}

// 입력 폼 → 구글 일정 시각. 종일은 끝 날짜 다음 날(포함 안 함)로 넣는다.
export function eventTimes(form) {
  const date = String(form.get('date') || '');
  const endDate = String(form.get('endDate') || '') || date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate < date) return null;
  if (form.get('allDay') === '1') {
    const next = new Date(`${endDate}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
    return { start: { date }, end: { date: next.toISOString().slice(0, 10) } };
  }
  const st = String(form.get('startTime') || ''); const et = String(form.get('endTime') || '');
  if (!/^\d{2}:\d{2}$/.test(st) || !/^\d{2}:\d{2}$/.test(et)) return null;
  const start = `${date}T${st}:00+09:00`; const end = `${endDate}T${et}:00+09:00`;
  if (Date.parse(end) <= Date.parse(start)) return null;
  return { start: { dateTime: start, timeZone: 'Asia/Seoul' }, end: { dateTime: end, timeZone: 'Asia/Seoul' } };
}

async function uploadToDrive(env, file) {
  const boundary = `jk${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name: file.name || '첨부파일' });
  const head = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
  const body = new Blob([head, await file.arrayBuffer(), `\r\n--${boundary}--`]);
  const res = await google(env, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink', {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body,
  });
  const f = await res.json();
  return { fileId: f.id, title: f.name, mimeType: f.mimeType, fileUrl: f.webViewLink };
}

function readFiles(form) {
  const files = form.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
  if (files.length > MAX_FILES) return { error: 'too_many_files' };
  if (files.some((f) => f.size > MAX_FILE_BYTES)) return { error: 'file_too_large' };
  return { files };
}

function eventBody(form, times) {
  const title = String(form.get('title') || '').trim().slice(0, 200);
  if (!title) return null;
  return {
    summary: title,
    location: String(form.get('location') || '').trim().slice(0, 300),
    description: String(form.get('description') || '').slice(0, 8000),
    ...times,
  };
}

export async function handleCalendarWrite(request, env, url) {
  const member = await getMember(request);
  if (!member) return json({ error: 'forbidden' }, 403);
  if (!env?.GOOGLE_OAUTH) return json({ error: 'not_configured' }, 503);
  const match = /^\/api\/calendar\/events(?:\/([A-Za-z0-9_-]+))?$/.exec(url.pathname);
  if (!match) return json({ error: 'not_found' }, 404);
  const eventId = match[1];
  try {
    if (request.method === 'POST' && !eventId) {
      const form = await request.formData();
      const times = eventTimes(form); const body = times && eventBody(form, times);
      if (!body) return json({ error: 'invalid_event' }, 400);
      const picked = readFiles(form); if (picked.error) return json({ error: picked.error }, 400);
      const attachments = [];
      for (const f of picked.files) attachments.push(await uploadToDrive(env, f));
      const res = await google(env, `${CAL}?supportsAttachments=true`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, attachments, extendedProperties: { private: { createdBy: member.id } } }),
      });
      const created = await res.json();
      await logActivity(member, 'event_create', body.summary, created.id, created.htmlLink);
      return json({ event: mapEvent(created, member) }, 201);
    }
    if (!eventId) return json({ error: 'method_not_allowed' }, 405);
    const currentRes = await google(env, `${CAL}/${eventId}`);
    if (currentRes.status === 404) return json({ error: 'not_found' }, 404);
    const current = await currentRes.json();
    const owner = current.extendedProperties?.private?.createdBy;
    if (!member.isAdmin && owner !== member.id) return json({ error: 'not_owner' }, 403);
    if (request.method === 'DELETE') {
      await google(env, `${CAL}/${eventId}`, { method: 'DELETE' });
      await logActivity(member, 'event_delete', current.summary || '(제목 없음)', eventId, null);
      return json({ ok: true });
    }
    if (request.method === 'PATCH') {
      const form = await request.formData();
      const times = eventTimes(form); const body = times && eventBody(form, times);
      if (!body) return json({ error: 'invalid_event' }, 400);
      const picked = readFiles(form); if (picked.error) return json({ error: picked.error }, 400);
      const keep = new Set(String(form.get('keepFileIds') || '').split(',').filter(Boolean));
      const attachments = (current.attachments || []).filter((a) => keep.has(a.fileId));
      for (const f of picked.files) attachments.push(await uploadToDrive(env, f));
      const res = await google(env, `${CAL}/${eventId}?supportsAttachments=true`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, attachments }),
      });
      const updated = await res.json();
      await logActivity(member, 'event_update', body.summary, eventId, updated.htmlLink);
      return json({ event: mapEvent(updated, member) });
    }
    return json({ error: 'method_not_allowed' }, 405);
  } catch {
    return json({ error: 'google_unavailable' }, 502);
  }
}

// 첨부파일 내려받기. 구글 계정이 없는 직원도 열 수 있게 Worker 가 대신 받아 준다.
export async function handleCalendarFile(request, env, url) {
  const member = await getMember(request);
  if (!member) return json({ error: 'forbidden' }, 403);
  const id = url.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{10,}$/.test(id) || !env?.GOOGLE_OAUTH) return json({ error: 'invalid' }, 400);
  try {
    const meta = await (await google(env, `https://www.googleapis.com/drive/v3/files/${id}?fields=name,mimeType`)).json();
    const res = await google(env, `https://www.googleapis.com/drive/v3/files/${id}?alt=media`);
    if (!res.ok) return json({ error: 'not_found' }, 404);
    return new Response(res.body, {
      headers: {
        'Content-Type': meta.mimeType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(meta.name || 'file')}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return json({ error: 'google_unavailable' }, 502);
  }
}

// 문서 만들기: jeakyungdrive01 드라이브 루트에 새 구글 문서를 만들고, 링크가 있는
// 사람은 누구나 편집할 수 있게 연다(만든 직원이 구글 계정 없이도 바로 쓰도록).
export async function handleDocs(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const member = await getMember(request);
  if (!member) return json({ error: 'forbidden' }, 403);
  if (!env?.GOOGLE_OAUTH) return json({ error: 'not_configured' }, 503);
  let input;
  try { input = await request.json(); } catch { return json({ error: 'invalid' }, 400); }
  const type = DOC_TYPES[input?.type];
  const name = String(input?.name || '').trim().slice(0, 200);
  if (!type || !name) return json({ error: 'invalid' }, 400);
  try {
    const res = await google(env, 'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: type.mime }),
    });
    const file = await res.json();
    await google(env, `https://www.googleapis.com/drive/v3/files/${file.id}/permissions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'writer', type: 'anyone' }),
    });
    await logActivity(member, 'doc_create', `[${type.label}] ${file.name}`, file.id, file.webViewLink);
    return json({ id: file.id, name: file.name, url: file.webViewLink }, 201);
  } catch {
    return json({ error: 'google_unavailable' }, 502);
  }
}
