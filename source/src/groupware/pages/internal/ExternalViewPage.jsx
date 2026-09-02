import { Navigate, useParams } from 'react-router-dom';

import EmbeddedSite from '../../components/EmbeddedSite.jsx';
import { GROUPWARE_NAVIGATION } from '../../config/navigation.js';

// 바깥 주소를 새 탭이 아니라 그룹웨어 화면 안에서 연다. 상단 메뉴와 경로 줄이
// 그대로 남아 있어야 하던 일로 돌아갈 수 있다.
//
// 주소를 이 화면의 경로에 실어 보내지는 않는다. 그렇게 하면 누구나 주소만
// 바꿔 임의의 사이트를 우리 화면 안에 띄울 수 있다. 대신 navigation.js 에
// 적어 둔 항목의 key 로만 찾는다.
export default function ExternalViewPage() {
  const { viewKey } = useParams();
  const item = GROUPWARE_NAVIGATION.find((entry) => entry.key === viewKey && entry.href);
  if (!item) return <Navigate to="/dashboard" replace />;

  return (
    <article className="gw-page gw-external-view" aria-labelledby="external-view-title">
      <header className="gw-external-view-head">
        <h1 id="external-view-title">{item.label}</h1>
        <a href={item.href} target="_blank" rel="noopener noreferrer">새 탭에서 열기 ↗</a>
      </header>
      <EmbeddedSite url={item.href} title={item.label} />
    </article>
  );
}
