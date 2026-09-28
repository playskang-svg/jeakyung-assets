// 2026 사업계획서 PPT 생성기. business-plan/index.html 과 같은 내용을 15장 슬라이드로 만든다.
// 사용: (임시 폴더에서) npm i pptxgenjs sharp && node scripts/business-plan/build-pptx.cjs
// 문구를 고치면 웹(index.html)과 이 파일을 함께 고친다.
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const OUT = process.argv[2] || IMG + 'jaekyung-business-plan-2026.pptx';
const IMG = require('path').resolve(__dirname, '../../business-plan') + '/';
const C = { navy950:'050A2B', navy900:'071044', blue:'1A46FF', blueSoft:'8EA4FF', ice:'E8EDFF', fresh:'0FB5A4', freshSoft:'DFF7F3', freshText:'0A8A7D', mint:'5FE0D2', ink:'10121A', ink7:'3C404B', ink5:'6A707C', line:'DFE3EB', surf:'EEF1F7', white:'FFFFFF', darkSoft:'B9C3EC', darkCard:'121A45', darkLine:'2A3470' };
const F = 'Malgun Gothic', M = 'Consolas';
// 사진을 슬롯 비율에 맞춰 미리 잘라 넣는다(pptx 의 cover 크롭은 뷰어마다 달라서).
async function crop(name, w, h, darken) {
  let img = sharp(IMG + name).resize(Math.round(w * 200), Math.round(h * 200), { fit: 'cover' });
  if (darken) img = img.modulate({ brightness: darken });
  return 'image/jpeg;base64,' + (await img.jpeg({ quality: 80 }).toBuffer()).toString('base64');
}
(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.author = '재경로지스｜물류'; pres.company = '재경로지스｜물류'; pres.title = '2026 사업계획서';
  const W = 13.33, H = 7.5, X = 0.6;
  let n = 0;
  const T = (s, text, o) => s.addText(text, Object.assign({ isTextBox: true, fontFace: F, margin: 0, color: C.ink, valign: 'top' }, o));
  const card = (s, x, y, w, h, fill, line, transp) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill, transparency: transp || 0 }, line: line ? { color: line, width: 1 } : { type: 'none' } });
  const circ = (s, x, y, d, fill, txt, color) => { s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: 'none' } }); if (txt) T(s, txt, { x, y, w: d, h: d, align: 'center', valign: 'middle', fontFace: M, fontSize: 11, bold: true, color }); };
  function slide(dark, eyebrow, title, bg) {
    n++; const s = pres.addSlide();
    s.background = { color: dark ? C.navy950 : C.white };
    return s;
  }
  function head(s, dark, eyebrow, title) {
    if (eyebrow) T(s, eyebrow, { x: X, y: 0.45, w: 9, h: 0.3, fontFace: M, fontSize: 11, bold: true, color: dark ? C.blueSoft : C.blue, charSpacing: 2 });
    if (title) T(s, title, { x: X, y: 0.78, w: 12.1, h: 0.7, fontSize: 28, bold: true, color: dark ? C.white : C.navy900 });
  }
  function foot(s, dark, extra) {
    T(s, '재경로지스｜물류 · 2026 사업계획서' + (extra ? ' · ' + extra : ''), { x: X, y: 7.02, w: 9, h: 0.25, fontSize: 9, color: dark ? C.darkSoft : C.ink5 });
    T(s, String(n).padStart(2, '0'), { x: W - X - 1, y: 7.02, w: 1, h: 0.25, fontSize: 9, fontFace: M, align: 'right', color: dark ? C.darkSoft : C.ink5 });
  }
  const lead = (s, text, dark) => T(s, text, { x: X, y: 1.5, w: 11.5, h: 0.6, fontSize: 13, color: dark ? C.darkSoft : C.ink7 });
  async function photoBg(s, name, shade) {
    s.addImage({ data: await crop(name, W, H), x: 0, y: 0, w: W, h: H, altText: '' });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: H, fill: { color: C.navy950, transparency: shade }, line: { type: 'none' } });
  }

  // 01 표지
  { const s = slide(true);
    await photoBg(s, 'img/hero.webp', 55);
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 8.2, h: H, fill: { color: C.navy950, transparency: 25 }, line: { type: 'none' } });
    T(s, 'BUSINESS PLAN 2026', { x: X, y: 0.6, w: 6, h: 0.3, fontFace: M, fontSize: 11, bold: true, color: C.blueSoft, charSpacing: 2 });
    T(s, 'COLD-CHAIN 3PL & FRESH LOGISTICS', { x: X, y: 1.8, w: 7, h: 0.3, fontFace: M, fontSize: 12, bold: true, color: C.mint, charSpacing: 1 });
    T(s, [{ text: '식자재 유통물류의', options: { color: C.white, breakLine: true } }, { text: '전담 파트너, 재경', options: { color: C.blueSoft } }], { x: X, y: 2.2, w: 7.4, h: 1.6, fontSize: 42, bold: true, lineSpacingMultiple: 1.1 });
    T(s, 'HL홀딩스와 함께 삼성웰스토리 DC·현대그린푸드 TC를 운영하고, 쿠팡·컬리·B마트 등 온라인 유통과 바르닭·작심닭 B2B 출고까지 — 신선식품의 보관부터 배송까지 한 흐름으로 책임집니다.', { x: X, y: 3.95, w: 6.9, h: 1.0, fontSize: 13, color: 'DCE2F7', lineSpacingMultiple: 1.3 });
    let tx = X; ['HL홀딩스 전담 물류사','삼성웰스토리 DC','현대그린푸드 동탄 TC','-20℃~+15℃ 콜드체인'].forEach(t => { const w = 0.4 + t.length * 0.135; card(s, tx, 5.2, w, 0.36, C.darkCard, C.darkLine); T(s, t, { x: tx, y: 5.2, w, h: 0.36, align: 'center', valign: 'middle', fontSize: 10, color: C.white }); tx += w + 0.12; });
    [['발행','2026. 09'],['발행처','재경로지스｜물류'],['웹','jeakyung.com']].forEach(([a,b],i) => { T(s, a, { x: X + i*2.3, y: 6.3, w: 2.2, h: 0.25, fontSize: 10, color: C.darkSoft }); T(s, b, { x: X + i*2.3, y: 6.55, w: 2.2, h: 0.35, fontSize: 13, bold: true, color: C.white }); });
    s.addNotes('표지 사진: Unsplash(인물 없음). 핵심 메시지 — HL홀딩스 전담 물류사, 식자재 유통물류 전담 파트너.');
  }

  // 02 한눈에
  { const s = slide(true);
    await photoBg(s, 'img/fleet.webp', 22);
    head(s, true, 'AT A GLANCE', '숫자로 보는 재경');
    lead(s, '운송에서 시작해 콜드체인 3PL까지. 현장에서 쌓은 인프라가 곧 경쟁력입니다.', true);
    const k = [['300','여 대','직영 차량\n1톤 ~ 25톤'],['60','여 개','고객사·협력사\n파트너십'],['5','개 권역','수도권 3센터 +\n호남·영남 식자재 센터'],['-20~15','℃','콜드체인 온도대\n24시간 모니터링',true],['365','일','수도권 ↔ 지방\n정기 간선 운행']];
    k.forEach(([a,u,d,acc],i) => { const x = X + i*2.46, y = 2.7; card(s, x, y, 2.3, 2.3, acc ? '0E3A4A' : C.darkCard, acc ? C.mint : C.darkLine, 10);
      T(s, [{ text: a, options: { fontSize: acc ? 28 : 38, bold: true, color: C.white } }, { text: ' ' + u, options: { fontSize: 13, bold: true, color: C.darkSoft } }], { x: x+0.22, y: y+0.3, w: 2.0, h: 0.8, valign: 'bottom' });
      T(s, d, { x: x+0.22, y: y+1.3, w: 1.95, h: 0.8, fontSize: 11, color: C.darkSoft, lineSpacingMultiple: 1.3 }); });
    T(s, '※ 수치는 2025년 4월 회사소개서 기준', { x: X, y: 6.5, w: 6, h: 0.3, fontSize: 10, color: C.darkSoft });
    foot(s, true);
  }

  // 03 회사 개요
  { const s = slide(false); head(s, false, '01 · COMPANY OVERVIEW', '하나의 재경, 이어지는 물류의 힘');
    lead(s, '화물 운수사업으로 출발해 대기업 운송, 중계물류, 3PL·풀필먼트까지 — 식품 유통 분야에 특화된 물류 솔루션을 제공합니다.');
    const rows = [['회사명','재경로지스｜물류 (유한회사 재경로지스 · 유한회사 재경물류 · 재경상운)'],['설립','2013년 (화물자동차 운수사업·운송주선)'],['대표이사','염달성'],['본사','광주광역시 광산구 앰코로 35, 245호 (쌍암동, 폭스존)'],['사업장','유한회사 재경물류 (경기 평택시 비전2로 79) · 여수지사'],['주요 사업','콜드체인 3PL · 신선식품 풀필먼트 · 기업운송 · 보관물류 · 물류컨설팅']];
    s.addTable(rows.map(([a,b]) => [{ text: a, options: { color: C.ink5, fontSize: 12 } }, { text: b, options: { color: C.ink, fontSize: 12 } }]), { x: X, y: 2.3, w: 7.0, colW: [1.3, 5.7], fontFace: F, border: [{ type: 'none' }, { type: 'none' }, { pt: 1, color: C.line }, { type: 'none' }], rowH: 0.62, valign: 'middle', margin: [0, 0.05, 0, 0] });
    s.addImage({ data: await crop('img/overview.webp', 4.9, 2.7), x: 7.95, y: 2.3, w: 4.78, h: 2.7, rounding: false, altText: '대형 물류센터 전경' });
    [['2013','창립',true],['2021~','HL홀딩스 전담'],['2023~','웰스토리·그린푸드'],['3','계열사']].forEach(([a,b,acc],i) => { const x = 7.95 + i*1.215, y = 5.2; card(s, x, y, 1.12, 1.35, acc ? C.navy900 : C.surf);
      T(s, a, { x: x+0.12, y: y+0.2, w: 1.0, h: 0.5, fontSize: 18, bold: true, color: acc ? C.white : C.navy900 });
      T(s, b, { x: x+0.12, y: y+0.75, w: 0.95, h: 0.5, fontSize: 9.5, color: acc ? C.darkSoft : C.ink7 }); });
    foot(s, false);
  }

  // 04 CEO
  { const s = slide(false); head(s, false, '02 · CEO MESSAGE');
    s.addImage({ data: await crop('ceo.webp', 3.8, 4.74), x: X+0.2, y: 1.2, w: 3.8, h: 4.74, altText: '재경로지스｜물류 대표이사 염달성' });
    T(s, [{ text: '현장을 이해하는 물류로', options: { breakLine: true } }, { text: '고객의 성장을 잇겠습니다.' }], { x: 5.3, y: 1.4, w: 7.4, h: 1.3, fontSize: 30, bold: true, color: C.navy900 });
    T(s, [
      { text: '재경은 2013년 창립 이래 대기업 운송과 중계물류, 풀필먼트 현장에서 답을 찾아 왔습니다. 지금은 ' },
      { text: 'HL홀딩스와의 파트너십', options: { bold: true, color: C.navy900 } }, { text: '을 바탕으로 ' },
      { text: '삼성웰스토리·현대그린푸드의 신선 유통물류', options: { bold: true, color: C.navy900 } },
      { text: '와 온라인 유통 브랜드의 출고를 책임지고 있습니다.', options: { breakLine: true } },
      { text: ' ', options: { breakLine: true, fontSize: 6 } },
      { text: '온도와 시간이 품질이 되는 신선물류에서, 약속한 시간에 약속한 상태로 전달하는 것 — 그것이 재경이 지켜 온 기준이며 앞으로도 변하지 않을 원칙입니다.' }
    ], { x: 5.3, y: 3.0, w: 7.3, h: 2.4, fontSize: 14, color: C.ink7, lineSpacingMultiple: 1.35 });
    T(s, [{ text: '염달성  ', options: { fontSize: 18, bold: true, color: C.navy900 } }, { text: '재경로지스｜물류 대표이사', options: { fontSize: 12, color: C.ink5 } }], { x: 5.3, y: 5.7, w: 6, h: 0.45, valign: 'middle' });
    foot(s, false);
  }

  // 05 파트너십
  { const s = slide(true); head(s, true, '03 · STRATEGIC PARTNERSHIP', 'HL홀딩스 파트너십 — 유통물류를 책임지는 협력사');
    const pts = [['2021.07~ HL홀딩스 전담 물류사','홈쇼핑 B2C 콜드체인 3PL을 시작으로 HL홀딩스의 전담 물류 파트너로 자리 잡았습니다.'],['2023.12~ 대형 급식·식자재 유통','HL홀딩스와 삼성웰스토리 DC를 공동 운영하고, 현대그린푸드 동탄 TC를 전담 운영합니다.'],['B2B 온라인·신선 3PL 확장','바르닭·작심닭 등 B2B 온라인 유통과 그 외 다수 신선식품 브랜드의 3PL을 수행합니다.']];
    pts.forEach(([a,b],i) => { const y = 2.0 + i*1.45; circ(s, X, y, 0.5, C.darkCard, String(i+1).padStart(2,'0'), C.blueSoft);
      T(s, a, { x: X+0.7, y, w: 4.4, h: 0.35, fontSize: 14, bold: true, color: C.white });
      T(s, b, { x: X+0.7, y: y+0.4, w: 4.4, h: 0.9, fontSize: 11, color: C.darkSoft, lineSpacingMultiple: 1.3 }); });
    card(s, 6.1, 1.9, 2.6, 1.1, C.darkCard, '3A4480'); T(s, 'HL홀딩스', { x: 6.1, y: 2.05, w: 2.6, h: 0.45, align: 'center', fontSize: 18, bold: true, color: C.white }); T(s, '동탄냉장 · 유통 파트너', { x: 6.1, y: 2.5, w: 2.6, h: 0.3, align: 'center', fontSize: 10, color: C.darkSoft });
    s.addShape(pres.shapes.LINE, { x: 7.4, y: 3.0, w: 0, h: 1.3, line: { color: C.mint, width: 2, dashType: 'dash' } });
    card(s, 6.75, 3.45, 1.3, 0.36, C.fresh); T(s, 'Since 2021', { x: 6.75, y: 3.45, w: 1.3, h: 0.36, align: 'center', valign: 'middle', fontSize: 10, bold: true, color: C.white });
    card(s, 6.1, 4.3, 2.6, 1.25, C.blue); T(s, '재경로지스｜물류', { x: 6.1, y: 4.5, w: 2.6, h: 0.45, align: 'center', fontSize: 17, bold: true, color: C.white }); T(s, '유통물류 전담 협력사', { x: 6.1, y: 4.98, w: 2.6, h: 0.3, align: 'center', fontSize: 10, color: C.ice });
    const tg = [['삼성웰스토리 DC','2023.12 ~ 현재 · HL 공동운영',false],['현대그린푸드 TC','2023.12 ~ 현재 · 동탄 TC 전담',false],['B2B 온라인 유통','바르닭 · 작심닭 등',false],['신선식품 3PL','그 외 다수 신선 브랜드',true]];
    tg.forEach(([a,b,f],i) => { const y = 1.75 + i*1.2; const cyv = y + 0.45;
      s.addShape(pres.shapes.LINE, { x: 8.7, y: Math.min(4.93, cyv), w: 0.9, h: Math.abs(4.93 - cyv), flipV: cyv < 4.93, line: { color: f ? C.mint : C.blueSoft, width: 1.5, endArrowType: 'triangle' } });
      card(s, 9.65, y, 3.05, 0.9, f ? '0E3A4A' : C.darkCard, f ? C.mint : '4A5AA8');
      T(s, a, { x: 9.85, y: y+0.14, w: 2.8, h: 0.35, fontSize: 13, bold: true, color: C.white });
      T(s, b, { x: 9.85, y: y+0.5, w: 2.8, h: 0.3, fontSize: 10, color: C.darkSoft }); });
    foot(s, true);
  }

  // 06 실적
  { const s = slide(false); head(s, false, '04 · TRACK RECORD', '주요 수행 실적 (2023 ~ 현재)');
    lead(s, '대형 급식·식자재 유통사의 신선 물동량과 온라인 브랜드의 B2B 출고를 동시에 운영합니다.');
    const rs = [['img/dc.webp','2023.12 — 현재','삼성웰스토리 DC','B2B/B2C 콜드체인 3PL. HL홀딩스와 DC(배송센터) 공동 운영.',false],['img/tc.webp','2023.12 — 현재','현대그린푸드 TC','동탄 TC(통과형 센터) 전담 운영. 입고 즉시 분류·출고로 리드타임 단축.',false],['img/b2b.webp','B2B 온라인 유통','바르닭 · 작심닭 등','온라인 식품 브랜드의 B2B 유통 출고를 책임 운영. 주문 수신부터 납품까지.',true],['img/fresh.webp','신선식품 3PL','다수 신선 브랜드','냉장·냉동 신선식품의 입고·보관·풀필먼트를 브랜드별 운영 기준에 맞춰 수행.',true]];
    for (let i = 0; i < rs.length; i++) { const [img,p,h,d,f] = rs[i]; const x = X + i*3.07, y = 2.25, w = 2.9;
      card(s, x, y, w, 4.45, C.white, C.line);
      s.addImage({ data: await crop(img, w, 1.8), x: x+0.02, y: y+0.02, w: w-0.04, h: 1.8, altText: h });
      T(s, p, { x: x+0.25, y: y+2.0, w: 2.5, h: 0.25, fontFace: M, fontSize: 10, bold: true, color: f ? C.freshText : C.blue });
      T(s, h, { x: x+0.25, y: y+2.3, w: 2.5, h: 0.4, fontSize: 15, bold: true, color: C.navy900 });
      T(s, d, { x: x+0.25, y: y+2.8, w: 2.45, h: 1.4, fontSize: 11, color: C.ink7, lineSpacingMultiple: 1.3 }); }
    foot(s, false);
  }

  // 07 고객 네트워크
  { const s = slide(false); head(s, false, '05 · CLIENT NETWORK', '국내 대표 유통·식품 기업이 선택한 파트너');
    lead(s, '50~60여 개 고객사·협력사와 파트너십을 이어가며, 고객사는 꾸준히 늘고 있습니다.');
    const g = [['식자재·급식 유통 3PL',['HL홀딩스','삼성웰스토리','현대그린푸드','동원홈푸드','CJ제일제당'],true],['온라인 유통 콜드체인',['쿠팡','컬리','배민 B마트','신세계유통','바르닭','작심닭']],['리테일·풀필먼트',['이마트에브리데이','푸디버스','푸드나무','현대홈쇼핑']],['운송·택배 협력',['LX판토스','CJ대한통운','롯데택배','경동택배','한샘']]];
    g.forEach(([lab,items,core],i) => { const x = X + i*3.07, y = 2.25, w = 2.9; card(s, x, y, w, 4.45, core ? C.navy900 : C.white, core ? null : C.line);
      T(s, lab, { x: x+0.25, y: y+0.25, w: 2.5, h: 0.3, fontSize: 11, bold: true, color: core ? C.blueSoft : C.blue });
      items.forEach((t,j) => { const yy = y + 0.7 + j*0.6; card(s, x+0.2, yy, w-0.4, 0.48, core ? '1D2A72' : C.surf); T(s, t, { x: x+0.38, y: yy, w: w-0.7, h: 0.48, valign: 'middle', fontSize: 13, bold: true, color: core ? C.white : C.navy900 }); }); });
    foot(s, false, '고객사명은 수행 이력 기준');
  }

  // 08 인프라
  { const s = slide(false); head(s, false, '06 · INFRASTRUCTURE', '전국을 잇는 센터·운송 인프라');
    // 권역 다이어그램(지도 대신 거점 도식)
    card(s, X, 1.8, 4.6, 4.9, C.ice);
    const nodes = [[2.9, 2.6, '수도권', '이천 · 안성1·2 · 동탄', C.blue], [1.4, 5.5, '호남 · 광주', '식자재 센터 · 본사', C.fresh], [4.1, 5.3, '영남 · 울주', '식자재 센터', C.fresh]];
    s.addShape(pres.shapes.LINE, { x: 1.55, y: 2.75, w: 1.5, h: 2.9, flipH: true, line: { color: C.blue, width: 1.5, dashType: 'dash' } });
    s.addShape(pres.shapes.LINE, { x: 3.05, y: 2.75, w: 1.2, h: 2.7, line: { color: C.blue, width: 1.5, dashType: 'dash' } });
    nodes.forEach(([x,y,a,b,col]) => { s.addShape(pres.shapes.OVAL, { x: x-0.15, y: y-0.15, w: 0.3, h: 0.3, fill: { color: col }, line: { color: C.white, width: 2 } });
      if (a === '수도권') { T(s, a, { x: x+0.3, y: y-0.2, w: 1.4, h: 0.3, fontSize: 12, bold: true, color: C.navy900 }); T(s, b, { x: x+0.3, y: y+0.08, w: 1.6, h: 0.25, fontSize: 9, color: C.ink7 }); return; }
      T(s, a, { x: x-0.9, y: y+0.2, w: 1.8, h: 0.3, align: 'center', fontSize: 12, bold: true, color: C.navy900 }); T(s, b, { x: x-1.0, y: y+0.48, w: 2.0, h: 0.25, align: 'center', fontSize: 9, color: C.ink7 }); });
    T(s, '365일 간선', { x: 2.3, y: 3.9, w: 1.4, h: 0.3, align: 'center', fontSize: 10, bold: true, color: C.blue });
    const it = [['수도권 3개 센터','이천·안성 1·2센터와 동탄 물류단지를 중심으로 쿠팡·컬리·B마트 등 온라인 유통 콜드체인 운영'],['호남·영남 식자재 센터','광주·울주 식자재 거점으로 지역 급식·식자재 배송 대응'],['직영 차량 300여 대','1톤부터 25톤까지 — 기업물류·특수화물·납품운송·365일 정기 간선']];
    it.forEach(([a,b],i) => { const x = 5.55 + (i%2)*3.65, y = 1.8 + Math.floor(i/2)*2.5; card(s, x, y, 3.5, 2.3, C.surf);
      T(s, a, { x: x+0.25, y: y+0.3, w: 3.0, h: 0.4, fontSize: 16, bold: true, color: C.navy900 }); T(s, b, { x: x+0.25, y: y+0.85, w: 3.0, h: 1.3, fontSize: 11.5, color: C.ink7, lineSpacingMultiple: 1.3 }); });
    s.addImage({ data: await crop('img/fleet.webp', 3.5, 2.3), x: 9.2, y: 4.3, w: 3.5, h: 2.3, altText: '고속도로를 달리는 화물 트럭' });
    foot(s, false, '거점 현황은 2025년 4월 기준');
  }

  // 09 핵심 역량
  { const s = slide(false); head(s, false, '07 · CORE COMPETENCE', '재경의 핵심 역량');
    s.addImage({ data: await crop('img/coldchain.webp', 4.6, 5.0), x: X, y: 1.7, w: 4.6, h: 5.0, altText: '저온 창고 출입구' });
    s.addShape(pres.shapes.RECTANGLE, { x: X, y: 6.1, w: 4.6, h: 0.6, fill: { color: C.navy950, transparency: 30 }, line: { type: 'none' } });
    T(s, '콜드체인 · 온도가 곧 품질입니다', { x: X+0.2, y: 6.1, w: 4.2, h: 0.6, valign: 'middle', fontSize: 11, bold: true, color: C.white });
    const cs = [['-20℃ ~ +15℃ 콜드체인','냉동·냉장·정온 온도대를 모두 다루고, 24시간 실시간 온도 모니터링으로 신선도를 지킵니다.'],['HACCP 기준 위생 관리','식자재 물류에 맞춘 위생 관리 체계와 숙련 인력으로 안전한 식품 유통을 보장합니다.'],['DC·TC·B2B·B2C 복합 운영','보관형·통과형·온라인 출고를 한 조직에서 운영해 물동량 변화에 유연하게 대응합니다.'],['센터 + 운송 원스톱','직영 차량과 간선망을 함께 가져 센터 운영부터 배송까지 한 번에 책임집니다.']];
    cs.forEach(([h,d],i) => { const y = 1.7 + i*1.28; card(s, 5.55, y, 7.18, 1.15, C.surf);
      circ(s, 5.8, y+0.25, 0.65, C.white, String(i+1).padStart(2,'0'), C.blue);
      T(s, h, { x: 6.7, y: y+0.18, w: 5.8, h: 0.35, fontSize: 15, bold: true, color: C.navy900 });
      T(s, d, { x: 6.7, y: y+0.56, w: 5.8, h: 0.5, fontSize: 11, color: C.ink7 }); });
    foot(s, false);
  }

  // 10 운영 모델
  { const s = slide(false); head(s, false, '08 · OPERATING MODEL', '세 가지 신선 운영 모델을 한 조직에서');
    lead(s, '보관형(DC)·통과형(TC)·B2B 온라인 출고를 모두 운영해 본 경험이 재경의 차별점입니다.');
    const ms = [['DC','Distribution Center','재고를 보관하며 주문 단위로 분류·배송하는 보관형 센터 운영',['입고 · 온도 검수','냉장·냉동 보관','주문별 피킹·분류','배송 · 납품 확인'],'수행: 삼성웰스토리',false],['TC','Transfer Center','재고 없이 입고 즉시 행선지별로 분류해 내보내는 통과형 운영',['차량 입고 · 검수','행선지별 즉시 분류','크로스도킹 상차','당일 출고'],'수행: 현대그린푸드 (동탄)',false],['B2B','Online Fulfillment','온라인 식품 브랜드의 거래처 주문을 받아 출고까지 대행',['주문 수신 · 확인','피킹 · 패킹(보냉)','B2B 출고 · 운송','재고·출고 리포트'],'수행: 바르닭 · 작심닭 등',true]];
    ms.forEach(([k,t,d,steps,cl,f],i) => { const x = X + i*4.1, y = 2.2; card(s, x, y, 3.9, 4.55, C.surf);
      card(s, x+0.25, y+0.28, 0.6, 0.34, C.navy900); T(s, k, { x: x+0.25, y: y+0.28, w: 0.6, h: 0.34, align: 'center', valign: 'middle', fontFace: M, fontSize: 10, bold: true, color: C.white });
      T(s, t, { x: x+0.95, y: y+0.26, w: 2.8, h: 0.4, fontSize: 15, bold: true, color: C.navy900, valign: 'middle' });
      T(s, d, { x: x+0.25, y: y+0.8, w: 3.4, h: 0.6, fontSize: 11, color: C.ink7 });
      steps.forEach((st,j) => { const yy = y + 1.55 + j*0.58; card(s, x+0.25, yy, 3.4, 0.46, C.white);
        T(s, String(j+1).padStart(2,'0'), { x: x+0.4, y: yy, w: 0.4, h: 0.46, valign: 'middle', fontFace: M, fontSize: 10, bold: true, color: f ? C.freshText : C.blue });
        T(s, st, { x: x+0.85, y: yy, w: 2.7, h: 0.46, valign: 'middle', fontSize: 12, color: C.ink }); });
      T(s, cl, { x: x+0.25, y: y+4.0, w: 3.4, h: 0.3, fontSize: 10, color: C.ink5 }); });
    foot(s, false);
  }

  // 11 서비스
  { const s = slide(false); head(s, false, '09 · BUSINESS AREA', '5대 물류 서비스');
    lead(s, '콜드체인 3PL과 신선식품 풀필먼트를 중심으로, 고객 운영에 필요한 물류 영역을 한곳에서 연결합니다.');
    const sv = [['3PL 물류대행','입고·보관·주문 처리·출고까지 물류 업무 일괄 대행',true],['신선식품 풀필먼트','B2B·B2C 주문 접수부터 피킹·보냉 포장·배송까지',true],['기업운송','기업물류·특수화물·납품운송·정기 간선'],['보관물류','냉동·냉장·상온 보관 조건과 입출고 연계'],['물류컨설팅','냉장센터 설계·운영 시스템 구축·물류비 절감 진단']];
    sv.forEach(([h,d,core],i) => { const x = X + i*2.46, y = 2.4; card(s, x, y, 2.3, 3.6, core ? C.navy900 : C.white, core ? null : C.line);
      circ(s, x+0.25, y+0.3, 0.7, core ? '1D2A72' : C.ice, String(i+1).padStart(2,'0'), core ? C.blueSoft : C.blue);
      T(s, h, { x: x+0.25, y: y+1.3, w: 1.9, h: 0.75, fontSize: 15, bold: true, color: core ? C.white : C.navy900 });
      T(s, d, { x: x+0.25, y: y+2.1, w: 1.85, h: 1.3, fontSize: 11, color: core ? C.darkSoft : C.ink7, lineSpacingMultiple: 1.3 }); });
    foot(s, false);
  }

  // 12 연혁
  { const s = slide(true); head(s, true, '10 · HISTORY', '재경이 걸어온 길, 2013 — 2026');
    const hs = [['2013',['재경로지스 설립','화물 운수사업·운송주선 개시']],['2015',['대기업 운송 및 구간 택배','롯데칠성·삼성전자·대림산업']],['2018',['한화케미칼·LG화학·한샘 특판 운송']],['2019',['현대리바트·아모레퍼시픽·이마트에브리데이 운송·중계']],['2021',['HL홀딩스 전담 물류 개시','쿠팡 콜드체인 3PL, 안성 1센터']],['2022',['컬리 콜드체인 3PL']],['2023',['삼성웰스토리 DC·현대그린푸드 동탄 TC','B마트·푸디버스, 안성 2센터']],['2024–26',['HL홀딩스 3PL 운영 전담 파트너','바르닭·작심닭 B2B 온라인 유통','그룹웨어·전자결재 운영 체계']]];
    s.addShape(pres.shapes.LINE, { x: X, y: 3.05, w: 12.1, h: 0, line: { color: C.darkLine, width: 2 } });
    hs.forEach(([y,items],i) => { const x = X + i*1.52; const now = i === hs.length-1;
      T(s, y, { x, y: 2.3, w: 1.45, h: 0.45, fontFace: M, fontSize: now ? 15 : 17, bold: true, color: now ? C.mint : C.white });
      s.addShape(pres.shapes.OVAL, { x, y: 2.93, w: 0.24, h: 0.24, fill: { color: now ? C.fresh : C.navy950 }, line: { color: now ? C.fresh : C.blueSoft, width: 2 } });
      T(s, items.map((t,j) => ({ text: t, options: { breakLine: j < items.length-1, paraSpaceAfter: 6 } })), { x, y: 3.4, w: 1.4, h: 3.2, fontSize: 10.5, color: C.darkSoft, lineSpacingMultiple: 1.25 }); });
    foot(s, true);
  }

  // 13 로드맵
  { const s = slide(false); head(s, false, '11 · STRATEGY & ROADMAP', '사업 전략 로드맵 2026 — 2028');
    const ph = [['PHASE 1 · 2026 하반기','운영 안정화·신뢰 강화',['HL홀딩스 동탄냉장 협력 운영 고도화','웰스토리 DC·그린푸드 TC 품질·정시율 관리','위험성평가 우수사업장 인정 추진'],C.ice,C.navy900,C.ink7,C.blue],['PHASE 2 · 2027','신선 3PL 화주 확대',['B2B·B2C 온라인 식품 브랜드 풀필먼트 확대','DC·TC 운영 노하우의 신규 유통사 제안','재고·출고·온도 데이터 리포트 표준화'],C.white,C.navy900,C.ink7,C.blue],['PHASE 3 · 2028~','신선물류 네트워크 확장',['수도권·호남·영남 거점 연계 신선 물류망','물류컨설팅(냉장센터 설계·운영) 사업화','유통사 전속 파트너 모델 표준화'],C.navy900,C.white,C.darkSoft,C.blueSoft]];
    ph.forEach(([w,h,items,bg,hc,tc,wc],i) => { const x = X + i*4.1, y = 1.8; card(s, x, y, 3.9, 3.7, bg, bg === C.white ? C.line : null);
      T(s, w, { x: x+0.3, y: y+0.3, w: 3.3, h: 0.3, fontFace: M, fontSize: 10, bold: true, color: wc });
      T(s, h, { x: x+0.3, y: y+0.65, w: 3.3, h: 0.45, fontSize: 17, bold: true, color: hc });
      T(s, items.map((t,j) => ({ text: t, options: { bullet: true, breakLine: j < items.length-1 } })), { x: x+0.3, y: y+1.3, w: 3.35, h: 2.2, fontSize: 12, color: tc, paraSpaceAfter: 10 }); });
    card(s, X, 5.8, 12.1, 0.75, C.freshSoft);
    card(s, X+0.3, 6.0, 0.8, 0.35, C.fresh); T(s, 'GOAL', { x: X+0.3, y: 6.0, w: 0.8, h: 0.35, align: 'center', valign: 'middle', fontFace: M, fontSize: 10, bold: true, color: C.white });
    T(s, '신선식품 유통물류 분야에서 “믿고 맡기는 전담 파트너” 포지션 확립', { x: X+1.3, y: 5.8, w: 10.5, h: 0.75, valign: 'middle', fontSize: 14, bold: true, color: '065E55' });
    foot(s, false);
  }

  // 14 안전·ESG
  { const s = slide(false); head(s, false, '12 · SAFETY & ESG', '안전이 곧 서비스 품질입니다');
    const ck = [['안전보건경영방침 운영','2024년 1월 방침 제정 이후 전 사업장 공통 기준으로 적용'],['원청 협력사 안전보건관리','HL홀딩스 동탄냉장 협력사로서 안전보건관리계획 수립·이행'],['위험성평가 상시 운영','지게차·상하차·냉동창고 작업 등 유해위험요인 발굴과 개선'],['신선 품질 관리','입고 온도 검수·24시간 온도 모니터링·보냉 출고로 품질 사고 예방']];
    ck.forEach(([h,d],i) => { const y = 1.8 + i*1.2; card(s, X, y, 7.0, 1.05, C.white, C.line);
      circ(s, X+0.3, y+0.28, 0.5, C.freshSoft, '✓', C.freshText);
      T(s, h, { x: X+1.05, y: y+0.18, w: 5.8, h: 0.35, fontSize: 14, bold: true, color: C.navy900 });
      T(s, d, { x: X+1.05, y: y+0.55, w: 5.8, h: 0.35, fontSize: 11, color: C.ink7 }); });
    card(s, 8.0, 1.8, 4.73, 4.65, C.navy900);
    s.addImage({ data: await crop('img/safety.webp', 4.73, 1.9), x: 8.0, y: 1.8, w: 4.73, h: 1.9, altText: '정렬된 지게차와 안전 통로' });
    card(s, 8.35, 3.95, 2.4, 0.34, '114A5A'); T(s, 'SOCIAL CONTRIBUTION', { x: 8.35, y: 3.95, w: 2.4, h: 0.34, align: 'center', valign: 'middle', fontFace: M, fontSize: 9, bold: true, color: C.mint });
    T(s, '지역과 함께 성장하는 기업', { x: 8.35, y: 4.45, w: 4.1, h: 0.4, fontSize: 16, bold: true, color: C.white });
    T(s, '광주광역시장애인체육회 후원기업으로 장애인 체육 발전을 지원하는 등, 본사가 있는 지역 사회와 함께 성장하는 활동을 이어가고 있습니다.', { x: 8.35, y: 4.95, w: 4.05, h: 1.4, fontSize: 11, color: C.darkSoft, lineSpacingMultiple: 1.35 });
    foot(s, false);
  }

  // 15 문의
  { const s = slide(true);
    await photoBg(s, 'img/dc.webp', 25);
    T(s, 'CONTACT', { x: X, y: 1.4, w: 6, h: 0.3, fontFace: M, fontSize: 11, bold: true, color: C.blueSoft, charSpacing: 2 });
    T(s, [{ text: '신선물류의 다음 단계,', options: { color: C.white, breakLine: true } }, { text: '재경과 함께 설계하세요.', options: { color: C.blueSoft } }], { x: X, y: 1.9, w: 10, h: 1.7, fontSize: 38, bold: true, lineSpacingMultiple: 1.1 });
    [['대표전화','070-8098-4559'],['본사','062-952-9794'],['이메일','contact@jeakyung.com']].forEach(([a,b],i) => { const x = X + i*3.7; card(s, x, 4.1, 3.5, 1.1, C.darkCard, C.darkLine, 15);
      T(s, a, { x: x+0.3, y: 4.28, w: 3, h: 0.3, fontSize: 11, color: C.darkSoft }); T(s, b, { x: x+0.3, y: 4.6, w: 3.1, h: 0.4, fontSize: 16, bold: true, color: C.white }); });
    T(s, [{ text: 'jeakyung.com/business-plan', options: { hyperlink: { url: 'https://jeakyung.com/business-plan/' }, color: C.mint } }, { text: '   ·   카카오톡 상담 pf.kakao.com/_xgrFxhn', options: { color: C.darkSoft } }], { x: X, y: 5.6, w: 11, h: 0.35, fontSize: 12 });
    foot(s, true, '사진: Unsplash');
  }
  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT);
})();
