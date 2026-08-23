export default function AudienceSection() {
  return (
    <div className="content-width audience-layout">
      <div className="audience-copy reveal">
        <span className="eyebrow"><i /> For Your Business</span>
        <h2 id="audience-title">지금 겪고 있는<br />물류 과제는 무엇인가요?</h2>
        <p>업종과 운영 환경에 따라 필요한 물류의 범위는 달라집니다. 가장 가까운 상황부터 확인해 보세요.</p>
        <a className="text-link" href="#guide">상담 준비 순서 확인하기 <span aria-hidden="true">→</span></a>
      </div>

      <div className="audience-list">
        <article className="audience-item reveal">
          <span>01</span>
          <div><h3>물류 운영을 맡기고 싶은 기업</h3><p>입고부터 출고까지 3PL 물류대행의 범위를 확인하고 싶은 경우</p></div>
          <i aria-hidden="true">↗</i>
        </article>
        <article className="audience-item reveal">
          <span>02</span>
          <div><h3>신선식품 유통 기업</h3><p>신선식품의 보관과 주문 처리, 출고 환경을 함께 검토해야 하는 경우</p></div>
          <i aria-hidden="true">↗</i>
        </article>
        <article className="audience-item reveal">
          <span>03</span>
          <div><h3>물류·SCM·운영 담당자</h3><p>기업운송과 보관물류를 안정적으로 연결할 방법을 찾는 경우</p></div>
          <i aria-hidden="true">↗</i>
        </article>
        <article className="audience-item reveal">
          <span>04</span>
          <div><h3>물류 개선이 필요한 기업</h3><p>현재 운영을 점검하고 적합한 물류 개선 방향을 찾고 싶은 경우</p></div>
          <i aria-hidden="true">↗</i>
        </article>
      </div>
    </div>
  );
}
