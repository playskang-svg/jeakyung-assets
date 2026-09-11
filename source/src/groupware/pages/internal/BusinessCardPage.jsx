import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';

import { useAuth } from '../../context/AuthContext.jsx';
import CompanyMark from '../../components/CompanyMark.jsx';
import {
  isKnownWorkLocationAddress,
  resolveBusinessCardAddress,
} from '../../config/workLocations.js';
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

// 명함용 실제 스마트폰 스캔 가능한 고해상도 QR 코드 컴포넌트
function CardQrGraphic({ qrDataUrl, qrType }) {
  return (
    <div
      className="gw-card-qr-box"
      title={
        qrType === 'url'
          ? '스마트폰 카메라로 비추면 웹사이트(https://jeakyung.com)가 즉시 열립니다.'
          : '스마트폰 카메라로 비추면 스마트폰 연락처에 즉시 추가(vCard)됩니다.'
      }
    >
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="실제 스캔 가능한 명함 QR 코드"
          className="gw-card-qr-img"
        />
      ) : (
        <div style={{ fontSize: '9px', color: '#94a3b8' }}>QR 생성중...</div>
      )}
      <span className="gw-card-qr-label">
        {qrType === 'url' ? 'VISIT WEBSITE' : 'SAVE CONTACT'}
      </span>
    </div>
  );
}

