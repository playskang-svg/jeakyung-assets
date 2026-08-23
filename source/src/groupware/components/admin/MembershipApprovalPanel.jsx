import { useEffect, useState } from 'react';

import FormStatus from '../FormStatus.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { approveMembership, listPendingMemberships, rejectMembership } from '../../services/membershipService.js';
import ProfileAvatar from '../profile/ProfileAvatar.jsx';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Seoul',
  }).format(new Date(value));
}

function MemberReviewCard({ member, directory, onCompleted }) {
  const prefix = `member-${member.id}`;
  const [departmentId, setDepartmentId] = useState(member.requested_department?.id ?? '');
  const [positionId, setPositionId] = useState(member.requested_position?.id ?? '');
  const [jobTitleId, setJobTitleId] = useState(member.requested_job_title?.id ?? '');
  const [roleCode, setRoleCode] = useState('employee');
  const [hireDate, setHireDate] = useState(member.requested_hire_date ?? '');
  const [employeeNumber, setEmployeeNumber] = useState(member.requested_employee_number ?? '');
  const [reason, setReason] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');

  const handleApprove = async () => {
    if (busyAction) return;
    if (!departmentId || !positionId || !jobTitleId || !roleCode || !hireDate || !employeeNumber.trim()) {
      setMessage('최종 부서·직급·직책·입사일·사번·역할을 모두 입력해 주세요.');
      return;
    }
    setBusyAction('approve');
    setMessage('');
    try {
      await approveMembership({ userId: member.id, departmentId, positionId, jobTitleId, roleCode, hireDate, employeeNumber });
      onCompleted(member.id, `${member.name}님의 가입을 승인했습니다.`);
    } catch {
      setMessage('가입 승인에 실패했습니다. 권한과 현재 회원 상태를 확인해 주세요.');
      setBusyAction('');
    }
  };

  const handleReject = async () => {
    if (busyAction) return;
    if (!reason.trim()) {
      setMessage('거절 사유를 입력해 주세요.');
      return;
    }
    setBusyAction('reject');
    setMessage('');
    try {
      await rejectMembership({ userId: member.id, reason: reason.trim() });
      onCompleted(member.id, `${member.name}님의 가입 신청을 거절했습니다.`);
    } catch {
      setMessage('가입 거절 처리에 실패했습니다. 권한과 현재 회원 상태를 확인해 주세요.');
      setBusyAction('');
    }
  };

  return (
    <article className="gw-review-card" aria-labelledby={`${prefix}-title`}>
      <header className="gw-review-card-header">
        <div className="gw-review-member-identity">
          <ProfileAvatar profile={{ ...member, display_name: member.full_name || member.name }} />
          <div>
          <span className="gw-eyebrow">PENDING MEMBER</span>
          <h3 id={`${prefix}-title`}>{member.name}</h3>
          <p>{member.email} · {member.phone || '연락처 미입력'}</p>
          </div>
        </div>
        <time dateTime={member.created_at}>{formatDate(member.created_at)} 신청</time>
      </header>

      <dl className="gw-request-summary">
        <div><dt>요청 부서</dt><dd>{member.requested_department?.name ?? '[미정]'}</dd></div>
        <div><dt>요청 직급</dt><dd>{member.requested_position?.name ?? '[미정]'}</dd></div>
        <div><dt>요청 직책</dt><dd>{member.requested_job_title?.name ?? '[미정]'}</dd></div>
        <div><dt>요청 입사일</dt><dd>{member.requested_hire_date ?? '[미정]'}</dd></div>
        <div><dt>요청 사번</dt><dd>{member.requested_employee_number ?? '[미정]'}</dd></div>
        <div><dt>관리자 확인 메모</dt><dd>{member.organization_request_note ?? '없음'}</dd></div>
      </dl>

      <div className="gw-admin-form-grid">
        <div className="gw-field">
          <label htmlFor={`${prefix}-department`}>최종 부서</label>
          <select id={`${prefix}-department`} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
            <option value="">선택</option>
            {directory.departments.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="gw-field">
          <label htmlFor={`${prefix}-hire-date`}>최종 입사일</label>
          <input id={`${prefix}-hire-date`} type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} />
        </div>
        <div className="gw-field">
          <label htmlFor={`${prefix}-employee-number`}>최종 사번</label>
          <input id={`${prefix}-employee-number`} value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} maxLength="60" />
        </div>
        <div className="gw-field">
          <label htmlFor={`${prefix}-position`}>최종 직급</label>
          <select id={`${prefix}-position`} value={positionId} onChange={(event) => setPositionId(event.target.value)}>
            <option value="">선택</option>
            {directory.positions.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="gw-field">
          <label htmlFor={`${prefix}-job-title`}>최종 직책</label>
          <select id={`${prefix}-job-title`} value={jobTitleId} onChange={(event) => setJobTitleId(event.target.value)}>
            <option value="">선택</option>
            {directory.jobTitles.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="gw-field">
          <label htmlFor={`${prefix}-role`}>대표 역할</label>
          <select id={`${prefix}-role`} value={roleCode} onChange={(event) => setRoleCode(event.target.value)}>
            {directory.roles.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div className="gw-field">
        <label htmlFor={`${prefix}-reason`}>거절 사유</label>
        <textarea id={`${prefix}-reason`} value={reason} onChange={(event) => setReason(event.target.value)} maxLength="1000" placeholder="거절할 때만 입력합니다." />
      </div>

      <FormStatus id={`${prefix}-status`} message={message} tone="error" />
      <div className="gw-admin-actions">
        <button className="gw-primary-button" type="button" disabled={Boolean(busyAction)} onClick={handleApprove}>
          {busyAction === 'approve' ? '승인 중…' : '가입 승인'}
        </button>
        <button className="gw-secondary-button gw-secondary-button--danger" type="button" disabled={Boolean(busyAction)} onClick={handleReject}>
          {busyAction === 'reject' ? '거절 중…' : '가입 거절'}
        </button>
      </div>
    </article>
  );
}

export default function MembershipApprovalPanel({ directory }) {
  const auth = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listPendingMemberships()
      .then((data) => { if (active) setMembers(data); })
      .catch(() => { if (active) setError('가입 대기 목록을 불러오지 못했습니다.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleCompleted = (memberId, completedMessage) => {
    setMembers((current) => current.filter((member) => member.id !== memberId));
    setMessage(completedMessage);
    setError('');
  };

  const allowedRoles = auth.activeRole === 'super_admin'
    ? directory.roles
    : directory.roles.filter((role) => !['super_admin', 'admin'].includes(role.code));

  return (
    <section className="gw-admin-section" aria-labelledby="membership-approval-title">
      <div className="gw-admin-section-heading">
        <div><span className="gw-eyebrow">MEMBERSHIP</span><h2 id="membership-approval-title">회원 승인</h2></div>
        <span className="gw-count-badge">대기 {members.length}명</span>
      </div>
      <FormStatus id="membership-action-status" message={error || message} tone={error ? 'error' : 'info'} />
      {loading && <p className="gw-empty-state" role="status">가입 대기 목록을 불러오고 있습니다.</p>}
      {!loading && !error && members.length === 0 && <p className="gw-empty-state">현재 승인 대기 중인 가입 신청이 없습니다.</p>}
      <div className="gw-review-list">
        {members.map((member) => (
          <MemberReviewCard key={member.id} member={member} directory={{ ...directory, roles: allowedRoles }} onCompleted={handleCompleted} />
        ))}
      </div>
    </section>
  );
}
