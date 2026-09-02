import { useState } from 'react';

import ButtonBoxTargetDialog from './ButtonBoxTargetDialog.jsx';

// 재사용 버튼 박스 렌더러. 링크 페이지 본문과 대시보드 위젯 양쪽에서 그대로 쓴다.
// 카드에는 썸네일과 설명만 보여 주고, 누르면 대상이 팝업으로 열린다.
// 게시판은 팝업 안에서 목록 ↔ 본문이 바뀌고, 팝업에 담을 수 없는 외부 주소는
// 새 탭으로 연다.
const canOpenInDialog = (item) => (item.link_type === 'board' && Boolean(item.board_slug))
  || (item.link_type === 'embed' && Boolean(item.url));

function Thumbnail({ item }) {
  if (item.thumbnail_url) {
    return <img src={item.thumbnail_url} alt="" loading="lazy" decoding="async" />;
  }
  return <span className="gw-buttonbox-thumb-fallback" aria-hidden="true">{item.label.slice(0, 2)}</span>;
}

export default function ButtonBoxGrid({ box, items }) {
  const [openItem, setOpenItem] = useState(null);

  // 아직 채우지 않은 버튼 줄은 아무것도 그리지 않는다. 빈 안내 상자가
  // 탭마다 자리를 차지하면 볼 것이 없는데 화면만 길어진다.
  if (!items || items.length === 0) return null;

  const style = box?.style || 'cards';

  // 팝업에서 열 수 있으면 버튼, 아니면 새 탭 링크로 그린다.
  const Trigger = ({ item, className, children }) => (canOpenInDialog(item)
    ? <button type="button" className={className} onClick={() => setOpenItem(item)}>{children}</button>
    : <a className={className} href={item.url} target="_blank" rel="noopener noreferrer">{children}</a>);

  const dialog = openItem
    ? <ButtonBoxTargetDialog item={openItem} onClose={() => setOpenItem(null)} />
    : null;

  if (style === 'list') {
    return (
      <>
        <ul className="gw-buttonbox gw-buttonbox--list">
          {items.map((item) => (
            <li key={item.id}>
              <Trigger item={item} className="gw-buttonbox-list-row">
                <span>
                  <strong>{item.label}</strong>
                  {item.description && <small>{item.description}</small>}
                </span>
                <i aria-hidden="true">→</i>
              </Trigger>
            </li>
          ))}
        </ul>
        {dialog}
      </>
    );
  }

  if (style === 'tiles') {
    return (
      <>
        <ul className="gw-buttonbox gw-buttonbox--tiles">
          {items.map((item) => (
            <li key={item.id}>
              <Trigger item={item} className="gw-buttonbox-tile">
                <strong>{item.label}</strong>
                {item.description && <span>{item.description}</span>}
              </Trigger>
            </li>
          ))}
        </ul>
        {dialog}
      </>
    );
  }

  // 기본값 'cards': 썸네일 + 제목 + 설명.
  return (
    <>
      <ul className="gw-buttonbox gw-buttonbox--cards">
        {items.map((item) => (
          <li key={item.id}>
            <Trigger item={item} className="gw-buttonbox-card">
              <span className="gw-buttonbox-thumb"><Thumbnail item={item} /></span>
              <span className="gw-buttonbox-card-body">
                <strong>{item.label}</strong>
                {item.description && <span className="gw-buttonbox-card-desc">{item.description}</span>}
              </span>
            </Trigger>
          </li>
        ))}
      </ul>
      {dialog}
    </>
  );
}
