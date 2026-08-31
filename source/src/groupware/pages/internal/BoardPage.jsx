import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getAttachmentViewUrl, getBoardOverview, getBoardPosts } from '../../services/boardService.js';

// embedded: 링크 페이지 안에서 하위 화면으로 렌더될 때. 라우트 파라미터 대신
// props로 게시판을 받고, 뒤로가기·목록 이동처럼 전체 화면 전제의 동선은 숨긴다.
// onOpenPost: 글을 눌렀을 때 다른 화면으로 이동하는 대신 이 함수를 부른다.
// 팝업 안에서 목록 ↔ 본문을 같은 화면에서 바꿔 끼우기 위해 쓴다.
export default function BoardPage({ boardSlug: boardSlugProp, embedded = false, onOpenPost = null }) {
  const navigate = useNavigate();
  const routeParams = useParams(); const boardSlug = boardSlugProp ?? routeParams.boardSlug;
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState(null); const [posts, setPosts] = useState({ items: [] }); const [thumbnails, setThumbnails] = useState({}); const [error, setError] = useState('');
  const search = params.get('q') ?? ''; const category = params.get('category') || null; const page = Number(params.get('page') ?? 1);
  useEffect(() => {
    let active = true;
    Promise.all([getBoardOverview(boardSlug), getBoardPosts(boardSlug, { search, category, page })]).then(async ([info, list]) => {
      if (!active) return;
      setOverview(info); setPosts(list); setError(''); setThumbnails({});
      if (info.board.board_type !== 'gallery') return;
      const covers = list.items.filter((item) => item.cover_attachment_id);
      const results = await Promise.allSettled(covers.map(async (item) => [item.id, await getAttachmentViewUrl(item.cover_attachment_id)]));
      if (active) setThumbnails(Object.fromEntries(results.filter((item) => item.status === 'fulfilled').map((item) => item.value)));
    }).catch(() => { if (active) setError('게시판 접근 권한이 없거나 게시판을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [boardSlug, search, category, page]);
  if (error) return <div className="gw-route-state"><div className="gw-notice gw-notice--warning" role="alert">{error}<br /><Link to="/boards">게시판 목록으로</Link></div></div>;
  if (!overview) return <p className="gw-empty-state" role="status">게시판을 불러오고 있습니다.</p>;
  // 팝업 안에서는 라우팅 대신 콜백으로 본문을 바꿔 끼운다.
  const PostLink = ({ postId, children, ...rest }) => (onOpenPost
    ? <a href={`/groupware/boards/${boardSlug}/posts/${postId}`} onClick={(event) => { event.preventDefault(); onOpenPost(postId); }} {...rest}>{children}</a>
    : <Link to={`/boards/${boardSlug}/posts/${postId}`} {...rest}>{children}</Link>);

  const isDiscussion = overview.board.board_type === 'discussion';
  const totalPages = Math.max(1, Math.ceil((posts.total_count ?? posts.items.length) / (posts.page_size || 20)));
  const selectCategory = (categoryId) => setParams((current) => {
    if (categoryId) current.set('category', categoryId);
    else current.delete('category');
    current.set('page', '1');
    return current;
  });
  const submitSearch = (event) => {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get('search');
    setParams((current) => {
      if (value) current.set('q', value); else current.delete('q');
      current.set('page', '1');
      return current;
    });
  };
  // 제목 줄 하나에 분류·검색·목록 이동·글쓰기를 모두 둔다. 예전에는 분류 탭과
  // 검색 폼이 각각 한 줄씩 차지해 목록이 그만큼 아래로 밀렸다.
  return <article className={embedded ? 'gw-page gw-page--embedded' : 'gw-page'} aria-labelledby="board-title">
    <header className="gw-page-header gw-board-header">
      {!embedded && <button type="button" className="gw-back-icon-button" onClick={() => navigate('/boards')} aria-label="게시판 목록으로"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg></button>}
      <h1 id="board-title">{overview.board.name}</h1>
      <div className="gw-board-header-actions">
        {overview.categories.length > 0 && (
          <label className="gw-board-category-select">
            <span className="gw-visually-hidden">게시판 분류</span>
            <select value={category ?? ''} onChange={(event) => selectCategory(event.target.value || null)}>
              <option value="">전체 분류</option>
              {overview.categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        )}
        {overview.board.settings.search_enabled !== false && (
          <form className="gw-board-search" onSubmit={submitSearch} role="search">
            <input name="search" defaultValue={search} placeholder="검색" aria-label="게시판 검색" />
            <button type="submit">검색</button>
          </form>
        )}
        {overview.board.settings.shortcut_enabled && overview.board.settings.shortcut_url && <a className="gw-secondary-button gw-board-shortcut-button" href={overview.board.settings.shortcut_url} target="_blank" rel="noopener noreferrer" aria-label={`${overview.board.settings.shortcut_label || '바로가기'}, 새 창`}>{overview.board.settings.shortcut_label || '바로가기'}<span aria-hidden="true">↗</span></a>}
        {!embedded && <Link className="gw-secondary-button" to="/boards">목록 이동</Link>}
        {overview.permissions.create && <Link className="gw-primary-button gw-board-write-button" to={`/boards/${boardSlug}/write`}>{isDiscussion ? '새 대화 시작' : '글쓰기'}</Link>}
      </div>
    </header>
    <div className={`gw-post-list gw-post-list--${overview.board.board_type}`}>{posts.items.map((post) => <article key={post.id} className={post.is_pinned ? 'is-pinned' : ''}>{overview.board.board_type === 'gallery' && <PostLink className="gw-gallery-thumbnail" postId={post.id} aria-label={`${post.title} 상세 보기`}>{thumbnails[post.id] ? <img src={thumbnails[post.id]} alt="" /> : <span>대표 이미지 없음</span>}</PostLink>}{isDiscussion && <div className="gw-discussion-count"><strong>{post.comment_count}</strong><span>댓글</span></div>}{/* 좌측은 제목 한 줄만. 분류·작성자·날짜는 모두 우측으로 보낸다. */}
      <div className="gw-post-list-main"><h2><PostLink postId={post.id}>{post.title}</PostLink></h2>{isDiscussion && post.excerpt && <p className="gw-discussion-excerpt">{post.excerpt}</p>}</div>
      <div className="gw-post-list-meta">
        {post.comment_count > 0 && <span title={`댓글 ${post.comment_count}개`}>💬 {post.comment_count}</span>}
        {post.attachment_count > 0 && <span title={`첨부 ${post.attachment_count}개`}>📎 {post.attachment_count}</span>}
        <span className="gw-post-list-category">{post.category ?? post.prefix ?? (post.is_notice ? '공지' : isDiscussion ? '대화' : '일반')}</span>
        <span className="gw-post-list-author">{formatAuthor(post, overview.board.settings)}</span>
        <time>{new Date(post.created_at).toLocaleDateString('ko-KR')}</time>
      </div></article>)}</div>
    {posts.items.length === 0 && <p className="gw-empty-state">등록된 게시글이 없습니다.</p>}<nav className="gw-pagination" aria-label="게시글 페이지"><button type="button" disabled={page <= 1} onClick={() => setParams({ q: search, ...(category ? { category } : {}), page: String(page - 1) })}>이전</button><span>{page} / {totalPages}페이지 · 총 {posts.total_count ?? posts.items.length}건</span><button type="button" disabled={page >= totalPages} onClick={() => setParams({ q: search, ...(category ? { category } : {}), page: String(page + 1) })}>다음</button></nav>
  </article>;
}

function formatAuthor(post, settings) {
  const parts = [post.author_name];
  if (settings.show_author_department && post.author_department) parts.push(post.author_department);
  if (settings.show_author_position && post.author_position) parts.push(post.author_position);
  if (settings.show_author_job_title && post.author_job_title) parts.push(post.author_job_title);
  return parts.filter(Boolean).join(' · ');
}
