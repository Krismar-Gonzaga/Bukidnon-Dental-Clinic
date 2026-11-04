import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { Field, FormError, Section } from '../components/portal/PortalUi';
import { USER_ROLE_LABELS } from '../config/adminNavigation';
import { CLINIC_ROLE_LABELS } from '../config/clinicNavigation';
import { updateAccount } from '../services/authService';
import { getFieldErrors } from '../services/apiErrors';
import '../components/portal/portal.css';

/**
 * My Profile for clinic members, clinic applicants and system administrators
 * (patients have their own profile pages). `layout` is the portal frame:
 * it receives title and activeHref.
 */
function AccountProfilePage({ layout: Layout, activeHref, passwordHref }) {
  const { user, memberships, refresh } = useAuth();
  const [form, setForm] = useState({ name: user?.name ?? '', email: user?.email ?? '' });
  const save = useMutation({
    mutationFn: () => updateAccount(form),
    onSuccess: () => refresh(),
  });
  const fieldErrors = getFieldErrors(save.error);
  const bind = (name) => ({
    value: form[name],
    error: fieldErrors[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  return (
    <Layout title="My Profile" activeHref={activeHref}>
      <Section title="Account details" subtitle="Your name and sign-in email.">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="portal-form-grid">
            <Field label="Full name" required autoComplete="name" {...bind('name')} />
            <Field label="Email" type="email" required autoComplete="email" {...bind('email')} />
          </div>
          <FormError error={save.error} />
          {save.isSuccess && (
            <p className="portal-success portal-spaced-top" role="status">
              Profile saved.
            </p>
          )}
          <div className="portal-form-actions">
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </Section>

      <Section title="Role and access">
        <dl className="portal-details">
          <dt>Account type</dt>
          <dd>{USER_ROLE_LABELS[user?.role] ?? user?.role}</dd>
          {memberships.length > 0 && (
            <>
              <dt>Clinics</dt>
              <dd>
                <ul className="portal-plain-list">
                  {memberships.map((m) => (
                    <li key={m.clinic_id}>
                      {m.clinic_name} — {CLINIC_ROLE_LABELS[m.role] ?? m.role}
                    </li>
                  ))}
                </ul>
              </dd>
            </>
          )}
        </dl>
      </Section>

      {passwordHref && (
        <Section title="Security">
          <a href={passwordHref} className="btn btn-outline">
            Change password
          </a>
        </Section>
      )}
    </Layout>
  );
}

export default AccountProfilePage;
