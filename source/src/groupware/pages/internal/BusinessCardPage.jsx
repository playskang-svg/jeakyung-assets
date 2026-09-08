import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import CompanyMark from '../../components/CompanyMark.jsx';

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
  name: '재경로지스｜물류',
  tagline: 'Beyond Logistics, Better Solutions.',
  site: 'jeakyung.com',
};

const STORAGE_KEY = 'groupware:business-card';

export default function BusinessCardPage() {
  const auth = useAuth();
  const profile = auth.profile ?? {};

  const [card, setCard] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      name: profile.display_name || profile.full_name || profile.name || '',
      title: profile.job_title_name || '',
      department: profile.department_name || '',
      mobile: profile.mobile_phone || '',
      office: profile.office_phone || '',
      email: profile.company_email || '',
      address: profile.work_location || '',
    };
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const patch = (key, value) => setCard((current) => ({ ...current, [key]: value }));

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleEmailShare = () => {
    const subject = `[명함] ${COMPANY.name} ${card.name || ''} ${card.title || ''}`;
    const body = `[명함] ${COMPANY.name}
━━━━━━━━━━━━━━━━━━━━
• 이름: ${card.name || '-'}
• 소속: ${[card.department, card.title].filter(Boolean).join(' / ') || '-'}
• 휴대전화: ${card.mobile || '-'}
• 사무실: ${card.office || '-'}
• 이메일: ${card.email || '-'}
• 주소: ${card.address || '-'}
• 웹사이트: https://${COMPANY.site}
━━━━━━━━━━━━━━━━━━━━
Beyond Logistics, Better Solutions.`;

    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleKakaoShare = async () => {
    const shareText = `[명함] ${COMPANY.name}
${card.name || '이름'} ${[card.department, card.title].filter(Boolean).join(' · ')}
━━━━━━━━━━━━━━━━━━━━
• 휴대폰: ${card.mobile || '-'}
• 사무실: ${card.office || '-'}
• 이메일: ${card.email || '-'}
• 주소: ${card.address || '-'}
• 웹사이트: https://${COMPANY.site}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${COMPANY.name} ${card.name} 명함`,
          text: shareText,
          url: `https://${COMPANY.site}`,
        });
        return;
      } catch {
        // user cancelled or share failed, fallback to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      setShareToast('카카오톡 공유용 명함 내용이 복사되었습니다. 대화방에 붙여넣기(Cmd/Ctrl+V)하세요!');
      setTimeout(() => setShareToast(''), 4000);
    } catch {
      alert('클립보드 복사에 실패했습니다.');
    }
  };

  return (
    <article className="gw-page gw-card-page" aria-labelledby="business-card-title">
      <header className="gw-page-header">
        <div>
          <h1 id="business-card-title">명함관리</h1>
          <p>명함에 올릴 정보를 설정하고 보관합니다.</p>
        </div>
        <div className="gw-admin-actions">
          <Link className="gw-secondary-button" to="/profile">내 프로필 편집</Link>
        </div>
      </header>

      {savedSuccess && (
        <div className="gw-notice gw-notice--success" role="status" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
          ✓ 명함 정보가 성공적으로 저장 및 보관되었습니다.
        </div>
      )}

      {shareToast && (
        <div className="gw-notice gw-notice--success" role="status" style={{ background: '#fef3c7', borderColor: '#fde68a', color: '#92400e' }}>
          ✓ {shareToast}
        </div>
      )}

      <div className="gw-card-layout">
        <section className="gw-card-preview-wrap" aria-label="명함 미리보기">
          <div className="gw-card-preview">
            <div className="gw-card-preview-top">
              <CompanyMark className="gw-card-mark" />
              <div>
                <strong>{COMPANY.name}</strong>
                <span>{COMPANY.tagline}</span>
              </div>
            </div>

            <hr className="gw-card-divider" />

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
          <p className="gw-field-hint">실제 인쇄 비율(90×50mm, 1.5배 확대) 미리보기입니다.</p>

          <div className="gw-card-share-actions">
            <button type="button" className="gw-share-btn gw-share-btn--kakao" onClick={handleKakaoShare} title="카카오톡으로 명함 공유">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 3c-5.523 0-10 3.582-10 8 0 2.868 1.895 5.378 4.75 6.784l-.84 3.084c-.113.414.155.83.567.83.15 0 .302-.055.424-.162l3.636-2.457c.478.077.967.121 1.463.121 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
              </svg>
              <span>카카오톡 공유</span>
            </button>
            <button type="button" className="gw-share-btn gw-share-btn--email" onClick={handleEmailShare} title="이메일로 명함 공유">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span>이메일 공유</span>
            </button>
          </div>
        </section>

        <section className="gw-card-form" aria-label="명함 값">
          <h2>명함에 올릴 값</h2>
          {FIELDS.map(([key, label]) => (
            <label className="gw-field" key={key}>
              <span>{label}</span>
              <input value={card[key]} maxLength={60} onChange={(event) => patch(key, event.target.value)} />
            </label>
          ))}
          <div className="gw-admin-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" className="gw-primary-button" onClick={handleSave}>
              명함 정보 저장
            </button>
            {savedSuccess && <span style={{ color: '#059669', fontSize: '13px', fontWeight: 600 }}>저장 완료</span>}
          </div>
        </section>
      </div>
    </article>
  );
}
