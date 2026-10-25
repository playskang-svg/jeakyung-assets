import { useEffect, useRef, useState } from 'react';

import { CONSULTATION_URL } from '../../data/navigation.js';
import './chatWidget.css';

const welcome = {
  role: 'assistant',
  content: '안녕하세요. 재경로지스 챗봇상담입니다. 물류 서비스에 관해 궁금한 점을 알려주세요.',
};

export default function ChatWidget() {
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([welcome]);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/chat/status', { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.available) setAvailable(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const originalOverflow = document.body.style.overflow;
      if (window.innerWidth <= 640) {
        document.body.style.overflow = 'hidden';
      }
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  async function send(event) {
    if (event) event.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    const nextHistory = [...history, { role: 'user', content }].slice(-11);
    setMessages((current) => [...current, { role: 'user', content }]);
    setHistory(nextHistory);
    setDraft('');
    setError('');
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextHistory }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        throw new Error(data.error || '답변을 받지 못했습니다.');
      }
      setHistory([...nextHistory, { role: 'assistant', content: data.reply }].slice(-10));
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (problem) {
      setError(problem.message || '일시적인 연결 지연입니다. 다시 시도해 주세요.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  async function retryLast() {
    if (sending || history.length === 0) return;
    setError('');
    setSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      });
      const data = await response.json();
      if (!response.ok || !data.reply) {
        throw new Error(data.error || '답변을 받지 못했습니다.');
      }
      setHistory([...history, { role: 'assistant', content: data.reply }].slice(-10));
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (problem) {
      setError(problem.message || '일시적인 연결 지연입니다. 다시 시도해 주세요.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  function resetChat() {
    setMessages([welcome]);
    setHistory([]);
    setError('');
    setDraft('');
  }

  // 운영 키가 준비되기 전에는 기존 카카오톡 상담만 노출한다.
  if (!available) return null;

  return (
    <div
      className={`chat-widget ${open ? 'chat-widget--open' : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) close();
      }}
    >
      {open && (
        <section className="chat-panel" aria-label="챗봇상담 대화창">
          <div className="chat-panel-header">
            <div className="chat-panel-title">
              <strong>재경 챗봇상담</strong>
              <span>24시간 물류 서비스 안내</span>
            </div>
            <div className="chat-panel-actions">
              <button
                type="button"
                onClick={resetChat}
                aria-label="새 대화 시작"
                title="새 대화"
                className="chat-action-btn"
              >
                ↻
              </button>
              <button
                type="button"
                onClick={close}
                aria-label="상담창 닫기"
                title="닫기"
                className="chat-action-btn chat-action-close"
              >
                ×
              </button>
            </div>
          </div>

          <div
            className="chat-messages"
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((message, index) => (
              <div
                className={`chat-message chat-message--${message.role}`}
                key={index}
              >
                {message.content}
              </div>
            ))}
            {sending && (
              <div
                className="chat-message chat-message--assistant chat-message--loading"
                aria-label="답변 작성 중"
              >
                <span className="chat-typing-dots">
                  <span>.</span><span>.</span><span>.</span>
                </span>
                답변을 준비하고 있습니다…
              </div>
            )}
          </div>

          <div className="chat-panel-bottom">
            {error && (
              <div className="chat-error" role="alert">
                <span>{error}</span>
                <div className="chat-error-actions">
                  <button type="button" onClick={retryLast} className="chat-retry-btn">
                    ↻ 다시 시도
                  </button>
                  <a href={CONSULTATION_URL} target="_blank" rel="noopener noreferrer">
                    카카오톡 1:1 상담 ↗
                  </a>
                </div>
              </div>
            )}

            <form className="chat-form" onSubmit={send}>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    send();
                  }
                }}
                maxLength={700}
                rows={2}
                aria-label="상담 질문"
                placeholder="물류 서비스에 대해 궁금한 점을 입력하세요"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="질문 보내기"
                className="chat-send-btn"
              >
                전송
              </button>
            </form>

            <p className="chat-disclaimer">
              챗봇 상담 시 개인정보는 입력하지 마세요. 견적·계약 등은{' '}
              <a href={CONSULTATION_URL} target="_blank" rel="noopener noreferrer">
                담당자에게 확인
              </a>
              해 주세요.
            </p>
          </div>
        </section>
      )}

      <button
        ref={launcherRef}
        className="chat-launcher"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? '챗봇상담 닫기' : '챗봇상담 열기'}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <span>챗봇상담</span>
      </button>
    </div>
  );
}
