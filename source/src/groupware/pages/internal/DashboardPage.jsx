import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyDashboardWidgets, setDashboardPreference } from '../../services/dashboardService.js';
import { BOARD_CATALOG_CHANGED_EVENT, getBoardPosts, getRecentBoardPosts, getVisibleBoards } from '../../services/boardService.js';
import { getMyLinkPages } from '../../services/linkPageService.js';
import { getButtonBox } from '../../services/buttonBoxService.js';
import ProfileCard from '../../components/profile/ProfileCard.jsx';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const PREPARING = new Set(['approval_status', 'today_schedule', 'week_schedule']);
// 홈 화면 위쪽이 직접 그리는 것들. 위젯으로 또 그리면 같은 목록이 한 화면에
// 두 번 나온다. 위젯 자체를 지우지는 않는다. 관리자 설정에는 그대로 남는다.
const COVERED_BY_HOME = new Set(['notices', 'recent_posts', 'mail_link']);
const NOTICE_SLUG = 'company-notice';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const shortDate = (value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')}`;
};

// 다섯 줄짜리 글 목록. 공지사항과 최신 게시글이 같은 모양을 쓴다.
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
function NowBar() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return (
    <div className="gw-nowbar">
      <p className="gw-nowbar-date">{now.getFullYear()}년 {now.getMonth() + 1}월 {now.getDate()}일 {WEEKDAYS[now.getDay()]}요일</p>
      <p className="gw-nowbar-time"><time dateTime={now.toISOString()}>{time}</time></p>
      <Link className="gw-nowbar-button" to="/calendar">일정</Link>
    </div>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [boards, setBoards] = useState([]);
  const [linkPages, setLinkPages] = useState([]);
  const [notices, setNotices] = useState([]);
  const [recent, setRecent] = useState([]);
  const [buttonBoxes, setButtonBoxes] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    // 위젯 외에는 없어도 화면이 서야 하므로 각각 따로 받는다. 공지 게시판이
    // 없거나 권한이 없으면 그 줄만 비고 나머지는 그대로 나온다.
    const [widgetResult, boardResult, linkPageResult, noticeResult, recentResult] = await Promise.allSettled([
      getMyDashboardWidgets(), getVisibleBoards(), getMyLinkPages(),
      getBoardPosts(NOTICE_SLUG, { page: 1 }), getRecentBoardPosts(5),
    ]);
    if (widgetResult.status === 'fulfilled') setWidgets(widgetResult.value);
    else setError('대시보드 구성을 불러오지 못했습니다.');
    if (boardResult.status === 'fulfilled') setBoards(boardResult.value);
    if (linkPageResult.status === 'fulfilled') setLinkPages(linkPageResult.value);
    if (noticeResult.status === 'fulfilled') {
      setNotices((noticeResult.value.items ?? []).slice(0, 5).map((item) => ({ ...item, board_slug: NOTICE_SLUG })));
    }
    if (recentResult.status === 'fulfilled') setRecent(recentResult.value);
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

  return (
    <article className="gw-page" aria-labelledby="page-title">
      <header className="gw-page-header"><div><h1 id="page-title">대시보드</h1></div></header>
      <ProfileCard />
      <NowBar />

      {/* 글 목록과 오른쪽 도구를 한 줄로 둔다. 좁은 화면에서는 아래로 쌓인다. */}
      <div className="gw-home-split">
        <div className="gw-panel gw-panel--feeds">
          <PostLines title="공지사항" posts={notices} to={`/boards/${NOTICE_SLUG}`} emptyText="등록된 공지가 없습니다." />
          <PostLines title="최신 게시글" posts={recent} to="/boards" emptyText="등록된 글이 없습니다." showBoard />
        </div>
        <aside className="gw-home-aside" aria-label="바로 쓰는 도구">
          <a className="gw-mail-button" href="https://mail.jeakyung.com" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
            사내메일
            <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </div>

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
          {/* 전자결재·조직도·파일은 게시판이 아니라 기능이라 한 줄 아래로 뺀다. */}
          <div className="gw-launch-modules">
            <Link to="/approval">전자결재</Link>
            <Link to="/organization">조직도</Link>
            <Link to="/files">파일</Link>
          </div>
        </section>
      )}

      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {loading ? <p className="gw-empty-state" role="status">위젯을 불러오고 있습니다.</p> : (
        <div className="gw-dashboard-grid">
          {widgets.filter((widget) => !widget.is_hidden && !COVERED_BY_HOME.has(widget.widget_type)).map((widget) => {
            const isCollapsed = collapsed.has(widget.id);
            return (
              <section className={`gw-dashboard-widget gw-dashboard-widget--${widget.size}`} key={widget.id}>
                <div className="gw-dashboard-widget-heading">
                  <h2>{widget.title}</h2>
                  {widget.route && (widget.route.startsWith('http')
                    ? <a className="gw-inline-link" href={widget.route} target="_blank" rel="noopener noreferrer">이동하기 <span aria-hidden="true">↗</span></a>
                    : <Link className="gw-inline-link" to={widget.route}>이동하기</Link>)}
                  {PREPARING.has(widget.widget_type) && <span className="gw-preparing-label">준비 중</span>}
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
      {!loading && widgets.some((widget) => widget.is_hidden && !COVERED_BY_HOME.has(widget.widget_type)) && <section className="gw-hidden-widgets" aria-labelledby="hidden-widgets-title"><h2 id="hidden-widgets-title">숨긴 위젯</h2>{widgets.filter((widget) => widget.is_hidden && !COVERED_BY_HOME.has(widget.widget_type)).map((widget) => <button type="button" key={widget.id} onClick={() => restore(widget)}>{widget.title} 복원</button>)}</section>}
    </article>
  );
}
