export default function ContactSection() {
  return (
    <div className="content-width contact-card reveal">
      <div className="contact-copy">
        <span className="eyebrow eyebrow-light"><i /> Start a Conversation</span>
        <h2 id="contact-title">우리 회사에 필요한 물류,<br />함께 이야기해 보세요.</h2>
        <p>관심 서비스와 현재 물류 과제를 정리해 주세요.<br />재경물류 카카오톡 채널에서 상담을 시작할 수 있습니다.</p>
        <a
          className="button button-primary contact-button kakao-cta kakao-cta-primary"
          href="https://pf.kakao.com/_xgrFxhn/chat"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="빠른 상담하기, 카카오톡 채널 새 창"
        >
          <span className="kakao-cta-label">빠른 상담하기</span>
          <span className="kakao-cta-arrow" aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="contact-checklist" aria-label="상담 전 준비 항목">
        <p>상담 전 준비하면 좋은 정보</p>
        <ul>
          <li><span>01</span> 관심 있는 서비스</li>
          <li><span>02</span> 취급 상품과 운영 환경</li>
          <li><span>03</span> 해결하려는 물류 과제</li>
          <li><span>04</span> 확인하고 싶은 내용</li>
        </ul>
      </div>
    </div>
  );
}
