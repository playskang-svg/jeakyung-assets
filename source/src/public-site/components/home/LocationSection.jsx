const headquartersMapUrl = 'https://www.google.com/maps/search/?api=1&query=%EA%B4%91%EC%A3%BC%EA%B4%91%EC%97%AD%EC%8B%9C%20%EA%B4%91%EC%82%B0%EA%B5%AC%20%EC%95%B0%EC%BD%94%EB%A1%9C%2035%20245%ED%98%B8';
const logisticsOfficeMapUrl = 'https://www.google.com/maps/search/?api=1&query=%EA%B2%BD%EA%B8%B0%EB%8F%84+%ED%8F%89%ED%83%9D%EC%8B%9C+%EB%B9%84%EC%A0%842%EB%A1%9C+79';
const yeosuBranchMapUrl = 'https://www.google.com/maps/search/?api=1&query=%EC%A0%84%EB%82%A8+%EC%97%AC%EC%88%98%EC%8B%9C+%EC%97%AC%EC%88%98%EC%82%B0%EB%8B%A8%EB%A1%9C+140+%EB%82%B4%ED%8A%B8%EB%9F%AD%ED%95%98%EC%9A%B0%EC%8A%A4+105%ED%98%B8';

function LocationPinIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z" />
      <circle cx={12} cy={9} r={2.5} />
    </svg>
  );
}

export default function LocationSection() {
  return (
    <>
      <div className="location-info reveal">
        <span className="eyebrow"><i /> Location</span>
        <h2 id="location-title">찾아오시는 길</h2>
        <p className="location-name">유한회사 재경로지스 본사</p>
        <address>광주광역시 광산구 앰코로 35,<br />245호(쌍암동, 폭스존)</address>
        <dl>
          <div><dt>대표전화</dt><dd><a href="tel:07080984559">070-8098-4559</a></dd></div>
          <div><dt>본사전화</dt><dd><a href="tel:0629529794">062-952-9794</a></dd></div>
          <div><dt>이메일</dt><dd><a href="mailto:contact@jeakyung.com">contact@jeakyung.com</a></dd></div>
        </dl>
        <a
          className="button location-button"
          href={headquartersMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="재경로지스 본사 위치를 Google 지도에서 보기, 새 창"
        >
          Google 지도에서 보기 <span aria-hidden="true">↗</span>
        </a>
      </div>

      <a
        className="map-preview reveal"
        href={headquartersMapUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="재경로지스 본사 위치를 Google 지도에서 보기, 새 창"
      >
        <span className="map-road road-one" aria-hidden="true" />
        <span className="map-road road-two" aria-hidden="true" />
        <span className="map-road road-three" aria-hidden="true" />
        <span className="map-pin" aria-hidden="true"><i /></span>
        <span className="map-label"><strong>재경로지스 본사</strong><small>Google 지도에서 길찾기</small></span>
      </a>

      <div className="location-sites" aria-label="추가 사업장 위치">
        <article className="location-site-card reveal">
          <div className="location-site-number" aria-hidden="true">02</div>
          <div className="location-site-content">
            <span className="location-site-type">Logistics Office</span>
            <h3>유한회사 재경물류</h3>
            <address>경기도 평택시 비전2로 79</address>
            <a
              className="location-site-link"
              href={logisticsOfficeMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="유한회사 재경물류 위치를 Google 지도에서 보기, 새 창"
            >
              <LocationPinIcon />
              Google 지도 바로가기 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>

        <article className="location-site-card reveal">
          <div className="location-site-number" aria-hidden="true">03</div>
          <div className="location-site-content">
            <span className="location-site-type">Yeosu Branch</span>
            <h3>재경로지스 여수지사</h3>
            <address>전남 여수시 여수산단로 140<br />내트럭하우스 105호(주삼동 1020)</address>
            <p className="location-site-contact"><a href="tel:0616919795">061-691-9795</a><span>·</span>Fax 061-691-9796</p>
            <a
              className="location-site-link"
              href={yeosuBranchMapUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="재경로지스 여수지사 위치를 Google 지도에서 보기, 새 창"
            >
              <LocationPinIcon />
              Google 지도 바로가기 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </article>
      </div>
    </>
  );
}
