import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyDashboardWidgets, setDashboardPreference } from '../../services/dashboardService.js';
import { BOARD_CATALOG_CHANGED_EVENT, getBoardPosts, getRecentBoardPosts, getVisibleBoards } from '../../services/boardService.js';
import { getMyLinkPages } from '../../services/linkPageService.js';
import { getButtonBox } from '../../services/buttonBoxService.js';
import ProfileCard from '../../components/profile/ProfileCard.jsx';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getQuickLinks } from '../../services/quickLinkService.js';

// 홈 화면에 내보내지 않는 위젯.
//   앞의 셋 — 홈 화면 위쪽이 직접 그린다. 위젯으로 또 그리면 같은 목록이 한
//              화면에 두 번 나온다.
//   뒤의 셋 — 아직 만들지 않은 기능이라 제목만 나오고 안이 비어 있었다.
// 위젯 자체를 지우지는 않는다. 관리자 설정에는 그대로 남아 있어, 홈 구성을
// 바꾸거나 기능을 만들면 이 목록에서 빼기만 하면 된다.
const NOT_ON_HOME = new Set([
  'notices', 'recent_posts', 'mail_link',
  'approval_status', 'today_schedule', 'week_schedule',
]);
const NOTICE_SLUG = 'company-notice';

const shortDate = (value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
};

// 다섯 줄짜리 글 목록. 공지사항과 최신 게시글이 같은 모양을 쓴다.
// 공지사항·최신 게시글 두 줄은 같은 길이로 나란히 선다.
const FEED_ROWS = 3;

// 홈 화면 '페이지' 박스의 버튼 하나. 색·크기는 관리자가 고른 값이고,
// 어디로 어떻게 여는지는 주소 모양과 open_in 이 정한다.
//
//   /approval        → 그 자리에서 이동
//   https://… frame  → /view/link/<id> 액자 안에서
//   https://… tab    → 새 탭 (액자를 거부하는 사이트)
//
// 액자로 보낼 때도 주소를 경로에 싣지 않는다. 그렇게 하면 누구나 주소만 바꿔
// 임의의 사이트를 우리 화면 안에 띄울 수 있다. id 만 넘긴다.
function QuickLinkButton({ link }) {
  const className = `gw-quickbtn is-${link.variant} is-${link.size}`;

  // 볼 권한이 없으면 서버가 주소를 아예 내려주지 않는다(url === null). 버튼은
  // 그대로 두되 눌렀을 때 안내 화면으로 보낸다 — 있는 줄도 몰랐던 것보다
  // "권한이 없다"고 말해 주는 편이 낫다.
  if (!link.url) {
    return (
      <Link className={`${className} is-locked`} to={`/view/link/${link.id}`} title="조회 권한이 필요합니다">
        {link.label}
        <span aria-hidden="true">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        </span>
      </Link>
    );
  }

  if (link.url.startsWith('/')) return <Link className={className} to={link.url}>{link.label}</Link>;
  if (link.open_in === 'tab') {
    return (
      <a className={className} href={link.url} target="_blank" rel="noopener noreferrer">
        {link.label}<span aria-hidden="true">↗</span>
      </a>
    );
  }
  return <Link className={className} to={`/view/link/${link.id}`}>{link.label}</Link>;
}

function PostLines({ title, posts, to, emptyText, showBoard = false }) {
  return (
    <section className="gw-feed" aria-label={title}>
      <header>
        <h2>{title}</h2>
        <Link to={to}>
          더보기
          <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h14" /><polyline points="13 6 19 12 13 18" /></svg>
        </Link>
      </header>
      {posts.length === 0
        ? <p className="gw-feed-empty">{emptyText}</p>
        : <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <Link to={`/boards/${post.board_slug}/posts/${post.id}`}>
                {showBoard && <em>{post.board_name}</em>}
                <span>{post.title}</span>
                {post.comment_count > 0 && <b>{post.comment_count}</b>}
              </Link>
              <time dateTime={post.created_at}>{shortDate(post.created_at)}</time>
            </li>
          ))}
        </ul>}
    </section>
  );
}

