import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyDashboardWidgets, setDashboardPreference } from '../../services/dashboardService.js';
import { BOARD_CATALOG_CHANGED_EVENT, getVisibleBoards } from '../../services/boardService.js';
import { getMyLinkPages } from '../../services/linkPageService.js';
import { getButtonBox } from '../../services/buttonBoxService.js';
import ProfileCard from '../../components/profile/ProfileCard.jsx';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { shortcutsOf } from '../../config/navigation.js';

const PREPARING = new Set(['approval_status', 'today_schedule', 'week_schedule']);

// 바로가기 줄. 내부 경로는 Link, 바깥 주소는 새 탭으로 연다.
function ShortcutRow({ kind, label }) {
  const items = shortcutsOf(kind);
  if (items.length === 0) return null;
  return (
    <nav className={`gw-shortcut-row gw-shortcut-row--${kind}`} aria-label={label}>
      {items.map((item) => (item.external
        ? <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer">{item.label}<span aria-hidden="true">↗</span></a>
        : <Link key={item.key} to={item.path}>{item.label}</Link>))}
    </nav>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [boards, setBoards] = useState([]);
  const [linkPages, setLinkPages] = useState([]);
  const [buttonBoxes, setButtonBoxes] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    // 게시판 목록은 사이드바에만 있어서 모바일(드로어가 닫힌 상태)에서는 보이지
    // 않았다. 대시보드에도 같이 실어 어느 화면 크기에서든 바로 들어갈 수 있게 한다.
    // 링크 페이지는 마이그레이션이 아직 없는 환경도 있으므로 실패해도 조용히 넘어간다.
    const [widgetResult, boardResult, linkPageResult] = await Promise.allSettled([getMyDashboardWidgets(), getVisibleBoards(), getMyLinkPages()]);
    if (widgetResult.status === 'fulfilled') setWidgets(widgetResult.value);
    else setError('대시보드 구성을 불러오지 못했습니다.');
    if (boardResult.status === 'fulfilled') setBoards(boardResult.value);
    if (linkPageResult.status === 'fulfilled') setLinkPages(linkPageResult.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, [auth.activeRole]);

  // 관리자가 게시판을 만들거나 지우면 박스도 따라 바뀌어야 한다. 예전에는
  // 사이드바가 이 신호를 듣고 있었는데, 사이드바를 없앤 지금은 여기가
  // 이동 경로라서 여기서 듣는다.
  useEffect(() => {
    const reload = () => getVisibleBoards().then(setBoards).catch(() => {});
    window.addEventListener(BOARD_CATALOG_CHANGED_EVENT, reload);
    return () => window.removeEventListener(BOARD_CATALOG_CHANGED_EVENT, reload);
  }, []);

  // 버튼 박스 위젯은 대시보드 RPC가 id만 돌려주므로(다른 위젯처럼 서버가 내용을
  // 미리 합쳐 주지 않는다), 화면에 나온 뒤 필요한 것만 따로 불러온다.
  useEffect(() => {
    const ids = [...new Set(widgets
      .filter((widget) => widget.widget_type === 'button_box' && widget.configuration?.button_box_id)
      .map((widget) => widget.configuration.button_box_id))];
    ids.filter((id) => !(id in buttonBoxes)).forEach((id) => {
      getButtonBox(id).then((result) => setButtonBoxes((current) => ({ ...current, [id]: result })))
        .catch(() => setButtonBoxes((current) => ({ ...current, [id]: null })));
    });
  }, [widgets]);

  // 이전에 숨겨 둔 위젯은 계속 되돌릴 수 있게 남긴다. 새로 숨기는 기능은 없앴고
  // 대신 화면에서만 접는다.
  const restore = async (widget) => {
    await setDashboardPreference(widget.id, { customOrder: widget.display_order, isHidden: false });
    setWidgets((current) => current.map((item) => item.id === widget.id ? { ...item, is_hidden: false } : item));
  };

  // 접기는 화면에서만 유지한다. 숨김(서버 저장)과 달리 항목을 목록에 남겨 두고
  // 내용만 감추므로, 되돌리려고 별도의 "숨긴 위젯" 영역을 찾아갈 필요가 없다.
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
      <ShortcutRow kind="module" label="그룹웨어 기능 바로가기" />
      {/* 게시판 바로가기는 내 프로필 바로 아래에 둔다. 접속 직후 가장 먼저 쓰는
          동선이면서, 누구의 화면인지 확인한 다음 이동하는 순서가 자연스럽다. */}
      {/* 사이드바를 없앤 뒤로 여기가 유일한 이동 경로다. 그래서 목록이 아니라
          박스로 둔다. 이름만 늘어놓는 것보다 설명 한 줄과 큼직한 버튼이 있어야
          처음 들어온 사람도 어디로 가야 할지 안다. 번호는 순서를 눈에 익히기
          위한 것으로, 관리자가 정한 정렬을 그대로 따른다. */}
      {!loading && (boards.length > 0 || linkPages.length > 0) && (
        <section className="gw-board-card-section" aria-labelledby="dashboard-boards-title">
          <h2 id="dashboard-boards-title" className="gw-visually-hidden">게시판</h2>
          <div className="gw-board-card-grid">
            {boards.map((board, index) => (
              <article className="gw-board-card" key={board.id}>
                <p className="gw-board-card-no" aria-hidden="true">{index + 1}</p>
                <h3>{board.name}</h3>
                {board.description && <p className="gw-board-card-desc">{board.description}</p>}
                <Link className="gw-board-card-go" to={`/boards/${board.slug}`}>바로가기<span className="gw-visually-hidden"> — {board.name}</span></Link>
              </article>
            ))}
            {linkPages.map((page) => (
              <article className="gw-board-card" key={page.id}>
                <p className="gw-board-card-no" aria-hidden="true">*</p>
                <h3>{page.title}</h3>
                <p className="gw-board-card-desc">{page.item_count}개 항목</p>
                <Link className="gw-board-card-go" to={`/pages/${page.slug}`}>바로가기<span className="gw-visually-hidden"> — {page.title}</span></Link>
              </article>
            ))}
          </div>
        </section>
      )}
      {error && <div className="gw-notice gw-notice--warning" role="alert">{error}</div>}
      {loading ? <p className="gw-empty-state" role="status">위젯을 불러오고 있습니다.</p> : (
        <div className="gw-dashboard-grid">
          {widgets.filter((widget) => !widget.is_hidden).map((widget) => {
            const isCollapsed = collapsed.has(widget.id);
            return (
              <section className={`gw-dashboard-widget gw-dashboard-widget--${widget.size}`} key={widget.id}>
                {/* 제목 줄 하나에 제목·이동하기·접기까지 모두 둔다. */}
                <div className="gw-dashboard-widget-heading">
                  <h2>{widget.title}</h2>
                  {widget.route && (widget.route.startsWith('http')
                    ? <a className="gw-inline-link" href={widget.route} target="_blank" rel="noopener noreferrer">이동하기 <span aria-hidden="true">↗</span></a>
                    : <Link className="gw-inline-link" to={widget.route}>이동하기</Link>)}
                  {PREPARING.has(widget.widget_type) && <span className="gw-preparing-label">준비 중</span>}
                  <button
                    type="button"
                    className="gw-widget-collapse"
                    aria-expanded={!isCollapsed}
                    onClick={() => toggleCollapse(widget.id)}
                  >
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
          {widgets.every((widget) => widget.is_hidden) && <p className="gw-empty-state">표시 중인 위젯이 없습니다. 관리자에게 문의해 주세요.</p>}
        </div>
      )}
      <ShortcutRow kind="tool" label="외부 서비스 바로가기" />
      {!loading && widgets.some((widget) => widget.is_hidden) && <section className="gw-hidden-widgets" aria-labelledby="hidden-widgets-title"><h2 id="hidden-widgets-title">숨긴 위젯</h2>{widgets.filter((widget) => widget.is_hidden).map((widget) => <button type="button" key={widget.id} onClick={() => restore(widget)}>{widget.title} 복원</button>)}</section>}
    </article>
  );
}
