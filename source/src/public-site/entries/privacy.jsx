import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import PublicFooter from '../components/layout/PublicFooter.jsx';
import PublicHeader from '../components/layout/PublicHeader.jsx';
import PrivacyPolicyPage from '../pages/PrivacyPolicyPage.jsx';
import { mountPublicPopupLayer } from '../../shared/popup/mountPublicPopupLayer.jsx';

const header = document.getElementById('header');
const main = document.getElementById('main-content');
const footer = document.querySelector('.site-footer');

if (header) {
  const headerRoot = createRoot(header);
  flushSync(() => headerRoot.render(<PublicHeader page="privacy" />));
}

if (main) {
  const mainRoot = createRoot(main);
  flushSync(() => mainRoot.render(<PrivacyPolicyPage />));
}

if (footer) {
  const footerRoot = createRoot(footer);
  flushSync(() => footerRoot.render(<PublicFooter page="privacy" />));
}

mountPublicPopupLayer('public_privacy');
