import { useState } from 'react';

import ProfileAvatar from '../../components/profile/ProfileAvatar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { updateMyProfile, uploadProfilePhoto } from '../../services/profileService.js';
import { prepareProfilePhoto } from '../../utils/profilePhoto.js';

export default function MyProfilePage() {
  const auth = useAuth();
  const profile = auth.profile ?? {};
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setStatus('');
    try {
      await updateMyProfile({ preferredName: form.get('preferredName'), mobilePhone: form.get('mobilePhone'), officePhone: form.get('officePhone'), extensionNumber: form.get('extensionNumber'), introduction: form.get('introduction') });
      await auth.refresh(); setStatus('내 프로필을 저장했습니다.');
    } catch { setStatus('프로필을 저장하지 못했습니다. 입력값을 확인해 주세요.'); }
    finally { setSaving(false); }
  };

  const upload = async (event) => {
    const selected = event.target.files?.[0]; if (!selected) return;
    setStatus('프로필 사진을 처리하고 있습니다.');
    try { const file = await prepareProfilePhoto(selected); await uploadProfilePhoto({ userId: profile.id, file }); await auth.refresh(); setStatus('프로필 사진을 변경했습니다.'); }
    catch { setStatus('프로필 사진을 변경하지 못했습니다. JPEG, PNG, WebP와 5MB 제한을 확인해 주세요.'); }
    finally { event.target.value = ''; }
  };

  return <article className="gw-page" aria-labelledby="page-title"><header className="gw-page-header"><div><span className="gw-eyebrow">MY PROFILE</span><h1 id="page-title">내 프로필</h1><p>연락처와 표시 정보를 관리합니다. 공식 인사 정보는 관리자에게 요청해 주세요.</p></div></header>
    <div className="gw-profile-editor-layout"><section className="gw-profile-photo-panel" aria-labelledby="profile-photo-title"><h2 id="profile-photo-title">프로필 사진</h2><ProfileAvatar profile={profile} size="xlarge" /><label className="gw-file-button">사진 선택<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label><p>중앙 기준 정사각형 512px 이하로 변환합니다. 이전 사진은 정리 후보로 보관됩니다.</p></section>
      <form className="gw-profile-form" onSubmit={submit}><section><h2>직접 수정 가능</h2><div className="gw-admin-form-grid"><label className="gw-field"><span>표시 이름</span><input name="preferredName" defaultValue={profile.preferred_name ?? ''} maxLength="120" /></label><label className="gw-field"><span>휴대전화</span><input name="mobilePhone" defaultValue={profile.mobile_phone ?? ''} maxLength="40" /></label><label className="gw-field"><span>사무실 전화</span><input name="officePhone" defaultValue={profile.office_phone ?? ''} maxLength="40" /></label><label className="gw-field"><span>내선번호</span><input name="extensionNumber" defaultValue={profile.extension_number ?? ''} maxLength="20" /></label><label className="gw-field gw-field--full"><span>한 줄 소개</span><textarea name="introduction" defaultValue={profile.introduction ?? ''} maxLength="300" /></label></div><button className="gw-primary-button" disabled={saving}>{saving ? '저장 중…' : '프로필 저장'}</button></section>
        <section className="gw-readonly-profile"><h2>관리자 관리 정보</h2><dl><div><dt>공식 이름</dt><dd>{profile.full_name || '미등록'}</dd></div><div><dt>회사 이메일</dt><dd>{profile.company_email || '미등록'}</dd></div><div><dt>사번</dt><dd>{profile.employee_number || '미등록'}</dd></div><div><dt>부서</dt><dd>{profile.department_name || '미등록'}</dd></div><div><dt>직급</dt><dd>{profile.position_name || '미등록'}</dd></div><div><dt>직책</dt><dd>{profile.job_title_name || '미등록'}</dd></div><div><dt>입사일</dt><dd>{profile.hire_date || '미등록'}</dd></div><div><dt>재직 상태</dt><dd>{profile.employment_status || '미등록'}</dd></div></dl></section>
      </form></div>{status && <p className="gw-form-status" role="status">{status}</p>}</article>;
}