export default function BusinessCardPage() {
  const auth = useAuth();
  const profile = auth.profile ?? {};
  const profileAddress = resolveBusinessCardAddress(profile);

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
      address: profileAddress,
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
      qrType: 'vcard', // 'vcard' | 'url'
      qrCustomUrl: '',

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
        const parsed = JSON.parse(saved);
        if (parsed.enName) parsed.enName = parsed.enName.replace(/-/g, '').trim();
        return {
          ...initial,
          ...parsed,
          // 예전에 빈 주소로 저장된 명함은 현재 소속의 기본 주소로 복구한다.
          address: parsed.address?.trim() || initial.address,
        };
      }
    } catch {
      // ignore JSON parse error
    }
    return initial;
  });

  const frontCardRef = useRef(null);
  const backCardRef = useRef(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [shareToast, setShareToast] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  const patch = (key, value) => setCard((current) => ({ ...current, [key]: value }));

  // 프로필이 늦게 로드되거나 소속·근무지가 바뀐 경우에도 기본 주소를 맞춘다.
  // 사용자가 별도로 입력한 주소는 덮어쓰지 않는다.
  useEffect(() => {
    setCard((current) => {
      const currentAddress = current.address?.trim() || '';
      if (currentAddress && !isKnownWorkLocationAddress(currentAddress)) return current;
      if (currentAddress === profileAddress) return current;
      return { ...current, address: profileAddress };
    });
  }, [profileAddress]);

  const handleFrontFieldChange = (key, value) => {
    if (key !== 'department') {
      patch(key, value);
      return;
    }

    setCard((current) => {
      const next = { ...current, department: value };
      const currentAddress = current.address?.trim() || '';
      if (!currentAddress || isKnownWorkLocationAddress(currentAddress)) {
        next.address = resolveBusinessCardAddress({ ...profile, department_name: value });
      }
      return next;
    });
  };

  // 실제 스캔 가능한 QR 코드 자동 생성 (vCard 또는 홈페이지 URL)
  useEffect(() => {
    let active = true;

    async function generateQR() {
      try {
        let content = '';
        if (card.qrType === 'url') {
          content = card.qrCustomUrl || `https://${COMPANY.site}`;
        } else {
          // vCard 3.0 포맷 — 스마트폰 카메라로 스캔 시 즉시 주소록 연락처 등록
          const nameToUse = card.name || card.enName || '재경로지스';
          const orgToUse = card.enCompanyName || COMPANY.name;
          const titleToUse = card.title || card.enTitle || '';
          const deptToUse = card.department || card.enDepartment || '';
          const mobileToUse = card.mobile || '';
          const officeToUse = card.office || '';
          const emailToUse = card.email || '';
          const addressToUse = card.address || card.enAddress || '';

          const vcard = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${nameToUse}`,
            card.name && card.name.length >= 2
              ? `N:${card.name.slice(0, 1)};${card.name.slice(1)};;;`
              : `N:${nameToUse};;;;`,
            `ORG:${orgToUse}${deptToUse ? ';' + deptToUse : ''}`,
            titleToUse ? `TITLE:${titleToUse}` : '',
            mobileToUse ? `TEL;TYPE=CELL:${mobileToUse}` : '',
            officeToUse ? `TEL;TYPE=WORK:${officeToUse}` : '',
            emailToUse ? `EMAIL;TYPE=WORK:${emailToUse}` : '',
            addressToUse ? `ADR;TYPE=WORK:;;${addressToUse};;;;` : '',
            `URL:https://${COMPANY.site}`,
            'NOTE:재경로지스 임직원 디지털 명함',
            'END:VCARD',
          ].filter(Boolean).join('\n');

          content = vcard;
        }

        const url = await QRCode.toDataURL(content, {
          width: 256,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        });

        if (active) {
          setQrDataUrl(url);
        }
      } catch (err) {
        console.error('QR code generation failed:', err);
      }
    }

    generateQR();

    return () => {
      active = false;
    };
  }, [
    card.qrType,
    card.qrCustomUrl,
    card.name,
    card.enName,
    card.title,
    card.enTitle,
    card.department,
    card.enDepartment,
    card.mobile,
    card.office,
    card.email,
    card.address,
    card.enAddress,
    card.enCompanyName,
  ]);

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

  // 한글 입력값을 영문으로 자동 변환 (원클릭 자동 채우기 - 하이픈 표기 일체 제거)
  const handleAutoTranslate = () => {
    const enName = (romanizeKoreanName(card.name) || '').replace(/-/g, '').replace(/\s+/g, ' ').trim();
    const enTitle = (translateTitle(card.title) || '').replace(/-/g, '').trim();
    const enDept = (translateDepartment(card.department) || '').replace(/-/g, '').trim();
    const enAddr = (translateAddress(card.address) || '').replace(/-/g, '').trim();

    setCard((prev) => ({
      ...prev,
      enName: enName || (prev.enName ? prev.enName.replace(/-/g, '').trim() : ''),
      enTitle: enTitle || (prev.enTitle ? prev.enTitle.replace(/-/g, '').trim() : ''),
      enDepartment: enDept || (prev.enDepartment ? prev.enDepartment.replace(/-/g, '').trim() : ''),
      enAddress: enAddr || (prev.enAddress ? prev.enAddress.replace(/-/g, '').trim() : ''),
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

  // 명함 엘리먼트를 고해상도 PNG Blob으로 렌더링
  const generateCardBlob = async (element) => {
    if (!element) return null;
    const canvas = await html2canvas(element, {
      scale: 3, // 선명한 3배율 고화질 렌더링
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 0.95);
    });
  };

  // 카카오톡 / 명함 이미지 공유 핸들러
  const handleKakaoShare = async () => {
    setIsCapturing(true);
    setShareToast('명함 이미지를 생성하고 있습니다…');
    try {
      const frontElement = frontCardRef.current;
      const blob = await generateCardBlob(frontElement);
      if (!blob) throw new Error('명함 이미지를 생성하지 못했습니다.');

      const cleanName = (card.name || '재경로지스').replace(/\s+/g, '_');
      const fileName = `${cleanName}_명함.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      const shareText = `[명함] ${COMPANY.name}
${card.name || '이름'} ${[card.department, card.title].filter(Boolean).join(' · ')}
━━━━━━━━━━━━━━━━━━━━
• 휴대폰: ${card.mobile || '-'}
• 사무실: ${card.office || '-'}
• 이메일: ${card.email || '-'}
• 주소: ${card.address || '-'}
• 웹사이트: https://${COMPANY.site}`;

      // 1. 모바일 기기 및 Web Share API 지원 환경: 이미지 파일을 직접 공유
      // 주의: url 파라미터를 단독으로 주면 앱이 이미지를 버리고 url 링크만 전송하므로 파일과 본문 텍스트로 전달
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `${COMPANY.name} ${card.name} 명함`,
            text: shareText,
          });
          setShareToast('✓ 명함 이미지가 공유되었습니다.');
          setTimeout(() => setShareToast(''), 4000);
          return;
        } catch (shareErr) {
          if (shareErr.name === 'AbortError') {
            setShareToast('');
            return;
          }
        }
      }

      // 2. PC / 데스크톱 환경: 클립보드에 이미지(PNG)를 직접 복사!
      // 카카오톡 PC 대화방에 바로 붙여넣기(Cmd/Ctrl+V)하면 명함 사진이 짠 하고 전송됨
      if (navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setShareToast('✓ 명함 사진이 클립보드에 복사되었습니다! 카카오톡 대화방에 붙여넣기(Ctrl+V / Cmd+V)하시면 명함 이미지가 바로 전송됩니다.');
          setTimeout(() => setShareToast(''), 7000);
          return;
        } catch {
          // fallback to download
        }
      }

      // 3. 클립보드 이미지 복사 미지원 시: 이미지 파일 자동 다운로드
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setShareToast('✓ 명함 이미지가 다운로드되었습니다. 카카오톡 대화방에 사진을 전송하세요!');
      setTimeout(() => setShareToast(''), 5000);
    } catch (err) {
      console.error(err);
      alert('명함 이미지 생성 중 오류가 발생했습니다: ' + (err.message || err));
    } finally {
      setIsCapturing(false);
    }
  };

  // 명함 이미지 파일 다운로드 (앞면 / 뒷면)
  const handleDownloadCard = async (type = 'front') => {
    setIsCapturing(true);
    setShareToast(`명함 ${type === 'front' ? '앞면' : '뒷면'} 이미지를 저장하고 있습니다…`);
    try {
      const element = type === 'front' ? frontCardRef.current : backCardRef.current;
      if (!element) throw new Error('명함 미리보기를 찾을 수 없습니다.');
      const blob = await generateCardBlob(element);
      if (!blob) throw new Error('이미지를 생성하지 못했습니다.');

      const cleanName = (card.name || '재경로지스').replace(/\s+/g, '_');
      const fileName = `${cleanName}_명함_${type === 'front' ? '앞면' : '뒷면'}.png`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setShareToast(`✓ 명함 ${type === 'front' ? '앞면' : '뒷면'} 이미지가 다운로드되었습니다.`);
      setTimeout(() => setShareToast(''), 4000);
    } catch (err) {
      alert('다운로드 중 오류가 발생했습니다: ' + (err.message || err));
    } finally {
      setIsCapturing(false);
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
          <div className="gw-card-preview" ref={frontCardRef}>
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
          <div ref={backCardRef}>
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
                        {(card.enName || (card.name ? romanizeKoreanName(card.name) : 'NAME')).replace(/-/g, '').trim()}
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
                    <CardQrGraphic qrDataUrl={qrDataUrl} qrType={card.qrType || 'vcard'} />
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
          </div>

          <p className="gw-field-hint">실제 인쇄 비율(90×50mm, 1.5배 확대) 뒷면 미리보기입니다.</p>

          {/* 명함 공유 및 고화질 사진 저장 액션 버튼 */}
          <div className="gw-card-share-actions">
            <button
              type="button"
              className="gw-share-btn gw-share-btn--kakao"
              onClick={handleKakaoShare}
              disabled={isCapturing}
              title="명함 사진으로 카카오톡 공유 (대화방에 사진 복사·전송)"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M12 3c-5.523 0-10 3.582-10 8 0 2.868 1.895 5.378 4.75 6.784l-.84 3.084c-.113.414.155.83.567.83.15 0 .302-.055.424-.162l3.636-2.457c.478.077.967.121 1.463.121 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
              </svg>
              <span>{isCapturing ? '이미지 생성 중…' : '카카오톡 / 명함 사진 공유'}</span>
            </button>
            <button
              type="button"
              className="gw-share-btn gw-share-btn--download"
              onClick={() => handleDownloadCard('front')}
              disabled={isCapturing}
              title="명함 앞면 고화질 PNG 이미지 파일 다운로드"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>앞면 사진 저장</span>
            </button>
            <button
              type="button"
              className="gw-share-btn gw-share-btn--download"
              onClick={() => handleDownloadCard('back')}
              disabled={isCapturing}
              title="명함 뒷면 고화질 PNG 이미지 파일 다운로드"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>뒷면 사진 저장</span>
            </button>
            <button type="button" className="gw-share-btn gw-share-btn--email" onClick={handleEmailShare} title="이메일로 명함 정보 공유">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              <span>이메일</span>
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
              <input value={card[key] || ''} maxLength={key === 'address' ? 160 : 60} onChange={(event) => handleFrontFieldChange(key, event.target.value)} />
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
                  value={(card.enName || '').replace(/-/g, '')}
                  placeholder={card.name ? romanizeKoreanName(card.name) : 'e.g. Seokki Kang'}
                  maxLength={60}
                  onChange={(e) => patch('enName', e.target.value.replace(/-/g, ''))}
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

              <label className="gw-field">
                <span>뒷면 QR 코드 스캔 시 동작</span>
                <select
                  value={card.qrType || 'vcard'}
                  onChange={(e) => patch('qrType', e.target.value)}
                  style={{
                    border: '1px solid var(--gw-border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '13px',
                    background: '#fff',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="vcard">📱 스마트폰 연락처 저장 (vCard — 카메라로 비추면 이름/번호/이메일 저장)</option>
                  <option value="url">🌐 회사 홈페이지 이동 (https://jeakyung.com)</option>
                </select>
              </label>

              {card.qrType === 'url' && (
                <label className="gw-field">
                  <span>연결할 웹사이트 주소</span>
                  <input
                    value={card.qrCustomUrl || `https://${COMPANY.site}`}
                    placeholder={`https://${COMPANY.site}`}
                    maxLength={120}
                    onChange={(e) => patch('qrCustomUrl', e.target.value)}
                  />
                </label>
              )}
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
