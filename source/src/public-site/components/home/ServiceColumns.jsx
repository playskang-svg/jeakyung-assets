import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

// 서비스 카드 안에 붙는 칼럼 띠.
//
// 그 서비스만의 글을 그림으로만 보여 준다. 띠 이름도, 글 제목도, 목록으로
// 가는 링크도 두지 않는다 — 카드에는 이미 서비스 이름과 설명이 있어서 글자를
// 더 얹으면 읽을 것만 늘고 그림이 눈에 들어오지 않는다. 이름은 마우스를
// 올렸을 때와 화면 낭독기에만 남긴다.
//
// 누르면 서비스 페이지로 넘어간다. 카드 안에서 본문을 펼치면 카드가 늘어나
// 옆 카드와 줄이 어긋나므로, 읽는 자리는 머리글 아래 제 페이지로 보낸다.
// 주소에 글 번호가 실려 있어 링크를 그대로 나눠 줄 수도 있다. 그 페이지에
// 같은 서비스의 글이 모두 모여 있으므로 따로 목록 링크를 둘 이유가 없다.
//
// 넘기는 방식은 두 가지다.
//   flow    가만히 두어도 왼쪽으로 흐른다. 마우스를 올리면 멈춘다.
//   paged   좌우 단추로 한 화면씩 민다. 단추는 평소 흐리게 두어 사진을
//           가리지 않다가, 손이 닿으면 또렷해지고 더 갈 곳이 없으면 꺼진다.
// 모양은 shape 으로 갈린다(square | round). 어느 조합이든 누를 때 열리는 곳,
// 그림을 받아 오는 방식, 글이 없을 때 사라지는 것은 모두 같다.
//
// 목록은 화면이 뜬 뒤에 따로 받는다. supabase-js 를 마케팅 페이지 첫 묶음에
// 넣지 않으려는 것으로, 소식/정보 영역과 같은 방식이다.
export default function ServiceColumns({ serviceKey, serviceName, shape = 'square', mode = 'flow' }) {
  const [articles, setArticles] = useState([]);
  const trackRef = useRef(null);
  // 어느 끝에 닿아 있는지. 처음에는 왼쪽 끝이라 뒤로 갈 곳이 없다.
  const [reach, setReach] = useState({ start: true, end: true });
  const paged = mode === 'paged';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [{ publicSupabase }, { getPublicServiceArticles }] = await Promise.all([
          import('../../../shared/supabaseAnon.js'),
          import('../../../shared/siteArticles/siteArticleService.js'),
        ]);
        if (!alive || !publicSupabase) return;
        const items = await getPublicServiceArticles(publicSupabase, serviceKey, 12);
        if (alive) setArticles(items);
      } catch {
        /* 목록을 못 받아도 카드는 그대로 둔다. 없어도 되는 자리다. */
      }
    })();
    return () => { alive = false; };
  }, [serviceKey]);

  // 단추를 켤지 끌지 정한다. 1px 은 소수점 폭 때문에 끝에 닿고도 0.5px 이
  // 남아 단추가 계속 켜져 있는 것을 막으려고 둔 여유다.
  const measure = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setReach({ start: track.scrollLeft <= 1, end: track.scrollLeft >= max - 1 });
  }, []);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!paged || !track) return undefined;
    measure();
    track.addEventListener('scroll', measure, { passive: true });
    // 그림이 늦게 도착하거나 창을 줄이면 폭이 바뀐다.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(track);
    window.addEventListener('resize', measure);
    return () => {
      track.removeEventListener('scroll', measure);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [paged, measure, articles.length]);

  // 단추로 넘기는 띠는 가만히 있으면 좌우로 밀 수 있다는 것이 한눈에
  // 안 보인다(마우스가 없는 화면에서는 단추도 늘 옅게만 떠 있다). 뜨고
  // 나서 한 번, 살짝 밀었다 되돌려 손으로 밀어 보라는 낌새만 준다.
  // 넘길 것이 없거나(칸이 다 보이는 카드) 움직임을 줄이라고 설정한
  // 사람에게는 하지 않는다.
  //
  // scroll-snap-type 이 걸려 있으면 28px 처럼 짧은 스크롤은 스냅이 도로
  // 붙잡아 아예 움직이지 않는다(칸 시작점 가까이만 붙잡는 proximity 라도
  // 마찬가지) — 낌새를 주는 동안만 꺼 둔다.
  useEffect(() => {
    if (!paged || articles.length === 0) return undefined;
    const track = trackRef.current;
    if (!track) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;

    const timers = [];
    timers.push(window.setTimeout(() => {
      if (track.scrollWidth <= track.clientWidth + 1) return;
      const snap = track.style.scrollSnapType;
      track.style.scrollSnapType = 'none';
      track.scrollTo({ left: 28, behavior: 'smooth' });
      timers.push(window.setTimeout(() => {
        track.scrollTo({ left: 0, behavior: 'smooth' });
        timers.push(window.setTimeout(() => { track.style.scrollSnapType = snap; }, 420));
      }, 420));
    }, 700));
    return () => timers.forEach(window.clearTimeout);
  }, [paged, articles.length]);

  // 보이는 만큼에서 조금 덜 민다. 한 칸이 걸쳐 남아 있어야 이어지는
  // 목록이라는 것이 보인다.
  const page = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const step = Math.max(track.clientWidth * 0.8, 120);
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  // 글이 없으면 아무것도 그리지 않는다. 아직 글을 쓰지 않은 카드에 빈 자리가
  // 생기면 미완성으로 보인다.
  if (articles.length === 0) return null;

  // 흐르는 띠는 두 벌을 이어 붙여 절반만큼 민 뒤 처음으로 되돌린다. 되돌아온
  // 자리의 그림이 방금 지나간 것과 같아 이음매가 보이지 않는다. 도는 시간은
  // 장수에 비례해 잡는다 — 고정값이면 글이 늘수록 빨라져 어지럽다.
  const flowing = !paged && articles.length > 2;
  const seconds = Math.max(articles.length * 7.5, 26);

  const tile = (article, echo = false) => (
    <li key={echo ? `echo-${article.id}` : article.id} aria-hidden={echo || undefined}>
      <a
        href={`services/?service=${encodeURIComponent(serviceKey)}&article=${article.id}`}
        title={article.title}
        aria-label={article.title}
        tabIndex={echo ? -1 : undefined}
      >
        <span className="service-columns-shot">
          {article.thumbnail_url
            ? <img src={article.thumbnail_url} alt="" loading="lazy" />
            : <span className="service-columns-blank" aria-hidden="true" />}
        </span>
      </a>
    </li>
  );

  const step = (direction) => (
    <button
      type="button"
      className={`service-columns-step service-columns-step--${direction < 0 ? 'prev' : 'next'}`}
      onClick={() => page(direction)}
      disabled={direction < 0 ? reach.start : reach.end}
      aria-label={direction < 0 ? `${serviceName} 이전 글 보기` : `${serviceName} 다음 글 보기`}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        {direction < 0 ? <path d="m15 5-7 7 7 7" /> : <path d="m9 5 7 7-7 7" />}
      </svg>
    </button>
  );

  const className = [
    'service-columns',
    shape === 'round' ? 'service-columns--round' : '',
    paged ? 'service-columns--paged' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <div
        className={`service-columns-strip${flowing ? ' is-flowing' : ''}`}
        role="group"
        aria-label={`${serviceName} 관련 글`}
      >
        <ul
          ref={trackRef}
          className="service-columns-track"
          style={flowing ? { '--service-columns-seconds': `${seconds}s` } : undefined}
        >
          {articles.map((article) => tile(article))}
          {flowing && articles.map((article) => tile(article, true))}
        </ul>
        {paged && step(-1)}
        {paged && step(1)}
      </div>
    </div>
  );
}
