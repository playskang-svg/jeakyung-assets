import { CHAT_SYSTEM_PROMPT } from './systemPrompt.js';

const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;
const recentRequests = new Map();

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

function validMessages(messages) {
  return Array.isArray(messages)
    && messages.length > 0
    && messages.length <= 12
    && messages.every((item, index) => item
      && Object.keys(item).length === 2
      && item.role === (index % 2 === 0 ? 'user' : 'assistant')
      && typeof item.content === 'string'
      && item.content.trim().length > 0
      && item.content.length <= (item.role === 'user' ? 700 : 1800))
    && messages.at(-1).role === 'user';
}

function isRateLimited(request) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const now = Date.now();
  if (recentRequests.size > 1000) {
    for (const [key, attempts] of recentRequests) {
      if (attempts.at(-1) < now - RATE_WINDOW_MS) recentRequests.delete(key);
    }
  }
  const attempts = (recentRequests.get(ip) || []).filter((time) => time > now - RATE_WINDOW_MS);
  if (attempts.length >= RATE_MAX) return true;
  attempts.push(now);
  recentRequests.set(ip, attempts);
  return false;
}

export async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ error: '허용되지 않은 요청입니다.' }, 405);

  const url = new URL(request.url);
  if (request.headers.get('Origin') !== url.origin) {
    return json({ error: '허용되지 않은 요청입니다.' }, 403);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 415);
  }
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'AI 상담 연결을 준비 중입니다. 카카오톡으로 문의해 주세요.' }, 503);
  }

  let messages;
  try {
    const body = await request.text();
    if (body.length > 12_000) return json({ error: '대화가 너무 깁니다. 새 상담을 시작해 주세요.' }, 413);
    messages = JSON.parse(body).messages;
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }
  if (!validMessages(messages)) return json({ error: '대화 형식이 올바르지 않습니다.' }, 400);
  if (isRateLimited(request)) return json({ error: '잠시 후 다시 질문해 주세요.' }, 429);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 450,
        system: CHAT_SYSTEM_PROMPT,
        messages: messages.map(({ role, content }) => ({ role, content: content.trim() })),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      // 문의 원문이나 API 키를 로그에 남기지 않는다.
      console.error('Claude API failed', response.status, response.headers.get('request-id'));
      return json({ error: response.status === 429
        ? '지금은 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        : 'AI 상담 연결에 문제가 생겼습니다. 카카오톡으로 문의해 주세요.' }, 502);
    }
    const data = await response.json();
    const reply = data.content?.filter((block) => block.type === 'text')
      .map((block) => block.text).join('\n').trim();
    if (!reply) return json({ error: '답변을 받지 못했습니다. 다시 시도해 주세요.' }, 502);
    return json({ reply });
  } catch {
    return json({ error: '연결 시간이 초과되었습니다. 다시 시도해 주세요.' }, 504);
  }
}
