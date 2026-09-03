import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { getMyDashboardWidgets, setDashboardPreference } from '../../services/dashboardService.js';
import { BOARD_CATALOG_CHANGED_EVENT, getAlbumHighlights, getAttachmentViewUrl, getBoardPosts, getRecentBoardPosts, getVisibleBoards } from '../../services/boardService.js';
import { getMyLinkPages } from '../../services/linkPageService.js';
import { getButtonBox } from '../../services/buttonBoxService.js';
import ProfileCard from '../../components/profile/ProfileCard.jsx';
import ButtonBoxGrid from '../../components/ButtonBoxGrid.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getQuickLinks } from '../../services/quickLinkService.js';
import { youTubeThumbnail } from '../../components/editor/YouTubeEmbed.js';

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
const ALBUM_SLUG = 'photo-album';
const GALLERY_TILES = 8;

// 앨범이 아직 비어 있을 때 자리에 세워 둘 그림. 사진을 한 장도 올리지 않은
// 채로 빈 상자만 두면 이 기능이 있는 줄도 모르고 지나친다.
//
// 파일이 아니라 그려서 만든다. 올려 둔 사진이 아니므로 저장 공간을 쓰지
// 않고, 화면 크기가 어떻든 흐려지지 않는다. 앨범에 사진이 한 장이라도
// 올라오면 이 자리는 그 사진들로 바뀐다.
const SAMPLE_TILES = [
  { key: 'box', label: '입고 검수', from: '#2450f5', to: '#5b8bff', art: (
    <><rect x="18" y="26" width="44" height="32" rx="3" /><path d="M18 36h44M40 26v32" /></>
  ) },
  { key: 'truck', label: '배송 차량', from: '#0f766e', to: '#2dd4bf', art: (
    <><rect x="10" y="30" width="34" height="22" rx="3" /><path d="M44 38h11l7 8v6H44z" /><circle cx="24" cy="56" r="4" /><circle cx="54" cy="56" r="4" /></>
  ) },
  { key: 'warehouse', label: '물류센터', from: '#b45309', to: '#fbbf24', art: (
    <><path d="M12 34 40 20l28 14v26H12z" /><rect x="30" y="42" width="20" height="18" /></>
  ) },
  { key: 'pallet', label: '팔레트 적재', from: '#6b21a8', to: '#c084fc', art: (
    <><rect x="16" y="24" width="20" height="18" rx="2" /><rect x="44" y="24" width="20" height="18" rx="2" /><path d="M12 50h56M20 50v8M60 50v8" /></>
  ) },
  { key: 'route', label: '배차 경로', from: '#be123c', to: '#fb7185', art: (
    <><path d="M16 56c10-2 12-16 24-18s14 8 24 4" /><circle cx="16" cy="56" r="4" /><circle cx="64" cy="42" r="4" /></>
  ) },
  { key: 'scan', label: '송장 스캔', from: '#155e75', to: '#38bdf8', art: (
    <><path d="M16 26h-4v-4M64 26h4v-4M16 54h-4v4M64 54h4v4" /><path d="M24 32v16M32 32v16M40 32v16M50 32v16M58 32v16" /></>
  ) },
  { key: 'team', label: '현장 점검', from: '#1e3a8a', to: '#60a5fa', art: (
    <><circle cx="30" cy="32" r="7" /><circle cx="52" cy="34" r="6" /><path d="M16 56c2-9 8-13 14-13s12 4 14 13M46 56c1-7 5-10 10-10s9 3 10 10" /></>
  ) },
  { key: 'award', label: '사내 행사', from: '#a16207', to: '#facc15', art: (
    <><circle cx="40" cy="32" r="12" /><path d="m32 42-4 18 12-6 12 6-4-18" /></>
  ) },
];

function SampleTile({ tile }) {
  const id = `gw-sample-${tile.key}`;
  return (
    <svg viewBox="0 0 80 80" role="img" aria-label={`${tile.label} 샘플 그림`} preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={tile.from} /><stop offset="1" stopColor={tile.to} />
      </linearGradient></defs>
      <rect width="80" height="80" fill={`url(#${id})`} />
      <g fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{tile.art}</g>
    </svg>
  );
}

