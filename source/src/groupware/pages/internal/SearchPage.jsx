import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { searchBoardPosts } from '../../services/boardService.js';

const formatDate = (value) => new Date(value).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });

// 게시판 전체 검색 결과. 어느 게시판의 글인지가 결과를 고르는 근거이므로
// 제목과 같은 줄에 게시판 이름을 둔다.
export default function SearchPage() {
  const [params] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setPosts(null); setError('');
    if (!query) { setPosts([]); return undefined; }
    searchBoardPosts(query)
      .then((data) => { if (active) setPosts(data); })
      .catch((cause) => { if (active) setError(cause.message || '검색하지 못했습니다.'); });
    return () => { active = false; };
  }, [query]);

  return (
    <article className="gw-page gw-search-page" aria-labelledby="search-title">
      <header className="gw-page-header">
        <div>
          <h1 id="search-title">검색</h1>
          {query
            ? <p><strong>{query}</strong> · {posts === null ? '찾는 중…' : `${posts.length}건`}</p>
            : <p>상단 검색창에 찾을 말을 입력해 주세요.</p>}
        </div>
      </header>

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}

      {query && posts !== null && posts.length === 0 && !error && (
        <p className="gw-empty-state">찾는 글이 없습니다. 다른 말로 찾아보세요.</p>
      )}

      {posts !== null && posts.length > 0 && (
        <ul className="gw-search-results">
          {posts.map((post) => (
            <li key={post.id}>
              <Link to={`/boards/${post.board_slug}/posts/${post.id}`}>
                <strong>{post.title}</strong>
                <span className="gw-search-meta">
                  <em>{post.board_name}</em>
                  <span>{post.author_name}</span>
                  <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
                  {post.comment_count > 0 && <span className="gw-comment-count">{post.comment_count}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
