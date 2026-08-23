export default function GuideSection() {
  return (
    <div className="content-width">
      <div className="section-heading split-heading reveal">
        <div>
          <span className="eyebrow"><i /> Before Consulting</span>
          <h2 id="guide-title">더 구체적인 상담을 위한<br />네 가지 준비 항목</h2>
        </div>
        <p>정해진 답이 없어도 괜찮습니다. 현재 상황과 필요한 범위를 아는 만큼 정리하면 상담 준비에 도움이 됩니다.</p>
      </div>

      <ol className="guide-steps">
        <li className="reveal"><div className="step-marker"><span>01</span><i /></div><h3>현재 운영 환경</h3><p>취급 상품, 주문 또는 출고 환경 등 현재 운영 상황을 정리합니다.</p></li>
        <li className="reveal"><div className="step-marker"><span>02</span><i /></div><h3>해결할 물류 과제</h3><p>물류대행, 운송, 보관 또는 운영 개선 중 우선 해결할 문제를 확인합니다.</p></li>
        <li className="reveal"><div className="step-marker"><span>03</span><i /></div><h3>필요한 서비스 범위</h3><p>단일 서비스 또는 여러 물류 영역의 연계가 필요한지 살펴봅니다.</p></li>
        <li className="reveal"><div className="step-marker"><span>04</span><i /></div><h3>상담 목표</h3><p>서비스 가능 여부, 적용 범위, 견적 등 확인하고 싶은 내용을 정리합니다.</p></li>
      </ol>
    </div>
  );
}
