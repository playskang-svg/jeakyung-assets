import { useMemo } from 'react';

import { sanitizePopupHtml } from './popupHtml.js';

export default function PopupDocumentContent({ html }) {
  const sanitizedHtml = useMemo(() => sanitizePopupHtml(html), [html]);
  return <div className="site-popup-document" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}

