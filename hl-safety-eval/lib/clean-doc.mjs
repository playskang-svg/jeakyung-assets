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

// Removes the <h?>...</h?> immediately containing `textPattern`, plus the
// <table>...</table> that immediately follows it — nothing else. Finding the
// *nearest* preceding heading open-tag by scanning forward and stopping once
// we pass the target text (rather than a single greedy/lazy regex spanning
// from the first heading in the whole doc) is the whole point here: an
// unanchored `<h[1-6][^>]*>[\s\S]*?text[\s\S]*?<\/h[1-6]>` matches from the
// *first* heading in the document, through every heading in between, which
// silently deletes the entire body. Bails out (removes nothing) unless a
// table directly follows the heading, so a shape we didn't expect is left
// alone rather than guessed at.
function removeHeadingAndFollowingTable(html, textPattern) {
  const textMatch = html.match(textPattern);
  if (!textMatch) return html;
  const textIdx = html.indexOf(textMatch[0]);

  const headingOpenRe = /<h[1-6][^>]*>/gi;
  let openIdx = -1;
  let m;
  while ((m = headingOpenRe.exec(html))) {
    if (m.index > textIdx) break;
    openIdx = m.index;
  }
  if (openIdx === -1) return html;

  const closeMatch = html.slice(textIdx).match(/<\/h[1-6]>/i);
  if (!closeMatch) return html;
  const closeIdx = textIdx + closeMatch.index + closeMatch[0].length;

  const tableMatch = html.slice(closeIdx).match(/^\s*<table\b[^>]*>[\s\S]*?<\/table>/i);
  if (!tableMatch) return html;
  const removeEnd = closeIdx + tableMatch[0].length;

  return html.slice(0, openIdx) + html.slice(removeEnd);
}

// Same nearest-preceding-tag idea for a <p>...</p> containing `textPattern`.
function removeParagraphContaining(html, textPattern) {
  const textMatch = html.match(textPattern);
  if (!textMatch) return html;
  const textIdx = html.indexOf(textMatch[0]);

  const pOpenRe = /<p\b[^>]*>/gi;
  let openIdx = -1;
  let m;
  while ((m = pOpenRe.exec(html))) {
    if (m.index > textIdx) break;
    openIdx = m.index;
  }
  if (openIdx === -1) return html;

  const closeMatch = html.slice(textIdx).match(/<\/p>/i);
  if (!closeMatch) return html;
  const removeEnd = textIdx + closeMatch.index + closeMatch[0].length;

  return html.slice(0, openIdx) + html.slice(removeEnd);
}

// Drops the "제출 전 확인사항" pre-submission checklist (heading + the table
// right after it) and any "※ 본/이 문서는 ..." attribution footnote.
// NOTE ON FIDELITY: everything else in this file only touches structure —
// this is the one place that removes real text the source document has.
// The Word/PDF/CSV downloads (linked straight to Google's export URLs) still
// carry it, so the web page and the downloaded file no longer match for
// these specific paragraphs. Requested explicitly; flagging it here so a
// future edit doesn't "fix" it back by accident.
function removeSubmissionChecklist(html) {
  for (let i = 0; i < 5; i++) {
    const next = removeHeadingAndFollowingTable(html, /제출\s*전\s*확인\s*사항/);
    if (next === html) break;
    html = next;
  }
  for (let i = 0; i < 5; i++) {
    const next = removeParagraphContaining(html, /※[^<]*?(?:본|이)\s*(?:문서|서류)는/);
    if (next === html) break;
    html = next;
  }
  return html;
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
      result += `<span class="sig-wrap"><img class="sig-img" src="${src}" alt="${signer.alt} ${marker === '(인)' ? '인' : '서명'}" height="48"></span>`;
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
  html = removeSubmissionChecklist(html);
  html = wrapTables(html);
  if (withSignatures) html = insertSignatures(html);
  return html.trim();
}
