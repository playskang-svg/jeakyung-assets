// 페이지 항목 하나를 화면에 그린다. 항목은 두 부류다.
//   가리키는 것 : board / embed  — 이 페이지 안에서 열린다
//                 page / external — 새 탭으로 나가므로 여기서는 그리지 않는다
//   담고 있는 것: html / richtext / buttons
import BoardDocumentRenderer from './editor/BoardDocumentRenderer.jsx';
import EmbeddedSite from './EmbeddedSite.jsx';
import BoardPage from '../pages/internal/BoardPage.jsx';
import { sanitizePopupHtml } from '../../shared/popup/popupHtml.js';

// 이 페이지 안에서 내용을 갈아 끼울 수 있는 항목. 나머지는 새 탭 링크로만 쓴다.
export const INLINE_TYPES = ['board', 'embed', 'html', 'richtext', 'buttons'];
export const isInlineItem = (item) => INLINE_TYPES.includes(item.item_type);

function ButtonList({ buttons }) {
  if (!buttons || buttons.length === 0) {
    return <p className="gw-empty-state">등록된 바로가기가 없습니다.</p>;
  }
  return (
    <ul className="gw-page-shortcuts">
      {buttons.map((button, index) => (
        <li key={`${button.url}-${index}`}>
          <a href={button.url} target="_blank" rel="noopener noreferrer">
            <strong>{button.label}</strong>
            {button.description && <span>{button.description}</span>}
            <i aria-hidden="true">↗</i>
          </a>
        </li>
      ))}
    </ul>
  );
}

export default function PageSection({ item }) {
  if (item.item_type === 'board') {
    return item.board_slug
      ? <BoardPage key={item.id} boardSlug={item.board_slug} embedded />
      : <p className="gw-empty-state">연결된 게시판을 찾을 수 없습니다.</p>;
  }

  if (item.item_type === 'embed') {
    return item.url
      ? <EmbeddedSite key={item.id} url={item.url} title={item.label} />
      : <p className="gw-empty-state">주소가 비어 있습니다.</p>;
  }

  if (item.item_type === 'html') {
    const html = item.content?.html ?? '';
    if (!html.trim()) return <p className="gw-empty-state">작성된 내용이 없습니다.</p>;
    // 관리자가 쓴 HTML도 그대로 넣지 않는다. 팝업 문서와 같은 허용 목록을 통과시킨다.
    return <div className="gw-page-document" dangerouslySetInnerHTML={{ __html: sanitizePopupHtml(html) }} />;
  }

  if (item.item_type === 'richtext') {
    const document = item.content?.document;
    if (!document || document.type !== 'doc') return <p className="gw-empty-state">작성된 내용이 없습니다.</p>;
    return <div className="gw-page-document"><BoardDocumentRenderer documentValue={document} attachments={[]} /></div>;
  }

  if (item.item_type === 'buttons') {
    return <ButtonList buttons={item.content?.buttons} />;
  }

  return <p className="gw-empty-state">표시할 수 없는 항목입니다.</p>;
}
