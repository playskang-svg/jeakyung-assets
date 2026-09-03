import { useState } from 'react';

import { COMPANY_LOGO_URL } from '../config/branding.js';

// 회사 로고 표시. 로고가 우리 저장소에 없고 바깥 주소를 가리키므로, 안 뜨는
// 경우가 생긴다. 그때는 원래 쓰던 글자 표시로 돌아간다 — 빈 네모가 남는 것보다
// 낫다.
export default function CompanyMark({ className = '', letter = 'J' }) {
  const [failed, setFailed] = useState(false);
  if (failed || !COMPANY_LOGO_URL) {
    return <span className={className} aria-hidden="true">{letter}</span>;
  }
  return (
    <span className={`${className} has-logo`.trim()} aria-hidden="true">
      <img src={COMPANY_LOGO_URL} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </span>
  );
}
