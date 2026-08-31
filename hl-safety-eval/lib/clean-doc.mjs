// Cleans a Google Docs "export?format=html" payload into a lean HTML fragment
// suitable for embedding in our own page template.
//
// Principles:
//  - Never touch the TEXT content. Only structural/style attributes are
//    trimmed so the page renders using our fonts instead of Google's.
//  - background-color / color are always preserved verbatim: the source
//    documents already use the site's #dce6f1 / #fff2cc / #ffe0e0 palette
//    for emphasis / "needs-check" / "top-priority" cells, so keeping them
//    is exactly how "원본 문서 색 체계 유지" is satisfied.

const STYLE_PROP_DENYLIST = new Set([
  'font-family',
  'line-height',
  'height',
  'width',
  'max-width',
  'min-height',
  'min-width',
  '-webkit-text-fill-color',
  'orphans',
  'widows',
  'font-kerning',
  'list-style-type',
]);

function decodeEntities(html) {
  return html.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function filterStyleAttr(styleValue) {
  const kept = [];
  for (const decl of styleValue.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (STYLE_PROP_DENYLIST.has(prop)) continue;
    kept.push(`${prop}:${value}`);
  }
  return kept.join(';');
}

function cleanStyleAttributes(html) {
  return html.replace(/\sstyle="([^"]*)"/g, (m, styleValue) => {
    const filtered = filterStyleAttr(styleValue);
    return filtered ? ` style="${filtered}"` : '';
  });
}

function extractBody(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return match ? match[1] : html;
}

function stripAttrs(html) {
  return html
    // drop every class="..." — Google's classes only carry list-bullet
    // hacks we intentionally don't ship; browser default bullets take over.
    .replace(/\sclass="[^"]*"/g, '')
    .replace(/\sid="[^"]*"/g, '');
}

function removeEmptyParagraphs(html) {
  // A Google "blank line" paragraph: a <p> whose only content is
  // whitespace, &nbsp;, and/or empty <span> tags.
  return html.replace(/<p\b[^>]*>((?:\s|&nbsp;|<span[^>]*>\s*<\/span>)*)<\/p>/gi, '');
}

function wrapTables(html) {
  return html.replace(/<table\b([^>]*)>/gi, '<div class="table-scroll"><table class="doc-table"$1>')
    .replace(/<\/table>/gi, '</table></div>');
}

// Paths are relative to docs/{no}.html (one level below the site root).
const SIGNERS = [
  { key: 'ceo', names: ['염달성', '염 달 성'], stamp: '../assets/sign-ceo.png', hand: '../assets/sign-ceo-hand.png', alt: '대표이사 염달성' },
  { key: 'kim', names: ['김수호', '김 수 호'], stamp: '../assets/sign-kim.png', hand: '../assets/sign-kim.png', alt: '김수호' },
  { key: 'park', names: ['박천희', '박 천 희'], stamp: '../assets/sign-park.png', hand: '../assets/sign-park.png', alt: '박천희' },
];

// Inserts a signature image right after every "(인)" / "(서명)" marker whose
// immediately preceding text names one of the three signers. Anonymous /
// blank template lines (e.g. a training-log form's "__________(서명)") are
// left untouched on purpose — there is no signer to attribute them to.
function insertSignatures(html) {
  const markerRe = /\(인\)|\(서명\)/g;
  let result = '';
  let lastIndex = 0;
  let m;
  while ((m = markerRe.exec(html))) {
    const marker = m[0];
    const windowStart = Math.max(0, m.index - 60);
    const preceding = html.slice(windowStart, m.index).replace(/<[^>]+>/g, '');
    const signer = SIGNERS.find((s) => s.names.some((n) => preceding.includes(n)));
    result += html.slice(lastIndex, m.index + marker.length);
    if (signer) {
      const src = marker === '(인)' ? signer.stamp : signer.hand;
      result += `<span class="sig-wrap"><img class="sig-img" src="${src}" alt="${signer.alt} ${marker === '(인)' ? '인' : '서명'}" height="48"><span class="sig-draft-badge" title="본 웹 게시본은 초안이며, 제출본은 실제 날인본으로 대체됩니다">초안</span></span>`;
    }
    lastIndex = m.index + marker.length;
  }
  result += html.slice(lastIndex);
  return result;
}

/**
 * @param {string} rawHtml - full HTML document as returned by Google's export endpoint
 * @param {boolean} withSignatures - whether this doc is on the signature-insertion list
 */
export function cleanGoogleDocHtml(rawHtml, withSignatures) {
  let html = decodeEntities(rawHtml);
  html = extractBody(html);
  html = cleanStyleAttributes(html);
  html = stripAttrs(html);
  html = removeEmptyParagraphs(html);
  html = wrapTables(html);
  if (withSignatures) html = insertSignatures(html);
  return html.trim();
}
