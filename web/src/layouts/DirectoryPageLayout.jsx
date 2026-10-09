import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import './DirectoryPageLayout.css';

// Shared shell for listing-style pages (clinics, dentists, services, contact):
// header, intro band, optional filter bar, content area, footer.
function DirectoryPageLayout({
  activeHref,
  title,
  description,
  filters,
  resultsLabel,
  centeredIntro = false,
  contentClassName,
  children,
}) {
  return (
    <div className="directory-page">
      <SiteHeader activeHref={activeHref} />

      <main className="directory-page-main">
        <section
          className={`directory-page-intro${centeredIntro ? ' is-centered' : ''}`}
          aria-labelledby="directory-page-title"
        >
          <div className="directory-page-container">
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

      <SiteFooter />
    </div>
  );
}

export default DirectoryPageLayout;
