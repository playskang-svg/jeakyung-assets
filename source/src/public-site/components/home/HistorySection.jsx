import { useEffect, useId, useRef, useState } from 'react';

// 회사 연혁. 최근 것이 위에 온다. 한 해에 여러 줄이면 items 를 늘린다.
// 내용이 비면 버튼 자체를 그리지 않는다(빈 패널이 열리는 일이 없도록).
const HISTORY = [
  {
    year: '2025',
    items: [
      { text: 'HL홀딩스 동탄냉장 풀필먼트 대표 물류대행사' },
      { text: '삼성웰스토리·현대그린푸드·바르닭·작심닭 등 Fresh Logistics 사업 영역 확대' },
    ],
  },
  {
    year: '2023',
    items: [
      { text: '프레시지 B2B·B2C, 허닭 B2C 등 풀필먼트 사업 확장' },
      { text: '재경로지스 안성 2센터 추가 운영' },
    ],
  },
  {
    year: '2021',
    items: [
      { text: '쿠팡 입고 간선 운송, 푸드나무 풀필먼트, 웰스토리 중계물류' },
      { text: '재경로지스 안성 1센터 운영' },
    ],
  },
  {
    year: '2019',
    items: [
      { text: '현대리바트·아모레퍼시픽·이마트에브리데이 운송 및 중계사업' },
    ],
  },
  {
    year: '2018',
    items: [
      { text: '한화케미칼·LG화학·한샘 특판 운송사업 개시' },
    ],
  },
  {
    year: '2017',
    items: [
      { text: '롯데칠성·삼성전자·대림산업 운송사업 확대 운영' },
    ],
  },
  {
    year: '2015',
    items: [
      { text: '대기업 운송 및 구간 택배 운송 사업 개시' },
    ],
  },
  {
    year: '2013',
    items: [
      { text: '재경로지스 창립' },
    ],
  },
];

export default function HistorySection() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  // 열면 패널 머리로 부드럽게 옮겨 준다. 화면이 갑자기 늘어나면
  // 어디를 봐야 할지 알기 어렵기 때문이다.
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panelRef.current.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }, [open]);

  // 닫을 때는 눌렀던 버튼으로 초점을 돌려준다(키보드 사용자).
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (HISTORY.length === 0) return null;

  const latestYear = HISTORY[0].year;
  const firstYear = HISTORY[HISTORY.length - 1].year;
  const spanYears = Number(latestYear) - Number(firstYear) + 1;

  return (
    <div className="history-block reveal">
      <button
        ref={buttonRef}
        type="button"
        className={`history-button${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span className="history-button-text">
          <span className="history-button-eyebrow">History</span>
          <span className="history-button-title">재경닷컴이 걸어온 길</span>
        </span>

        {/* 연혁에서 실제로 할 말은 "얼마나 오래 해왔는가"다. 버튼에서 먼저 보여 준다. */}
        <span className="history-button-span">
          <span className="history-button-years">{firstYear}<i aria-hidden="true" />{latestYear}</span>
          <span className="history-button-note">현장에서 {spanYears}년</span>
        </span>

        <span className="history-button-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24" role="presentation"><path d="m5 8.5 7 7 7-7" /></svg>
        </span>
      </button>

      <section
        id={panelId}
        ref={panelRef}
        className={`history-panel${open ? ' is-open' : ''}`}
        aria-labelledby={`${panelId}-title`}
        hidden={!open}
      >
        <header className="history-panel-head">
          <div>
            <span className="eyebrow"><i /> History</span>
            <h2 id={`${panelId}-title`}>재경닷컴이 걸어온 길</h2>
          </div>
          <button type="button" className="history-close" onClick={close} aria-label="연혁 닫기">×</button>
        </header>

        <div className="history-body">
          {/* 원본 페이지의 사진 자리. 바깥 사진에 기대지 않고 브랜드 마크로 짜서
              언제나 같은 품질로 뜨게 한다. */}
          <aside className="history-visual" aria-hidden="true">
            <svg className="history-visual-mark" viewBox="0 0 32 32" role="presentation">
              <path d="M16 3 27 9.2v13.6L16 29 5 22.8V9.2L16 3Z" />
              <path d="m5.8 9.7 10.2 6 10.2-6M16 15.7v12" />
              <path d="m11 6 10.3 6" />
            </svg>
            <p className="history-visual-since">Since {firstYear}</p>
            <p className="history-visual-range">{firstYear} — {latestYear}</p>
            <p className="history-visual-note">현장에서 쌓아 온 {spanYears}년</p>
          </aside>

          <ol className="history-timeline">
          {HISTORY.map((group) => (
            <li key={group.year}>
              <p className="history-year">{group.year}</p>
              <ul className="history-events">
                {group.items.map((item) => (
                  <li key={`${item.month}-${item.text}`}>
                    {item.month && <span className="history-month">{item.month}</span>}
                    <span className="history-text">{item.text}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
          </ol>
        </div>

        <div className="history-panel-foot">
          <button type="button" className="history-close-wide" onClick={close}>연혁 닫기</button>
        </div>
      </section>
    </div>
  );
}
