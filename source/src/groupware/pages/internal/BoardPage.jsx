import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { getBoardOverview, getBoardPosts, resolvePostThumbnail } from '../../services/boardService.js';
import { formatBoardDateTime } from '../../utils/datetime.js';

// 글머리 표시. 글쓰기 화면에서 체크한 것을 목록에서 제목 앞에 그림으로 알린다.
// 어느 게시판이든 같은 그림을 쓴다. 글자로 적으면 제목이 밀리고 게시판마다
// 말이 달라져, 훑어볼 때 눈에 걸리는 쪽을 골랐다.
//
//   공지글      표지판
//   중요글      빨간 느낌표
//   상단 고정   압정
//
// 그림만 두면 화면 낭독기에는 아무것도 안 들리므로 이름을 따로 싣는다.
function PostFlags({ post }) {
  const flags = [
    post.is_notice && { key: 'notice', label: '공지글', icon: (
      <><path d="M12 4.2V6" /><rect x="3.4" y="6" width="17.2" height="8.6" rx="1.6" /><path d="M12 14.6v5.2M9.4 19.8h5.2" /></>
    ) },
    post.is_important && { key: 'important', label: '중요글', icon: (
      <><circle cx="12" cy="12" r="8.4" /><path d="M12 7.6v5.2" /><path d="M12 16.2v.1" /></>
    ) },
    post.is_pinned && { key: 'pinned', label: '상단 고정', icon: (
      <><path d="M9 3.6h6l-.9 5.2 3.1 2.6H6.8l3.1-2.6z" /><path d="M12 11.4v9" /></>
    ) },
  ].filter(Boolean);
  if (flags.length === 0) return null;
  return flags.map((flag) => (
    <span key={flag.key} className={`gw-post-flag gw-post-flag--${flag.key}`} title={flag.label}>
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{flag.icon}</svg>
      <b>{flag.label}</b>
    </span>
  ));
}

