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

export function handleChatStatus(request, env) {
  if (request.method !== 'GET') return json({ error: '허용되지 않은 요청입니다.' }, 405);
  return json({ available: Boolean(env.ANTHROPIC_API_KEY || env.AI) });
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

async function fallbackWorkersAI(env, messages) {
  if (!env?.AI) return null;
  try {
    const aiMessages = [
      { role: 'system', content: CHAT_SYSTEM_PROMPT },
      ...messages.map(({ role, content }) => ({ role, content: content.trim() })),
    ];
    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: aiMessages,
      max_tokens: 450,
    });
    const reply = (aiResponse?.response || '').trim();
    return reply || null;
  } catch (err) {
    console.error('Workers AI fallback failed', err);
    return null;
  }
}

export async function handleChat(request, env) {
  if (request.method !== 'POST') return json({ error: '허용되지 않은 요청입니다.' }, 405);

  const url = new URL(request.url);
  const origin = request.headers.get('Origin');
  const allowedOrigins = new Set([
    url.origin,
    'https://jeakyung.com',
    'https://www.jeakyung.com',
  ]);
  if (origin && !allowedOrigins.has(origin)) {
    return json({ error: '허용되지 않은 요청입니다.' }, 403);
  }
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 415);
  }
  if (!env.ANTHROPIC_API_KEY && !env.AI) {
    return json({ error: '챗봇상담 연결을 준비 중입니다. 카카오톡으로 문의해 주세요.' }, 503);
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
    async function callClaude(attempt = 1) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'User-Agent': 'anthropic-sdk-typescript/0.39.0',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 450,
          system: CHAT_SYSTEM_PROMPT,
          messages: messages.map(({ role, content }) => ({ role, content: content.trim() })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok && attempt < 2 && (res.status === 403 || res.status >= 500)) {
        return callClaude(attempt + 1);
      }
      return res;
    }

    if (env.ANTHROPIC_API_KEY) {
      const response = await callClaude();
      if (response.ok) {
        const data = await response.json();
        const reply = data.content?.filter((block) => block.type === 'text')
          .map((block) => block.text).join('\n').trim();
        if (reply) return json({ reply });
      } else {
        console.error('Claude API failed', response.status, response.headers.get('request-id'));
      }
    }

    // Anthropic API 키가 없거나, 403(지역 제한) / 5xx 오류 시 Workers AI로 무중단 페일오버
    const fallbackReply = await fallbackWorkersAI(env, messages);
    if (fallbackReply) {
      return json({ reply: fallbackReply });
    }

    return json({
      code: 'upstream_permission',
      error: '챗봇상담 연결에 문제가 생겼습니다. 카카오톡으로 문의해 주세요.',
    }, 502);
  } catch {
    const fallbackReply = await fallbackWorkersAI(env, messages);
    if (fallbackReply) {
      return json({ reply: fallbackReply });
    }
    return json({ error: '연결 시간이 초과되었습니다. 다시 시도해 주세요.' }, 504);
  }
}
