const DRAFT_NOTICE = '본 웹 게시본은 초안이며, 제출본은 실제 날인본으로 대체됩니다.';
const SITE_TITLE = '유한회사 재경물류 안전보건 제출본';
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

function head(title, description) {
  return `<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${esc(description)}">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<link rel="stylesheet" href="/assets/style.css">`;
}

function siteFooter() {
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="disclaimer">⚠️ ${DRAFT_NOTICE}</div>
    <p>${esc(SITE_TITLE)} 웹 게시본 ${VERSION} · 작성/게시일 ${BUILD_DATE} · 문의 유한회사 재경물류</p>
  </div>
</footer>`;
}

function draftBanner() {
  return `<div class="draft-banner">📝 초안 · ${DRAFT_NOTICE}</div>`;
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
    <a class="btn primary" href="/docs/${encodeURIComponent(doc.no)}.html">본문 보기</a>
    <a class="btn" href="${wordOrExcelUrl}">${docKindLabel(doc)} 받기</a>
    <a class="btn" href="${pdfUrl}">PDF 받기</a>
  </div>
</article>`;
}

function scoreRow({ name, current, max, deduct }) {
  const pct = Math.round((current / max) * 100);
  return `<div class="score-row${deduct ? ' deduct' : ''}">
  <span class="name">${esc(name)}</span>
  <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
  <span class="num">${current}/${max}</span>
</div>`;
}

const SCORE_ROWS = [
  { name: '1. 안전보건경영방침', current: 3, max: 5 },
  { name: '2. 안전보건목표', current: 5, max: 10, deduct: true },
  { name: '3. 역할과 책임', current: 3, max: 5 },
  { name: '4. 위험성평가', current: 5, max: 20, deduct: true },
  { name: '5. 안전관리(TBM)', current: 0, max: 10, deduct: true },
  { name: '5. 안전관리(예방활동)', current: 10, max: 10 },
  { name: '6. 개선조치', current: 5, max: 5 },
  { name: '7. 교육관리', current: 10, max: 10 },
  { name: '8. 건강검진', current: 5, max: 5 },
  { name: '9. 비상대응체계', current: 10, max: 10 },
  { name: '10. 산업재해현황', current: 5, max: 5 },
  { name: '11. 산업재해관리', current: 5, max: 5 },
];

