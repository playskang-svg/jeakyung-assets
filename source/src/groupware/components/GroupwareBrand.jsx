import { Link } from 'react-router-dom';
import CompanyMark from './CompanyMark.jsx';

export default function GroupwareBrand({ compact = false }) {
  return (
    <Link className={`gw-brand${compact ? ' gw-brand--compact' : ''}`} to="/login" aria-label="재경로지스｜물류 그룹웨어 로그인으로 이동">
      <CompanyMark className="gw-brand-mark" />
      <span className="gw-brand-copy">
        <strong>재경로지스｜물류</strong>
        <small>GROUPWARE</small>
      </span>
    </Link>
  );
}
