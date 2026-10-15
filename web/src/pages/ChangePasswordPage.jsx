import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import { changePassword } from '../services/authService';
import { getErrorMessage, getFieldErrors } from '../services/apiErrors';
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

// Changing the password signs out the account's other devices; this
// session stays signed in.
function ChangePasswordPage({ layout: Layout = PatientLayout, backHref = PATIENT_PROFILE_HREF, activeHref = PATIENT_PROFILE_HREF }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const successRef = useRef(null);

  const change = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
    onSuccess: () => setForm(INITIAL_FORM),
    onError: (apiError) => {
      const fields = getFieldErrors(apiError);
      setError(fields.current_password ?? fields.new_password ?? getErrorMessage(apiError));
    },
  });

  useEffect(() => {
    if (change.isSuccess) successRef.current?.focus();
  }, [change.isSuccess]);

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
    change.mutate();
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
    <Layout title="Change Password" activeHref={activeHref}>
      <div className="change-password-page">
        <a href={backHref} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back
        </a>

        {change.isSuccess ? (
          <SuccessCard
            ref={successRef}
            title={PASSWORD_CHANGED_TITLE}
            message={`${PASSWORD_CHANGED_MESSAGE} Other devices were signed out.`}
            action={
              <a href={backHref} className="btn btn-primary">
                Done
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

            <ProfileField label="Current Password" autoComplete="current-password" {...field('currentPassword')} />
            <ProfileField
              label="New Password"
              autoComplete="new-password"
              aria-describedby={STRENGTH_TEXT_ID}
              {...field('newPassword')}
            />
            <ProfileField label="Confirm New Password" autoComplete="new-password" {...field('confirmPassword')} />

            <PasswordStrengthMeter id={STRENGTH_TEXT_ID} password={form.newPassword} />

            {error && (
              <p className="change-password-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-primary btn-lg change-password-submit" disabled={change.isPending}>
              {change.isPending ? 'Updating…' : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}

export default ChangePasswordPage;
