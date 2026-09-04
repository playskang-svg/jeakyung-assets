import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext.jsx';
import AttendancePunch from './AttendancePunch.jsx';
import OnlinePeek from './OnlinePeek.jsx';
import ProfileAvatar from './ProfileAvatar.jsx';

function value(input) { return input || '미등록'; }
function tenure(hireDate) {
  if (!hireDate) return '미등록';
  const start = new Date(`${hireDate}T00:00:00`);
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  if (months < 0) return '입사 예정';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years ? `${years}년 ` : ''}${rest}개월`;
}

export default function ProfileCard() {
  const auth = useAuth();
  const profile = auth.profile ?? {};
  const displayName = profile.display_name || profile.preferred_name || profile.full_name || profile.name || '사용자';
  const activeRoleName = auth.assignedRoles.find((role) => role.code === auth.activeRole)?.name || auth.activeRole || '미등록';
  const contacts = [profile.employee_number, profile.mobile_phone, profile.company_email].filter(Boolean);
  // 상세 항목은 기본적으로 접어 두고 필요할 때만 펼친다.
  const [expanded, setExpanded] = useState(false);
  return (
    <section className="gw-profile-card" aria-labelledby="my-profile-card-title">
      <div className="gw-profile-card-hero">
        <ProfileAvatar profile={profile} size="large" />
        <div>
          {/* 이름 옆에 사번·휴대전화·회사 이메일. 등록되지 않은 것은 빼고
              있는 것만 세운다 — 셋 다 '미등록'이면 읽을 게 없는 줄이 남는다.
              전체 항목은 아래 '펼치기'가 미등록까지 보여 준다. */}
          <div className="gw-profile-card-name">
            <h2 id="my-profile-card-title">{displayName}</h2>
            {contacts.length > 0 && <span className="gw-profile-card-contact">{contacts.join(', ')}</span>}
          </div>
          <p>{value(profile.department_name)} · {value(profile.position_name)} · {value(profile.job_title_name)}<span className="gw-active-role-badge">{activeRoleName}</span></p>
        </div>
        {/* 이름 줄과 단추 사이의 빈자리. 출퇴근은 매일 한 번씩 누르는 것이라
            홈에서 바로 닿아야 하고, 지금 접속자 창도 같은 자리에 둔다 —
            둘 다 "지금" 을 보여 주는 값이라 따로 화면을 열게 하면 번거롭다. */}
        <div className="gw-profile-side">
          <AttendancePunch />
          <OnlinePeek />
        </div>
        <div className="gw-profile-card-actions">
          <button
            type="button"
            className="gw-secondary-button"
            aria-expanded={expanded}
            aria-controls="my-profile-facts"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? '접기' : '펼치기'}
          </button>
          <Link className="gw-secondary-button" to="/business-card">명함관리</Link>
          <Link className="gw-secondary-button" to="/profile">편집</Link>
        </div>
      </div>
      {expanded && (
        <dl className="gw-profile-facts" id="my-profile-facts">
          <div><dt>사번</dt><dd>{value(profile.employee_number)}</dd></div><div><dt>입사일</dt><dd>{value(profile.hire_date)}</dd></div><div><dt>재직 기간</dt><dd>{tenure(profile.hire_date)}</dd></div><div><dt>회사 이메일</dt><dd>{value(profile.company_email)}</dd></div><div><dt>휴대전화</dt><dd>{value(profile.mobile_phone)}</dd></div><div><dt>사무실 전화</dt><dd>{value(profile.office_phone)}{profile.extension_number ? ` · 내선 ${profile.extension_number}` : ''}</dd></div><div><dt>근무지</dt><dd>{value(profile.work_location)}</dd></div><div><dt>보유 역할</dt><dd>{auth.assignedRoles.map((role) => role.name).join(', ') || '미등록'}</dd></div>
        </dl>
      )}
    </section>
  );
}
