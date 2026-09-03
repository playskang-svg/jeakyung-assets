import { useEffect, useState } from 'react';

// 서비스 카드 안에 붙는 칼럼 띠.
//
// 그 서비스만의 글을 그림으로만 왼쪽으로 흘려 보낸다. 띠 이름도, 글 제목도,
// 목록으로 가는 링크도 두지 않는다 — 카드에는 이미 서비스 이름과 설명이
// 있어서 글자를 더 얹으면 읽을 것만 늘고 그림이 눈에 들어오지 않는다.
// 이름은 마우스를 올렸을 때와 화면 낭독기에만 남긴다. 카드 안은 좁아서
// 좌우 단추를 두면 사진을 가리고 손이 많이 간다. 흘려 두면 가만히 있어도
// 다음 것이 지나간다.
//
// 누르면 소식 페이지로 넘어간다. 카드 안에서 본문을 펼치면 카드가 늘어나
// 옆 카드와 줄이 어긋나므로, 읽는 자리는 머리글 아래 제 페이지로 보낸다.
// 주소에 글 번호가 실려 있어 링크를 그대로 나눠 줄 수도 있다. 그 페이지에
// 같은 서비스의 글이 모두 모여 있으므로 따로 목록 링크를 둘 이유가 없다.
//
// shape="round" 를 주면 그림을 동그랗게 잘라 낸다. 서비스마다 띠의 인상을
// 달리 하려는 것으로, 흐르는 방식과 누를 때 벌어지는 일은 모두 같다.
//
// 목록은 화면이 뜬 뒤에 따로 받는다. supabase-js 를 마케팅 페이지 첫 묶음에
// 넣지 않으려는 것으로, 소식/정보 영역과 같은 방식이다.
export default function ServiceColumns({ serviceKey, serviceName, shape = 'square' }) {
  const [articles, setArticles] = useState([]);

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

  // 글이 없으면 아무것도 그리지 않는다. 아직 글을 쓰지 않은 카드에 빈 자리가
  // 생기면 미완성으로 보인다.
  if (articles.length === 0) return null;

  // 두 벌을 이어 붙여 절반만큼 민 뒤 처음으로 되돌린다. 되돌아온 자리의 그림이
  // 방금 지나간 것과 같아 이음매가 보이지 않는다. 도는 시간은 장수에 비례해
  // 잡는다 — 고정값이면 글이 늘수록 빨라져 어지럽다.
  const flowing = articles.length > 2;
  const seconds = Math.max(articles.length * 7.5, 26);

  const tile = (article, echo = false) => (
    <li key={echo ? `echo-${article.id}` : article.id} aria-hidden={echo || undefined}>
      <a
        href={`news/?service=${encodeURIComponent(serviceKey)}&article=${article.id}`}
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

  return (
    <div className={`service-columns${shape === 'round' ? ' service-columns--round' : ''}`}>
      <div
        className={`service-columns-strip${flowing ? ' is-flowing' : ''}`}
        role="group"
        aria-label={`${serviceName} 관련 글`}
      >
        <ul
          className="service-columns-track"
          style={flowing ? { '--service-columns-seconds': `${seconds}s` } : undefined}
        >
          {articles.map((article) => tile(article))}
          {flowing && articles.map((article) => tile(article, true))}
        </ul>
      </div>
    </div>
  );
}
