import { Link } from 'react-router-dom';
import CompanyMark from './CompanyMark.jsx';

export default function GroupwareBrand({ compact = false, to = '/' }) {
  const content = (
    <>
      <CompanyMark className="gw-brand-mark" />
      <span className="gw-brand-copy">
        <strong>재경로지스｜물류</strong>
        <small>GROUPWARE</small>
      </span>
    </>
  );

  if (to) {
    return (
      <Link className={`gw-brand${compact ? ' gw-brand--compact' : ''}`} to={to} aria-label="재경로지스｜물류 그룹웨어">
        {content}
      </Link>
    );
  }

  return (
    <span className={`gw-brand${compact ? ' gw-brand--compact' : ''}`}>
      {content}
    </span>
  );
}
