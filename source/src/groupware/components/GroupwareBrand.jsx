import { Link } from 'react-router-dom';

export default function GroupwareBrand({ compact = false }) {
  return (
    <Link className={`gw-brand${compact ? ' gw-brand--compact' : ''}`} to="/login" aria-label="재경로지스｜물류 그룹웨어 로그인으로 이동">
      <span className="gw-brand-mark" aria-hidden="true">J</span>
      <span className="gw-brand-copy">
        <strong>재경로지스｜물류</strong>
        <small>GROUPWARE</small>
      </span>
    </Link>
  );
}
