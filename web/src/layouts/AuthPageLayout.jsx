import Icon from '../components/Icon';
import { BRAND_NAME, BRAND_TAGLINE } from '../config/app';
import './AuthPageLayout.css';

const HOME_HREF = '/';

// Standalone frame for sign-in and registration: no full site header or
// footer, as in the Figma designs. Adds a way back home and brand context.
function AuthPageLayout({ children }) {
  return (
    <div className="auth-page">
      <header className="auth-page-bar">
        <a href={HOME_HREF} className="auth-page-back">
          <Icon name="arrowLeft" size={18} />
          Back to Home
        </a>
      </header>

      <main className="auth-page-main">
        <div className="auth-page-brand">
          <p className="auth-page-wordmark">{BRAND_NAME}</p>
          <p className="auth-page-tagline">{BRAND_TAGLINE}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export default AuthPageLayout;
