export default function PageScaffold({ eyebrow, title, description, sections, notice }) {
  return (
    <article className="gw-page" aria-labelledby="page-title">
      <header className="gw-page-header">
        <div>
          <span className="gw-eyebrow">{eyebrow}</span>
          <h1 id="page-title">{title}</h1>
          <p>{description}</p>
        </div>
        <span className="gw-phase-badge">연동 준비</span>
      </header>
      {notice && <div className="gw-notice" role="status">{notice}</div>}
      <div className="gw-module-grid">
        {sections.map((section, index) => (
          <section className="gw-module-card" key={section.title} aria-labelledby={`module-${index}`}>
            <span className="gw-module-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <h2 id={`module-${index}`}>{section.title}</h2>
            <p>{section.description}</p>
            <span className="gw-module-state">다음 Phase 구현 예정</span>
          </section>
        ))}
      </div>
    </article>
  );
}
