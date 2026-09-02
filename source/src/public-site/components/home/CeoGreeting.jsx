import ceoPortraitUrl from '../../../../public/images/ceo-yeom-dalseong.webp';

export default function CeoGreeting() {
  return (
    <>
      <div className="ceo-portrait">
        <img
          src={ceoPortraitUrl}
          width={821}
          height={1024}
          alt="재경로지스&물류 대표이사 염달성"
          loading="lazy"
        />
      </div>
      <div className="ceo-message">
        <span className="eyebrow"><i /> CEO Message</span>
        <h2 id="about-title">현장을 이해하는 물류로<br />고객의 성장을 잇겠습니다.</h2>
        <p>안녕하세요. 재경로지스&물류 대표이사 염달성입니다. 재경은 고객의 운영이 더 안정적으로 이어지도록 현장에서 답을 찾겠습니다. 3PL 물류대행과 신선식품 풀필먼트를 중심으로 꼭 필요한 물류 해답을 함께 만들어가겠습니다. 감사합니다.</p>
        <p className="ceo-signature"><strong>염달성</strong><span>재경로지스&물류 대표이사</span></p>
      </div>
    </>
  );
}
