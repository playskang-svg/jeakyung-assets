import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import PublicFooter from '../components/layout/PublicFooter.jsx';
import PublicHeader from '../components/layout/PublicHeader.jsx';
import HomePage from '../pages/HomePage.jsx';
import { mountPublicPopupLayer } from '../../shared/popup/mountPublicPopupLayer.jsx';

const header = document.getElementById('header');
const main = document.getElementById('main-content');
const footer = document.querySelector('.site-footer');

if (header) {
  const headerRoot = createRoot(header);
  flushSync(() => headerRoot.render(<PublicHeader page="home" />));
}

if (main) {
  const mainRoot = createRoot(main);
  flushSync(() => mainRoot.render(<HomePage />));
}

if (footer) {
  const footerRoot = createRoot(footer);
  flushSync(() => footerRoot.render(<PublicFooter page="home" />));
}

// 관리자가 팝업 문서를 "공개 사이트 · 홈"으로 배포하면 로그인 없이도 보이게 한다.
mountPublicPopupLayer('public_home');
