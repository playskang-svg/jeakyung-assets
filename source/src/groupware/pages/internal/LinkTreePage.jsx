import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getLinkPage } from '../../services/linkPageService.js';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import PageSection, { isInlineItem } from '../../components/PageSection.jsx';

// 업무 페이지. 위에 고정된 메뉴줄, 그 아래 바뀌는 두 층으로 되어 있다.
//
//   지입업무 │ [탭1][탭2][탭3]   상단바 밑에 붙어 스크롤해도 남는 메뉴줄
//   ─────────────────────────────
//   [버튼][버튼]        그 탭에 매달린 버튼 박스(없으면 이 줄이 없다)
//   게시판·문서·외부화면  그 탭의 내용
//
// 탭을 고르면 아래 두 층만 바뀌고 메뉴줄은 그대로 서 있다. 항목은 게시판·
// 외부 화면·HTML 문서·글·바로가기 버튼 중 하나이고, 다른 페이지나 새 탭으로
// 나가는 주소는 메뉴줄의 링크로 남는다.
export default function LinkTreePage() {
  const { pageSlug } = useParams();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setData(null); setError('');
    getLinkPage(pageSlug)
      .then((value) => { if (active) setData(value); })
      .catch((cause) => { if (active) setError(cause.message || '페이지를 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [pageSlug]);

  if (error) return <div className="gw-route-state"><div className="gw-notice gw-notice--warning" role="alert">{error}</div></div>;
  if (!data) return <p className="gw-empty-state" role="status">페이지를 불러오고 있습니다.</p>;

  const items = data.items ?? [];
  const inlineItems = items.filter(isInlineItem);
  const activeItem = inlineItems.find((item) => item.id === params.get('tab')) ?? inlineItems[0] ?? null;
  // 항목을 바꾸면 이전 게시판의 검색·분류·쪽수 상태는 의미가 없으므로 함께 버린다.
  const selectItem = (item) => setParams({ tab: item.id });

  return (
    <article className="gw-page gw-linktree-page" aria-labelledby="linktree-title">
      {/* 고정 메뉴줄. 어느 탭에 들어가 있든 나머지 탭이 함께 보인다. */}
      <header className="gw-linktree-menubar">
        <div className="gw-linktree-menubar-title">
          <h1 id="linktree-title">{data.page.title}</h1>
        </div>
        {items.length > 0 && (
          <nav className="gw-linktree-tabs" aria-label={`${data.page.title} 메뉴`}>
            {items.map((item) => (isInlineItem(item) ? (
              <button
                key={item.id}
                type="button"
                className={item.id === activeItem?.id ? 'is-active' : ''}
                aria-current={item.id === activeItem?.id ? 'page' : undefined}
                onClick={() => selectItem(item)}
              >
                {item.button_box && (
                  <span className="gw-tab-link-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: '5px' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  </span>
                )}
                {item.label}
              </button>
            ) : (
              // 화면 안에 끼워 넣을 수 없는 대상은 새 탭으로 연다.
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer">
                {item.label} <i aria-hidden="true">↗</i>
              </a>
            )))}
          </nav>
        )}
      </header>
      {/* 고른 탭에 매달린 버튼 줄. 게시판이 아닌 항목일 때만 상단에 둔다. (게시판은 제목과 카테고리 사이에 배치) */}
      {activeItem?.button_box && activeItem.item_type !== 'board' && (
        <div className="gw-linktree-buttons">
          <ButtonBoxGrid box={activeItem.button_box} items={activeItem.button_box.items} />
        </div>
      )}
      {activeItem ? (
        <div className="gw-linktree-content"><PageSection key={activeItem.id} item={activeItem} /></div>
      ) : data.button_box ? (
        // 항목 없이 버튼 박스만 두고 쓰던 예전 페이지. 그대로 동작해야 한다.
        <div className="gw-linktree-content"><ButtonBoxGrid box={data.button_box} items={data.button_box.items} /></div>
      ) : (
        <p className="gw-empty-state">표시할 항목이 없습니다. 관리자 화면에서 항목을 추가해 주세요.</p>
      )}
    </article>
  );
}
