import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import CompanyMark from '../../components/CompanyMark.jsx';
import { getProfilePhotoUrl } from '../../services/profileService.js';
import {
  romanizeKoreanName,
  translateDepartment,
  translateTitle,
  translateAddress,
} from '../../utils/cardTranslation.js';

const FRONT_FIELDS = [
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
  nameEn: 'JEAKYUNG LOGIS',
  tagline: 'Beyond Logistics, Better Solutions.',
  site: 'jeakyung.com',
};

const STORAGE_KEY = 'groupware:business-card';

// 벡터 약도 그래픽 컴포넌트 (선명한 SVG 고해상도 인포그래픽)
function CardMapGraphic() {
  return (
    <svg viewBox="0 0 450 106" width="100%" height="100%" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <rect width="450" height="106" fill="#f8fafc" />
      {/* 주변 랜드마크 블록 */}
      <rect x="18" y="10" width="80" height="34" rx="4" fill="#e2e8f0" opacity="0.65" />
      <text x="58" y="30" fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="600">배다리생태공원</text>
      
      <rect x="110" y="10" width="94" height="34" rx="4" fill="#e2e8f0" opacity="0.65" />
      <text x="157" y="30" fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="600">평택시청 방면</text>
      
      <rect x="340" y="10" width="94" height="34" rx="4" fill="#e2e8f0" opacity="0.65" />
      <text x="387" y="30" fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="600">안성IC 방면</text>

      {/* 메인 도로망 (가로 도로 - 비전2로) */}
      <line x1="0" y1="60" x2="450" y2="60" stroke="#cbd5e1" strokeWidth="18" />
      <line x1="0" y1="60" x2="450" y2="60" stroke="#ffffff" strokeWidth="2" strokeDasharray="8 6" />
      <text x="35" y="63" fontSize="9.5" fill="#475569" fontWeight="700">비전2로</text>

      {/* 세로 도로망 (교차로 - 비전사거리) */}
      <line x1="220" y1="0" x2="220" y2="106" stroke="#cbd5e1" strokeWidth="16" />
      <line x1="220" y1="0" x2="220" y2="106" stroke="#ffffff" strokeWidth="2" strokeDasharray="8 6" />
      <text x="226" y="22" fontSize="8.5" fill="#64748b" fontWeight="600">비전사거리</text>

      <line x1="330" y1="52" x2="330" y2="106" stroke="#e2e8f0" strokeWidth="10" />

      {/* 하단 편의시설 블록 */}
      <rect x="110" y="77" width="94" height="24" rx="4" fill="#edf2f7" />
      <text x="157" y="92" fontSize="8.5" fill="#94a3b8" textAnchor="middle">비전동 우체국</text>

      {/* 강조 목적지 건물: 재경 서울경기지사 (701호) */}
      <rect x="238" y="12" width="94" height="40" rx="6" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="1.5" />
      <circle cx="250" cy="26" r="4.5" fill="#60a5fa" />
      <circle cx="250" cy="26" r="2" fill="#ffffff" />
      <text x="285" y="27" fontSize="10" fill="#ffffff" fontWeight="700" textAnchor="middle">재경 서울경기지사</text>
      <text x="285" y="42" fontSize="8.5" fill="#93c5fd" textAnchor="middle">701호 본사직영</text>

      {/* 지점 위치 핀 점선 안내 */}
      <path d="M250 32 L250 51" stroke="#2563eb" strokeWidth="2" strokeDasharray="2 2" />
      <circle cx="250" cy="53" r="3.5" fill="#2563eb" />
    </svg>
  );
}

