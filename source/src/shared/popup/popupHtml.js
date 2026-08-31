const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'H1', 'H2', 'H3', 'H4', 'HR',
  'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD',
  'TH', 'THEAD', 'TR', 'U', 'UL',
]);

const BLOCKED_TAGS = new Set(['BASE', 'BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'META', 'OBJECT', 'SCRIPT', 'STYLE']);
const SAFE_STYLE_PROPERTIES = new Set([
  'background-color', 'border', 'border-radius', 'color', 'font-size', 'font-weight',
  'line-height', 'margin', 'margin-bottom', 'margin-left', 'margin-right', 'margin-top',
  'padding', 'padding-bottom', 'padding-left', 'padding-right', 'padding-top', 'text-align',
]);

function sanitizeStyle(value) {
  return value.split(';').map((declaration) => declaration.trim()).filter(Boolean).map((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator < 1) return '';
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const styleValue = declaration.slice(separator + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property) || /url\s*\(|expression\s*\(|javascript:|position\s*:/i.test(styleValue)) return '';
    return `${property}: ${styleValue}`;
  }).filter(Boolean).join('; ');
}

export function sanitizePopupHtml(value) {
  if (!value || typeof DOMParser === 'undefined') return '';
  const documentValue = new DOMParser().parseFromString(`<body>${String(value)}</body>`, 'text/html');

  for (const element of [...documentValue.body.querySelectorAll('*')]) {
    if (BLOCKED_TAGS.has(element.tagName)) {
      element.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(element.tagName)) {
      element.replaceWith(...element.childNodes);
      continue;
    }

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const allowed = name === 'style'
        || (element.tagName === 'A' && ['href', 'target', 'rel'].includes(name))
        || (element.tagName === 'IMG' && ['src', 'alt', 'width', 'height', 'loading'].includes(name))
        || (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan'].includes(name));
      if (!allowed || name.startsWith('on')) element.removeAttribute(attribute.name);
    }

    if (element.hasAttribute('style')) {
      const safeStyle = sanitizeStyle(element.getAttribute('style') ?? '');
      if (safeStyle) element.setAttribute('style', safeStyle);
      else element.removeAttribute('style');
    }

    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? '';
      // https 절대주소나 사이트 내부 경로만 남긴다. data:·javascript: 등은 이미지를 통째로 버린다.
      if (!/^(https:\/\/|\/)/i.test(src)) {
        element.remove();
        continue;
      }
      element.setAttribute('loading', 'lazy');
    }

    if (element.tagName === 'A') {
      const href = element.getAttribute('href') ?? '';
      if (!/^(https?:|mailto:|tel:|#|\/)/i.test(href)) element.removeAttribute('href');
      if (element.getAttribute('target') === '_blank') element.setAttribute('rel', 'noopener noreferrer');
      else element.removeAttribute('target');
    }
  }

  return documentValue.body.innerHTML;
}

