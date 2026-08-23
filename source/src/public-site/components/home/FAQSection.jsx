export default function FAQSection() {
  return (
    <div className="content-width faq-layout">
      <div className="faq-heading reveal">
        <span className="eyebrow"><i /> Frequently Asked Questions</span>
        <h2 id="faq-title">서비스를 살펴보기 전<br />궁금한 내용을 확인하세요.</h2>
      </div>
      <div className="faq-list reveal">
        <details>
          <summary>어떤 물류 서비스를 확인할 수 있나요?<span aria-hidden="true" /></summary>
          <p>3PL 물류대행, 신선식품 풀필먼트, 기업운송, 보관물류와 물류컨설팅을 확인할 수 있습니다.</p>
        </details>
        <details>
          <summary>3PL 물류대행은 어떻게 상담하나요?<span aria-hidden="true" /></summary>
          <p>취급 상품, 현재 입출고 환경과 해결하려는 물류 과제를 정리한 뒤 재경물류 카카오톡 채널로 문의해 주세요.</p>
        </details>
        <details>
          <summary>신선식품 풀필먼트도 문의할 수 있나요?<span aria-hidden="true" /></summary>
          <p>신선식품의 보관과 주문 처리, 출고 등 필요한 범위를 정리해 상담할 수 있습니다. 실제 제공 범위와 조건은 상담을 통해 확인해 주세요.</p>
        </details>
        <details>
          <summary>여러 물류 영역을 함께 문의할 수 있나요?<span aria-hidden="true" /></summary>
          <p>기업운송, 보관물류와 컨설팅 등 필요한 서비스가 여러 개인 경우 우선순위와 상담 목표를 함께 정리해 문의할 수 있습니다.</p>
        </details>
      </div>
    </div>
  );
}
