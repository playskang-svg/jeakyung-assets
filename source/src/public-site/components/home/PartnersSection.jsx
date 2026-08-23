const PARTNER_COMPANIES = [
  '웰스토리',
  '현대그린푸드',
  '동원식품',
  'HL홀딩스',
  '현대홈쇼핑',
];

export default function PartnersSection() {
  return (
    <div className="content-width partners-layout">
      <div className="section-heading reveal">
        <span className="eyebrow"><i /> Our Partners</span>
        <h2 id="partners-title">신뢰할 수 있는<br />유통·리테일 파트너사</h2>
        <p>다양한 유통·식품 기업과 함께 안정적인 물류 운영을 이어가고 있습니다.</p>
      </div>

      <ul className="partners-list reveal" aria-label="협력사 목록">
        {PARTNER_COMPANIES.map((name) => (
          <li key={name}>
            <span>{name}</span>
          </li>
        ))}
      </ul>

      <p className="partners-note reveal">그 외에도 다양한 유통·리테일 파트너사와 함께하고 있습니다.</p>
    </div>
  );
}
