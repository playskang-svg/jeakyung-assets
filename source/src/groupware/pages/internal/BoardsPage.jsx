import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBoardType } from '../../config/boardTypes.js';
import { getVisibleBoards } from '../../services/boardService.js';

export default function BoardsPage() {
  const [boards, setBoards] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getVisibleBoards()
      .then((data) => { setBoards(data); setError(''); })
      .catch(() => setError('접근 가능한 게시판을 불러오지 못했습니다.'));
  }, []);

  const groups = useMemo(() => boards.reduce((result, board) => {
    const key = board.group_name ?? '기타';
    (result[key] ??= []).push(board);
    return result;
  }, {}), [boards]);

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
                const type = getBoardType(board.board_type);
                return (
                  // 카드 전체가 링크다. 제목 글자만 정확히 겨냥할 필요가 없다.
                  <article className="gw-board-card" key={board.id}>
                    <span className="gw-board-type-label">{type.label}</span>
                    <h3><Link to={`/boards/${board.slug}`}>{board.name}</Link></h3>
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
      {boards.length === 0 && !error && <p className="gw-empty-state">현재 읽기 권한이 부여된 게시판이 없습니다.</p>}
    </article>
  );
}
