import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import ProfileField from '../components/patient/ProfileField';
import PasswordStrengthMeter from '../components/patient/PasswordStrengthMeter';
import SuccessCard from '../components/patient/SuccessCard';
import {
  PASSWORD_CHANGED_MESSAGE,
  PASSWORD_CHANGED_TITLE,
  PASSWORD_MIN_LENGTH,
} from '../config/profile';
import { PATIENT_PROFILE_HREF } from '../config/patientNavigation';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './ChangePasswordPage.css';

const INITIAL_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };
const STRENGTH_TEXT_ID = 'change-password-strength';

const getFormError = ({ newPassword, confirmPassword }) => {
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    return `New password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (newPassword !== confirmPassword) return 'New passwords do not match.';
  return '';
};

// Change Password with a MOCK submit: the form checks the new password
// locally, then shows the success screen. Nothing is sent yet.
function ChangePasswordPage() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [isChanged, setIsChanged] = useState(false);
  const successRef = useRef(null);

  useEffect(() => {
    if (isChanged) successRef.current?.focus();
  }, [isChanged]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setError('');
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const formError = getFormError(form);
    if (formError) {
      setError(formError);
      return;
    }
    // MOCK change password: replace with POST /change-password during integration.
    setIsChanged(true);
  };

  const field = (name) => ({
    id: `change-password-${name}`,
    name,
    type: 'password',
    icon: 'lock',
    revealable: true,
    required: true,
    value: form[name],
    onChange: handleChange,
  });

  return (
    <PatientLayout
      title="Change Password"
      activeHref={PATIENT_PROFILE_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="change-password-page">
        <a href={PATIENT_PROFILE_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Profile
        </a>

        {isChanged ? (
          <SuccessCard
            ref={successRef}
            title={PASSWORD_CHANGED_TITLE}
            message={PASSWORD_CHANGED_MESSAGE}
            action={
              <a href={PATIENT_PROFILE_HREF} className="btn btn-primary">
                Back to Profile
              </a>
            }
          />
        ) : (
          <form
            className="patient-panel change-password-card"
            aria-labelledby="change-password-title"
            onSubmit={handleSubmit}
            noValidate
          >
            <span className="change-password-icon" aria-hidden="true">
              <Icon name="lock" size={24} />
            </span>
            <h2 id="change-password-title" className="change-password-title">
              Change Password
            </h2>

            <ProfileField
              label="Current Password"
              autoComplete="current-password"
              {...field('currentPassword')}
            />
            <ProfileField
              label="New Password"
              autoComplete="new-password"
              aria-describedby={STRENGTH_TEXT_ID}
              {...field('newPassword')}
            />
            <ProfileField
              label="Confirm New Password"
              autoComplete="new-password"
              {...field('confirmPassword')}
            />

            <PasswordStrengthMeter id={STRENGTH_TEXT_ID} password={form.newPassword} />

            {error && (
              <p className="change-password-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-lg change-password-submit">
              Update Password
            </button>
          </form>
        )}
      </div>
    </PatientLayout>
  );
}

export default ChangePasswordPage;
