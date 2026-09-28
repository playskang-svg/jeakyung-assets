// 재경로지스｜물류 회사소개서 PPT 생성기. company-profile/index.html 과 같은 내용을 14장 슬라이드로 만든다.
// 사용: (임시 폴더에서) npm i pptxgenjs sharp 후 NODE_PATH=<그 폴더>/node_modules node scripts/company-profile/build-pptx.cjs
// 문구를 고치면 웹(index.html)과 이 파일을 함께 고친다.
const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const IMG = require('path').resolve(__dirname, '../../company-profile') + '/';
const OUT = process.argv[2] || IMG + 'jaekyung-company-profile-2026.pptx';
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
  pres.author = '재경로지스｜물류'; pres.company = '재경로지스｜물류'; pres.title = '재경로지스｜물류 회사소개서';
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

  // 아이콘: 웹과 같은 선 아이콘을 SVG→PNG 로 넣는다.
  const ICON = {
    truck: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
    people: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.6-4.6 4-5"/>',
    pin: '<path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/>',
    temp: '<path d="M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0Z"/><path d="M12 17v-5"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    shield: '<path d="M12 2 3 6v6c0 5 3.8 9.4 9 10 5.2-.6 9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
    lanes: '<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="19" cy="17" r="2"/>',
  };
  async function icon(name, color) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" fill="none" stroke="#${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
    return 'image/png;base64,' + (await sharp(Buffer.from(svg)).png().toBuffer()).toString('base64');
  }
  const FOOT = '재경로지스｜물류 · 회사소개서';
  function foot2(s, dark, extra) {
    T(s, FOOT + (extra ? ' · ' + extra : ''), { x: X, y: 7.02, w: 9, h: 0.25, fontSize: 9, color: dark ? C.darkSoft : C.ink5 });
    T(s, String(n).padStart(2, '0'), { x: W - X - 1, y: 7.02, w: 1, h: 0.25, fontSize: 9, fontFace: M, align: 'right', color: dark ? C.darkSoft : C.ink5 });
  }
  const pill = (s, x, y, w, h, fill, text, color, size, line) => { card(s, x, y, w, h, fill, line); T(s, text, { x, y, w, h, align: 'center', valign: 'middle', fontSize: size || 12, bold: true, color }); };

  // 01 표지
  { const s = slide(true);
    await photoBg(s, 'img/hero.webp', 50);
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 8.2, h: H, fill: { color: C.navy950, transparency: 25 }, line: { type: 'none' } });
    T(s, 'COMPANY PROFILE 2026', { x: X, y: 0.6, w: 6, h: 0.3, fontFace: M, fontSize: 11, bold: true, color: C.blueSoft, charSpacing: 2 });
    T(s, 'COLD-CHAIN 3PL & FRESH LOGISTICS', { x: X, y: 1.9, w: 7, h: 0.3, fontFace: M, fontSize: 12, bold: true, color: C.mint, charSpacing: 1 });
    T(s, [{ text: '신선물류,', options: { color: C.white, breakLine: true } }, { text: '재경에 맡기세요.', options: { color: C.blueSoft } }], { x: X, y: 2.3, w: 7.4, h: 1.7, fontSize: 46, bold: true, lineSpacingMultiple: 1.1 });
    T(s, '냉동·냉장 식자재부터 온라인 신선식품까지. 보관·풀필먼트·운송을 한 번에 책임지는 콜드체인 3PL 파트너, 재경로지스｜물류입니다.', { x: X, y: 4.15, w: 6.8, h: 0.9, fontSize: 14, color: 'DCE2F7', lineSpacingMultiple: 1.3 });
    pill(s, X, 5.2, 2.4, 0.5, C.blue, '물류 상담 신청 →', C.white, 13);
    [['대표전화','070-8098-4559',0,2.2],['이메일','contact@jeakyung.com',2.4,3.0],['웹','jeakyung.com',5.6,2.0]].forEach(([a,b,dx,w]) => { T(s, a, { x: X + dx, y: 6.3, w, h: 0.25, fontSize: 10, color: C.darkSoft }); T(s, b, { x: X + dx, y: 6.55, w, h: 0.35, fontSize: 13, bold: true, color: C.white }); });
  }

  // 02 숫자
  { const s = slide(true);
    await photoBg(s, 'img/fleet.webp', 22);
    head(s, true, 'AT A GLANCE', '숫자로 보는 재경');
    lead(s, '운송에서 시작해 콜드체인 3PL까지. 현장에서 쌓은 인프라가 곧 경쟁력입니다.', true);
    const k = [['truck','300','여 대','직영 차량\n1톤 ~ 25톤'],['people','60','여 개','고객사·협력사\n파트너십'],['pin','5','개 권역','수도권 3센터 +\n호남·영남 식자재 센터'],['temp','-20~15','℃','콜드체인 온도대\n24시간 모니터링',true],['cal','365','일','수도권 ↔ 지방\n정기 간선 운행']];
    for (let i = 0; i < k.length; i++) { const [ic,a,u,d,acc] = k[i]; const x = X + i*2.46, y = 2.5;
      card(s, x, y, 2.3, 2.7, acc ? '0E3A4A' : C.darkCard, acc ? C.mint : C.darkLine, 10);
      s.addImage({ data: await icon(ic, acc ? '5FE0D2' : '8EA4FF'), x: x+0.22, y: y+0.25, w: 0.42, h: 0.42 });
      T(s, [{ text: a, options: { fontSize: acc ? 28 : 38, bold: true, color: C.white } }, { text: ' ' + u, options: { fontSize: 13, bold: true, color: C.darkSoft } }], { x: x+0.22, y: y+0.8, w: 2.0, h: 0.8, valign: 'bottom' });
      T(s, d, { x: x+0.22, y: y+1.75, w: 1.95, h: 0.8, fontSize: 11, color: C.darkSoft, lineSpacingMultiple: 1.3 }); }
    T(s, '※ 수치는 2025년 4월 기준', { x: X, y: 6.5, w: 6, h: 0.3, fontSize: 10, color: C.darkSoft });
    foot2(s, true);
  }

  // 03 회사 소개
  { const s = slide(false); head(s, false, 'ABOUT US', '현장을 이해하는 물류, 재경로지스｜물류');
    T(s, [{ text: '2013년 화물 운수사업으로 출발해 대기업 운송·중계물류를 거쳐, 지금은 ' }, { text: '식자재·신선식품 콜드체인 3PL', options: { bold: true, color: C.blue } }, { text: '을 전문으로 하는 종합 물류 기업입니다.' }], { x: X, y: 1.8, w: 6.6, h: 1.4, fontSize: 18, color: C.ink7, lineSpacingMultiple: 1.35 });
    [['유한회사 재경로지스','본사 · 광주'],['유한회사 재경물류','평택 · 3PL 운영'],['재경상운','운송']].forEach(([a,b],i) => { const x = X + i*2.25; card(s, x, 3.45, 2.1, 0.95, C.surf); T(s, a, { x: x+0.18, y: 3.6, w: 1.9, h: 0.35, fontSize: 12, bold: true, color: C.navy900 }); T(s, b, { x: x+0.18, y: 3.95, w: 1.9, h: 0.3, fontSize: 10, color: C.ink5 }); });
    card(s, X, 4.7, 6.6, 1.7, C.white, C.line);
    s.addImage({ data: await crop('ceo.webp', 1.1, 1.1), x: X+0.3, y: 5.0, w: 1.1, h: 1.1, rounding: true, altText: '대표이사 염달성' });
    T(s, '“온도와 시간이 품질이 되는 신선물류에서, 약속한 시간에 약속한 상태로 전달하는 것 — 그것이 재경의 기준입니다.”', { x: X+1.65, y: 4.95, w: 4.75, h: 0.9, fontSize: 12, color: C.ink7, lineSpacingMultiple: 1.3 });
    T(s, [{ text: '대표이사 ', options: { color: C.ink5 } }, { text: '염달성', options: { bold: true, color: C.navy900 } }], { x: X+1.65, y: 5.9, w: 3, h: 0.3, fontSize: 11 });
    s.addImage({ data: await crop('img/overview.webp', 5.3, 4.6), x: 7.43, y: 1.8, w: 5.3, h: 4.6, altText: '대형 물류센터 전경' });
    foot2(s, false);
  }

  // 04 Why
  { const s = slide(false); head(s, false, 'WHY JAEKYUNG', '재경을 선택해야 하는 4가지 이유');
    const w4 = [['shield','대기업이 검증한 운영','HL홀딩스 전담 물류사로 삼성웰스토리 DC·현대그린푸드 TC를 운영합니다.',C.blue],['temp','-20℃~+15℃ 콜드체인','냉동·냉장·정온 전 온도대, 24시간 온도 모니터링, HACCP 기준 위생 관리.',C.fresh],['truck','센터 + 운송 원스톱','직영 차량 300여 대와 365일 간선망. 보관부터 배송까지 한 곳에서.',C.blue],['lanes','채널별 맞춤 운영','급식 DC, 통과형 TC, 온라인 B2B·B2C까지 — 채널에 맞는 운영을 설계합니다.',C.blue]];
    for (let i = 0; i < 4; i++) { const [ic,h,d,col] = w4[i]; const x = X + i*3.07, y = 2.0;
      card(s, x, y, 2.9, 4.2, C.surf);
      T(s, String(i+1).padStart(2,'0'), { x: x+1.6, y: y+0.15, w: 1.15, h: 0.8, fontFace: M, fontSize: 40, bold: true, align: 'right', color: 'DCE3FA' });
      circ(s, x+0.3, y+0.4, 0.95, col);
      s.addImage({ data: await icon(ic, 'FFFFFF'), x: x+0.53, y: y+0.63, w: 0.5, h: 0.5 });
      T(s, h, { x: x+0.3, y: y+1.65, w: 2.4, h: 0.75, fontSize: 17, bold: true, color: C.navy900 });
      T(s, d, { x: x+0.3, y: y+2.45, w: 2.35, h: 1.5, fontSize: 12, color: C.ink7, lineSpacingMultiple: 1.35 }); }
    foot2(s, false);
  }

  // 05 서비스
  { const s = slide(false); head(s, false, 'SERVICES', '필요한 물류를 한곳에서');
    const sv = [['img/b2b.webp','3PL 물류대행','입고·보관·주문 처리·출고 일괄 대행',true],['img/fresh.webp','신선식품 풀필먼트','B2B·B2C 주문부터 보냉 포장·배송까지',true],['img/fleet.webp','기업운송','1~25톤 · 특수화물 · 납품 · 정기 간선'],['img/dc.webp','보관물류','냉동·냉장·상온 보관과 입출고 연계'],['img/tc.webp','물류컨설팅','냉장센터 설계 · 운영 시스템 · 물류비 진단']];
    for (let i = 0; i < 5; i++) { const [img,h,d,core] = sv[i]; const x = X + i*2.46, y = 1.75, w = 2.3;
      card(s, x, y, w, 5.0, core ? C.navy900 : C.white, core ? null : C.line);
      s.addImage({ data: await crop(img, w, 3.1), x: x+0.01, y: y+0.01, w: w-0.02, h: 3.1, altText: h });
      T(s, String(i+1).padStart(2,'0'), { x: x+0.2, y: y+3.3, w: 1, h: 0.25, fontFace: M, fontSize: 10, bold: true, color: core ? C.blueSoft : C.blue });
      T(s, h, { x: x+0.2, y: y+3.58, w: 2.0, h: 0.4, fontSize: 15, bold: true, color: core ? C.white : C.navy900 });
      T(s, d, { x: x+0.2, y: y+4.05, w: 1.95, h: 0.8, fontSize: 11, color: core ? C.darkSoft : C.ink7, lineSpacingMultiple: 1.3 }); }
    foot2(s, false);
  }

  // 06 콜드체인
  { const s = slide(true);
    await photoBg(s, 'img/coldchain.webp', 30);
    head(s, true, 'COLD-CHAIN CAPABILITY', '온도가 곧 품질입니다');
    lead(s, '상품이 요구하는 온도대 그대로, 입고부터 출고까지 끊김 없이 관리합니다.', true);
    const bx = X, bw = 10.5, by = 2.8, bh = 0.9;
    const zones = [['냉동', 0.57, '2E5EFF'], ['냉장', 0.29, '14ADBF'], ['정온', 0.14, 'F09A35']];
    let zx = bx; zones.forEach(([t, f, col]) => { const w = bw * f; s.addShape(pres.shapes.RECTANGLE, { x: zx, y: by, w, h: bh, fill: { color: col }, line: { type: 'none' } }); T(s, t, { x: zx, y: by, w, h: bh, align: 'center', valign: 'middle', fontSize: 20, bold: true, color: C.white }); zx += w; });
    [['-20℃', 0], ['0℃', 0.57], ['+10℃', 0.86], ['+15℃', 1]].forEach(([t, f]) => T(s, t, { x: bx + bw * f - (f === 1 ? 0.9 : 0), y: by + bh + 0.12, w: 0.9, h: 0.3, fontFace: M, fontSize: 11, color: C.darkSoft, align: f === 1 ? 'right' : 'left' }));
    [['24h','실시간 온도 모니터링'],['HACCP','기준 위생 관리 체계'],['보냉','출고 포장·차량 온도 유지']].forEach(([a,b],i) => { const x = X + i*3.6; card(s, x, 4.6, 3.4, 1.5, C.darkCard, C.darkLine, 15); T(s, a, { x: x+0.3, y: 4.8, w: 3, h: 0.6, fontSize: 28, bold: true, color: C.white }); T(s, b, { x: x+0.3, y: 5.45, w: 3, h: 0.4, fontSize: 12, color: C.darkSoft }); });
    foot2(s, true);
  }

  // 07 운영 모델
  { const s = slide(false); head(s, false, 'OPERATING MODELS', '채널에 맞춘 세 가지 운영 방식');
    const ln = [['DC','보관형 배송센터','예) 급식·식자재 유통',['입고·온도 검수','냉장·냉동 보관','주문별 피킹','배송·납품'],false],['TC','통과형 센터','예) 크로스도킹 물류',['차량 입고','행선지 분류','즉시 상차','당일 출고'],false],['B2B','온라인 풀필먼트','예) D2C 식품 브랜드',['주문 수신','피킹·보냉 패킹','출고·운송','재고 리포트'],true]];
    ln.forEach(([k,t,e,steps,f],i) => { const y = 1.8 + i*1.65; card(s, X, y, 12.1, 1.45, C.surf);
      pill(s, X+0.3, y+0.22, 0.75, 0.34, f ? C.fresh : C.navy900, k, C.white, 10);
      T(s, t, { x: X+0.3, y: y+0.62, w: 2.6, h: 0.4, fontSize: 16, bold: true, color: C.navy900 });
      T(s, e, { x: X+0.3, y: y+1.0, w: 2.6, h: 0.3, fontSize: 10, color: C.ink5 });
      steps.forEach((st,j) => { const sx = X + 3.2 + j*2.2; card(s, sx, y+0.3, 1.9, 0.85, C.white);
        T(s, String(j+1).padStart(2,'0'), { x: sx+0.18, y: y+0.4, w: 1, h: 0.25, fontFace: M, fontSize: 9, bold: true, color: f ? C.freshText : C.blue });
        T(s, st, { x: sx+0.18, y: y+0.66, w: 1.7, h: 0.35, fontSize: 12, bold: true, color: C.navy900 });
        if (j < 3) s.addShape(pres.shapes.ISOSCELES_TRIANGLE, { x: sx+1.97, y: y+0.62, w: 0.2, h: 0.22, rotate: 90, fill: { color: f ? C.fresh : C.blue }, line: { type: 'none' } }); }); });
    foot2(s, false);
  }

  // 08 레퍼런스
  { const s = slide(true); head(s, true, 'REFERENCES', '대표 수행 사례');
    const cs = [['img/overview.webp','2021.07 ~','HL홀딩스','홈쇼핑 B2C 콜드체인 3PL로 시작해 전담 물류 파트너로 성장',false],['img/dc.webp','2023.12 ~','삼성웰스토리 DC','HL홀딩스와 DC 공동 운영 · B2B/B2C 콜드체인',false],['img/tc.webp','2023.12 ~','현대그린푸드 TC','동탄 TC 전담 운영 · 입고 즉시 분류·출고',false],['img/b2b.webp','B2B 온라인','바르닭 · 작심닭 등','온라인 식품 브랜드의 B2B 유통 출고 책임 운영',true]];
    for (let i = 0; i < 4; i++) { const [img,p,h,d,f] = cs[i]; const x = X + i*3.07, y = 1.75, w = 2.9;
      card(s, x, y, w, 4.9, C.darkCard, C.darkLine);
      s.addImage({ data: await crop(img, w, 2.2), x: x+0.01, y: y+0.01, w: w-0.02, h: 2.2, altText: h });
      T(s, p, { x: x+0.25, y: y+2.45, w: 2.5, h: 0.25, fontFace: M, fontSize: 10, bold: true, color: f ? C.mint : C.blueSoft });
      T(s, h, { x: x+0.25, y: y+2.75, w: 2.5, h: 0.45, fontSize: 17, bold: true, color: C.white });
      T(s, d, { x: x+0.25, y: y+3.3, w: 2.45, h: 1.3, fontSize: 11.5, color: C.darkSoft, lineSpacingMultiple: 1.35 }); }
    foot2(s, true);
  }

  // 09 고객
  { const s = slide(false); head(s, false, 'CLIENTS & PARTNERS', '국내 대표 유통·식품 기업과 함께합니다');
    lead(s, '50~60여 개 고객사·협력사와 파트너십을 이어가고 있습니다.');
    const rows = [['식자재 · 급식',[['HL홀딩스',1],['삼성웰스토리',1],['현대그린푸드',1],['동원홈푸드'],['CJ제일제당']]],['온라인 유통',[['쿠팡',1],['컬리',1],['배민 B마트'],['신세계유통'],['바르닭'],['작심닭']]],['리테일 · 풀필먼트',[['이마트에브리데이'],['현대홈쇼핑'],['푸디버스'],['푸드나무']]],['운송 · 택배',[['LX판토스'],['CJ대한통운'],['롯데택배'],['경동택배'],['한샘']]]];
    rows.forEach(([lab, items], i) => { const y = 2.35 + i*1.1; T(s, lab, { x: X, y: y, w: 1.8, h: 0.55, valign: 'middle', fontSize: 11, bold: true, color: C.blue });
      let x = X + 2.0; items.forEach(([t, big]) => { const w = 0.5 + t.length * (big ? 0.2 : 0.17); pill(s, x, y, w, 0.55, big ? C.navy900 : C.surf, t, big ? C.white : C.navy900, big ? 14 : 12); x += w + 0.15; });
      s.addShape(pres.shapes.LINE, { x: X, y: y+0.8, w: 12.1, h: 0, line: { color: C.line, width: 1 } }); });
    foot2(s, false, '수행 이력 기준');
  }

  // 10 네트워크
  { const s = slide(false); head(s, false, 'NETWORK', '전국을 잇는 센터·운송 네트워크');
    card(s, X, 1.8, 4.6, 4.9, C.ice);
    s.addShape(pres.shapes.LINE, { x: 1.55, y: 2.75, w: 1.5, h: 2.9, flipH: true, line: { color: C.blue, width: 1.5, dashType: 'dash' } });
    s.addShape(pres.shapes.LINE, { x: 3.05, y: 2.75, w: 1.2, h: 2.7, line: { color: C.blue, width: 1.5, dashType: 'dash' } });
    [[2.9, 2.6, '수도권', '이천 · 안성1·2 · 동탄', C.blue, true], [1.4, 5.5, '호남 · 광주', '식자재 센터 · 본사', C.fresh], [4.1, 5.3, '영남 · 울주', '식자재 센터', C.fresh]].forEach(([x,y,a,b,col,right]) => {
      s.addShape(pres.shapes.OVAL, { x: x-0.15, y: y-0.15, w: 0.3, h: 0.3, fill: { color: col }, line: { color: C.white, width: 2 } });
      if (right) { T(s, a, { x: x+0.3, y: y-0.2, w: 1.4, h: 0.3, fontSize: 12, bold: true, color: C.navy900 }); T(s, b, { x: x+0.3, y: y+0.08, w: 1.6, h: 0.25, fontSize: 9, color: C.ink7 }); }
      else { T(s, a, { x: x-0.9, y: y+0.2, w: 1.8, h: 0.3, align: 'center', fontSize: 12, bold: true, color: C.navy900 }); T(s, b, { x: x-1.0, y: y+0.48, w: 2.0, h: 0.25, align: 'center', fontSize: 9, color: C.ink7 }); } });
    T(s, '365일 간선', { x: 2.3, y: 3.9, w: 1.4, h: 0.3, align: 'center', fontSize: 10, bold: true, color: C.blue });
    [['수도권 3개 센터','이천·안성 1·2센터, 동탄 물류단지 — 온라인 유통 콜드체인 거점'],['호남·영남 식자재 센터','광주·울주 거점으로 지역 급식·식자재 배송'],['직영 차량 300여 대','1톤~25톤 · 기업물류·특수화물·납품운송']].forEach(([a,b],i) => { const x = 5.55 + (i%2)*3.65, y = 1.8 + Math.floor(i/2)*2.5; card(s, x, y, 3.5, 2.3, C.surf);
      T(s, a, { x: x+0.25, y: y+0.3, w: 3.0, h: 0.4, fontSize: 16, bold: true, color: C.navy900 }); T(s, b, { x: x+0.25, y: y+0.85, w: 3.0, h: 1.3, fontSize: 11.5, color: C.ink7, lineSpacingMultiple: 1.3 }); });
    s.addImage({ data: await crop('img/fleet.webp', 3.5, 2.3), x: 9.2, y: 4.3, w: 3.5, h: 2.3, altText: '고속도로를 달리는 화물 트럭' });
    foot2(s, false, '2025년 4월 기준');
  }

  // 11 연혁
  { const s = slide(true); head(s, true, 'HISTORY', '운송에서 콜드체인 3PL까지, 2013 — 2026');
    const hs = [['2013',['재경로지스 설립','화물 운수사업·운송주선']],['2015',['대기업 운송·구간 택배','롯데칠성·삼성전자·대림산업']],['2018',['한화케미칼·LG화학·한샘 특판 운송']],['2019',['현대리바트·아모레퍼시픽·이마트에브리데이']],['2021',['HL홀딩스 전담 물류','쿠팡 콜드체인 3PL, 안성 1센터']],['2022',['컬리 콜드체인 3PL']],['2023',['삼성웰스토리 DC·현대그린푸드 TC','B마트·푸디버스, 안성 2센터']],['2024–26',['HL홀딩스 3PL 운영 전담 파트너','바르닭·작심닭 B2B 온라인 유통']]];
    s.addShape(pres.shapes.LINE, { x: X, y: 3.05, w: 12.1, h: 0, line: { color: C.darkLine, width: 2 } });
    hs.forEach(([y,items],i) => { const x = X + i*1.52; const now = i === hs.length-1;
      T(s, y, { x, y: 2.3, w: 1.45, h: 0.45, fontFace: M, fontSize: now ? 15 : 17, bold: true, color: now ? C.mint : C.white });
      s.addShape(pres.shapes.OVAL, { x, y: 2.93, w: 0.24, h: 0.24, fill: { color: now ? C.fresh : C.navy950 }, line: { color: now ? C.fresh : C.blueSoft, width: 2 } });
      T(s, items.map((t,j) => ({ text: t, options: { breakLine: j < items.length-1, paraSpaceAfter: 6 } })), { x, y: 3.4, w: 1.4, h: 3.2, fontSize: 10.5, color: C.darkSoft, lineSpacingMultiple: 1.25 }); });
    foot2(s, true);
  }

  // 12 도입 절차
  { const s = slide(false); head(s, false, 'HOW WE START', '재경과 시작하는 5단계');
    lead(s, '현재 물류를 먼저 이해하고, 무리 없이 옮겨 오는 것부터 시작합니다.');
    const st = [['상담','상품·물동량·채널 파악'],['현장 진단','현행 물류 흐름과 온도 조건 점검'],['운영 설계·견적','센터·운송·인력 구성 제안'],['시범 운영','소규모로 운영 기준 검증'],['본 운영','정기 리포트로 지속 개선']];
    s.addShape(pres.shapes.LINE, { x: X + 1.2, y: 3.05, w: 9.7, h: 0, line: { color: C.blue, width: 3 } });
    st.forEach(([a,b],i) => { const cx = X + 1.21 + i*2.42; const last = i === 4;
      s.addShape(pres.shapes.OVAL, { x: cx-0.45, y: 2.6, w: 0.9, h: 0.9, fill: { color: last ? C.fresh : C.white }, line: { color: last ? C.fresh : C.blue, width: 3 } });
      T(s, String(i+1), { x: cx-0.45, y: 2.6, w: 0.9, h: 0.9, align: 'center', valign: 'middle', fontFace: M, fontSize: 22, bold: true, color: last ? C.white : C.blue });
      T(s, a, { x: cx-1.15, y: 3.7, w: 2.3, h: 0.4, align: 'center', fontSize: 16, bold: true, color: C.navy900 });
      T(s, b, { x: cx-1.15, y: 4.1, w: 2.3, h: 0.6, align: 'center', fontSize: 11, color: C.ink7 }); });
    card(s, X, 5.35, 12.1, 1.0, C.navy900);
    T(s, '지금 운영 중인 물류, 비용과 품질을 함께 점검해 드립니다.', { x: X+0.4, y: 5.35, w: 7.5, h: 1.0, valign: 'middle', fontSize: 15, bold: true, color: C.white });
    pill(s, 9.1, 5.6, 3.3, 0.5, C.blue, '카카오톡 상담 pf.kakao.com/_xgrFxhn', C.white, 11);
    foot2(s, false);
  }

  // 13 안전·ESG
  { const s = slide(false); head(s, false, 'SAFETY & ESG', '안전이 곧 서비스 품질입니다');
    const ck = [['안전보건경영방침 운영','2024년 1월 제정, 전 사업장 공통 적용'],['원청 수준의 안전보건관리','HL홀딩스 동탄냉장 협력사 안전보건관리계획 이행'],['위험성평가 상시 운영','지게차·상하차·냉동창고 작업 위험요인 개선'],['신선 품질 관리','입고 온도 검수 · 24시간 모니터링 · 보냉 출고']];
    ck.forEach(([h,d],i) => { const y = 1.8 + i*1.2; card(s, X, y, 7.0, 1.05, C.white, C.line);
      circ(s, X+0.3, y+0.28, 0.5, C.freshSoft, '✓', C.freshText);
      T(s, h, { x: X+1.05, y: y+0.18, w: 5.8, h: 0.35, fontSize: 14, bold: true, color: C.navy900 });
      T(s, d, { x: X+1.05, y: y+0.55, w: 5.8, h: 0.35, fontSize: 11, color: C.ink7 }); });
    card(s, 8.0, 1.8, 4.73, 4.65, C.navy900);
    s.addImage({ data: await crop('img/safety.webp', 4.73, 2.3), x: 8.0, y: 1.8, w: 4.73, h: 2.3, altText: '정렬된 지게차와 안전 통로' });
    pill(s, 8.35, 4.35, 2.4, 0.34, '114A5A', 'SOCIAL CONTRIBUTION', C.mint, 9);
    T(s, '지역과 함께 성장하는 기업', { x: 8.35, y: 4.85, w: 4.1, h: 0.4, fontSize: 16, bold: true, color: C.white });
    T(s, '광주광역시장애인체육회 후원기업으로 지역 장애인 체육 발전을 지원하고 있습니다.', { x: 8.35, y: 5.35, w: 4.05, h: 0.9, fontSize: 11, color: C.darkSoft, lineSpacingMultiple: 1.35 });
    foot2(s, false);
  }

  // 14 문의
  { const s = slide(true);
    await photoBg(s, 'img/hero.webp', 25);
    T(s, 'CONTACT', { x: X, y: 1.4, w: 6, h: 0.3, fontFace: M, fontSize: 11, bold: true, color: C.blueSoft, charSpacing: 2 });
    T(s, [{ text: '신선물류 고민,', options: { color: C.white, breakLine: true } }, { text: '재경이 함께 풀겠습니다.', options: { color: C.blueSoft } }], { x: X, y: 1.9, w: 10, h: 1.7, fontSize: 40, bold: true, lineSpacingMultiple: 1.1 });
    [['대표전화','070-8098-4559'],['본사','062-952-9794'],['이메일','contact@jeakyung.com']].forEach(([a,b],i) => { const x = X + i*3.7; card(s, x, 4.1, 3.5, 1.1, C.darkCard, C.darkLine, 15);
      T(s, a, { x: x+0.3, y: 4.28, w: 3, h: 0.3, fontSize: 11, color: C.darkSoft }); T(s, b, { x: x+0.3, y: 4.6, w: 3.1, h: 0.4, fontSize: 16, bold: true, color: C.white }); });
    T(s, [{ text: 'jeakyung.com/company-profile', options: { hyperlink: { url: 'https://jeakyung.com/company-profile/' }, color: C.mint } }, { text: '   ·   카카오톡 상담 pf.kakao.com/_xgrFxhn', options: { color: C.darkSoft } }], { x: X, y: 5.6, w: 11, h: 0.35, fontSize: 13 });
    foot2(s, true, '사진: Unsplash');
  }
  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT);
})();
