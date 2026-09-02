import Brand from '../common/Brand.jsx';
import {
  CONSULTATION_URL,
  footerLinksByPage,
  WORK_SYSTEM_URL,
} from '../../data/navigation.js';

export default function PublicFooter({ page }) {
  const links = footerLinksByPage[page];
  const isPrivacy = page === 'privacy';
  const currentYear = new Date().getFullYear();

  return (
    <div className="content-width">
      <div className="footer-main">
        <div className="footer-company">
          <Brand href={links.home} placement="footer" />
          <p className="footer-company-name">유한회사 재경로지스</p>
          <address>광주광역시 광산구 앰코로 35, 245호<br />(쌍암동, 폭스존)</address>
          <p className="footer-contact">
            <a href="tel:07080984559">070-8098-4559</a>
            <span>·</span>
            <a href="mailto:contact@jeakyung.com">contact@jeakyung.com</a>
          </p>
        </div>
        <div className="footer-nav">
          <div>
            <p>Explore</p>
            <a href={links.about}>회사 소개</a>
            <a href={links.services}>서비스</a>
            <a href={links.location}>찾아오시는 길</a>
          </div>
          <div>
            <p>Support</p>
            <a href={links.guide}>상담 준비</a>
            <a href={links.faq}>FAQ</a>
            <a
              className="footer-work-link"
              href={WORK_SYSTEM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="그룹웨어와 메일 접속, 새 창"
            >
              🔐 그룹웨어 | 메일 ↗
            </a>
            <a
              href={CONSULTATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="빠른 상담하기, 카카오톡 채널 새 창"
            >
              빠른 상담하기 ↗
            </a>
          </div>
          <div>
            <p>Policy</p>
            <a
              className="policy-link"
              href={links.privacy}
              aria-current={isPrivacy ? 'page' : undefined}
            >
              개인정보처리방침
            </a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>본사 062-952-9794 · Fax 062-962-9795</p>
        <p>© <span id="current-year">{currentYear}</span> Jaekyung.com. All rights reserved.</p>
      </div>
    </div>
  );
}
