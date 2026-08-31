const SITE_TITLE = '적격수급사 안전보건평가';
const SITE_SUBTITLE = '유한회사 재경물류 안전보건관리';
const GDRIVE_FOLDER = 'https://drive.google.com/drive/folders/13REZlblbGLwcJkILouBzgVMxoPOv72tZ';
const BUILD_DATE = '2026-08-31';
const VERSION = 'v1.0';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function exportUrl(doc, format) {
  const kind = doc.type === 'document' ? 'document' : 'spreadsheets';
  return `https://docs.google.com/${kind}/d/${doc.id}/export?format=${format}`;
}

function docKindLabel(doc) {
  return doc.type === 'document' ? '워드' : '엑셀';
}

function docKindFormat(doc) {
  return doc.type === 'document' ? 'docx' : 'xlsx';
}

// base='' from index.html at the site root, base='../' from docs/{no}.html.
// Every internal link in this file is relative for the same reason: the site
// may be served from a domain root (its own Netlify site) or from a subpath
// (e.g. jeakyung.com/hl-safety-eval/) — relative paths work in both.
function head(title, description, base = '') {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(description)}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="${base}assets/style.css">`;
}

// No signature image here on purpose — 염달성's signature is only inserted
// contextually inside the specific documents that actually need it (see
// SIGNATURE_TARGETS in build.mjs + insertSignatures() in clean-doc.mjs), not
// as a blanket mark on every page of the site.
function siteFooter() {
  return `<footer class="site-footer">
  <div class="wrap">
    <p>${esc(SITE_TITLE)} 웹 게시본 ${VERSION} · 작성/게시일 ${BUILD_DATE} · 문의 유한회사 재경물류</p>
  </div>
</footer>`;
}

const CATEGORY_ORDER = ['안전보건관리체계', '실행수준', '비상상황 대응', '재해관리', '가점'];
const CATEGORY_TOTAL = {
  안전보건관리체계: 20,
  실행수준: 60,
  '비상상황 대응': 10,
  재해관리: 10,
  가점: 5,
};

function docCard(doc) {
  const wordOrExcelUrl = exportUrl(doc, docKindFormat(doc));
  const pdfUrl = exportUrl(doc, 'pdf');
  return `<article class="doc-card">
  <span class="no">${esc(doc.no)}</span>
  <h4>${esc(doc.title)}</h4>
  <p class="summary">${esc(doc.summary)}</p>
  <div class="meta-row"><span>${esc(doc.criterion)}</span><span>담당 ${esc(doc.owner)}</span></div>
  <div class="btn-row">
    <a class="btn primary" href="docs/${encodeURIComponent(doc.no)}.html">본문 보기</a>
    <a class="btn" href="${wordOrExcelUrl}">${docKindLabel(doc)} 받기</a>
    <a class="btn" href="${pdfUrl}">PDF 받기</a>
  </div>
</article>`;
}

// Deliberately no numbers here — just done / partial / not-started, so the
// page never states a score, only what's actually finished. Doubles as a
// table of contents: each row links straight to the document(s) filed
// under that evaluation criterion (matched via documents.json's own
// `criterion` field, so it can't drift out of sync with the doc list).
function checklistRow({ name, current, max }, documents) {
  let state = 'done';
  let icon = '✅';
  if (current === 0) { state = 'todo'; icon = '⬜'; }
  else if (current < max) { state = 'partial'; icon = '🔶'; }
  const related = documents.filter((d) => d.criterion === name);
  const links = related
    .map((d) => `<a href="docs/${encodeURIComponent(d.no)}.html">${esc(d.no)}. ${esc(d.title)}</a>`)
    .join('');
  return `<div class="check-row ${state}">
  <span class="check-icon">${icon}</span>
  <span class="check-name">${esc(name)}</span>
  <span class="check-docs">${links}</span>
</div>`;
}

const SCORE_ROWS = [
  { name: '1. 안전보건경영방침', current: 3, max: 5 },
  { name: '2. 안전보건목표', current: 5, max: 10 },
  { name: '3. 역할과 책임', current: 3, max: 5 },
  { name: '4. 위험성평가', current: 5, max: 20 },
  { name: '5. 안전관리(TBM)', current: 0, max: 10 },
  { name: '5. 안전관리(예방활동)', current: 10, max: 10 },
  { name: '6. 개선조치', current: 5, max: 5 },
  { name: '7. 교육관리', current: 10, max: 10 },
  { name: '8. 건강검진', current: 5, max: 5 },
  { name: '9. 비상대응체계', current: 10, max: 10 },
  { name: '10. 산업재해현황', current: 5, max: 5 },
  { name: '11. 산업재해관리', current: 5, max: 5 },
];

export function renderIndexPage(documents) {
  const grouped = new Map();
  for (const cat of CATEGORY_ORDER) grouped.set(cat, []);
  for (const doc of documents) {
    if (doc.no === '00') continue;
    if (!grouped.has(doc.category)) grouped.set(doc.category, []);
    grouped.get(doc.category).push(doc);
  }

  const categorySections = CATEGORY_ORDER.map((cat) => {
    const docs = grouped.get(cat) || [];
    if (docs.length === 0) return '';
    return `<div class="doc-category">
  <h3>${esc(cat)}<span class="cat-score">${CATEGORY_TOTAL[cat]}점</span></h3>
  <div class="doc-grid">${docs.map(docCard).join('\n')}</div>
