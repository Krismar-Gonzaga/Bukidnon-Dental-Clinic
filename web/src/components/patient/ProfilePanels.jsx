import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../Icon';
import ProfileInfoCard from './ProfileInfoCard';
import { QueryState } from '../StatusMessage';
import {
  ALLERGY_SEVERITIES,
  ALLERGY_TYPES,
  ANXIETY_LEVELS,
  ANXIETY_SCALE_MAX,
  CONDITIONS_NOTICE,
  CONSENT_OPTIONS,
  VITAL_FIELDS,
} from '../../config/profile';
import { getEditProfileHref } from '../../config/patientNavigation';
import { getErrorMessage } from '../../services/apiErrors';
import { updateNotificationPreferences } from '../../services/notificationApi';
import { getMedicalHistory, getSharedRecords, updateConsents } from '../../services/patientApi';
import { PATIENT_PROFILE_KEY } from '../../pages/profileKeys';
import { formatBirthDate, getAge } from '../../utils/profile';

const orDash = (value) => value || '—';

export const CLINIC_RECORDED_NOTE =
  'Recorded by your clinic during visits. To correct something, tell your dentist at your next appointment.';

const Empty = ({ children }) => <p className="profile-empty-text">{children}</p>;

export function OverviewPanel({ profile, counts }) {
  return (
    <>
      <div className="profile-overview-grid">
        <ProfileInfoCard
          title="Personal Information"
          subtitle="Basic demographic details"
          editHref={getEditProfileHref('overview')}
          rows={[
            { label: 'Full Name', value: profile.name },
            { label: 'Date of Birth', value: profile.birthDate ? formatBirthDate(profile.birthDate) : '—' },
            { label: 'Age', value: profile.birthDate ? `${getAge(profile.birthDate)} years old` : '—' },
            { label: 'Gender', value: orDash(profile.gender) },
            { label: 'Civil Status', value: orDash(profile.civilStatus) },
            { label: 'Blood Type', value: orDash(profile.bloodType) },
          ]}
        />
        <ProfileInfoCard
          title="Contact Details"
          subtitle="How we reach you"
          editHref={getEditProfileHref('overview')}
          rows={[
            { label: 'Email', value: profile.email },
            { label: 'Mobile', value: orDash(profile.phone) },
            { label: 'Address', value: orDash(profile.address) },
            { label: 'City', value: orDash(profile.city) },
            { label: 'Province', value: orDash(profile.province) },
            { label: 'Zip Code', value: orDash(profile.zipCode) },
          ]}
        />
      </div>

      {counts && (
        <section className="profile-activity" aria-labelledby="profile-activity-title">
          <h2 id="profile-activity-title" className="profile-activity-title">
            Activity Summary
          </h2>
          <dl className="profile-activity-grid">
            {[
              { label: 'Total Appointments', value: counts.total },
              { label: 'Completed', value: counts.completed },
              { label: 'Upcoming', value: counts.upcoming },
              { label: 'Reviews Submitted', value: counts.reviews_given },
            ].map(({ label, value }) => (
              <div key={label} className="profile-activity-item">
                <dd>{value}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

// What clinics recorded stays visible next to what the patient reports (right of access).
function ClinicRecordsCard() {
  const history = useQuery({ queryKey: ['patient', 'medicalHistory'], queryFn: getMedicalHistory });
  const records = useQuery({ queryKey: ['patient', 'records'], queryFn: getSharedRecords });

  return (
    <ProfileInfoCard title="Recorded by Your Clinics" subtitle={CLINIC_RECORDED_NOTE}>
      <QueryState query={history} loadingLabel="Loading…">
        {(entries) =>
          entries.length > 0 ? (
            <dl className="profile-info-card-rows">
              {entries.map((entry) => (
                <div key={entry.clinic} className="profile-clinic-record">
                  <dt>
                    {entry.clinic} · {entry.recordedAt}
                  </dt>
                  <dd>Allergies: {orDash(entry.allergies)}</dd>
                  <dd>Medications: {orDash(entry.medications)}</dd>
                  <dd>Conditions: {orDash(entry.conditions)}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <Empty>No conditions recorded by a clinic yet.</Empty>
          )
        }
      </QueryState>
      <QueryState query={records} loadingLabel="Loading…">
        {(items) =>
          items.length > 0 && (
            <ul className="profile-record-list">
              {items.map((record) => (
                <li key={record.id} className="profile-record">
                  <p className="profile-record-title">
                    {record.procedures || record.type} · {record.date}
                  </p>
                  <p className="profile-record-meta">
                    {record.clinic}
                    {record.dentist && ` · ${record.dentist}`}
                  </p>
                  {record.careInstructions && <p className="profile-record-text">{record.careInstructions}</p>}
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </ProfileInfoCard>
  );
}

// Amber when the patient added a note, green when they report nothing, neutral otherwise.
const vitalTone = ({ value, note }) => {
  if (note) return 'warning';
  return /^none/i.test(value ?? '') ? 'success' : 'neutral';
};

export function MedicalPanel({ health }) {
  const editHref = getEditProfileHref('medical');

  return (
    <div className="profile-stack">
      <ProfileInfoCard title="Medical Conditions" subtitle="Existing or prior diagnoses relevant to dental care" editHref={editHref}>
        {health.conditions.length > 0 ? (
          <>
            <ul className="profile-chips">
              {health.conditions.map((condition) => (
                <li key={condition} className="profile-chip is-warning">
                  {condition}
                </li>
              ))}
            </ul>
            <p className="profile-notice">
              <Icon name="alertCircle" size={16} />
              {CONDITIONS_NOTICE}
            </p>
          </>
        ) : (
          <Empty>No conditions added.</Empty>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard title="Previous Dental Procedures" subtitle="Relevant past treatments" editHref={editHref}>
        {health.procedures.length > 0 ? (
          <ul className="profile-rows">
            {health.procedures.map((procedure, index) => (
              <li key={`${procedure.name}-${index}`} className="profile-row">
                <span className="profile-row-icon">
                  <Icon name="stethoscope" size={18} />
                </span>
                <div className="profile-row-body">
                  <p className="profile-row-title">{procedure.name}</p>
                  {procedure.detail && <p className="profile-row-text">{procedure.detail}</p>}
                  {procedure.note && <p className="profile-row-note">{procedure.note}</p>}
                </div>
                {procedure.date && <span className="profile-row-date">{procedure.date}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No procedures added.</Empty>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard title="Vital & Systemic Notes" subtitle="Information that may affect anesthesia or treatment" editHref={editHref}>
        <dl className="profile-vitals">
          {VITAL_FIELDS.map(({ id, label }) => {
            const vital = health.vitals[id] ?? {};
            return (
              <div key={id} className={`profile-vital is-${vital.value ? vitalTone(vital) : 'neutral'}`}>
                <dt>{label}</dt>
                <dd>{orDash(vital.value)}</dd>
                {vital.note && <dd className="profile-vital-note">{vital.note}</dd>}
              </div>
            );
          })}
        </dl>
      </ProfileInfoCard>

      <ClinicRecordsCard />
    </div>
  );
}

const typeLabel = (value) => ALLERGY_TYPES.find((type) => type.value === value)?.label ?? value;

export function AllergiesPanel({ health }) {
  const editHref = getEditProfileHref('allergies');
  const { level, sedation, notes } = health.anxiety;

  return (
    <div className="profile-stack">
      <ProfileInfoCard title="Known Allergies" subtitle="Drug, food, and material sensitivities" editHref={editHref}>
        {health.allergies.length > 0 ? (
          <ul className="profile-rows">
            {health.allergies.map((allergy, index) => (
              <li key={`${allergy.name}-${index}`} className="profile-row is-danger">
                <span className="profile-row-icon">
                  <Icon name="alertCircle" size={18} />
                </span>
                <div className="profile-row-body">
                  <p className="profile-row-title">
                    {allergy.name}
                    <span className="profile-chip">{typeLabel(allergy.type)}</span>
                    <span className={`profile-chip is-${ALLERGY_SEVERITIES[allergy.severity]?.tone}`}>
                      {ALLERGY_SEVERITIES[allergy.severity]?.label}
                    </span>
                  </p>
                  {allergy.reaction && <p className="profile-row-text">Reaction: {allergy.reaction}</p>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No allergies added.</Empty>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard title="Current Medications" subtitle="Medicines taken regularly that may interact with dental treatments" editHref={editHref}>
        {health.medications.length > 0 ? (
          <ul className="profile-rows">
            {health.medications.map((medication, index) => (
              <li key={`${medication.name}-${index}`} className="profile-row">
                <span className="profile-row-icon">
                  <Icon name="stethoscope" size={18} />
                </span>
                <div className="profile-row-body">
                  <p className="profile-row-title">
                    {medication.name}
                    {medication.dosage && <span className="profile-row-dose">{medication.dosage}</span>}
                  </p>
                  {medication.purpose && <p className="profile-row-text">For: {medication.purpose}</p>}
                  {medication.note && (
                    <p className="profile-row-warning">
                      <Icon name="alertCircle" size={13} />
                      {medication.note}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No medications added.</Empty>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard title="Dental Anxiety" subtitle="Helps the dentist prepare and accommodate your needs" editHref={editHref}>
        <div className="profile-anxiety">
          <div className="profile-anxiety-box">
            <p className="profile-anxiety-label">Anxiety Level</p>
            <p className="profile-anxiety-value">{level ? ANXIETY_LEVELS[level - 1] : '—'}</p>
            <div
              className="profile-anxiety-bar"
              role="img"
              aria-label={level ? `Level ${level} of ${ANXIETY_SCALE_MAX}` : 'Not set'}
            >
              {Array.from({ length: ANXIETY_SCALE_MAX }, (_, index) => (
                <span key={index} className={index < (level ?? 0) ? 'is-on' : undefined} />
              ))}
            </div>
          </div>
          <div className="profile-anxiety-box">
            <p className="profile-anxiety-label">Preferred Sedation</p>
            <p className="profile-anxiety-value">{orDash(sedation)}</p>
          </div>
          <div className="profile-anxiety-box is-wide">
            <p className="profile-anxiety-label">Notes for Dentist</p>
            <p className="profile-row-text">{orDash(notes)}</p>
          </div>
        </div>
      </ProfileInfoCard>
    </div>
  );
}

function ConsentSwitches({ profile }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    // The first switch is the existing email preference; the rest are stored consents.
    mutationFn: ({ id, value }) =>
      id === 'emailReminders' ? updateNotificationPreferences({ email: value }) : updateConsents({ [id]: value }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PATIENT_PROFILE_KEY }),
  });

  const current = (id) => (id === 'emailReminders' ? profile.emailNotifications : Boolean(profile.consents[id]));

  return (
    <>
      <ul className="profile-consents">
        {CONSENT_OPTIONS.map(({ id, label }) => {
          const pending = save.isPending && save.variables?.id === id;
          const checked = pending ? save.variables.value : current(id);
          return (
            <li key={id}>
              <label className="profile-consent">
                <span>{label}</span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={checked}
                  disabled={save.isPending}
                  onChange={(event) => save.mutate({ id, value: event.target.checked })}
                />
                <span className="profile-switch" aria-hidden="true" />
              </label>
            </li>
          );
        })}
      </ul>
      {save.isError && (
        <p className="profile-avatar-error" role="alert">
          {getErrorMessage(save.error)}
        </p>
      )}
    </>
  );
}

export function EmergencyPanel({ profile }) {
  const editHref = getEditProfileHref('emergency');
  const hasContact = Boolean(profile.emergencyContactName || profile.emergencyContactPhone);

  return (
    <div className="profile-stack">
      <ProfileInfoCard
        title="Primary Emergency Contact"
        subtitle="Person to contact in case of emergency during or after a procedure"
        editHref={editHref}
        rows={
          hasContact
            ? [
                { label: 'Relationship', value: orDash(profile.emergencyContactRelationship) },
                { label: 'Mobile Number', value: orDash(profile.emergencyContactPhone) },
                { label: 'Address', value: orDash(profile.emergencyContactAddress) },
              ]
            : []
        }
      >
        {hasContact ? (
          <div className="profile-contact-card">
            <span className="profile-contact-avatar" aria-hidden="true">
              {(profile.emergencyContactName || '?').charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="profile-row-title">{orDash(profile.emergencyContactName)}</p>
              {profile.emergencyContactRelationship && <p className="profile-row-text">{profile.emergencyContactRelationship}</p>}
              {profile.emergencyContactPhone && (
                <a className="profile-contact-phone" href={`tel:${profile.emergencyContactPhone.replace(/\s/g, '')}`}>
                  {profile.emergencyContactPhone}
                </a>
              )}
            </div>
          </div>
        ) : (
          <Empty>No emergency contact added.</Empty>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard title="Consent & Preferences" subtitle="Communication and treatment consent settings">
        <ConsentSwitches profile={profile} />
      </ProfileInfoCard>
    </div>
  );
}
