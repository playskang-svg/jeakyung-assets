import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

import { getLinkPage } from '../../services/linkPageService.js';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import PageSection, { isInlineItem } from '../../components/PageSection.jsx';

// 업무 페이지. 제목과 버튼 줄이 고정 머리글로 남고, 버튼을 누르면 그 아래
// 영역만 해당 항목으로 바뀐다. 항목은 게시판·외부 화면·HTML 문서·글·바로가기
// 버튼 중 하나이고, 다른 페이지나 새 탭으로 나가는 주소는 머리글의 링크로 남는다.
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
      <header className="gw-linktree-header">
        <div className="gw-linktree-heading">
          <h1 id="linktree-title">{data.page.title}</h1>
          {data.page.description && <p>{data.page.description}</p>}
        </div>
        {!data.button_box && items.length > 0 && (
          <nav className="gw-linktree-tabs" aria-label={`${data.page.title} 항목`}>
            {items.map((item) => (isInlineItem(item) ? (
              <button
                key={item.id}
                type="button"
                className={item.id === activeItem?.id ? 'is-active' : ''}
                aria-current={item.id === activeItem?.id ? 'page' : undefined}
                onClick={() => selectItem(item)}
              >
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
      {data.button_box ? (
        <div className="gw-linktree-content"><ButtonBoxGrid box={data.button_box} items={data.button_box.items} /></div>
      ) : activeItem ? (
        <div className="gw-linktree-content"><PageSection key={activeItem.id} item={activeItem} /></div>
      ) : (
        <p className="gw-empty-state">표시할 항목이 없습니다. 관리자 화면에서 항목을 추가해 주세요.</p>
      )}
    </article>
  );
}
