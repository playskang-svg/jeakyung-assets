import { serviceListHref } from '../../data/services.js';

// 세 칸 모두 눌러 볼 수 있다 — 아래 서비스 영역의 그 게시판으로 곧장
// 이어진다. 03번은 세 서비스를 한꺼번에 가리키므로 한 곳으로 보낼 수
// 없어, 같은 화면의 서비스 전체 영역(#services)으로 스크롤한다.
export default function CoreValues() {
  return (
    <>
      <a className="value-card reveal" href={serviceListHref('3pl')}>
        <span className="card-number">01</span>
        <h3>운영을 잇는 3PL</h3>
        <p>입고, 보관, 주문 처리와 출고까지 비즈니스에 필요한 물류대행 범위를 함께 살펴봅니다.</p>
      </a>
      <a className="value-card reveal" href={serviceListHref('fresh')}>
        <span className="card-number">02</span>
        <h3>신선식품 풀필먼트</h3>
        <p>신선식품의 특성과 운영 환경을 고려해 필요한 보관과 풀필먼트 영역을 확인합니다.</p>
      </a>
      <a className="value-card reveal" href="#services">
        <span className="card-number">03</span>
        <h3>연결되는 물류 역량</h3>
        <p>기업운송, 보관물류와 물류컨설팅을 유기적으로 연결해 필요한 범위를 찾을 수 있습니다.</p>
      </a>
    </>
  );
}