export function renderIndexPage(documents) {
  const master = documents.find((d) => d.no === '00');
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
${draftBanner()}
<header class="site-header">
  <div class="wrap">
    <span class="eyebrow">적격수급사 안전보건 평가 · 제출본 웹 게시</span>
    <h1>${esc(SITE_TITLE)}</h1>
    <p class="subtitle">HL홀딩스(주) 동탄냉장 물류센터 · 2026년 적격수급사 안전보건 평가</p>
  </div>
</header>

<main class="wrap">

  <section class="block">
    <h2><span class="num">1</span>사업장 개요</h2>
    <div class="overview-grid">
      <div class="overview-card"><div class="label">대표이사</div><div class="value">염달성</div></div>
      <div class="overview-card"><div class="label">원청사</div><div class="value">HL홀딩스(주)</div></div>
      <div class="overview-card"><div class="label">현장</div><div class="value">동탄냉장 물류센터</div></div>
      <div class="overview-card"><div class="label">상시근로자</div><div class="value">10명 미만</div></div>
      <div class="overview-card"><div class="label">근무형태</div><div class="value">오전조·오후조 2교대</div></div>
      <div class="overview-card"><div class="label">안전보건 총괄 (오전조 관리감독자)</div><div class="value">김수호</div></div>
      <div class="overview-card"><div class="label">오후조 관리감독자</div><div class="value">박천희</div></div>
    </div>
  </section>

  <section class="block">
    <h2><span class="num">2</span>관리범위 구분표</h2>
    <div class="scope-table">
      <div class="scope-col ours">
        <h3><span class="tag">재경물류 수행범위</span></h3>
        <ul>
          <li>입출고</li>
          <li>지게차 운반</li>
          <li>핸드파렛트 취급</li>
          <li>랙 적재</li>
          <li>피킹 / 포장</li>
          <li>상하차</li>
        </ul>
      </div>
      <div class="scope-col theirs">
        <h3><span class="tag">HL홀딩스(주) 소관</span></h3>
        <ul>
          <li>냉동기 · 냉매</li>
          <li>기계실</li>
          <li>적재 랙 (구조물)</li>
          <li>도크</li>
          <li>소방</li>
          <li>건물</li>
        </ul>
      </div>
      <div class="scope-note">※ 재경물류는 원청사 소관 설비에 대해 일상 육안점검을 수행하고, 이상 발견 시 즉시 원청사에 통보합니다. 이 구분은 32개 문서 전반의 책임 범위를 가르는 핵심 기준입니다.</div>
    </div>
  </section>

  <section class="block">
    <h2><span class="num">3</span>배점 현황</h2>
    <div class="score-summary">
      <div class="score-total">
        <div class="big">66<small>/100점</small></div>
        <div class="cap">2026.08 기준 · 12개 평가항목 · 증빙 완비 시 100점 달성 가능</div>
      </div>
      <div class="score-total">
        <div class="big" style="color:#8a1f1f">-34<small>점</small></div>
        <div class="cap">실점 원인 = 문서 부재가 아닌 실행 증빙(서명·사진·일지) 부재</div>
      </div>
      <div class="score-total">
        <div class="big">0<small>/5점 (가점)</small></div>
        <div class="cap">ISO45001·KOSHA-MS 인증 및 위험성평가 우수사업장 인정 (추진 중)</div>
      </div>
    </div>
    <div class="score-bars">
      ${SCORE_ROWS.map(scoreRow).join('\n      ')}
    </div>
    <div class="deduct-callout">
      <h4>🔻 실점 회복 우선순위 (현재 −34점의 직접 원인)</h4>
      <ul>
        <li><b>위험성평가 −15점</b> — 참여 근로자 서명부 확보(+15점 일부), 개선 전·후 사진 확보(+15점 일부) <a href="/docs/4-2%EB%B3%84%EC%A7%80.html">4-2 별지</a></li>
        <li><b>TBM −10점</b> — 오전조·오후조 최근 3개월분 실제 작성 + RA-No. 기재 + 참석 서명 <a href="/docs/5-1.html">5-1</a></li>
        <li><b>안전보건목표 −5점</b> — 안전보건활동계획서 월별 실적란 기입 <a href="/docs/2-1.html">2-1</a></li>
        <li><b>안전보건경영방침 −2점</b> — 대표이사 날인 및 게시 사진 <a href="/docs/1-1.html">1-1</a></li>
        <li><b>역할과 책임 −2점</b> — 김수호·박천희 관리감독자 교육 이수 증빙 <a href="/docs/3-3.html">3-3</a></li>
      </ul>
    </div>
    <div class="deduct-callout" style="background:var(--check-bg);border-color:#e8d38a;margin-top:12px;">
      <h4 style="color:#6b4e00">🟡 전체 문서 공통 확인 필요 항목 (재경물류 실제 값 확인 필요 — 임의 기입 금지)</h4>
      <ul>
        <li>김수호·박천희 직위 확정</li>
        <li>오전조/오후조 근무시간 및 조별 인원 확정</li>
        <li>지게차·핸드파렛트 대수 및 소유/임차 구분</li>
        <li>사내·원청 비상연락처 확정</li>
        <li>사업자등록번호 기입</li>
        <li>근로자대표 선출 및 성명 기입</li>
      </ul>
    </div>
  </section>

  <section class="block">
    <h2><span class="num">4</span>제출서류 (32건)</h2>
    <div class="filter-bar">
      <input type="search" id="doc-search" placeholder="문서명·번호로 검색…">
      <button class="filter-chip active" data-filter="all">전체</button>
      ${CATEGORY_ORDER.map((c) => `<button class="filter-chip" data-filter="${esc(c)}">${esc(c)}</button>`).join('\n      ')}
    </div>
    <div class="doc-category">
      <h3>마스터</h3>
      <div class="doc-grid">${docCard(master)}</div>
    </div>
    ${categorySections}
  </section>

  <section class="block">
    <h2><span class="num">5</span>전체 다운로드</h2>
    <div class="download-all">
      <p style="margin-top:0">32개 문서 전체를 구글 드라이브 폴더에서 한 번에 내려받을 수 있습니다.<br>폴더째 다운로드하면 문서/시트가 워드·엑셀 파일로 자동 변환됩니다.</p>
      <a class="btn primary" href="${GDRIVE_FOLDER}">📁 구글 드라이브 폴더 전체 열기</a>
    </div>
  </section>

</main>
${siteFooter()}
<script src="/assets/main.js"></script>
</body>
</html>`;
}

export function renderDocPage(doc, contentHtml, prevDoc, nextDoc) {
  const wordOrExcelUrl = exportUrl(doc, docKindFormat(doc));
  const pdfUrl = exportUrl(doc, 'pdf');
  const prevLink = prevDoc
    ? `<a class="side prev" href="/docs/${encodeURIComponent(prevDoc.no)}.html"><span class="dir">← 이전 문서</span>${esc(prevDoc.no)}. ${esc(prevDoc.title)}</a>`
    : '<span class="side"></span>';
  const nextLink = nextDoc
    ? `<a class="side next" href="/docs/${encodeURIComponent(nextDoc.no)}.html" style="text-align:right"><span class="dir">다음 문서 →</span>${esc(nextDoc.no)}. ${esc(nextDoc.title)}</a>`
    : '<span class="side"></span>';

  return `<!doctype html>
<html lang="ko">
<head>
${head(`${doc.no}. ${doc.title} - ${SITE_TITLE}`, doc.summary)}
</head>
<body>
<div class="topbar">
  <div class="wrap">
    <a class="back" href="/index.html">← 목록으로</a>
    <div class="title"><span class="no">${esc(doc.no)} · ${esc(doc.category)}</span><span class="name">${esc(doc.title)}</span></div>
    <div class="actions">
      <a class="btn" href="${wordOrExcelUrl}">${docKindLabel(doc)} 받기</a>
      <a class="btn" href="${pdfUrl}">PDF 받기</a>
    </div>
  </div>
</div>
<div class="doc-page-body">
  <div class="wrap">
    <div class="disclaimer" style="background:var(--check-bg);border:1px solid #e8d38a;border-radius:8px;padding:8px 14px;font-size:12.5px;color:#6b4e00;margin-bottom:14px;">⚠️ ${DRAFT_NOTICE}</div>
    <article class="doc-content">
${contentHtml}
    </article>
    <div class="doc-nav">${prevLink}${nextLink}</div>
  </div>
</div>
${siteFooter()}
</body>
</html>`;
}