// 초 단위로 흐르는 시계. 날짜와 요일은 한국어로 읽히게 직접 조립한다.
// 프로필 바로 아래 한 줄로 눕는다. 늘 같은 자리에 있으면 되는 정보라
// 세로로 자리를 많이 차지할 이유가 없다.
export default function DashboardPage() {
  const auth = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [boards, setBoards] = useState([]);
  const [linkPages, setLinkPages] = useState([]);
  const [quickLinkRows, setQuickLinkRows] = useState([]);
  const [notices, setNotices] = useState([]);
  const [recent, setRecent] = useState([]);
  const [buttonBoxes, setButtonBoxes] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    // 위젯 외에는 없어도 화면이 서야 하므로 각각 따로 받는다. 공지 게시판이
    // 없거나 권한이 없으면 그 줄만 비고 나머지는 그대로 나온다.
    const [widgetResult, boardResult, linkPageResult, noticeResult, recentResult, quickResult] = await Promise.allSettled([
      getMyDashboardWidgets(), getVisibleBoards(), getMyLinkPages(),
      getBoardPosts(NOTICE_SLUG, { page: 1 }), getRecentBoardPosts(FEED_ROWS),
      getQuickLinks(),
    ]);
    if (widgetResult.status === 'fulfilled') setWidgets(widgetResult.value);
    else setError('대시보드 구성을 불러오지 못했습니다.');
    if (boardResult.status === 'fulfilled') setBoards(boardResult.value);
    if (linkPageResult.status === 'fulfilled') setLinkPages(linkPageResult.value);
    if (noticeResult.status === 'fulfilled') {
      setNotices((noticeResult.value.items ?? []).slice(0, FEED_ROWS).map((item) => ({ ...item, board_slug: NOTICE_SLUG })));
    }
    if (recentResult.status === 'fulfilled') setRecent(recentResult.value);
    if (quickResult.status === 'fulfilled') setQuickLinkRows(quickResult.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, [auth.activeRole]);

  // 관리자가 게시판을 만들거나 지우면 박스도 따라 바뀌어야 한다.
  useEffect(() => {
    const reload = () => getVisibleBoards().then(setBoards).catch(() => {});
    window.addEventListener(BOARD_CATALOG_CHANGED_EVENT, reload);
    return () => window.removeEventListener(BOARD_CATALOG_CHANGED_EVENT, reload);
  }, []);

  useEffect(() => {
    const ids = [...new Set(widgets
      .filter((widget) => widget.widget_type === 'button_box' && widget.configuration?.button_box_id)
      .map((widget) => widget.configuration.button_box_id))];
    ids.filter((id) => !(id in buttonBoxes)).forEach((id) => {
      getButtonBox(id).then((result) => setButtonBoxes((current) => ({ ...current, [id]: result })))
        .catch(() => setButtonBoxes((current) => ({ ...current, [id]: null })));
    });
  }, [widgets]);

  const restore = async (widget) => {
    await setDashboardPreference(widget.id, { customOrder: widget.display_order, isHidden: false });
    setWidgets((current) => current.map((item) => item.id === widget.id ? { ...item, is_hidden: false } : item));
  };

  const toggleCollapse = (widgetId) => setCollapsed((current) => {
    const next = new Set(current);
    if (next.has(widgetId)) next.delete(widgetId);
    else next.add(widgetId);
    return next;
  });

  const shownWidgets = widgets.filter((widget) => !widget.is_hidden && !NOT_ON_HOME.has(widget.widget_type));
  const restorableWidgets = widgets.filter((widget) => widget.is_hidden && !NOT_ON_HOME.has(widget.widget_type));

  return (
    <article className="gw-page gw-dashboard-page" aria-label="대시보드">
      <ProfileCard />

      <div className="gw-panel gw-panel--feeds">
        <PostLines title="공지사항" posts={notices} to={`/boards/${NOTICE_SLUG}`} emptyText="등록된 공지가 없습니다." />
        <PostLines title="최신 게시글" posts={recent} to="/boards" emptyText="등록된 글이 없습니다." showBoard />
      </div>

      {/* 메일·전자결재 같은 기능은 게시판이 아니다. 같은 판에 담으면 '게시판'
          제목 아래 게시판이 아닌 것이 섞여 무엇이 무엇인지 알기 어렵다. */}
      {quickLinkRows.length > 0 && (
      <section className="gw-panel gw-launch-panel" aria-labelledby="dashboard-goto-title">
        <div className="gw-panel-heading">
          <h2 id="dashboard-goto-title">페이지</h2>
        </div>
        {/* 바깥 주소도 /view/<key> 로 간다. 새 탭으로 튕겨 나가지 않고
            상단 메뉴를 그대로 둔 채 이 화면 안에서 열린다. */}
        <div className="gw-quickrow">
          {quickLinkRows.map((item) => <QuickLinkButton key={item.id} link={item} />)}
        </div>
      </section>
      )}

      {/* 게시판으로 가는 길을 한 덩어리로 묶는다. 낱개로 흩어 두면 화면이
          버튼밭처럼 보이고 무엇이 한 묶음인지 알기 어렵다. */}
      {!loading && (boards.length > 0 || linkPages.length > 0) && (
        <section className="gw-panel gw-launch-panel" aria-labelledby="dashboard-boards-title">
          <div className="gw-panel-heading">
            <h2 id="dashboard-boards-title">게시판</h2>
            <Link to="/boards">전체 보기</Link>
          </div>
          <div className="gw-launch-grid">
            {boards.map((board) => (
              <Link className="gw-launch-card" key={board.id} to={`/boards/${board.slug}`}>
                <strong>{board.name}</strong>
                {board.description && <span>{board.description}</span>}
              </Link>
            ))}
            {linkPages.map((page) => (
              <Link className="gw-launch-card" key={page.id} to={`/pages/${page.slug}`}>
                <strong>{page.title}</strong>
                <span>{page.item_count}개 항목</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {shownWidgets.length > 0 && (
        <div className="gw-dashboard-grid">
          {shownWidgets.map((widget) => {
            const isCollapsed = collapsed.has(widget.id);
            return (
              <section className={`gw-dashboard-widget gw-dashboard-widget--${widget.size}`} key={widget.id}>
                <div className="gw-dashboard-widget-heading">
                  <h2>{widget.title}</h2>
                  {widget.route && (widget.route.startsWith('http')
                    ? <a className="gw-inline-link" href={widget.route} target="_blank" rel="noopener noreferrer">이동하기 <span aria-hidden="true">↗</span></a>
                    : <Link className="gw-inline-link" to={widget.route}>이동하기</Link>)}
                  <button type="button" className="gw-widget-collapse" aria-expanded={!isCollapsed} onClick={() => toggleCollapse(widget.id)}>
                    {isCollapsed ? '펼치기' : '접기'}
                  </button>
                </div>
                {!isCollapsed && (
                  <>
                    {widget.description && <p>{widget.description}</p>}
                    {Array.isArray(widget.configuration?.items) && widget.configuration.items.length > 0 && <ul className="gw-widget-posts">{widget.configuration.items.map((item) => <li key={item.id}><Link to={`/boards/${item.board_slug}/posts/${item.id}`}><strong>{item.title}</strong><span>{item.board_name}</span></Link></li>)}</ul>}
                    {widget.widget_type === 'button_box' && widget.configuration?.button_box_id && (
                      buttonBoxes[widget.configuration.button_box_id] === undefined
                        ? <p className="gw-empty-state" role="status">불러오는 중…</p>
                        : buttonBoxes[widget.configuration.button_box_id] === null
                          ? <p className="gw-empty-state">버튼 박스를 불러오지 못했습니다.</p>
                          : <ButtonBoxGrid box={buttonBoxes[widget.configuration.button_box_id].box} items={buttonBoxes[widget.configuration.button_box_id].items} />
                    )}
                  </>
                )}
              </section>
            );
          })}
        </div>
      )}
      {!loading && restorableWidgets.length > 0 && <section className="gw-hidden-widgets" aria-labelledby="hidden-widgets-title"><h2 id="hidden-widgets-title">숨긴 위젯</h2>{restorableWidgets.map((widget) => <button type="button" key={widget.id} onClick={() => restore(widget)}>{widget.title} 복원</button>)}</section>}
    </article>
  );
}