// 명함용 벡터 QR 코드 컴포넌트
function CardQrGraphic() {
  return (
    <div className="gw-card-qr-box">
      <svg viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="29" height="29" rx="3" fill="white"/>
        {/* 모서리 마커 */}
        <rect x="2" y="2" width="7" height="7" rx="1.5" fill="#0f172a"/>
        <rect x="3.5" y="3.5" width="4" height="4" rx="0.5" fill="white"/>
        <rect x="4.5" y="4.5" width="2" height="2" fill="#0f172a"/>
        
        <rect x="20" y="2" width="7" height="7" rx="1.5" fill="#0f172a"/>
        <rect x="21.5" y="3.5" width="4" height="4" rx="0.5" fill="white"/>
        <rect x="22.5" y="4.5" width="2" height="2" fill="#0f172a"/>
        
        <rect x="2" y="20" width="7" height="7" rx="1.5" fill="#0f172a"/>
        <rect x="3.5" y="21.5" width="4" height="4" rx="0.5" fill="white"/>
        <rect x="4.5" y="22.5" width="2" height="2" fill="#0f172a"/>
        
        {/* QR 패턴 도트 */}
        <rect x="11" y="3" width="2" height="2" fill="#0f172a"/>
        <rect x="14" y="2" width="2" height="2" fill="#0f172a"/>
        <rect x="16" y="4" width="2" height="2" fill="#0f172a"/>
        <rect x="11" y="7" width="2" height="2" fill="#0f172a"/>
        <rect x="15" y="8" width="2" height="2" fill="#0f172a"/>
        <rect x="3" y="11" width="2" height="2" fill="#0f172a"/>
        <rect x="7" y="12" width="2" height="2" fill="#0f172a"/>
        <rect x="11" y="11" width="2" height="2" fill="#0f172a"/>
        <rect x="13" y="13" width="2" height="2" fill="#0f172a"/>
        <rect x="17" y="11" width="2" height="2" fill="#0f172a"/>
        <rect x="21" y="12" width="2" height="2" fill="#0f172a"/>
        <rect x="25" y="10" width="2" height="2" fill="#0f172a"/>
        <rect x="5" y="15" width="2" height="2" fill="#0f172a"/>
        <rect x="9" y="16" width="2" height="2" fill="#0f172a"/>
        <rect x="12" y="17" width="2" height="2" fill="#0f172a"/>
        <rect x="15" y="15" width="2" height="2" fill="#0f172a"/>
        <rect x="19" y="16" width="2" height="2" fill="#0f172a"/>
        <rect x="24" y="14" width="2" height="2" fill="#0f172a"/>
        <rect x="11" y="21" width="2" height="2" fill="#0f172a"/>
        <rect x="14" y="23" width="2" height="2" fill="#0f172a"/>
        <rect x="17" y="20" width="2" height="2" fill="#0f172a"/>
        <rect x="12" y="25" width="2" height="2" fill="#0f172a"/>
        <rect x="21" y="22" width="2" height="2" fill="#0f172a"/>
        <rect x="24" y="24" width="2" height="2" fill="#0f172a"/>
      </svg>
      <span style={{ fontSize: '9px', color: '#64748b', fontWeight: 700, letterSpacing: '-0.02em' }}>SCAN CONTACT</span>
    </div>
  );
}

