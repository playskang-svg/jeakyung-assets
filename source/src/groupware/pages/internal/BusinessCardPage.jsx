import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';

// 명함 관리 — 첫 판.
//
// 아직 저장하지 않는다. 명함을 담을 표도, 저장 함수도 만들지 않았다. 지금은
// 어떤 값이 명함에 들어가고 어떻게 놓이는지 눈으로 보고 고르기 위한 화면이다.
// 값은 내 프로필에서 가져오고, 여기서 고친 것은 미리보기에만 반영된다.
//
// 다음에 할 일: business_cards 표와 저장/발행, 로고·QR, PDF 내보내기.
const FIELDS = [
  ['name', '이름'],
  ['title', '직책'],
  ['department', '부서'],
  ['mobile', '휴대전화'],
  ['office', '사무실 전화'],
  ['email', '이메일'],
  ['address', '주소'],
];

const COMPANY = {
  name: '재경로지스&물류',
  tagline: '3PL 물류 · 신선식품 풀필먼트',
  site: 'jeakyung.com',
};

export default function BusinessCardPage() {
  const auth = useAuth();
  const profile = auth.profile ?? {};
  const [card, setCard] = useState({
    name: profile.display_name || profile.full_name || profile.name || '',
    title: profile.job_title_name || '',
    department: profile.department_name || '',
    mobile: profile.mobile_phone || '',
    office: profile.office_phone || '',
    email: profile.company_email || '',
    address: profile.work_location || '',
  });
  const patch = (key, value) => setCard((current) => ({ ...current, [key]: value }));

  return (
    <article className="gw-page gw-card-page" aria-labelledby="business-card-title">
      <header className="gw-page-header">
        <div>
          <h1 id="business-card-title">명함관리</h1>
          <p>명함에 올릴 값을 고릅니다. 아직 저장되지 않습니다 — 배치를 먼저 정하는 중입니다.</p>
        </div>
        <div className="gw-admin-actions">
          <Link className="gw-secondary-button" to="/profile">내 프로필 편집</Link>
        </div>
      </header>

      <div className="gw-notice" role="status">
        지금은 <strong>미리보기</strong>만 됩니다. 저장·인쇄·발행은 다음에 붙입니다.
        값을 실제로 바꾸려면 <Link to="/profile">내 프로필</Link>에서 고쳐 주세요.
      </div>

      <div className="gw-card-layout">
        <section className="gw-card-preview-wrap" aria-label="명함 미리보기">
          <div className="gw-card-preview">
            <div className="gw-card-preview-top">
              <span className="gw-card-mark" aria-hidden="true">J</span>
              <div>
                <strong>{COMPANY.name}</strong>
                <span>{COMPANY.tagline}</span>
              </div>
            </div>
            <div className="gw-card-preview-name">
              <strong>{card.name || '이름'}</strong>
              <span>{[card.department, card.title].filter(Boolean).join(' · ') || '부서 · 직책'}</span>
            </div>
            <dl className="gw-card-preview-contact">
              {card.mobile && <div><dt>M</dt><dd>{card.mobile}</dd></div>}
              {card.office && <div><dt>T</dt><dd>{card.office}</dd></div>}
              {card.email && <div><dt>E</dt><dd>{card.email}</dd></div>}
              {card.address && <div><dt>A</dt><dd>{card.address}</dd></div>}
              <div><dt>W</dt><dd>{COMPANY.site}</dd></div>
            </dl>
          </div>
          <p className="gw-field-hint">실제 인쇄 비율(90×50mm)에 맞춘 미리보기입니다.</p>
        </section>

        <section className="gw-card-form" aria-label="명함 값">
          <h2>명함에 올릴 값</h2>
          {FIELDS.map(([key, label]) => (
            <label className="gw-field" key={key}>
              <span>{label}</span>
              <input value={card[key]} maxLength={60} onChange={(event) => patch(key, event.target.value)} />
            </label>
          ))}
          <div className="gw-admin-actions">
            <button type="button" className="gw-primary-button" disabled title="다음에 붙입니다">저장 (준비 중)</button>
          </div>
        </section>
      </div>
    </article>
  );
}
