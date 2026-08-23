import { Link } from 'react-router-dom';

export default function GroupwareBrand({ compact = false }) {
  return (
    <Link className={`gw-brand${compact ? ' gw-brand--compact' : ''}`} to="/login" aria-label="재경닷컴 그룹웨어 로그인으로 이동">
      <span className="gw-brand-mark" aria-hidden="true">J</span>
      <span className="gw-brand-copy">
        <strong>재경닷컴</strong>
        <small>GROUPWARE</small>
      </span>
    </Link>
  );
}
