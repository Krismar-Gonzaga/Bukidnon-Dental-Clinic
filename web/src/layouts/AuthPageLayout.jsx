import './AuthPageLayout.css';

// Standalone frame for sign-in and registration: no site header or footer,
// as in the Figma designs.
function AuthPageLayout({ children }) {
  return <main className="auth-page">{children}</main>;
}

export default AuthPageLayout;
