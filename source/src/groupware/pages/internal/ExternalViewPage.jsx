import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import EmbeddedSite from '../../components/EmbeddedSite.jsx';
import { GROUPWARE_NAVIGATION } from '../../config/navigation.js';
import { getQuickLinks } from '../../services/quickLinkService.js';

// 바깥 주소를 새 탭이 아니라 그룹웨어 화면 안에서 연다. 상단 메뉴와 경로 줄이
// 그대로 남아 있어야 하던 일로 돌아갈 수 있다.
//
// 주소를 이 화면의 경로에 싣지는 않는다. 그렇게 하면 누구나 주소만 바꿔 임의의
// 사이트를 우리 화면 안에 띄울 수 있다. 대신 이름표만 받는다.
//
//   /view/link/<id>  관리자가 등록한 '페이지 이동' 버튼 (quick_links)
//   /view/<key>      navigation.js 에 적힌 항목 (옛 주소 — 그대로 둔다)
function ViewFrame({ label, url }) {
  return (
    <article className="gw-page gw-external-view" aria-labelledby="external-view-title">
      <header className="gw-external-view-head">
        <h1 id="external-view-title">{label}</h1>
        <a href={url} target="_blank" rel="noopener noreferrer">새 탭에서 열기 ↗</a>
      </header>
      <EmbeddedSite url={url} title={label} />
    </article>
  );
}

export function QuickLinkViewPage() {
  const { linkId } = useParams();
  const [link, setLink] = useState(undefined);

  useEffect(() => {
    let active = true;
    setLink(undefined);
    // 목록 전체를 받아 그중에서 고른다. 한 건만 받는 함수를 따로 두는 것보다
    // 낫다 — 이 목록은 홈 화면이 이미 받는 것이라 캐시가 겹친다.
    getQuickLinks()
      .then((rows) => { if (active) setLink(rows.find((row) => row.id === linkId) ?? null); })
      .catch(() => { if (active) setLink(null); });
    return () => { active = false; };
  }, [linkId]);

  if (link === undefined) return <p className="gw-empty-state" role="status">화면을 준비하고 있습니다.</p>;
  if (!link) return <Navigate to="/dashboard" replace />;
  return <ViewFrame label={link.label} url={link.url} />;
}

export default function ExternalViewPage() {
  const { viewKey } = useParams();
  // newTab 항목은 액자를 거부하는 곳이라 여기서 열면 빈 화면만 남는다.
  const item = GROUPWARE_NAVIGATION.find((entry) => entry.key === viewKey && entry.href && !entry.newTab);
  if (!item) return <Navigate to="/dashboard" replace />;
  return <ViewFrame label={item.label} url={item.href} />;
}
