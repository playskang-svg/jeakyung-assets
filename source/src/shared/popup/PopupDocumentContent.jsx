import { useMemo } from 'react';

import { sanitizePopupHtml } from './popupHtml.js';

// styleScope 를 주면 글쓴이가 적은 <style> 을 그 선택자 안으로 가둬 살린다.
// 주지 않으면 <style> 은 버려진다(팝업처럼 좁은 자리의 기본값).
export default function PopupDocumentContent({ html, className = 'site-popup-document', styleScope = '' }) {
  const sanitizedHtml = useMemo(() => sanitizePopupHtml(html, { styleScope }), [html, styleScope]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