// embedded: 링크 페이지 안에서 하위 화면으로 렌더될 때. 라우트 파라미터 대신
// props로 게시판을 받고, 뒤로가기·목록 이동처럼 전체 화면 전제의 동선은 숨긴다.
// onOpenPost: 글을 눌렀을 때 다른 화면으로 이동하는 대신 이 함수를 부른다.
// 팝업 안에서 목록 ↔ 본문을 같은 화면에서 바꿔 끼우기 위해 쓴다.
export default function BoardPage({ boardSlug: boardSlugProp, embedded = false, onOpenPost = null }) {
  const navigate = useNavigate();
  const routeParams = useParams(); const boardSlug = boardSlugProp ?? routeParams.boardSlug;
  const [params, setParams] = useSearchParams();
  const [overview, setOverview] = useState(null); const [posts, setPosts] = useState({ items: [] }); const [thumbnails, setThumbnails] = useState({}); const [error, setError] = useState('');
  const search = params.get('q') ?? ''; const category = params.get('category') || null; const page = Number(params.get('page') ?? 1); const scope = params.get('scope') || 'all';
  useEffect(() => {
    let active = true;
    Promise.all([getBoardOverview(boardSlug), getBoardPosts(boardSlug, { search, category, page, scope })]).then(async ([info, list]) => {
      if (!active) return;
      setOverview(info); setPosts(list); setError(''); setThumbnails({});
      if (info.board.board_type !== 'gallery') return;
      // 대표 이미지를 고르지 않았어도 본문에 그림이 있으면 그것을 건다.
      // 주소로 넣은 그림도 여기서 잡힌다.
      const results = await Promise.allSettled(list.items.map(async (item) => [item.id, await resolvePostThumbnail(item)]));
      if (active) {
        setThumbnails(Object.fromEntries(results
          .filter((item) => item.status === 'fulfilled' && item.value[1])
          .map((item) => item.value)));
      }
    }).catch(() => { if (active) setError('게시판 접근 권한이 없거나 게시판을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [boardSlug, search, category, page, scope]);
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
    const form = new FormData(event.currentTarget);
    const value = form.get('search');
    const nextScope = form.get('scope') || 'all';
    setParams((current) => {
      if (value) current.set('q', value); else current.delete('q');
      // 검색어가 없으면 범위도 지운다. 주소에 아무 일도 하지 않는 값이 남지 않게.
      if (value && nextScope !== 'all') current.set('scope', nextScope); else current.delete('scope');
      current.set('page', '1');
      return current;
    });
  };
  // 표 형태 목록은 일반 게시판(공지·자유)에만 쓴다. 갤러리는 썸네일 격자,
  // 대화형은 댓글 수를 앞세운 카드가 각각 그 형식의 요점이라 그대로 둔다.
  const isTableList = !isDiscussion && overview.board.board_type !== 'gallery';
  const pageSize = posts.page_size || 20;
  const totalCount = posts.total_count ?? posts.items.length;
  // 글 번호는 최신 글이 가장 큰 수가 되게 매긴다. 페이지를 넘겨도 이어진다.
  const numberOf = (index) => totalCount - ((page - 1) * pageSize) - index;

  // 페이지 번호는 한 번에 다섯 개만 보인다. 100페이지짜리 게시판에서
  // 번호가 줄을 넘겨 흐르는 것을 막는다.
  const pageWindow = (() => {
    const size = Math.min(5, totalPages);
    let first = Math.max(1, page - Math.floor(size / 2));
    if (first + size - 1 > totalPages) first = totalPages - size + 1;
    return Array.from({ length: size }, (unused, index) => first + index);
  })();
  const goToPage = (next) => setParams((current) => { current.set('page', String(next)); return current; });

  const categoryNameOf = (post) => post.category ?? post.prefix ?? (post.is_notice ? '공지' : '일반');

  return <article className={embedded ? 'gw-page gw-page--embedded' : 'gw-page'} aria-labelledby="board-title">
    <header className="gw-page-header gw-board-header">
            <h1 id="board-title">{overview.board.name}</h1>
      <div className="gw-board-header-actions">
        {!embedded && <Link className="gw-secondary-button" to="/boards">목록 이동</Link>}
      </div>
    </header>

    {/* 분류 탭. 고른 것만 진하게 채워 지금 어디를 보고 있는지 한눈에 보이게 한다. */}
    {overview.categories.length > 0 && (
      <div className="gw-board-tabs" role="tablist" aria-label="게시판 분류">
        <button type="button" role="tab" aria-selected={!category} className={!category ? 'is-active' : ''} onClick={() => selectCategory(null)}>전체보기</button>
        {overview.categories.map((item) => (
          <button type="button" role="tab" key={item.id} aria-selected={category === item.id} className={category === item.id ? 'is-active' : ''} onClick={() => selectCategory(item.id)}>{item.name}</button>
        ))}
      </div>
    )}

    {overview.board.settings.search_enabled !== false && (
      <form className="gw-board-searchbar" onSubmit={submitSearch} role="search">
        <select name="scope" aria-label="검색 범위" key={scope} defaultValue={scope}>
          <option value="all">전체</option>
          <option value="title">제목</option>
          <option value="author">작성자</option>
        </select>
        <input name="search" defaultValue={search} aria-label="게시판 검색" />
        <button type="submit" aria-label="검색">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
        </button>
      </form>
    )}

    {isTableList ? (
      <div className="gw-post-table-wrap">
        <table className="gw-post-table">
          <thead><tr><th scope="col">글 번호</th><th scope="col">카테고리</th><th scope="col">제목</th><th scope="col">작성자</th><th scope="col">작성일</th></tr></thead>
          <tbody>
            {posts.items.map((post, index) => (
              <tr key={post.id} className={post.is_pinned ? 'is-pinned' : ''}>
                <td className="gw-post-table-no">{post.is_pinned ? <span className="gw-post-table-badge">공지</span> : numberOf(index)}</td>
                <td className="gw-post-table-category">{categoryNameOf(post)}</td>
                <td className="gw-post-table-title">
                  <PostFlags post={post} />
                  <PostLink postId={post.id}>{post.title}</PostLink>
                  {post.attachment_count > 0 && <span className="gw-post-table-mark" title={`첨부 ${post.attachment_count}개`} aria-label={`첨부 ${post.attachment_count}개`}>
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 4.5-4.2a1.7 1.7 0 0 1 2.3 0L16 17" /></svg>
                  </span>}
                  {post.comment_count > 0 && <span className="gw-post-table-comments" aria-label={`댓글 ${post.comment_count}개`}>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12a7.5 7.5 0 0 1-7.5 7.5H8L4 22v-4.2A7.5 7.5 0 0 1 12.5 4.5 7.5 7.5 0 0 1 20 12Z" /></svg>
                    {post.comment_count}
                  </span>}
                </td>
                <td className="gw-post-table-author">{formatAuthor(post, overview.board.settings)}</td>
                <td className="gw-post-table-date">{formatBoardDateTime(post.created_at)}</td>
              </tr>
            ))}
            {posts.items.length === 0 && <tr><td colSpan={5} className="gw-post-table-empty">등록된 게시글이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    ) : (
      <>
        <div className={`gw-post-list gw-post-list--${overview.board.board_type}`}>{posts.items.map((post) => <article key={post.id} className={post.is_pinned ? 'is-pinned' : ''}>{overview.board.board_type === 'gallery' && <PostLink className="gw-gallery-thumbnail" postId={post.id} aria-label={`${post.title} 상세 보기`}>{thumbnails[post.id] ? <img src={thumbnails[post.id]} alt="" /> : <span>대표 이미지 없음</span>}</PostLink>}{isDiscussion && <div className="gw-discussion-count"><strong>{post.comment_count}</strong><span>댓글</span></div>}
          <div className="gw-post-list-main"><h2><PostFlags post={post} /><PostLink postId={post.id}>{post.title}</PostLink></h2>{isDiscussion && post.excerpt && <p className="gw-discussion-excerpt">{post.excerpt}</p>}</div>
          <div className="gw-post-list-meta">
            {post.comment_count > 0 && <span title={`댓글 ${post.comment_count}개`}>💬 {post.comment_count}</span>}
            {post.attachment_count > 0 && <span title={`첨부 ${post.attachment_count}개`}>📎 {post.attachment_count}</span>}
            <span className="gw-post-list-category">{categoryNameOf(post)}</span>
            <span className="gw-post-list-author">{formatAuthor(post, overview.board.settings)}</span>
            <time>{formatBoardDateTime(post.created_at)}</time>
          </div></article>)}</div>
        {posts.items.length === 0 && <p className="gw-empty-state">등록된 게시글이 없습니다.</p>}
      </>
    )}

    <nav className="gw-page-numbers" aria-label="게시글 페이지">
      <button type="button" disabled={page <= 1} onClick={() => goToPage(page - 1)} aria-label="이전 페이지">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
      {pageWindow.map((number) => (
        <button type="button" key={number} className={number === page ? 'is-current' : ''} aria-current={number === page ? 'page' : undefined} onClick={() => goToPage(number)}>{number}</button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => goToPage(page + 1)} aria-label="다음 페이지">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </nav>

    {overview.permissions.create && (
      <div className="gw-board-write-row">
        <Link className="gw-board-write-button" to={`/boards/${boardSlug}/write`}>{isDiscussion ? '새 대화 시작' : '글쓰기'}</Link>
      </div>
    )}
  </article>;
}

function formatAuthor(post, settings) {
  const parts = [post.author_name];
  if (settings.show_author_department && post.author_department) parts.push(post.author_department);
  if (settings.show_author_position && post.author_position) parts.push(post.author_position);
  if (settings.show_author_job_title && post.author_job_title) parts.push(post.author_job_title);
  return parts.filter(Boolean).join(' · ');
}
