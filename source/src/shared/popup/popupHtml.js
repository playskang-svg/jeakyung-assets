const ALLOWED_TAGS = new Set([
  'A', 'B', 'BLOCKQUOTE', 'BR', 'CODE', 'DIV', 'EM', 'FIGCAPTION', 'FIGURE', 'H1', 'H2',
  'H3', 'H4', 'H5', 'H6', 'HR', 'I', 'IMG', 'LI', 'OL', 'P', 'PRE', 'S', 'SECTION', 'SMALL',
  'SPAN', 'STRONG', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'U', 'UL',
]);

const BLOCKED_TAGS = new Set(['BASE', 'BUTTON', 'EMBED', 'FORM', 'IFRAME', 'INPUT', 'LINK', 'META', 'OBJECT', 'SCRIPT']);

// 글을 짜는 데 필요한 속성만 연다. 목록을 두는 이유는, 새 CSS 속성이 생겼을 때
// 자동으로 허용되지 않게 하기 위해서다.
const SAFE_STYLE_PROPERTIES = new Set([
  // 색·글자
  'background', 'background-color', 'color', 'font-family', 'font-size', 'font-style',
  'font-weight', 'letter-spacing', 'line-height', 'opacity', 'text-align', 'text-decoration',
  'text-transform', 'white-space', 'word-break',
  // 상자
  'border', 'border-bottom', 'border-color', 'border-left', 'border-radius', 'border-right',
  'border-style', 'border-top', 'border-width', 'box-shadow', 'height', 'margin',
  'margin-bottom', 'margin-left', 'margin-right', 'margin-top', 'max-height', 'max-width',
  'min-height', 'min-width', 'padding', 'padding-bottom', 'padding-left', 'padding-right',
  'padding-top', 'width',
  // 배치
  'align-items', 'aspect-ratio', 'columns', 'display', 'flex', 'flex-basis', 'flex-direction',
  'flex-grow', 'flex-shrink', 'flex-wrap', 'gap', 'grid-column', 'grid-row',
  'grid-template-columns', 'grid-template-rows', 'justify-content', 'justify-items',
  'list-style', 'object-fit', 'order', 'overflow', 'overflow-x', 'overflow-y', 'row-gap',
  'column-gap', 'vertical-align',
]);

// 값에 이런 것이 있으면 그 선언을 통째로 버린다.
//   url(...)         바깥으로 요청을 보내 읽은 사람을 추적할 수 있다
//   position:fixed   글 영역을 벗어나 화면을 덮을 수 있다
//   @import          바깥 스타일시트를 끌어온다
const UNSAFE_STYLE_VALUE = /url\s*\(|expression\s*\(|javascript:|behavior\s*:|@import|position\s*:/i;

function sanitizeDeclarations(cssText) {
  return cssText.split(';').map((declaration) => declaration.trim()).filter(Boolean).map((declaration) => {
    const separator = declaration.indexOf(':');
    if (separator < 1) return '';
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const styleValue = declaration.slice(separator + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property)) return '';
    if (UNSAFE_STYLE_VALUE.test(`${property}:${styleValue}`)) return '';
    return `${property}: ${styleValue}`;
  }).filter(Boolean).join('; ');
}

// 글쓴이가 <style> 로 적은 규칙을 글 영역 안으로 가둔다. 선택자마다 scope 를 앞에
// 붙이므로 .site-header 같은 바깥 요소는 건드릴 수 없고, html/body/:root 로 문서
// 전체를 잡으려는 선택자는 글 영역 자신으로 바뀐다.
function scopeSelector(selector, scope) {
  return selector.split(',').map((part) => {
    const one = part.trim();
    if (!one || one.startsWith('@')) return '';
    if (/^(html|body|:root)\b/i.test(one)) return scope;
    return `${scope} ${one}`;
  }).filter(Boolean).join(', ');
}

function sanitizeStyleSheet(cssText, scope) {
  // 중괄호 한 겹만 읽는다. @media 같은 중첩 규칙은 여기서 다루지 않고 버린다.
  const rules = [];
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match = pattern.exec(cssText);
  while (match) {
    const selector = scopeSelector(match[1], scope);
    const body = sanitizeDeclarations(match[2]);
    if (selector && body) rules.push(`${selector} { ${body} }`);
    match = pattern.exec(cssText);
  }
  return rules.join('\n');
}

// options.styleScope 를 주면 <style> 을 그 선택자 안으로 가둬 남긴다.
// 주지 않으면 <style> 은 지금까지처럼 통째로 버린다(팝업 등 좁은 자리).
export function sanitizePopupHtml(value, options = {}) {
  if (!value || typeof DOMParser === 'undefined') return '';
  const scope = typeof options.styleScope === 'string' ? options.styleScope.trim() : '';
  const documentValue = new DOMParser().parseFromString(`<body>${String(value)}</body>`, 'text/html');

  for (const element of [...documentValue.body.querySelectorAll('*')]) {
    if (element.tagName === 'STYLE') {
      const scoped = scope ? sanitizeStyleSheet(element.textContent ?? '', scope) : '';
      if (scoped) element.textContent = scoped;
      else element.remove();
      continue;
    }
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
      const allowed = name === 'style' || name === 'class'
        || (element.tagName === 'A' && ['href', 'target', 'rel'].includes(name))
        || (element.tagName === 'IMG' && ['src', 'alt', 'width', 'height', 'loading'].includes(name))
        || (['TD', 'TH'].includes(element.tagName) && ['colspan', 'rowspan'].includes(name));
      if (!allowed || name.startsWith('on')) element.removeAttribute(attribute.name);
    }

    if (element.hasAttribute('style')) {
      const safeStyle = sanitizeDeclarations(element.getAttribute('style') ?? '');
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
