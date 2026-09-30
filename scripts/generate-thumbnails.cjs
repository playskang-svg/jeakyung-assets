const fs = require('fs');
const path = require('path');
const { chromium } = require('c:/Window_DEV/insta-cardnews/node_modules/playwright');

const ARTICLES = [
  {
    id: '676dacaa-86ac-4737-93ab-8a0388c542c3',
    filename: 'logistics-workforce.webp',
    badge: '물류동향',
    title: '물류 인력난 시대',
    subtitle: '현장에서 실제로 통하는 실전 해법',
    points: [
      '운전기사 고령화 대응 및 지입·협력망 다각화',
      '디지털 배차 시스템 및 상·하차 보조 자동화',
      '현장 기사 처우 개선과 상생 인센티브 모델'
    ],
    themeColor: '#3b82f6'
  },
  {
    id: '7d946bbb-e6d1-4172-bf2e-bf86b8cffb9c',
    filename: 'esg-logistics.webp',
    badge: '친환경 물류',
    title: 'ESG 경영과 물류 혁신',
    subtitle: '탄소 배출을 줄이는 친환경 운송 전략',
    points: [
      '친환경 전기·수소 화물 차량 단계적 확대',
      '공차 운행 최소화 및 최적 경로 AI 배차',
      '친환경 포장재 전환과 에코 드라이빙 실천'
    ],
    themeColor: '#10b981'
  },
  {
    id: 'a99c27d3-6109-4e83-9598-7a8706b116db',
    filename: '3pl-selection-criteria.webp',
    badge: '3PL 가이드',
    title: '3PL 파트너 선정 기준',
    subtitle: '화주 기업이 반드시 체크해야 할 5가지 핵심',
    points: [
      '자체 차량 보유율 및 직영 운송 네트워크 규모',
      '실시간 화물 관제 및 WMS/TMS 시스템 연동',
      '위기 대응력과 동일 업종 레퍼런스 검증'
    ],
    themeColor: '#06b6d4'
  },
  {
    id: 'a6ed4a2a-8e88-49a6-935e-7f516141e58f',
    filename: 'digital-logistics-wms-tms.webp',
    badge: '스마트 물류',
    title: '디지털 물류 전환',
    subtitle: 'WMS와 TMS 도입이 바꾸는 물류 현장',
    points: [
      '바코드·RFID 기반 입출고 오류율 제로화',
      '실시간 차량 위치 관제 및 다구간 배차 최적화',
      '물류 데이터 실시간 분석을 통한 원가 절감'
    ],
    themeColor: '#8b5cf6'
  },
  {
    id: '53098f28-f4e7-49d3-9fc9-f866c2ba5a61',
    filename: 'warehouse-safety-management.webp',
    badge: '안전보건',
    title: '물류센터 안전관리',
    subtitle: '중대재해처벌법 시대, 현장 필수 대응 지침',
    points: [
      '지게차-작업자 동선 분리 및 스마트 안전센서',
      '정기 시설물 점검 및 실무자 안전 교육 강화',
      '현장 밀착형 비상 대응 매뉴얼 및 관리 체계'
    ],
    themeColor: '#f97316'
  },
  {
    id: 'd206417e-2592-4035-b33b-1662bf3d933b',
    filename: 'cost-reduction-guide.webp',
    badge: '비용 절감',
    title: '물류 비용 절감 가이드',
    subtitle: '중소기업을 위한 실전 원가 절감 5대 전략',
    points: [
      '화물 통합 및 공동 물류를 통한 운송비 절감',
      '재고 회전율 최적화로 창고 보관료 최소화',
      '고정 물류비의 변동비화 (전문 3PL 아웃소싱)'
    ],
    themeColor: '#eab308'
  },
  {
    id: 'f25b65a9-89f1-4630-b94f-81d8108f394d',
    filename: 'regional-logistics-hub.webp',
    badge: '거점 전략',
    title: '지역 물류 허브의 부상',
    subtitle: '수도권 집중에서 전국 분산 거점 시대로',
    points: [
      '영남·호남·중부권역 지역 거점 물류 인프라 확대',
      '전국 당일·익일 권역별 직송 배송망 구축',
      '물류 이동 동선 단축으로 탄소 및 운임 절감'
    ],
    themeColor: '#6366f1'
  },
  {
    id: '179cd6a3-78dc-49ae-8bff-5a27fc16d443',
    filename: 'logistics-market-outlook-2026.webp',
    badge: '시장 분석',
    title: '2026 하반기 물류 전망',
    subtitle: '화주와 물류기업이 주목해야 할 4대 핵심 흐름',
    points: [
      '경기 흐름과 연계된 유연한 3PL 물류 수요 증가',
      '화물 운송 시장 규제 및 안전운임 제도 동향',
      '자동화 설비 투자 확대와 스마트 물류 가속'
    ],
    themeColor: '#0284c7'
  },
  {
    id: 'eda292ca-c47b-4a72-a6de-6662077875c1',
    filename: 'fulfillment-automation-robot.webp',
    badge: '미래 기술',
    title: '풀필먼트 로봇 자동화',
    subtitle: '로봇과 사람이 함께 일하는 스마트 물류센터',
    points: [
      'AGV / AMR 자율주행 이송 로봇 현장 도입',
      '피킹 및 분류 자동화로 처리 속도 3배 향상',
      '작업자 피로도 경감 및 고정밀 재고 관리'
    ],
    themeColor: '#ec4899'
  }
];

