// 버튼 박스 디자인 '폴더형'. 게시판 탭 위(BoardPage)와 버튼 박스 자리
// (ButtonBoxGrid) 양쪽이 같은 모양을 쓴다.
//
// 주소가 '#'인 버튼은 자리만 먼저 잡아 둔 것이다. 눌러도 갈 곳이 없으므로
// 누를 수 없는 모양으로 그린다 — 눌렀는데 아무 일도 없으면 고장으로 보인다.
export const isPlaceholderLink = (item) => {
  const url = (item.url ?? '').trim();
  return url === '' || url === '#';
};

function FolderIcon() {
  return (
    <svg className="gw-folder-icon" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.6c.6 0 1.1.2 1.5.6L11.8 7h7A2.2 2.2 0 0 1 21 9.2V10H3z" fill="currentColor" opacity=".7" />
      <path d="M3 10h18v7.8a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z" fill="currentColor" />
    </svg>
  );
}

// canOpen(item) 이 참이면 onOpen 으로 이 화면 안(팝업)에서 연다. 나머지는 새 탭.
export default function FolderButtons({ items, canOpen = null, onOpen = null }) {
  return (
    <ul className="gw-folder-buttons">
      {items.map((item) => {
        const body = (
          <>
            <FolderIcon />
            <span className="gw-folder-button-text">
              <strong>{item.label}</strong>
              {item.description && <small>{item.description}</small>}
            </span>
          </>
        );
        let control;
        if (isPlaceholderLink(item)) {
          control = (
            <span className="gw-folder-button is-placeholder" title="아직 연결하지 않은 버튼입니다. 관리자 화면의 버튼 박스에서 주소를 넣으면 열립니다.">
              {body}
            </span>
          );
        } else if (canOpen?.(item) && onOpen) {
          control = <button type="button" className="gw-folder-button" onClick={() => onOpen(item)}>{body}</button>;
        } else {
          control = (
            <a className="gw-folder-button" href={item.url} target="_blank" rel="noopener noreferrer">
              {body}
              <i aria-hidden="true">↗</i>
              <span className="gw-visually-hidden"> (새 탭에서 열림)</span>
            </a>
          );
        }
        return <li key={item.id ?? item.label}>{control}</li>;
      })}
    </ul>
  );
}
