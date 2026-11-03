import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBoardType } from '../../config/boardTypes.js';
import { getVisibleBoards } from '../../services/boardService.js';
import { getMyLinkPages } from '../../services/linkPageService.js';
import BoardCardArt, { boardCardKind } from '../../components/BoardCardArt.jsx';
import { isHiddenConsignmentLink } from '../../config/navigation.js';

export default function BoardsPage() {
  const [boards, setBoards] = useState([]);
  const [linkPages, setLinkPages] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.allSettled([getVisibleBoards(), getMyLinkPages()])
      .then(([boardRes, linkRes]) => {
        if (boardRes.status === 'fulfilled') {
          setBoards(boardRes.value);
          setError('');
        } else {
          setError('접근 가능한 게시판을 불러오지 못했습니다.');
        }
        if (linkRes.status === 'fulfilled') {
          setLinkPages(linkRes.value);
        }
      });
  }, []);

  const groups = useMemo(() => {
    const list = boards.filter((board) => !isHiddenConsignmentLink(board));

    // 그 외 사용자 권한이 있는 업무 링크페이지도 게시판 목록에 포함
    for (const page of linkPages) {
      if (isHiddenConsignmentLink(page)) continue;
      if (!list.some((b) => b.name === page.title || b.slug === page.slug)) {
        list.push({
          id: page.id,
          group_name: '회사',
          name: page.title,
          slug: page.slug,
          to: `/pages/${page.slug}`,
          description: page.description || `${page.item_count}개 항목`,
          board_type: 'page',
          isLinkPage: true,
          sort_order: 80,
        });
      }
    }

    const map = list.reduce((result, board) => {
      const key = board.group_name ?? '기타';
      (result[key] ??= []).push(board);
      return result;
    }, {});

    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sort_order ?? 100) - (b.sort_order ?? 100));
    }

    return map;
  }, [boards, linkPages]);

  return (
    <article className="gw-page" aria-labelledby="page-title">
      <header className="gw-page-header">
        <div>
          <span className="gw-eyebrow">BOARDS</span>
          <h1 id="page-title">게시판</h1>
          <p>관리자가 부여한 읽기 권한이 있는 게시판만 표시됩니다.</p>
        </div>
      </header>
      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      <div className="gw-board-directory">
        {Object.entries(groups).map(([group, items]) => (
          <section key={group}>
            <h2>{group}</h2>
            <div className="gw-board-card-grid">
              {items.map((board) => {
                const type = board.isLinkPage && board.board_type === 'page'
                  ? { label: '업무 페이지', description: `${board.item_count ?? 1}개 항목` }
                  : getBoardType(board.board_type);
                const targetUrl = board.to ?? `/boards/${board.slug}`;
                const cardKind = boardCardKind(board);
                return (
                  // 카드 전체가 링크다. 제목 글자만 정확히 겨냥할 필요가 없다.
                  <article className={`gw-board-card gw-card-kind--${cardKind}`} key={board.id}>
                    <span className="gw-board-type-label">{type.label}</span>
                    <h3><Link to={targetUrl}><BoardCardArt kind={cardKind} />{board.name}</Link></h3>
                    <p>{board.description || type.description}</p>
                    <span className="gw-board-card-enter" aria-hidden="true">
                      바로가기
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h14" /><polyline points="13 6 19 12 13 18" /></svg>
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {boards.length === 0 && linkPages.length === 0 && !error && <p className="gw-empty-state">현재 읽기 권한이 부여된 게시판이 없습니다.</p>}
    </article>
  );
}
