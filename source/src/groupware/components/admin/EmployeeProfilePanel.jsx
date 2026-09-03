import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '../../context/AuthContext.jsx';
import { getEmployeeProfileCatalog, updateEmployeeProfile, uploadProfilePhoto } from '../../services/profileService.js';
import { prepareProfilePhoto } from '../../utils/profilePhoto.js';
import ProfileAvatar from '../profile/ProfileAvatar.jsx';

function toForm(employee) {
  return {
    id: employee.id,
    fullName: employee.full_name ?? '', employeeNumber: employee.employee_number ?? '', companyEmail: employee.company_email ?? '',
    departmentId: employee.department_id ?? '', positionId: employee.position_id ?? '', jobTitleId: employee.job_title_id ?? '', hireDate: employee.hire_date ?? '',
    mobilePhone: employee.mobile_phone ?? '', officePhone: employee.office_phone ?? '', extensionNumber: employee.extension_number ?? '',
    employmentStatus: employee.employment_status ?? 'active', workLocation: employee.work_location ?? '', roles: employee.roles ?? ['employee'],
    preferredStartRole: employee.preferred_start_role ?? employee.active_role ?? 'employee',
  };
}

export default function EmployeeProfilePanel({ directory }) {
  const auth = useAuth();
  const [catalog, setCatalog] = useState({ employees: [], recent_changes: [] });
  const [filters, setFilters] = useState({ search: '', departmentId: '' });
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async (nextFilters = filters) => {
    setLoading(true); setStatus('');
    try { setCatalog(await getEmployeeProfileCatalog(nextFilters)); }
    catch { setStatus('직원 프로필을 불러오지 못했습니다. 활성 관리자 역할을 확인해 주세요.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const selected = useMemo(() => catalog.employees.find((employee) => employee.id === form?.id), [catalog.employees, form?.id]);
  const history = catalog.recent_changes.filter((change) => change.target_id === form?.id).slice(0, 12);
  const toggleRole = (roleCode, checked) => setForm((current) => {
    const roles = checked ? [...new Set([...current.roles, roleCode])] : current.roles.filter((code) => code !== roleCode);
    const safeRoles = roles.includes('employee') ? roles : [...roles, 'employee'];
    return { ...current, roles: safeRoles, preferredStartRole: safeRoles.includes(current.preferredStartRole) ? current.preferredStartRole : 'employee' };
  });

  const save = async (event) => {
    event.preventDefault();
    const roleChanged = JSON.stringify([...form.roles].sort()) !== JSON.stringify([...(selected?.roles ?? [])].sort());
    if (roleChanged && !window.confirm('역할 배정 변경은 즉시 권한에 반영되고 감사 로그에 기록됩니다. 계속하시겠습니까?')) return;
    setStatus('직원 프로필을 저장하고 있습니다.');
    try {
      await updateEmployeeProfile(form);
      if (form.id === auth.profile?.id) await auth.refresh();
      const nextCatalog = await getEmployeeProfileCatalog(filters);
      setCatalog(nextCatalog);
      const updated = nextCatalog.employees.find((employee) => employee.id === form.id);
      if (updated) setForm(toForm(updated));
      setStatus('직원 프로필과 역할을 저장했습니다.');
    } catch (error) {
      setStatus(error.message === 'last_super_admin_protected' ? '마지막 최고 관리자 역할은 해제할 수 없습니다.' : '직원 프로필을 저장하지 못했습니다. 필수값과 권한을 확인해 주세요.');
    }
  };

  const upload = async (event) => {
    const selectedFile = event.target.files?.[0]; if (!selectedFile || !form) return;
    setStatus('프로필 사진을 처리하고 있습니다.');
    try { const file = await prepareProfilePhoto(selectedFile); await uploadProfilePhoto({ userId: form.id, file }); if (form.id === auth.profile?.id) await auth.refresh(); await load(); setStatus('프로필 사진을 변경했습니다.'); }
    catch { setStatus('프로필 사진을 변경하지 못했습니다. 이미지 형식과 관리자 역할을 확인해 주세요.'); }
    finally { event.target.value = ''; }
  };

  return <section className="gw-admin-section" aria-labelledby="employee-profile-admin-title"><div className="gw-admin-section-heading"><div><span className="gw-eyebrow">EMPLOYEE PROFILES</span><h2 id="employee-profile-admin-title">직원 프로필 관리</h2><p>공식 인사 정보와 다중 역할을 서버 검증과 감사 로그를 거쳐 관리합니다.</p></div><span className="gw-count-badge">{catalog.employees.length}명</span></div>
    <form className="gw-employee-search" onSubmit={(event) => { event.preventDefault(); load(); }}><label className="gw-field"><span>이름·사번·이메일 검색</span><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label><label className="gw-field"><span>부서</span><select value={filters.departmentId} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}><option value="">전체 부서</option>{directory.departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button className="gw-secondary-button" type="submit">검색</button></form>
    {loading && <p className="gw-empty-state" role="status">직원 프로필을 불러오고 있습니다.</p>}
    <div className="gw-employee-admin-layout"><div className="gw-employee-list" aria-label="직원 목록">{catalog.employees.map((employee) => <button type="button" key={employee.id} className={form?.id === employee.id ? 'is-selected' : undefined} onClick={() => setForm(toForm(employee))}><ProfileAvatar profile={employee} size="small" /><span><strong>{employee.display_name}</strong><small>{employee.employee_number || '사번 미등록'} · {employee.department_name || '부서 미등록'}</small><small>{employee.active_role || '활성 역할 미등록'}</small></span></button>)}</div>
      {form && <form className="gw-employee-editor" onSubmit={save}><header><div><h3>{selected?.display_name || form.fullName}</h3><p>계정 이메일 인증 정보는 이 화면에서 변경하지 않습니다.</p></div><div className="gw-admin-photo-control"><ProfileAvatar profile={selected} /><label className="gw-file-button">사진 변경<input type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></label></div></header><div className="gw-admin-form-grid">
        <label className="gw-field"><span>공식 이름</span><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></label><label className="gw-field"><span>사번</span><input value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></label><label className="gw-field"><span>회사 이메일(표시용)</span><input type="email" value={form.companyEmail} onChange={(e) => setForm({ ...form, companyEmail: e.target.value })} /></label><label className="gw-field"><span>입사일</span><input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></label>
        <label className="gw-field"><span>부서</span><select required value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>{directory.departments.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="gw-field"><span>직급 (선택)</span><select value={form.positionId} onChange={(e) => setForm({ ...form, positionId: e.target.value })}><option value="">직급 없음</option>{directory.positions.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="gw-field"><span>직책</span><select required value={form.jobTitleId} onChange={(e) => setForm({ ...form, jobTitleId: e.target.value })}>{directory.jobTitles.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="gw-field"><span>재직 상태</span><select value={form.employmentStatus} onChange={(e) => setForm({ ...form, employmentStatus: e.target.value })}><option value="active">재직</option><option value="leave">휴직</option><option value="resigned">퇴사</option></select></label>
        <label className="gw-field"><span>휴대전화</span><input value={form.mobilePhone} onChange={(e) => setForm({ ...form, mobilePhone: e.target.value })} /></label><label className="gw-field"><span>사무실 전화</span><input value={form.officePhone} onChange={(e) => setForm({ ...form, officePhone: e.target.value })} /></label><label className="gw-field"><span>내선번호</span><input value={form.extensionNumber} onChange={(e) => setForm({ ...form, extensionNumber: e.target.value })} /></label><label className="gw-field"><span>근무지</span><input value={form.workLocation} onChange={(e) => setForm({ ...form, workLocation: e.target.value })} /></label>
      </div><fieldset className="gw-builder-fieldset"><legend>보유 역할</legend><div className="gw-role-checkboxes">{directory.roles.map((role) => <label key={role.code}><input type="checkbox" checked={form.roles.includes(role.code)} disabled={role.code === 'employee' || (['super_admin', 'admin'].includes(role.code) && auth.activeRole !== 'super_admin')} onChange={(e) => toggleRole(role.code, e.target.checked)} /> {role.name}</label>)}</div><p>모든 승인 직원은 최소 employee 역할을 유지하며, 관리자 계열 역할은 최고 관리자만 변경합니다. 권한은 보유 역할 중 가장 높은 역할이 자동으로 적용되고 사용자가 전환하지 않습니다.</p></fieldset><button className="gw-primary-button" type="submit">직원 프로필 저장</button>
      <section className="gw-profile-history" aria-labelledby="profile-history-title"><h4 id="profile-history-title">최근 변경 이력</h4>{history.length ? <ul>{history.map((item) => <li key={item.id}><strong>{item.action}</strong><time>{new Date(item.created_at).toLocaleString('ko-KR')}</time><span>{Array.isArray(item.metadata?.changed_fields) ? item.metadata.changed_fields.join(', ') : Array.isArray(item.metadata?.roles) ? item.metadata.roles.join(', ') : '보안 이벤트'}</span></li>)}</ul> : <p>표시할 변경 이력이 없습니다.</p>}</section></form>}
    </div>{status && <p className="gw-form-status" role="status">{status}</p>}</section>;
}
