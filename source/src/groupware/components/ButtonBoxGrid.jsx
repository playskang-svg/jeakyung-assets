import { Link } from 'react-router-dom';

// 재사용 버튼 박스 렌더러. 링크 페이지 본문과 대시보드 위젯 양쪽에서 그대로 쓴다.
// 항목은 제목(label)·설명(선택)·주소(url)만 가지며, 주소가 '/'로 시작하면 앱
// 안에서 이동(Link)하고 그 외에는 외부 주소로 보아 새 탭으로 연다.
function ButtonBoxLink({ item, children, className }) {
  if (item.url.startsWith('/')) {
    return <Link className={className} to={item.url}>{children}</Link>;
  }
  return <a className={className} href={item.url} target="_blank" rel="noopener noreferrer">{children}</a>;
}

export default function ButtonBoxGrid({ box, items }) {
  if (!items || items.length === 0) {
    return <p className="gw-empty-state">등록된 버튼이 없습니다. 관리자 화면에서 추가해 주세요.</p>;
  }

  const style = box?.style || 'cards';

  if (style === 'list') {
    return (
      <ul className="gw-buttonbox gw-buttonbox--list">
        {items.map((item) => (
          <li key={item.id}>
            <ButtonBoxLink item={item} className="gw-buttonbox-list-row">
              <span>
                <strong>{item.label}</strong>
                {item.description && <small>{item.description}</small>}
              </span>
              <i aria-hidden="true">→</i>
            </ButtonBoxLink>
          </li>
        ))}
      </ul>
    );
  }

  if (style === 'tiles') {
    return (
      <ul className="gw-buttonbox gw-buttonbox--tiles">
        {items.map((item) => (
          <li key={item.id}>
            <ButtonBoxLink item={item} className="gw-buttonbox-tile">
              <strong>{item.label}</strong>
              {item.description && <span>{item.description}</span>}
            </ButtonBoxLink>
          </li>
        ))}
      </ul>
    );
  }

  // 기본값 'cards': 번호 배지 + 제목 + 알약형 바로가기 버튼.
  return (
    <ul className="gw-buttonbox gw-buttonbox--cards">
      {items.map((item, index) => (
        <li key={item.id} className="gw-buttonbox-card">
          <span className="gw-buttonbox-card-number" aria-hidden="true">{index + 1}</span>
          <strong>{item.label}</strong>
          {item.description && <p>{item.description}</p>}
          <ButtonBoxLink item={item} className="gw-buttonbox-card-cta">바로가기</ButtonBoxLink>
        </li>
      ))}
    </ul>
  );
}
