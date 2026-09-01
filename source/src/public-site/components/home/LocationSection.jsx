// 사업장 위치. 예전에는 본사만 커다란 가짜 지도 그림을 차지하고 나머지는 작은
// 카드였는데, 그림이 실제 지도가 아니라 아무 정보도 주지 못했다. 지금은 세 곳을
// 같은 크기의 카드로 두고, 길찾기는 카카오맵으로 바로 넘긴다(휴대폰에서는 앱이 열린다).
const kakaoMapUrl = (query) => `https://map.kakao.com/link/search/${encodeURIComponent(query)}`;

const SITES = [
  {
    type: 'Headquarters',
    name: '유한회사 재경로지스 본사',
    address: ['광주광역시 광산구 앰코로 35', '245호 (쌍암동, 폭스존)'],
    query: '광주광역시 광산구 앰코로 35',
    contacts: [
      { label: '대표전화', value: '070-8098-4559', href: 'tel:07080984559' },
      { label: '본사전화', value: '062-952-9794', href: 'tel:0629529794' },
      { label: '이메일', value: 'contact@jeakyung.com', href: 'mailto:contact@jeakyung.com' },
    ],
  },
  {
    type: 'Logistics Office',
    name: '유한회사 재경물류',
    address: ['경기도 평택시 비전2로 79'],
    query: '경기도 평택시 비전2로 79',
    contacts: [],
  },
  {
    type: 'Yeosu Branch',
    name: '재경로지스 여수지사',
    address: ['전남 여수시 여수산단로 140', '내트럭하우스 105호 (주삼동 1020)'],
    query: '전남 여수시 여수산단로 140',
    contacts: [
      { label: '전화', value: '061-691-9795', href: 'tel:0616919795' },
      { label: '팩스', value: '061-691-9796' },
    ],
  },
];

function PinIcon() {
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
      <div className="loc-head reveal">
        <span className="eyebrow"><i /> Location</span>
        <h2 id="location-title">찾아오시는 길</h2>
        <p>광주 본사와 평택·여수 사업장에서 고객 운영을 지원합니다.</p>
      </div>

      <ul className="loc-grid">
        {SITES.map((site) => (
          <li key={site.name}>
            <article className="loc-card reveal">
              <span className="loc-card-type">{site.type}</span>
              <h3>{site.name}</h3>
              <address>
                {site.address.map((line, index) => (
                  <span key={line}>{line}{index < site.address.length - 1 && <br />}</span>
                ))}
              </address>

              {site.contacts.length > 0 && (
                <dl className="loc-card-contacts">
                  {site.contacts.map((contact) => (
                    <div key={contact.label}>
                      <dt>{contact.label}</dt>
                      <dd>{contact.href ? <a href={contact.href}>{contact.value}</a> : contact.value}</dd>
                    </div>
                  ))}
                </dl>
              )}

              <a
                className="loc-card-link"
                href={kakaoMapUrl(site.query)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${site.name} 카카오맵에서 길찾기, 새 창`}
              >
                <PinIcon />
                카카오맵 길찾기
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
