import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../components/portal/PortalUi';
import { getClinicHref } from '../../config/clinicNavigation';
import { inviteMember } from '../../services/clinicPortalApi';
import { getSpecializations } from '../../services/publicApi';
import '../../components/clinic/ClinicAdminUi.css';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const EMPTY = { firstName: '', lastName: '', email: '', phone: '', specializationId: '', years: '', education: '', days: [1, 2, 3, 4, 5], startsAt: '08:00', endsAt: '17:00' };

function ClinicAddDentistPage() {
  const { clinicId } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const specializations = useQuery({ queryKey: ['specializations', 'list'], queryFn: getSpecializations });
  const backHref = getClinicHref(clinicId, 'dentists');

  const send = useMutation({
    mutationFn: () =>
      inviteMember(clinicId, {
        role: 'dentist',
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        specialization_id: form.specializationId ? Number(form.specializationId) : undefined,
        years_experience: form.years === '' ? undefined : Number(form.years),
        qualifications: form.education.trim() || undefined,
        ...(form.days.length > 0 ? { working_days: form.days, starts_at: form.startsAt, ends_at: form.endsAt } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      navigate(backHref);
    },
  });

  const bind = (name) => ({ value: form[name], onChange: (event) => setForm((f) => ({ ...f, [name]: event.target.value })) });
  const toggleDay = (day) => setForm((f) => ({ ...f, days: f.days.includes(day) ? f.days.filter((d) => d !== day) : [...f.days, day] }));

  return (
    <ClinicLayout section="dentists" title="Add Dentist" subtitle="Invite a licensed dentist to join your clinic" requires={['clinic.staff.manage']} hideSearch>
      <BackLink href={backHref}>Back to Dentists</BackLink>
      <div className="clinic-form-page">
        <Card>
          <div className="clinic-form-head">
            <span className="clinic-form-head-icon">
              <Icon name="userPlus" size={22} />
            </span>
            <div>
              <h2 className="clinic-admin-card-title">Invite a Dentist</h2>
              <p className="clinic-admin-card-sub">Fill in the details or send an email invitation</p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <div className="portal-form-grid">
              <Field label="First name" required maxLength={120} {...bind('firstName')} />
              <Field label="Last name" required maxLength={120} {...bind('lastName')} />
              <Field label="Email address" type="email" required className="is-wide" maxLength={255} placeholder="dentist@example.com" {...bind('email')} />
              <Field label="Phone number" type="tel" className="is-wide" maxLength={30} {...bind('phone')} />
              <Field
                label="Specialization"
                as="select"
                options={[{ value: '', label: 'Choose…' }, ...(specializations.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
                {...bind('specializationId')}
              />
              <Field label="Years of experience" type="number" min="0" max="70" placeholder="e.g. 7" {...bind('years')} />
              <Field label="Educational background" className="is-wide" maxLength={2000} placeholder="e.g. UST College of Dentistry" {...bind('education')} />
              <div className="is-wide">
                <p className="portal-field-label">Working days</p>
                <div className="clinic-chips">
                  {DAYS.map(({ day, label }) => (
                    <button key={day} type="button" className={`clinic-chip-button${form.days.includes(day) ? ' is-active' : ''}`} aria-pressed={form.days.includes(day)} onClick={() => toggleDay(day)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Start time" type="time" required={form.days.length > 0} {...bind('startsAt')} />
              <Field label="End time" type="time" required={form.days.length > 0} {...bind('endsAt')} />
            </div>
            <p className="clinic-info-note">
              <Icon name="mail" size={16} />
              <span>
                <strong>Send Email Invitation.</strong> An invitation link will be sent to the dentist's email to set up their account and complete onboarding.
              </span>
            </p>
            <FormError error={send.error} />
            <div className="clinic-form-actions">
              <a href={backHref} className="btn btn-outline">
                Cancel
              </a>
              <button type="submit" className="btn btn-primary" disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default ClinicAddDentistPage;
