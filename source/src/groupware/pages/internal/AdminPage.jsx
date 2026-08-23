import { useCallback, useEffect, useState } from 'react';

import AdminControlIndexPanel from '../../components/admin/AdminControlIndexPanel.jsx';
import MembershipApprovalPanel from '../../components/admin/MembershipApprovalPanel.jsx';
import OrganizationManagementPanel from '../../components/admin/OrganizationManagementPanel.jsx';
import DashboardWidgetPanel from '../../components/admin/DashboardWidgetPanel.jsx';
import SystemUsagePanel from '../../components/admin/SystemUsagePanel.jsx';
import EmployeeProfilePanel from '../../components/admin/EmployeeProfilePanel.jsx';
import { EMPTY_DIRECTORY, getAdminOverview } from '../../services/adminOverviewService.js';

const EMPTY_OVERVIEW = { directory: null, usage: null, approval: null, popups: null };

export default function AdminPage() {
  const [overview, setOverview] = useState(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(true);
  // 첫 화면은 점검 목록만 보이게 비워 둔다. 항목을 고른 뒤에야 해당 패널을 펼친다.
  const [section, setSection] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getAdminOverview();
      setOverview({
        directory: result.directory.data,
        usage: result.usage.data,
        approval: result.approval.data,
        popups: result.popups.data,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const directory = overview.directory ?? EMPTY_DIRECTORY;

  return (
    <article className="gw-page gw-admin-page" aria-labelledby="page-title">
      <header className="gw-page-header">
        <div>
          <h1 id="page-title">관리자</h1>
          <p>회원·조직, 시스템 사용량과 대시보드·게시판 구성을 서버 권한 검증과 감사 로그를 거쳐 관리합니다.</p>
        </div>
      </header>

      <AdminControlIndexPanel
        directory={overview.directory}
        usage={overview.usage}
        approval={overview.approval}
        popups={overview.popups}
        loading={loading}
        onReload={load}
        activeSection={section}
        onSelectSection={setSection}
      />

      {section === 'membership' && <MembershipApprovalPanel directory={directory} />}
      {section === 'employee' && <EmployeeProfilePanel directory={directory} />}
      {section === 'organization' && <OrganizationManagementPanel directory={directory} onReload={load} />}
      {section === 'widgets' && <DashboardWidgetPanel directory={directory} />}
      {section === 'usage' && <SystemUsagePanel usage={overview.usage} loading={loading} onReload={load} />}
    </article>
  );
}
