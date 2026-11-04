import Icon from '../components/Icon';
import { LOGIN_HREF } from '../config/navigation';
import { usePlatform } from '../services/platformStore';
import './MaintenancePage.css';

/** Shown to everyone but system administrators while Maintenance Mode is on. */
function MaintenancePage() {
  const { platform_name: name, support_email: email } = usePlatform();

  return (
    <main className="maintenance-page">
      <div className="maintenance-card">
        <span className="maintenance-icon" aria-hidden="true">
          <Icon name="settings" size={32} />
        </span>
        <h1 className="maintenance-title">{name} is down for maintenance</h1>
        <p className="maintenance-text">We are working on the platform and will be back soon. Please try again in a little while.</p>
        {email && (
          <p className="maintenance-text">
            Need help? Write to <a href={`mailto:${email}`}>{email}</a>.
          </p>
        )}
        <a href={LOGIN_HREF} className="maintenance-link">
          Administrator sign in
        </a>
      </div>
    </main>
  );
}

export default MaintenancePage;