export default function BusinessCardPage() {
  const auth = useAuth();
  const profile = auth.profile ?? {};

  // Supabase 프로필에 등록된 프로필 사진 로드
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  useEffect(() => {
    let active = true;
    if (profile?.profile_photo_path) {
      getProfilePhotoUrl(profile.profile_photo_path)
        .then((url) => {
          if (active && url) {
            setProfilePhotoUrl(url);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [profile?.profile_photo_path]);

  // 카드 상태 초기화 (localStorage 데이터가 있으면 복원, 없으면 기본값)
  const [card, setCard] = useState(() => {
    const initial = {
      // 앞면 정보
      name: profile.display_name || profile.full_name || profile.name || '',
      title: profile.job_title_name || '',
      department: profile.department_name || '',
      mobile: profile.mobile_phone || '',
      office: profile.office_phone || '',
      email: profile.company_email || '',
      address: profile.work_location || '',
      photoUrl: '', // 사용자가 명함 전용으로 등록하거나 선택한 사진

      // 뒷면 양식 선택: 'english' | 'map' | 'slogan'
      backType: 'english',

      // 뒷면 — 영문 명함
      enName: '',
      enTitle: '',
      enDepartment: '',
      enCompanyName: 'JEAKYUNG LOGIS',
      enTagline: 'Beyond Logistics, Better Solutions.',
      enAddress: '',

      // 뒷면 — 회사 약도
      mapLocationName: '재경로지스 서울경기지사',
      mapAddress: profile.work_location || '경기도 평택시 비전2로 79 (비전동) 701호 서울경기지사',
      mapSubway: '1호선 평택역 1번 출구 버스 15분 / 지제역 SRT',
      mapParking: '건물 지하 주차장 완비 / 안성IC 10분',

      // 뒷면 — 슬로건 & 비전
      sloganMain: 'Beyond Logistics, Better Solutions.',
      sloganSub: '신뢰와 혁신을 바탕으로 최적화된 운송 솔루션을 제공하며, 고객과 함께 성장하는 스마트 물류 파트너',
      sloganValues: '신속 정시 배송, 안전 최우선, 스마트 물류 시스템, 고객 맞춤 솔루션',
      sloganFoot: '고객지원 1588-0000 · contact@jeakyung.com',
    };

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...initial, ...JSON.parse(saved) };
      }
    } catch {
      // ignore JSON parse error
    }
    return initial;
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [shareToast, setShareToast] = useState('');

  const patch = (key, value) => setCard((current) => ({ ...current, [key]: value }));

  // 프로필 사진 우선순위: 명함 전용 사진(photoUrl) > 프로필 기본 사진(profilePhotoUrl)
  const activePhotoUrl = card.photoUrl || profilePhotoUrl;

  // 로컬 사진 파일 업로드 핸들러
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      patch('photoUrl', event.target.result);
    };
    reader.readAsDataURL(file);
  };

  // 등록된 기본 프로필 사진으로 복원
  const handleUseProfilePhoto = () => {
    patch('photoUrl', profilePhotoUrl);
  };

  // 사진 제거
  const handleClearPhoto = () => {
    patch('photoUrl', '');
  };

  // 한글 입력값을 영문으로 자동 변환 (원클릭 자동 채우기)
  const handleAutoTranslate = () => {
    const enName = romanizeKoreanName(card.name);
    const enTitle = translateTitle(card.title);
    const enDept = translateDepartment(card.department);
    const enAddr = translateAddress(card.address);

    setCard((prev) => ({
      ...prev,
      enName: enName || prev.enName,
      enTitle: enTitle || prev.enTitle,
      enDepartment: enDept || prev.enDepartment,
      enAddress: enAddr || prev.enAddress,
      enCompanyName: prev.enCompanyName || COMPANY.nameEn,
      enTagline: prev.enTagline || COMPANY.tagline,
    }));
  };

  // 저장 핸들러
  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(card));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch {
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  // 이메일 공유 핸들러
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

  // 카카오톡 / 클립보드 공유 핸들러
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
          <p>앞면과 뒷면 정보를 설정하고 보관합니다. 등록된 프로필 사진 및 3가지 뒷면 양식을 지원합니다.</p>
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
        {/* ========================================================================= */}
        {/* 좌측: 명함 앞면 / 뒷면 미리보기 영역 */}
        {/* ========================================================================= */}
        <section className="gw-card-preview-wrap" aria-label="명함 미리보기">
          {/* 1. 명함 앞면 (라운드 외곽 + 3D 입체 그림자 + 우측 프로필 사진) */}
          <div className="gw-card-preview">
            <div className="gw-card-preview-top">
              <CompanyMark className="gw-card-mark" />
              <div>
                <strong>{COMPANY.name}</strong>
                <span>{COMPANY.tagline}</span>
              </div>
            </div>

            <hr className="gw-card-divider" />

            <div className="gw-card-body">
              <div className="gw-card-body-left">
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

              {/* 우측 빈 공간: 배율 최적화된 프로필 사진 */}
              <div className="gw-card-body-right">
                <div className="gw-card-photo-box" title={activePhotoUrl ? `${card.name} 프로필 사진` : '프로필 사진 없음'}>
                  {activePhotoUrl ? (
                    <img src={activePhotoUrl} alt={`${card.name} 프로필`} className="gw-card-photo-img" />
                  ) : (
                    <label className="gw-card-photo-placeholder" title="클릭하여 프로필 사진 업로드">
                      <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="8" r="5" />
                        <path d="M20 21a8 8 0 0 0-16 0" />
                      </svg>
                      <span>사진 등록</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>
          <p className="gw-field-hint">실제 인쇄 비율(90×50mm, 1.5배 확대) 앞면 미리보기입니다.</p>

          {/* 2. 명함 뒷면 섹션 타이틀 */}
          <div className="gw-card-section-title">
            <h3>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h12M6 16h8"/>
              </svg>
              명함 뒷면 미리보기
            </h3>
            <span className="gw-card-badge-pill">
              {card.backType === 'english' && '양식: 영문 명함'}
              {card.backType === 'map' && '양식: 회사 약도'}
              {card.backType === 'slogan' && '양식: 슬로건/비전'}
            </span>
          </div>

          {/* 3. 명함 뒷면 (선택된 템플릿 렌더링) */}
          {card.backType === 'english' && (
            <div className="gw-card-preview gw-card-preview--back gw-card-preview--english">
              <div className="gw-card-preview-top">
                <CompanyMark className="gw-card-mark" />
                <div>
                  <strong>{card.enCompanyName || COMPANY.nameEn}</strong>
                  <span>{card.enTagline || COMPANY.tagline}</span>
                </div>
              </div>

              <hr className="gw-card-divider" />

              <div className="gw-card-body">
                <div className="gw-card-body-left">
                  <div className="gw-card-preview-name">
                    <strong style={{ textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                      {card.enName || (card.name ? romanizeKoreanName(card.name) : 'NAME')}
                    </strong>
                    <span>
                      {[
                        card.enDepartment || (card.department ? translateDepartment(card.department) : ''),
                        card.enTitle || (card.title ? translateTitle(card.title) : ''),
                      ].filter(Boolean).join(', ') || 'Department, Title'}
                    </span>
                  </div>
                  <dl className="gw-card-preview-contact">
                    {card.mobile && <div><dt>M</dt><dd>{card.mobile}</dd></div>}
                    {card.office && <div><dt>T</dt><dd>{card.office}</dd></div>}
                    {card.email && <div><dt>E</dt><dd>{card.email}</dd></div>}
                    {(card.enAddress || card.address) && (
                      <div><dt>A</dt><dd>{card.enAddress || translateAddress(card.address)}</dd></div>
                    )}
                    <div><dt>W</dt><dd>{COMPANY.site}</dd></div>
                  </dl>
                </div>

                <div className="gw-card-body-right">
                  <CardQrGraphic />
                </div>
              </div>
            </div>
          )}

          {card.backType === 'map' && (
            <div className="gw-card-preview gw-card-preview--back gw-card-preview--map">
              <div className="gw-card-map-header">
                <CompanyMark className="gw-card-mark gw-card-mark--sm" />
                <div>
                  <strong>{card.mapLocationName || '재경로지스 서울경기지사'}</strong>
                  <span>{card.mapAddress || card.address || '경기도 평택시 비전2로 79 (비전동) 701호'}</span>
                </div>
              </div>

              <div className="gw-card-map-svg-wrap">
                <CardMapGraphic />
              </div>

              <div className="gw-card-map-info-grid">
                <div className="gw-card-map-info-item">
                  <span className="gw-map-badge">🚇 대중교통</span>
                  <p title={card.mapSubway}>{card.mapSubway || '1호선 평택역 1번 출구 버스 15분 / 지제역 SRT'}</p>
                </div>
                <div className="gw-card-map-info-item">
                  <span className="gw-map-badge">🚗 자가용/주차</span>
                  <p title={card.mapParking}>{card.mapParking || '건물 지하 주차장 완비 / 안성IC 10분'}</p>
                </div>
              </div>
            </div>
          )}

          {card.backType === 'slogan' && (
            <div className="gw-card-preview gw-card-preview--back gw-card-preview--slogan">
              <div className="gw-slogan-content">
                <div className="gw-slogan-top">
                  <CompanyMark className="gw-card-mark gw-card-mark--sm" />
                  <span>JEAKYUNG LOGISTICS</span>
                </div>

                <div className="gw-slogan-main">
                  <h4 className="gw-slogan-title">{card.sloganMain || 'Beyond Logistics, Better Solutions.'}</h4>
                  <p className="gw-slogan-sub">
                    {card.sloganSub || '신뢰와 혁신을 바탕으로 최적화된 운송 솔루션을 제공하며, 고객과 함께 성장하는 스마트 물류 파트너'}
                  </p>
                  <div className="gw-slogan-values">
                    {(card.sloganValues || '신속 정시 배송, 안전 최우선, 스마트 물류 시스템, 고객 맞춤 솔루션')
                      .split(',')
                      .map((v, i) => (
                        <span key={i} className="gw-slogan-pill">{v.trim()}</span>
                      ))}
                  </div>
                </div>

                <div className="gw-slogan-foot">
                  <span>{card.sloganFoot || `고객지원 ${card.office || '1588-0000'}`}</span>
                  <span>{COMPANY.site}</span>
                </div>
              </div>
            </div>
          )}

          <p className="gw-field-hint">실제 인쇄 비율(90×50mm, 1.5배 확대) 뒷면 미리보기입니다.</p>

          {/* 명함 공유 액션 버튼 */}
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

        {/* ========================================================================= */}
        {/* 우측: 정보 입력 폼 영역 (앞면 기본값 + 프로필 사진 관리 + 뒷면 양식별 입력) */}
        {/* ========================================================================= */}
        <section className="gw-card-form" aria-label="명함 값">
          <h2>명함 앞면 정보</h2>

          {/* 프로필 사진 관리 박스 */}
          <div className="gw-photo-mgmt-box">
            <div className="gw-photo-mgmt-thumb">
              {activePhotoUrl ? (
                <img src={activePhotoUrl} alt="사진 미리보기" />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '11px', textAlign: 'center' }}>
                  No Photo
                </div>
              )}
            </div>
            <div className="gw-photo-mgmt-actions">
              <label className="gw-secondary-button" style={{ cursor: 'pointer', fontSize: '12.5px', padding: '6px 12px' }}>
                사진 파일 선택
                <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
              </label>
              {profilePhotoUrl && (
                <button type="button" className="gw-secondary-button" onClick={handleUseProfilePhoto} style={{ fontSize: '12.5px', padding: '6px 12px' }}>
                  프로필 사진 불러오기
                </button>
              )}
              {card.photoUrl && (
                <button type="button" className="gw-secondary-button" onClick={handleClearPhoto} style={{ fontSize: '12.5px', padding: '6px 12px', color: '#dc2626' }}>
                  사진 삭제
                </button>
              )}
            </div>
          </div>

          {/* 앞면 텍스트 필드들 */}
          {FRONT_FIELDS.map(([key, label]) => (
            <label className="gw-field" key={key}>
              <span>{label}</span>
              <input value={card[key] || ''} maxLength={60} onChange={(event) => patch(key, event.target.value)} />
            </label>
          ))}

          <hr style={{ border: 'none', borderTop: '1px solid var(--gw-border)', margin: '20px 0 16px 0' }} />

          {/* 뒷면 양식 선택 및 내용 입력 */}
          <h2>명함 뒷면 양식 및 내용</h2>
          <p className="gw-field-hint" style={{ margin: '0 0 10px 0' }}>뒷면에 배치할 양식을 선택하고 세부 내용을 입력·편집하세요.</p>

          <div className="gw-back-type-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={card.backType === 'english'}
              className={`gw-back-type-btn ${card.backType === 'english' ? 'is-active' : ''}`}
              onClick={() => patch('backType', 'english')}
            >
              🌐 영문 명함
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={card.backType === 'map'}
              className={`gw-back-type-btn ${card.backType === 'map' ? 'is-active' : ''}`}
              onClick={() => patch('backType', 'map')}
            >
              🗺️ 회사 약도
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={card.backType === 'slogan'}
              className={`gw-back-type-btn ${card.backType === 'slogan' ? 'is-active' : ''}`}
              onClick={() => patch('backType', 'slogan')}
            >
              ✨ 슬로건 / 비전
            </button>
          </div>

          {/* 1) 영문 명함 선택 시 입력 필드들 */}
          {card.backType === 'english' && (
            <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
              <div>
                <button type="button" className="gw-magic-btn" onClick={handleAutoTranslate} title="앞면 한글 정보를 영문으로 자동 변환하여 채웁니다">
                  ✨ 앞면 한글 정보로 영문 자동 채우기
                </button>
                <span style={{ display: 'block', fontSize: '11.5px', color: '#64748b' }}>
                  클릭 시 한글 이름·직책·부서·주소가 영문으로 자동 번역되며, 아래에서 자유롭게 수정·편집할 수 있습니다.
                </span>
              </div>

              <label className="gw-field">
                <span>영문 성명 (Full Name)</span>
                <input
                  value={card.enName || ''}
                  placeholder={card.name ? romanizeKoreanName(card.name) : 'e.g. Seok-ki Kang'}
                  maxLength={60}
                  onChange={(e) => patch('enName', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>영문 직책 (Job Title)</span>
                <input
                  value={card.enTitle || ''}
                  placeholder={card.title ? translateTitle(card.title) : 'e.g. General Manager'}
                  maxLength={60}
                  onChange={(e) => patch('enTitle', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>영문 부서 (Department)</span>
                <input
                  value={card.enDepartment || ''}
                  placeholder={card.department ? translateDepartment(card.department) : 'e.g. System Operations Dept.'}
                  maxLength={60}
                  onChange={(e) => patch('enDepartment', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>영문 회사명 (Company)</span>
                <input
                  value={card.enCompanyName || ''}
                  placeholder="JEAKYUNG LOGIS"
                  maxLength={60}
                  onChange={(e) => patch('enCompanyName', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>영문 슬로건 (Tagline)</span>
                <input
                  value={card.enTagline || ''}
                  placeholder="Beyond Logistics, Better Solutions."
                  maxLength={80}
                  onChange={(e) => patch('enTagline', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>영문 주소 (Address)</span>
                <textarea
                  rows={2}
                  value={card.enAddress || ''}
                  placeholder={card.address ? translateAddress(card.address) : 'Suite 701, 79, Bijeon 2-ro, Pyeongtaek-si, Gyeonggi-do, Republic of Korea'}
                  onChange={(e) => patch('enAddress', e.target.value)}
                  style={{
                    border: '1px solid var(--gw-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </label>
            </div>
          )}

          {/* 2) 회사 약도 선택 시 입력 필드들 */}
          {card.backType === 'map' && (
            <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
              <label className="gw-field">
                <span>지점 / 위치명</span>
                <input
                  value={card.mapLocationName || ''}
                  placeholder="재경로지스 서울경기지사"
                  maxLength={60}
                  onChange={(e) => patch('mapLocationName', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>약도 주소 표시</span>
                <input
                  value={card.mapAddress || ''}
                  placeholder="경기도 평택시 비전2로 79 (비전동) 701호 서울경기지사"
                  maxLength={100}
                  onChange={(e) => patch('mapAddress', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>🚇 대중교통 안내</span>
                <input
                  value={card.mapSubway || ''}
                  placeholder="1호선 평택역 1번 출구 버스 15분 / 지제역 SRT"
                  maxLength={100}
                  onChange={(e) => patch('mapSubway', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>🚗 자가용 / 주차 안내</span>
                <input
                  value={card.mapParking || ''}
                  placeholder="건물 지하 주차장 완비 / 안성IC 10분"
                  maxLength={100}
                  onChange={(e) => patch('mapParking', e.target.value)}
                />
              </label>
            </div>
          )}

          {/* 3) 슬로건 & 비전 선택 시 입력 필드들 */}
          {card.backType === 'slogan' && (
            <div style={{ display: 'grid', gap: '12px', marginTop: '10px' }}>
              <label className="gw-field">
                <span>메인 슬로건 (Brand Slogan)</span>
                <input
                  value={card.sloganMain || ''}
                  placeholder="Beyond Logistics, Better Solutions."
                  maxLength={80}
                  onChange={(e) => patch('sloganMain', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>브랜드 비전 설명 (Sub Text)</span>
                <textarea
                  rows={3}
                  value={card.sloganSub || ''}
                  placeholder="신뢰와 혁신을 바탕으로 최적화된 운송 솔루션을 제공하며..."
                  onChange={(e) => patch('sloganSub', e.target.value)}
                  style={{
                    border: '1px solid var(--gw-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                  }}
                />
              </label>

              <label className="gw-field">
                <span>핵심 가치 태그 (쉼표로 구분)</span>
                <input
                  value={card.sloganValues || ''}
                  placeholder="신속 정시 배송, 안전 최우선, 스마트 물류 시스템, 고객 맞춤 솔루션"
                  maxLength={120}
                  onChange={(e) => patch('sloganValues', e.target.value)}
                />
              </label>

              <label className="gw-field">
                <span>하단 안내 문구 / 연락처</span>
                <input
                  value={card.sloganFoot || ''}
                  placeholder="고객지원 1588-0000 · contact@jeakyung.com"
                  maxLength={80}
                  onChange={(e) => patch('sloganFoot', e.target.value)}
                />
              </label>
            </div>
          )}

          <div className="gw-admin-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px' }}>
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
