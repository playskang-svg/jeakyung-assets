import { SERVICE_NAMES, serviceListHref } from '../../data/services.js';
import ServiceColumns from './ServiceColumns.jsx';

// 카드 아래 링크. 예전에는 카카오톡 상담으로 곧장 보냈지만, 상담 버튼은
// 아래 문의 영역에 따로 있고 카드에서는 그 서비스의 글부터 읽는 편이
// 자연스러워 목록 페이지로 보낸다.
function ServiceMore({ serviceKey }) {
  return (
    <a
      className="service-more"
      href={serviceListHref(serviceKey)}
      data-service={SERVICE_NAMES[serviceKey]}
      aria-label={`${SERVICE_NAMES[serviceKey]} 자세히 보기`}
    >
      자세히 보기 <span aria-hidden="true">→</span>
    </a>
  );
}

export default function ServicesSection() {
  return (
    <div className="content-width">
      <div className="section-heading services-heading reveal">
        <div>
          <span className="eyebrow"><i /> Core Services</span>
          <h2 id="services-title">운영에 꼭 맞는<br />물류 서비스를 확인하세요.</h2>
        </div>
        <p>3PL 물류대행과 신선식품 풀필먼트를 중심으로 필요한 물류 범위를 함께 검토합니다.</p>
      </div>

      <div className="service-grid">
        <article className="service-card service-featured reveal">
          <div className="service-card-top">
            <span>01</span>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M9 33V16l15-8 15 8v17l-15 8-15-8Z" /><path d="m9 16 15 8 15-8M24 24v17M17 12l15 8" /></svg>
          </div>
          <div>
            <p className="service-label">Third-party logistics</p>
            <h3>3PL 물류대행</h3>
            <p>입고, 보관, 주문 처리와 출고까지 기업 운영에 필요한 물류 업무를 연결해 살펴봅니다.</p>
          </div>
          <ServiceColumns serviceKey="3pl" serviceName={SERVICE_NAMES['3pl']} mode="paged" />
          <ServiceMore serviceKey="3pl" />
        </article>

        <article className="service-card service-featured reveal">
          <div className="service-card-top">
            <span>02</span>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M13 38c14 0 23-9 23-27-14 0-23 9-23 27Z" /><path d="M13 38c5-10 11-16 23-27M12 17c-3 4-4 9-2 14" /></svg>
          </div>
          <div>
            <p className="service-label">Fresh food fulfillment</p>
            <h3>신선식품 풀필먼트</h3>
            <p>신선식품의 입고부터 보관, 주문 처리와 출고까지 필요한 풀필먼트 범위를 확인합니다.</p>
          </div>
          <ServiceColumns serviceKey="fresh" serviceName={SERVICE_NAMES.fresh} shape="round" mode="paged" />
          <ServiceMore serviceKey="fresh" />
        </article>

        <article className="service-card reveal">
          <div className="service-card-top">
            <span>03</span>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M5 14h24v22H5zM29 22h8l6 7v7H29z" /><circle cx="14" cy="37" r="4" /><circle cx="36" cy="37" r="4" /><path d="M10 21h12M10 27h8" /></svg>
          </div>
          <div>
            <p className="service-label">Corporate transport</p>
            <h3>기업운송</h3>
            <p>기업 화물의 특성과 운영 조건에 맞춰 필요한 운송 서비스 범위를 살펴봅니다.</p>
          </div>
          <ServiceColumns serviceKey="transport" serviceName={SERVICE_NAMES.transport} mode="paged" />
          <ServiceMore serviceKey="transport" />
        </article>

        <article className="service-card reveal">
          <div className="service-card-top">
            <span>04</span>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 18 24 8l17 10v22H7V18Z" /><path d="M15 40V25h18v15M19 30h10M19 35h10" /></svg>
          </div>
          <div>
            <p className="service-label">Storage logistics</p>
            <h3>보관물류</h3>
            <p>상품과 운영 환경에 필요한 보관 조건과 입출고 연계 범위를 확인합니다.</p>
          </div>
          <ServiceColumns serviceKey="storage" serviceName={SERVICE_NAMES.storage} mode="paged" />
          <ServiceMore serviceKey="storage" />
        </article>

        <article className="service-card reveal">
          <div className="service-card-top">
            <span>05</span>
            <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="8" width="34" height="26" rx="2" /><path d="M17 41h14M24 34v7M13 26l7-7 6 5 9-10" /></svg>
          </div>
          <div>
            <p className="service-label">Logistics consulting</p>
            <h3>물류컨설팅</h3>
            <p>현재 물류 운영을 진단하고 개선 방향과 필요한 서비스 범위를 함께 검토합니다.</p>
          </div>
          <ServiceColumns serviceKey="consulting" serviceName={SERVICE_NAMES.consulting} mode="paged" />
          <ServiceMore serviceKey="consulting" />
        </article>
      </div>
    </div>
  );
}