// 앨범 타일 하나. 사진 글과 영상 글이 같은 모양을 쓰되, 영상에는 재생 표시를
// 얹어 누르기 전에 무엇인지 알 수 있게 한다.
function GalleryCard({ item }) {
  const inner = (
    <>
      <span className="gw-gallery-shot">
        {item.thumbnail
          ? <img src={item.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" />
          : <SampleTile tile={item.tile} />}
        {item.isVideo && (
          <span className="gw-gallery-play" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 7.5v9l7.5-4.5z" fill="currentColor" /></svg>
          </span>
        )}
      </span>
      <strong>{item.label}{item.isVideo && <span className="gw-visually-hidden"> (영상)</span>}</strong>
      {item.caption && <span className="gw-gallery-caption">{item.caption}</span>}
    </>
  );
  return item.to
    ? <Link to={item.to} title={item.label}>{inner}</Link>
    : <span className="gw-gallery-figure" title={item.label}>{inner}</span>;
}

// 사내앨범을 가로로 넘겨 보는 띠.
//
// 저절로 흐르게 해 봤지만 손으로 넘기는 편이 낫다. 흐르는 것은 누르려는
// 순간에도 움직여서 엉뚱한 글이 열리고, 보고 싶은 자리로 되돌아갈 수도 없다.
// 양옆 삼각형으로 넘기고, 손가락으로 쓸어도 된다.
function GalleryStrip({ items, isSample }) {
  const trackRef = useRef(null);
  // 양 끝에 닿으면 그쪽 단추를 죽인다. 눌러도 안 움직이는 단추가 살아 있으면
  // 고장 난 것으로 보인다.
  const [edge, setEdge] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setEdge({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  // 타일이 늘거나 창 크기가 바뀌면 다시 잰다.
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [items, measure]);

  // 한 번에 보이는 만큼씩 넘긴다. 한 장씩이면 답답하고, 화면 폭마다 보이는
  // 장수가 달라 고정값을 쓸 수 없다. 60px 은 넘긴 뒤에도 직전 것이 살짝
  // 남아 이어진다는 느낌을 주려고 뺀 값이다.
  const nudge = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(el.clientWidth - 60, 160), behavior: 'smooth' });
  };

  return (
    <div className="gw-gallery-strip">
      <button
        type="button" className="gw-gallery-nav gw-gallery-nav--prev"
        aria-label="이전 사진 보기" disabled={edge.start} onClick={() => nudge(-1)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M16 4.5v15L6 12z" fill="currentColor" /></svg>
      </button>

      <ul className="gw-gallery-track" ref={trackRef} onScroll={measure}>
        {items.map((item) => <li key={item.key}><GalleryCard item={item} /></li>)}
      </ul>

      <button
        type="button" className="gw-gallery-nav gw-gallery-nav--next"
        aria-label="다음 사진 보기" disabled={edge.end} onClick={() => nudge(1)}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 4.5v15l10-7.5z" fill="currentColor" /></svg>
      </button>

      {isSample && <p className="gw-gallery-note">아직 올라온 사진이 없어 예시 그림을 두었습니다. 사내앨범에 사진이나 유튜브 영상을 올리면 이 자리가 바뀝니다.</p>}
    </div>
  );
}

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
  const [album, setAlbum] = useState([]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    // 위젯 외에는 없어도 화면이 서야 하므로 각각 따로 받는다. 공지 게시판이
    // 없거나 권한이 없으면 그 줄만 비고 나머지는 그대로 나온다.
    const [widgetResult, boardResult, linkPageResult, noticeResult, recentResult, quickResult, albumResult] = await Promise.allSettled([
      getMyDashboardWidgets(), getVisibleBoards(), getMyLinkPages(),
      getBoardPosts(NOTICE_SLUG, { page: 1 }), getRecentBoardPosts(FEED_ROWS),
      getQuickLinks(), getAlbumHighlights(ALBUM_SLUG, GALLERY_TILES),
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
    // 앨범은 대표 이미지 주소를 한 장씩 따로 받아야 해서 뒤에서 채운다.
    // 권한이 없거나 게시판이 없으면 빈 배열로 두고 샘플 그림이 대신 선다.
    if (albumResult.status === 'fulfilled') {
      // 사진 글은 대표 이미지를, 영상 글은 유튜브 미리보기를 건다. 둘 다 없는
      // 글은 띠에 걸 그림이 없으므로 건너뛴다.
      const picks = (albumResult.value ?? []).filter((item) => item.cover_attachment_id || item.youtube_id);
      const shots = await Promise.allSettled(picks.map(async (item) => ({
        key: item.id,
        label: item.title,
        caption: shortDate(item.created_at),
        to: `/boards/${ALBUM_SLUG}/posts/${item.id}`,
        isVideo: Boolean(item.youtube_id),
        thumbnail: item.cover_attachment_id
          ? await getAttachmentViewUrl(item.cover_attachment_id)
          : youTubeThumbnail(item.youtube_id),
      })));
      setAlbum(shots.filter((shot) => shot.status === 'fulfilled').map((shot) => shot.value));
    }
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
      {/* 사내앨범. 홈 맨 아래에 가로로 한 줄 둔다. 사진은 훑어보는 것이라
          세로로 쌓아 자리를 먹기보다 옆으로 미는 편이 맞다. */}
      <section className="gw-panel gw-gallery-panel" aria-labelledby="dashboard-gallery-title">
        <div className="gw-panel-heading">
          <h2 id="dashboard-gallery-title">사내앨범</h2>
          <Link to={`/boards/${ALBUM_SLUG}`}>전체 보기</Link>
        </div>
        <GalleryStrip
          items={album.length > 0 ? album : SAMPLE_TILES.map((tile) => ({ key: tile.key, label: tile.label, tile }))}
          isSample={album.length === 0}
        />
      </section>

      {!loading && restorableWidgets.length > 0 && <section className="gw-hidden-widgets" aria-labelledby="hidden-widgets-title"><h2 id="hidden-widgets-title">숨긴 위젯</h2>{restorableWidgets.map((widget) => <button type="button" key={widget.id} onClick={() => restore(widget)}>{widget.title} 복원</button>)}</section>}
    </article>
  );
}
