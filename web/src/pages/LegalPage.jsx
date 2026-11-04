import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import { LEGAL_PAGES } from '../config/legal';
import './LegalPage.css';

// Privacy notice and terms of use. The text in config/legal.js is a
// PROVISIONAL draft that the clinic owners and project stakeholders must
// review against their actual data processing before launch.
function LegalPage({ page }) {
  const { title, intro, updated, sections } = LEGAL_PAGES[page];

  return (
    <DirectoryPageLayout title={title} description={intro}>
      <article className="legal-page">
        <p className="legal-page-updated">Draft for review · last updated {updated}</p>
        {sections.map(({ heading, body }) => (
          <section key={heading} className="legal-page-section">
            <h2>{heading}</h2>
            {body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>
    </DirectoryPageLayout>
  );
}

export default LegalPage;