</div>`;
  }).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
${head(SITE_TITLE, 'HL홀딩스(주) 동탄냉장 물류센터 2026년 적격수급사 안전보건 평가 제출본 웹 게시본')}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <h1>${esc(SITE_TITLE)}</h1>
    <p class="subtitle">${esc(SITE_SUBTITLE)}</p>
  </div>
</header>

<main class="wrap">

  <section class="block">
    <h2><span class="num">1</span>사업장 개요</h2>
    <div class="overview-grid">
      <div class="overview-card"><div class="label">대표이사</div><div class="value">염달성</div></div>
      <div class="overview-card"><div class="label">원청사</div><div class="value">HL홀딩스(주)</div></div>
      <div class="overview-card"><div class="label">현장</div><div class="value">동탄냉장 물류센터</div></div>
      <div class="overview-card"><div class="label">상시근로자</div><div class="value">오전조 4명 · 중간조 2명 · 오후조 4명</div></div>
      <div class="overview-card"><div class="label">근무형태</div><div class="value">오전조·중간조·오후조 교대</div></div>
      <div class="overview-card"><div class="label">안전보건 총괄 (오전조 관리감독자)</div><div class="value">김수호 센터장</div></div>
      <div class="overview-card"><div class="label">오후조 관리감독자</div><div class="value">박천희 과장</div></div>
    </div>
  </section>

  <section class="block">
    <h2><span class="num">2</span>평가항목 체크리스트</h2>
    <div class="checklist">
      ${SCORE_ROWS.map((row) => checklistRow(row, documents)).join('\n      ')}
    </div>
  </section>

  <section class="block">
    <h2><span class="num">3</span>제출서류 (31건)</h2>
    <div class="filter-bar">
      <input type="search" id="doc-search" placeholder="문서명·번호로 검색…">
      <button class="filter-chip active" data-filter="all">전체</button>
      ${CATEGORY_ORDER.map((c) => `<button class="filter-chip" data-filter="${esc(c)}">${esc(c)}</button>`).join('\n      ')}
    </div>
    ${categorySections}
  </section>

  <section class="block">
    <h2><span class="num">4</span>전체 다운로드</h2>
    <div class="download-all">
      <p style="margin-top:0">32개 문서 전체를 구글 드라이브 폴더에서 한 번에 내려받을 수 있습니다.<br>폴더째 다운로드하면 문서/시트가 워드·엑셀 파일로 자동 변환됩니다.</p>
      <a class="btn primary" href="${GDRIVE_FOLDER}">📁 구글 드라이브 폴더 전체 열기</a>
    </div>
  </section>

</main>
${siteFooter()}
<script src="assets/main.js"></script>
</body>
</html>`;
}

export function renderDocPage(doc, contentHtml, prevDoc, nextDoc) {
  const wordOrExcelUrl = exportUrl(doc, docKindFormat(doc));
  const pdfUrl = exportUrl(doc, 'pdf');
  const prevLink = prevDoc
    ? `<a class="side prev" href="${encodeURIComponent(prevDoc.no)}.html"><span class="dir">← 이전 문서</span>${esc(prevDoc.no)}. ${esc(prevDoc.title)}</a>`
    : '<span class="side"></span>';
  const nextLink = nextDoc
    ? `<a class="side next" href="${encodeURIComponent(nextDoc.no)}.html" style="text-align:right"><span class="dir">다음 문서 →</span>${esc(nextDoc.no)}. ${esc(nextDoc.title)}</a>`
    : '<span class="side"></span>';

  return `<!doctype html>
<html lang="ko">
<head>
${head(`${doc.no}. ${doc.title} - ${SITE_TITLE}`, doc.summary, '../')}
</head>
<body>
<div class="topbar">
  <div class="wrap">
    <a class="back" href="../index.html">← 목록으로</a>
    <div class="title"><span class="no">${esc(doc.no)} · ${esc(doc.category)}</span><span class="name">${esc(doc.title)}</span></div>
    <div class="actions">
      <a class="btn" href="${wordOrExcelUrl}">${docKindLabel(doc)} 받기</a>
      <a class="btn" href="${pdfUrl}">PDF 받기</a>
    </div>
  </div>
</div>
<div class="doc-page-body">
  <div class="wrap">
    <article class="doc-content">
${contentHtml}
    </article>
    <div class="doc-nav">${prevLink}${nextLink}</div>
  </div>
</div>
${siteFooter('../')}
</body>
</html>`;
}
