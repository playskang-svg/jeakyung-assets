import { useEffect, useRef, useState } from 'react';

import { CONSULTATION_URL } from '../../data/navigation.js';
import './chatWidget.css';

const welcome = { role: 'assistant', content: '안녕하세요. 재경로지스 AI 상담입니다. 물류 서비스에 관해 궁금한 점을 알려주세요.' };

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [consented, setConsented] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([welcome]);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const launcherRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, open]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !consented || sending) return;
    const nextHistory = [...history, { role: 'user', content }].slice(-11);
    setMessages((current) => [...current, { role: 'user', content }]);
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
      if (!response.ok || !data.reply) throw new Error(data.error || '답변을 받지 못했습니다.');
      setHistory([...nextHistory, { role: 'assistant', content: data.reply }].slice(-10));
      setMessages((current) => [...current, { role: 'assistant', content: data.reply }]);
    } catch (problem) {
      setError(problem.message || '연결에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function close() {
    setOpen(false);
    launcherRef.current?.focus();
  }

  return (
    <div className="chat-widget" onKeyDown={(event) => { if (event.key === 'Escape' && open) close(); }}>
      {open && (
        <section className="chat-panel" aria-label="AI 상담 대화창">
          <div className="chat-panel-header">
            <div><strong>재경 AI 상담</strong><span>언제든 질문해 주세요</span></div>
            <div className="chat-panel-actions">
              <button type="button" onClick={() => { setMessages([welcome]); setHistory([]); setError(''); }} aria-label="새 대화 시작" title="새 대화">↻</button>
              <button type="button" onClick={close} aria-label="상담창 닫기">×</button>
            </div>
          </div>
          <div className="chat-messages" ref={listRef} role="log" aria-live="polite" aria-relevant="additions text">
            {messages.map((message, index) => (
              <p className={`chat-message chat-message--${message.role}`} key={index}>{message.content}</p>
            ))}
            {sending && <p className="chat-message chat-message--assistant" aria-label="답변 작성 중">답변을 작성하고 있습니다…</p>}
          </div>
          <div className="chat-panel-bottom">
            {error && <p className="chat-error" role="alert">{error} <a href={CONSULTATION_URL} target="_blank" rel="noopener noreferrer">담당자 상담 ↗</a></p>}
            <label className="chat-consent">
              <input type="checkbox" checked={consented} onChange={(event) => setConsented(event.target.checked)} />
              <span>대화 내용을 Claude AI에 전송하는 데 동의합니다. 연락처·민감정보는 입력하지 마세요. <a href="/privacy/" target="_blank" rel="noopener noreferrer">개인정보 안내</a></span>
            </label>
            <form className="chat-form" onSubmit={send}>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}
                maxLength={700}
                rows={2}
                aria-label="상담 질문"
                placeholder="궁금한 내용을 입력하세요"
              />
              <button type="submit" disabled={!draft.trim() || !consented || sending} aria-label="질문 보내기">보내기</button>
            </form>
            <p className="chat-disclaimer">AI의 일반 안내입니다. 견적·계약·운영 가능 여부는 <a href={CONSULTATION_URL} target="_blank" rel="noopener noreferrer">담당자에게 확인</a>해 주세요.</p>
          </div>
        </section>
      )}
      <button ref={launcherRef} className="chat-launcher" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={open ? 'AI 상담창 닫기' : 'AI 상담창 열기'}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8.2 8.2 0 0 1-3.2-.6L4 20l1.6-4.4A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8.5 11.5h7"/></svg>
        <span>AI 상담</span>
      </button>
    </div>
  );
}
