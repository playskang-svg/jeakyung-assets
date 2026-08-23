import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import BoardBuilderPanel from '../../components/admin/BoardBuilderPanel.jsx';
import { getOrganizationDirectory } from '../../services/organizationService.js';

const EMPTY_DIRECTORY = { departments: [], positions: [], jobTitles: [], roles: [] };

export default function BoardAdminPage() {
  const [directory, setDirectory] = useState(EMPTY_DIRECTORY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDirectory = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      setDirectory(await getOrganizationDirectory());
    } catch {
      setError('게시판 권한 대상이 되는 조직과 역할 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDirectory(); }, [loadDirectory]);

  return (
    <article className="gw-page gw-admin-page" aria-labelledby="page-title">
      <header className="gw-page-header">
        <div>
          <span className="gw-eyebrow">BOARD ADMINISTRATION</span>
          <h1 id="page-title">게시판 관리</h1>
          <p>게시판 종류를 선택하고 사용자별 읽기·쓰기·댓글 권한을 설정합니다.</p>
        </div>
        <div className="gw-admin-actions">
          <Link className="gw-secondary-button" to="/admin">전체 관리자 화면</Link>
          <Link className="gw-primary-button" to="/boards">사용자 게시판 확인</Link>
        </div>
      </header>
      {error ? <div className="gw-notice gw-notice--warning" role="alert">{error}<br /><button type="button" onClick={loadDirectory}>다시 시도</button></div> : loading ? <p className="gw-empty-state" role="status">게시판 관리 정보를 불러오고 있습니다.</p> : <BoardBuilderPanel directory={directory} />}
    </article>
  );
}
