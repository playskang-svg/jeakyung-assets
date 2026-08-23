import Brand from '../common/Brand.jsx';
import {
  CONSULTATION_URL,
  navigationByPage,
  WORK_SYSTEM_URL,
} from '../../data/navigation.js';
import useHeaderNavigation from '../../hooks/useHeaderNavigation.js';
import useSectionNavigation from '../../hooks/useSectionNavigation.js';

function WorkSystemIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
      <path d="M8 5V3h8v2" />
    </svg>
  );
}

function WorkSystemLink({ mobile = false, onClick }) {
  return (
    <a
      className={mobile ? 'mobile-work-link' : 'work-system-link'}
      href={WORK_SYSTEM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="그룹웨어와 메일 접속, 새 창"
      onClick={onClick}
    >
      <WorkSystemIcon />
      <span>그룹웨어 | 메일</span>
      {mobile && <i aria-hidden="true">↗</i>}
    </a>
  );
}

export default function PublicHeader({ page }) {
  const navigation = navigationByPage[page];
  const homeHref = page === 'home' ? '#top' : '../';
  const activeHref = useSectionNavigation(page, navigation);
  const {
    closeMenu,
    isMenuOpen,
    menuButtonRef,
    mobileNavigationRef,
    toggleMenu,
  } = useHeaderNavigation();

  return (
    <>
      <div className="header-inner">
        <Brand href={homeHref} placement="header" />

        <nav className="desktop-nav" aria-label="주요 메뉴">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={activeHref === item.href ? 'active' : undefined}
              aria-current={activeHref === item.href ? 'location' : undefined}
            >
              {item.label}
            </a>
          ))}
          <WorkSystemLink />
        </nav>

        <a
          className="header-cta external-cta"
          href={CONSULTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="빠른 상담하기, 카카오톡 채널 새 창"
        >
          빠른 상담하기
        </a>

        <button
          ref={menuButtonRef}
          className="menu-button"
          type="button"
          aria-label={isMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          aria-controls="mobile-navigation"
          aria-expanded={isMenuOpen}
          onClick={toggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <nav
        ref={mobileNavigationRef}
        className="mobile-nav"
        id="mobile-navigation"
        aria-label="모바일 메뉴"
        hidden={!isMenuOpen}
      >
        {navigation.map((item) => (
          <a key={item.href} href={item.href} onClick={() => closeMenu()}>{item.label}</a>
        ))}
        <WorkSystemLink mobile onClick={() => closeMenu()} />
        <a
          className="mobile-nav-cta kakao-cta"
          href={CONSULTATION_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="빠른 상담하기, 카카오톡 채널 새 창"
          onClick={() => closeMenu()}
        >
          <span className="kakao-cta-label">빠른 상담하기</span>
          <span className="kakao-cta-arrow" aria-hidden="true">↗</span>
        </a>
      </nav>
    </>
  );
}
