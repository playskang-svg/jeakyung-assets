function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3 27 9.2v13.6L16 29 5 22.8V9.2L16 3Z" />
      <path d="m5.8 9.7 10.2 6 10.2-6M16 15.7v12" />
      <path d="m11 6 10.3 6" />
    </svg>
  );
}

export default function Brand({ href, placement }) {
  const isHeader = placement === 'header';

  return (
    <a
      className={`brand ${isHeader ? 'header-brand' : 'footer-brand'}`}
      href={href}
      aria-label="재경로지스｜물류 홈"
    >
      <BrandMark />
      {isHeader ? (
        <span className="brand-word" aria-hidden="true">
          <span className="brand-core">재경로지스</span>
          <span className="brand-suffix">｜물류</span>
        </span>
      ) : (
        <span>재경로지스｜물류</span>
      )}
    </a>
  );
}
