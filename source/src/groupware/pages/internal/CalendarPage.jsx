import { useEffect, useMemo, useState } from 'react';

import { requireSupabase } from '../../lib/supabase.js';

// 사내일정. 구글 캘린더 '재경 사내일정'(jeakyungdrive01)을 Worker /api/calendar 가
// 읽어 승인 회원에게만 돌려준다. 등록·수정은 구글 캘린더에서 한다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeOf = (ev) => (ev.allDay ? '종일' : ev.start.slice(11, 16));

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [state, setState] = useState({ loading: true, events: [], error: '' });
  const [selected, setSelected] = useState(() => ymd(new Date()));

  // 일요일부터 6주를 깐다. 앞뒤 달 날짜도 흐리게 보인다.
  const days = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - cursor.getDay());
    return Array.from({ length: 42 }, (unused, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    (async () => {
      try {
        const { data } = await requireSupabase().auth.getSession();
        const res = await fetch(`/api/calendar?start=${ymd(days[0])}&end=${ymd(days[41])}`, {
          headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.available === false ? 'not_configured' : 'failed');
        if (alive) setState({ loading: false, events: body.events ?? [], error: '' });
      } catch (error) {
        if (alive) {
          setState({
            loading: false,
            events: [],
            error: error.message === 'not_configured' ? '사내일정 캘린더가 아직 연결되지 않았습니다.' : '일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          });
        }
      }
    })();
    return () => { alive = false; };
  }, [days]);

  // 날짜별로 묶는다. 종일 일정의 끝은 다음 날 0시라 하루 빼서 센다.
  const byDay = useMemo(() => {
    const map = {};
    for (const ev of state.events) {
      const s = ev.start.slice(0, 10);
      let e = ev.end.slice(0, 10);
      if (ev.allDay) { const d = new Date(`${e}T00:00:00`); d.setDate(d.getDate() - 1); e = ymd(d); }
      if (e < s) e = s;
      for (const d of days) { const k = ymd(d); if (k >= s && k <= e) (map[k] ||= []).push(ev); }
    }
    return map;
  }, [state.events, days]);

  const today = ymd(new Date());
  const move = (delta) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(ymd(d)); };
  const selectedEvents = byDay[selected] ?? [];

  return (
    <article className="gw-page gw-cal" aria-labelledby="calendar-title">
      <header className="gw-page-header gw-cal-header">
        <div>
          <h1 id="calendar-title">사내일정</h1>
          <p className="gw-field-hint">일정 등록·수정은 구글 캘린더 '재경 사내일정'에서 합니다. 바뀐 내용은 1분 안에 여기에 반영됩니다.</p>
        </div>
        <a className="gw-secondary-button" href="https://jeakyung.quv.kr/36" target="_blank" rel="noopener noreferrer">예전 일정 보기 ↗</a>
      </header>

      <div className="gw-cal-toolbar">
        <button type="button" className="gw-secondary-button" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <strong aria-live="polite">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</strong>
        <button type="button" className="gw-secondary-button" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button type="button" className="gw-secondary-button" onClick={goToday}>오늘</button>
        {state.loading && <span className="gw-field-hint" role="status">불러오는 중…</span>}
      </div>

      {state.error && <div className="gw-notice gw-notice--warning" role="alert">{state.error}</div>}

      <div className="gw-cal-grid" role="grid" aria-label="월간 일정">
        {WEEKDAYS.map((w, i) => <div key={w} className={`gw-cal-weekday${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}`} role="columnheader">{w}</div>)}
        {days.map((d) => {
          const k = ymd(d);
          const list = byDay[k] ?? [];
          const cls = ['gw-cal-day',
            d.getMonth() !== cursor.getMonth() && 'is-outside',
            k === today && 'is-today',
            k === selected && 'is-selected',
            d.getDay() === 0 && 'is-sun',
            d.getDay() === 6 && 'is-sat'].filter(Boolean).join(' ');
          return (
            <button type="button" key={k} className={cls} role="gridcell" aria-selected={k === selected} onClick={() => setSelected(k)} aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일, 일정 ${list.length}건`}>
              <span className="gw-cal-date">{d.getDate()}</span>
              {list.slice(0, 3).map((ev) => <span key={ev.id} className={`gw-cal-chip${ev.allDay ? ' is-allday' : ''}`}>{ev.allDay ? '' : `${timeOf(ev)} `}{ev.title}</span>)}
              {list.length > 3 && <span className="gw-cal-more">+{list.length - 3}</span>}
            </button>
          );
        })}
      </div>

      <section className="gw-cal-agenda" aria-labelledby="calendar-agenda-title">
        <h2 id="calendar-agenda-title">{Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일 일정</h2>
        {selectedEvents.length === 0 && <p className="gw-empty-state">등록된 일정이 없습니다.</p>}
        <ul>
          {selectedEvents.map((ev) => (
            <li key={ev.id}>
              <span className="gw-cal-agenda-time">{ev.allDay ? '종일' : `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}`}</span>
              <div>
                <strong>{ev.title}</strong>
                {ev.location && <span className="gw-cal-agenda-loc">{ev.location}</span>}
                {ev.description && <p>{ev.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