function getHtml(item) {
  const pointsHtml = item.points.map(p => `
    <div style="background: rgba(255, 255, 255, 0.08); border-left: 6px solid ${item.themeColor}; padding: 18px 24px; border-radius: 12px; margin-bottom: 14px; font-size: 26px; font-weight: 600; color: #f8fafc; display: flex; align-items: center; gap: 14px; backdrop-filter: blur(8px); box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
      <span style="color: ${item.themeColor}; font-weight: 900; font-size: 28px;">✔</span> ${p}
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1080px;
    height: 720px;
    background: radial-gradient(circle at 12% 18%, #172554 0%, #071044 55%, #03071e 100%);
    font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Malgun Gothic', 'Noto Sans KR', sans-serif;
    color: #ffffff;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 60px 70px;
    border: 3px solid rgba(255, 255, 255, 0.12);
    position: relative;
    overflow: hidden;
  }
  .grid-bg {
    position: absolute;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
  }
  .glow {
    position: absolute;
    width: 400px;
    height: 400px;
    top: -150px;
    right: -100px;
    background: radial-gradient(circle, ${item.themeColor}33 0%, transparent 70%);
    pointer-events: none;
  }
  .content { position: relative; z-index: 1; }
  .badge {
    display: inline-block;
    background: ${item.themeColor};
    color: #ffffff;
    font-size: 20px;
    font-weight: 800;
    padding: 9px 24px;
    border-radius: 999px;
    letter-spacing: 0.05em;
    box-shadow: 0 4px 16px ${item.themeColor}66;
  }
  .title {
    font-size: 50px;
    font-weight: 900;
    line-height: 1.25;
    color: #ffffff;
    margin-top: 20px;
    margin-bottom: 10px;
    letter-spacing: -0.03em;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }
  .subtitle {
    font-size: 24px;
    color: #94a3b8;
    margin-bottom: 26px;
    font-weight: 500;
  }
  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(255, 255, 255, 0.15);
    padding-top: 22px;
    font-size: 20px;
    color: #94a3b8;
    font-weight: 600;
    position: relative;
    z-index: 1;
  }
  .brand { color: #38bdf8; font-weight: 800; }
</style>
</head>
<body>
  <div class="grid-bg"></div>
  <div class="glow"></div>
  <div class="content">
    <div class="badge">${item.badge}</div>
    <div class="title">${item.title}</div>
    <div class="subtitle">${item.subtitle}</div>
  </div>
  <div class="content">
    ${pointsHtml}
  </div>
  <div class="footer">
    <span><span class="brand">재경로지스｜물류</span> 정보 및 동향 리포트</span>
    <span>jeakyung.com</span>
  </div>
</body>
</html>`;
}

async function run() {
  const targetDir1 = path.join(__dirname, '../assets/articles');
  const targetDir2 = path.join(__dirname, '../source/public/images/articles');
  if (!fs.existsSync(targetDir1)) fs.mkdirSync(targetDir1, { recursive: true });
  if (!fs.existsSync(targetDir2)) fs.mkdirSync(targetDir2, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 720 });
  const cdp = await page.context().newCDPSession(page);

  for (const item of ARTICLES) {
    console.log(`[생성 중] ${item.filename} - ${item.title}`);
    await page.setContent(getHtml(item));
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'webp', quality: 90 });
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(path.join(targetDir1, item.filename), buffer);
    fs.writeFileSync(path.join(targetDir2, item.filename), buffer);
  }

  await browser.close();
  console.log('✔ 9개 WebP 썸네일 생성 완료!');
}

run().catch(err => {
  console.error('실패:', err);
  process.exit(1);
});
