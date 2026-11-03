import { useEffect, useMemo, useState } from 'react';

import {
  deleteCalendarEvent, describeGoogleError, downloadCalendarFile, getCalendarEvents, saveCalendarEvent,
} from '../../services/googleService.js';

// 사내일정. 구글 캘린더 '재경 사내일정'(jeakyungdrive01)을 Worker 가 읽고 쓴다.
// 날짜를 누르면 그날 일정이 아래에 나오고, 두 번 누르거나 '일정 등록'으로 새 일정을 넣는다.
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const minusDay = (s) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() - 1); return ymd(d); };

function EventForm({ initial, onClose, onSaved }) {
  const editing = Boolean(initial.id);
  const [allDay, setAllDay] = useState(initial.allDay ?? true);
  const [keep, setKeep] = useState(() => new Set((initial.attachments ?? []).map((a) => a.fileId)));
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set('allDay', allDay ? '1' : '0');
    if (editing) form.set('keepFileIds', [...keep].join(','));
    setBusy(true); setStatus('저장하는 중…');
    try { await saveCalendarEvent(initial.id, form); onSaved(); }
    catch (error) { setStatus(describeGoogleError(error.code)); setBusy(false); }
  };

  return (
    <div className="gw-target-dialog-layer" role="presentation" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section className="gw-target-dialog gw-cal-dialog" role="dialog" aria-modal="true" aria-labelledby="cal-form-title">
        <header className="gw-target-dialog-bar">
          <div className="gw-target-dialog-title"><strong id="cal-form-title">{editing ? '일정 수정' : '일정 등록'}</strong></div>
          <div className="gw-target-dialog-actions"><button type="button" className="gw-target-dialog-close" onClick={onClose} disabled={busy} aria-label="닫기">×</button></div>
        </header>
        <form className="gw-cal-form" onSubmit={submit}>
          <label>제목<input name="title" required maxLength={200} defaultValue={initial.title ?? ''} autoFocus /></label>
          <label className="gw-cal-check"><input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} /> 종일</label>
          <div className="gw-cal-form-row">
            <label>시작 날짜<input type="date" name="date" required defaultValue={initial.date} /></label>
            {!allDay && <label>시작 시각<input type="time" name="startTime" required defaultValue={initial.startTime ?? '09:00'} /></label>}
          </div>
          <div className="gw-cal-form-row">
            <label>끝 날짜<input type="date" name="endDate" defaultValue={initial.endDate ?? initial.date} /></label>
            {!allDay && <label>끝 시각<input type="time" name="endTime" required defaultValue={initial.endTime ?? '10:00'} /></label>}
          </div>
          <label>장소<input name="location" maxLength={300} defaultValue={initial.location ?? ''} /></label>
          <label>내용<textarea name="description" rows={5} maxLength={8000} defaultValue={initial.description ?? ''} /></label>
          {editing && (initial.attachments ?? []).length > 0 && (
            <fieldset className="gw-cal-keep">
              <legend>기존 첨부파일 (체크를 풀면 일정에서 뺍니다)</legend>
              {initial.attachments.map((a) => (
                <label key={a.fileId} className="gw-cal-check">
                  <input type="checkbox" checked={keep.has(a.fileId)} onChange={(e) => setKeep((cur) => { const n = new Set(cur); if (e.target.checked) n.add(a.fileId); else n.delete(a.fileId); return n; })} /> {a.title}
                </label>
              ))}
            </fieldset>
          )}
          <label>첨부파일 (최대 5개, 개당 20MB)<input type="file" name="files" multiple /></label>
          {status && <p className="gw-field-hint" role="status">{status}</p>}
          <div className="gw-cal-form-actions">
            <button type="button" className="gw-secondary-button" onClick={onClose} disabled={busy}>취소</button>
            <button type="submit" className="gw-primary-button" disabled={busy}>{editing ? '수정 저장' : '등록'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [state, setState] = useState({ loading: true, events: [], error: '', canWrite: false });
  const [selected, setSelected] = useState(() => ymd(new Date()));
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState('');

  // 일요일부터 6주를 깐다. 앞뒤 달 날짜도 흐리게 보인다.
  const days = useMemo(() => {
    const start = new Date(cursor);
    start.setDate(1 - cursor.getDay());
    return Array.from({ length: 42 }, (unused, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [cursor]);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    getCalendarEvents(ymd(days[0]), ymd(days[41]))
      .then((body) => { if (alive) setState({ loading: false, events: body.events ?? [], error: '', canWrite: Boolean(body.canWrite) }); })
      .catch((error) => {
        if (alive) setState({ loading: false, events: [], canWrite: false, error: error.status === 503 ? '사내일정 캘린더가 아직 연결되지 않았습니다.' : '일정을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      });
    return () => { alive = false; };
  }, [days, reloadKey]);

  // 날짜별로 묶는다. 종일 일정의 끝은 다음 날 0시라 하루 빼서 센다.
  const byDay = useMemo(() => {
    const map = {};
    for (const ev of state.events) {
      const s = ev.start.slice(0, 10);
      let e = ev.end.slice(0, 10);
      if (ev.allDay) e = minusDay(e);
      if (e < s) e = s;
      for (const d of days) { const k = ymd(d); if (k >= s && k <= e) (map[k] ||= []).push(ev); }
    }
    return map;
  }, [state.events, days]);

  const today = ymd(new Date());
  const move = (delta) => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  const goToday = () => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); setSelected(ymd(d)); };
  const selectedEvents = byDay[selected] ?? [];
  const openNew = (date) => setForm({ date, endDate: date, allDay: true });
  const openEdit = (ev) => setForm({
    id: ev.id, title: ev.title, allDay: ev.allDay, location: ev.location, description: ev.description, attachments: ev.attachments,
    date: ev.start.slice(0, 10), endDate: ev.allDay ? minusDay(ev.end.slice(0, 10)) : ev.end.slice(0, 10),
    startTime: ev.allDay ? undefined : ev.start.slice(11, 16), endTime: ev.allDay ? undefined : ev.end.slice(11, 16),
  });
  const remove = async (ev) => {
    if (!window.confirm(`'${ev.title}' 일정을 삭제할까요? 구글 캘린더에서도 지워집니다.`)) return;
    try { await deleteCalendarEvent(ev.id); setNotice('일정을 삭제했습니다.'); setReloadKey((k) => k + 1); }
    catch (error) { setNotice(describeGoogleError(error.code)); }
  };
  const download = (a) => downloadCalendarFile(a.fileId, a.title).catch(() => setNotice('파일을 받지 못했습니다.'));

  return (
    <article className="gw-page gw-cal" aria-labelledby="calendar-title">
      <header className="gw-page-header gw-cal-header">
        <div>
          <h1 id="calendar-title">사내일정</h1>
          <p className="gw-field-hint">날짜를 두 번 누르거나 '일정 등록'을 누르면 일정을 넣을 수 있습니다. 구글 캘린더 '재경 사내일정'과 같이 바뀝니다.</p>
        </div>
        <a className="gw-secondary-button" href="https://jeakyung.quv.kr/36" target="_blank" rel="noopener noreferrer">예전 일정 보기 ↗</a>
      </header>

      <div className="gw-cal-toolbar">
        <button type="button" className="gw-secondary-button" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <strong aria-live="polite">{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</strong>
        <button type="button" className="gw-secondary-button" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button type="button" className="gw-secondary-button" onClick={goToday}>오늘</button>
        {state.canWrite && <button type="button" className="gw-primary-button gw-cal-add" onClick={() => openNew(selected)}>+ 일정 등록</button>}
        {state.loading && <span className="gw-field-hint" role="status">불러오는 중…</span>}
      </div>

      {state.error && <div className="gw-notice gw-notice--warning" role="alert">{state.error}</div>}
      {notice && <div className="gw-notice" role="status">{notice}</div>}

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
            <button type="button" key={k} className={cls} role="gridcell" aria-selected={k === selected}
              onClick={() => setSelected(k)} onDoubleClick={() => state.canWrite && openNew(k)}
              aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일, 일정 ${list.length}건`}>
              <span className="gw-cal-date">{d.getDate()}</span>
              {list.slice(0, 3).map((ev) => <span key={ev.id} className={`gw-cal-chip${ev.allDay ? ' is-allday' : ''}`}>{ev.allDay ? '' : `${ev.start.slice(11, 16)} `}{ev.title}</span>)}
              {list.length > 3 && <span className="gw-cal-more">+{list.length - 3}</span>}
            </button>
          );
        })}
      </div>

      <section className="gw-cal-agenda" aria-labelledby="calendar-agenda-title">
        <div className="gw-cal-agenda-head">
          <h2 id="calendar-agenda-title">{Number(selected.slice(5, 7))}월 {Number(selected.slice(8, 10))}일 일정</h2>
          {state.canWrite && <button type="button" className="gw-secondary-button" onClick={() => openNew(selected)}>+ 이 날 일정 등록</button>}
        </div>
        {selectedEvents.length === 0 && <p className="gw-empty-state">등록된 일정이 없습니다.</p>}
        <ul>
          {selectedEvents.map((ev) => (
            <li key={ev.id}>
              <span className="gw-cal-agenda-time">{ev.allDay ? '종일' : `${ev.start.slice(11, 16)}–${ev.end.slice(11, 16)}`}</span>
              <div className="gw-cal-agenda-body">
                <strong>{ev.title}</strong>
                {ev.location && <span className="gw-cal-agenda-loc">{ev.location}</span>}
                {ev.description && <p>{ev.description}</p>}
                {ev.attachments?.length > 0 && (
                  <div className="gw-cal-files">
                    {ev.attachments.map((a) => <button type="button" key={a.fileId} className="gw-cal-file" onClick={() => download(a)}>📎 {a.title}</button>)}
                  </div>
                )}
              </div>
              {ev.canEdit && (
                <div className="gw-cal-agenda-actions">
                  <button type="button" className="gw-secondary-button" onClick={() => openEdit(ev)}>수정</button>
                  <button type="button" className="gw-secondary-button" onClick={() => remove(ev)}>삭제</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {form && <EventForm initial={form} onClose={() => setForm(null)} onSaved={() => { setForm(null); setNotice('저장했습니다.'); setReloadKey((k) => k + 1); }} />}
    </article>
  );
}
