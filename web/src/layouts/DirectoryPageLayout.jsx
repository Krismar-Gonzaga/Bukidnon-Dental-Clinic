import './DirectoryPageLayout.css';

// Shared content layout for listing-style pages and their intro/filter sections.
function DirectoryPageLayout({
  title,
  eyebrow,
  description,
  filters,
  resultsLabel,
  centeredIntro = false,
  contentClassName,
  children,
}) {
  return (
    <div className="directory-page">
      <main className="directory-page-main">
        <section
          className={`directory-page-intro${centeredIntro ? ' is-centered' : ''}`}
          aria-labelledby="directory-page-title"
        >
          <div className="directory-page-container">
            {eyebrow && <span className="directory-page-eyebrow">{eyebrow}</span>}
            <h1 id="directory-page-title" className="directory-page-title">
              {title}
            </h1>
            <p className="directory-page-text">{description}</p>
          </div>
        </section>

        {filters && (
          <div className="directory-page-filter-bar">
            <div className="directory-page-container">{filters}</div>
          </div>
        )}

        <section
          className={`directory-page-results${
            contentClassName ? ` ${contentClassName}` : ''
          }`}
          aria-label={resultsLabel}
        >
          <div className="directory-page-container">{children}</div>
        </section>
      </main>
    </div>
  );
}

export default DirectoryPageLayout;
