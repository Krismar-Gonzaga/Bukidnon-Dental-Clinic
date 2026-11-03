import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import Tabs from '../components/Tabs';
import ProfileAvatar from '../components/patient/ProfileAvatar';
import ProfileField from '../components/patient/ProfileField';
import RepeatableRows from '../components/patient/RepeatableRows';
import SuccessCard from '../components/patient/SuccessCard';
import { QueryState } from '../components/StatusMessage';
import {
  ALLERGY_SEVERITIES,
  ALLERGY_TYPES,
  ANXIETY_LEVELS,
  BLOOD_TYPE_OPTIONS,
  CIVIL_STATUS_OPTIONS,
  GENDER_OPTIONS,
  PROFILE_TABS,
  PROFILE_UPDATED_MESSAGE,
  PROFILE_UPDATED_TITLE,
  VITAL_FIELDS,
} from '../config/profile';
import { PATIENT_PROFILE_HREF } from '../config/patientNavigation';
import { getProfile, updateHealth, updateProfile } from '../services/patientApi';
import { getErrorMessage, getFieldErrors } from '../services/apiErrors';
import { CURRENT_USER_KEY } from '../auth/AuthContext';
import { PATIENT_PROFILE_KEY } from './profileKeys';
import { joinName, splitName } from '../utils/profile';
import '../components/patient/patientPanel.css';
import './EditProfilePage.css';

const EDIT_TABS = PROFILE_TABS.map(({ id, editLabel }) => ({ id, label: editLabel }));

// Backend field → form field, for showing validation errors.
const FIELD_NAMES = {
  name: 'firstName',
  email: 'email',
  phone: 'phone',
  address: 'address',
  birth_date: 'birthDate',
  gender: 'gender',
  civil_status: 'civilStatus',
  blood_type: 'bloodType',
  city: 'city',
  province: 'province',
  zip_code: 'zipCode',
  emergency_contact_name: 'emergencyContactName',
  emergency_contact_phone: 'emergencyContactPhone',
  emergency_contact_relationship: 'emergencyContactRelationship',
  emergency_contact_address: 'emergencyContactAddress',
};

const PROCEDURE_FIELDS = [
  { key: 'name', label: 'Procedure', placeholder: 'Tooth Extraction' },
  { key: 'date', label: 'Date', placeholder: 'March 2024' },
  { key: 'detail', label: 'Details', placeholder: 'Lower right molar (#47)' },
  { key: 'note', label: 'Notes', placeholder: 'No complications' },
];
const ALLERGY_FIELDS = [
  { key: 'name', label: 'Allergy', placeholder: 'Penicillin' },
  { key: 'type', label: 'Type', options: ALLERGY_TYPES },
  {
    key: 'severity',
    label: 'Severity',
    options: Object.entries(ALLERGY_SEVERITIES).map(([value, { label }]) => ({ value, label })),
  },
  { key: 'reaction', label: 'Reaction', placeholder: 'Hives, difficulty breathing' },
];
const MEDICATION_FIELDS = [
  { key: 'name', label: 'Medication', placeholder: 'Amlodipine' },
  { key: 'dosage', label: 'Dosage', placeholder: '5mg once daily' },
  { key: 'purpose', label: 'For', placeholder: 'Hypertension' },
  { key: 'note', label: 'Note for the dentist', placeholder: 'Anything to watch out for' },
];

// Blank rows are ones the patient added and left empty: they are not saved.
const withName = (rows) => rows.filter((row) => row.name?.trim());

function EditProfileForm({ profile, initialTab }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(() =>
    EDIT_TABS.some(({ id }) => id === initialTab) ? initialTab : 'overview'
  );
  const [form, setForm] = useState(() => ({ ...profile, ...splitName(profile.name) }));
  const [health, setHealth] = useState(() => ({
    ...profile.health,
    conditions: profile.health.conditions.map((name) => ({ name })),
  }));
  const successRef = useRef(null);

  const save = useMutation({
    mutationFn: async () => {
      await updateProfile({ ...form, name: joinName(form) });
      await updateHealth({
        ...health,
        conditions: withName(health.conditions).map(({ name }) => name.trim()),
        procedures: withName(health.procedures),
        allergies: withName(health.allergies),
        medications: withName(health.medications),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PATIENT_PROFILE_KEY });
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    },
  });

  useEffect(() => {
    if (save.isSuccess) successRef.current?.focus();
  }, [save.isSuccess]);

  const fieldErrors = Object.fromEntries(
    Object.entries(save.isError ? getFieldErrors(save.error) : {}).map(([key, message]) => [FIELD_NAMES[key] ?? key, message])
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const field = (name) => ({
    id: `profile-${name}`,
    name,
    value: form[name] ?? '',
    onChange: handleChange,
    'aria-invalid': fieldErrors[name] ? true : undefined,
  });

  const setSection = (section) => (value) => setHealth((current) => ({ ...current, [section]: value }));
  const setVital = (id, key, value) =>
    setHealth((current) => ({
      ...current,
      vitals: { ...current.vitals, [id]: { ...current.vitals[id], [key]: value } },
    }));
  const setAnxiety = (key, value) =>
    setHealth((current) => ({ ...current, anxiety: { ...current.anxiety, [key]: value } }));

  if (save.isSuccess) {
    return (
      <SuccessCard
        ref={successRef}
        title={PROFILE_UPDATED_TITLE}
        message={PROFILE_UPDATED_MESSAGE}
        action={
          <a href={PATIENT_PROFILE_HREF} className="btn btn-primary">
            Back to Profile
          </a>
        }
      />
    );
  }

  return (
    <form
      className="patient-panel edit-profile-card"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="edit-profile-photo">
        <ProfileAvatar name={profile.name} photoVersion={profile.photoVersion} action="link" />
      </div>

      <Tabs
        tabs={EDIT_TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        idPrefix="edit-profile"
        label="Profile sections"
        variant="pill"
      />

      <div
        role="tabpanel"
        id={`edit-profile-panel-${activeTab}`}
        aria-labelledby={`edit-profile-tab-${activeTab}`}
        className="edit-profile-panel"
      >
        {activeTab === 'overview' && (
          <div className="edit-profile-grid">
            <ProfileField label="First Name" required {...field('firstName')} />
            <ProfileField label="Last Name" {...field('lastName')} />
            <ProfileField label="Email Address" type="email" icon="mail" required className="is-wide" {...field('email')} />
            <ProfileField label="Phone Number" type="tel" icon="phone" className="is-wide" {...field('phone')} />
            <ProfileField label="Date of Birth" type="date" {...field('birthDate')} />
            <ProfileField label="Gender" options={GENDER_OPTIONS} {...field('gender')} />
            <ProfileField label="Civil Status" options={CIVIL_STATUS_OPTIONS} {...field('civilStatus')} />
            <ProfileField label="Blood Type" options={BLOOD_TYPE_OPTIONS} {...field('bloodType')} />
            <ProfileField label="Address" icon="mapPin" className="is-wide" {...field('address')} />
            <ProfileField label="City / Municipality" icon="mapPin" className="is-wide" {...field('city')} />
            <ProfileField label="Province" {...field('province')} />
            <ProfileField label="Zip Code" {...field('zipCode')} />
          </div>
        )}

        {activeTab === 'medical' && (
          <div className="edit-profile-sections">
            <RepeatableRows
              title="Medical Conditions"
              addLabel="Add condition"
              idPrefix="condition"
              rows={health.conditions}
              fields={[{ key: 'name', label: 'Condition', placeholder: 'Hypertension', wide: true }]}
              emptyRow={{ name: '' }}
              onChange={setSection('conditions')}
            />
            <RepeatableRows
              title="Previous Dental Procedures"
              addLabel="Add procedure"
              idPrefix="procedure"
              rows={health.procedures}
              fields={PROCEDURE_FIELDS}
              emptyRow={{ name: '', date: '', detail: '', note: '' }}
              onChange={setSection('procedures')}
            />
            <fieldset className="repeatable">
              <legend className="repeatable-title">Vital &amp; Systemic Notes</legend>
              <div className="edit-profile-grid">
                {VITAL_FIELDS.map(({ id, label, placeholder }) => (
                  <div key={id} className="edit-profile-vital">
                    <ProfileField
                      id={`vital-${id}`}
                      label={label}
                      placeholder={placeholder}
                      value={health.vitals[id]?.value ?? ''}
                      onChange={(event) => setVital(id, 'value', event.target.value)}
                    />
                    <input
                      className="edit-profile-note"
                      aria-label={`${label} note`}
                      placeholder="Note (optional)"
                      value={health.vitals[id]?.note ?? ''}
                      onChange={(event) => setVital(id, 'note', event.target.value)}
                    />
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'allergies' && (
          <div className="edit-profile-sections">
            <RepeatableRows
              title="Known Allergies"
              addLabel="Add allergy"
              idPrefix="allergy"
              rows={health.allergies}
              fields={ALLERGY_FIELDS}
              emptyRow={{ name: '', type: 'drug', severity: 'mild', reaction: '' }}
              onChange={setSection('allergies')}
            />
            <RepeatableRows
              title="Current Medications"
              addLabel="Add medication"
              idPrefix="medication"
              rows={health.medications}
              fields={MEDICATION_FIELDS}
              emptyRow={{ name: '', dosage: '', purpose: '', note: '' }}
              onChange={setSection('medications')}
            />
            <fieldset className="repeatable">
              <legend className="repeatable-title">Dental Anxiety</legend>
              <div className="edit-profile-grid">
                <ProfileField
                  id="anxiety-level"
                  label="Anxiety Level"
                  options={ANXIETY_LEVELS}
                  value={health.anxiety.level ? ANXIETY_LEVELS[health.anxiety.level - 1] : ''}
                  onChange={(event) => {
                    const index = ANXIETY_LEVELS.indexOf(event.target.value);
                    setAnxiety('level', index >= 0 ? index + 1 : null);
                  }}
                />
                <ProfileField
                  id="anxiety-sedation"
                  label="Preferred Sedation"
                  placeholder="Local anesthesia only"
                  value={health.anxiety.sedation ?? ''}
                  onChange={(event) => setAnxiety('sedation', event.target.value)}
                />
                <div className="is-wide">
                  <label htmlFor="anxiety-notes" className="profile-field-label">
                    Notes for Dentist
                  </label>
                  <textarea
                    id="anxiety-notes"
                    className="edit-profile-textarea"
                    rows={3}
                    maxLength={1000}
                    value={health.anxiety.notes ?? ''}
                    onChange={(event) => setAnxiety('notes', event.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          </div>
        )}

        {activeTab === 'emergency' && (
          <div className="edit-profile-grid">
            <ProfileField label="Contact Name" className="is-wide" {...field('emergencyContactName')} />
            <ProfileField label="Relationship" {...field('emergencyContactRelationship')} />
            <ProfileField label="Contact Phone" type="tel" icon="phone" {...field('emergencyContactPhone')} />
            <ProfileField label="Address" icon="mapPin" className="is-wide" {...field('emergencyContactAddress')} />
          </div>
        )}
      </div>

      {save.isError && (
        <div className="edit-profile-error" role="alert">
          <p>{Object.keys(fieldErrors).length > 0 ? 'Please check these fields:' : getErrorMessage(save.error)}</p>
          {Object.keys(fieldErrors).length > 0 && (
            <ul>
              {Object.values(fieldErrors).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="edit-profile-actions">
        <a href={PATIENT_PROFILE_HREF} className="btn btn-lg edit-profile-cancel">
          Cancel
        </a>
        <button type="submit" className="btn btn-primary btn-lg" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function EditProfilePage() {
  const [searchParams] = useSearchParams();
  const profile = useQuery({ queryKey: PATIENT_PROFILE_KEY, queryFn: getProfile });

  return (
    <PatientLayout title="Edit Profile" activeHref={PATIENT_PROFILE_HREF}>
      <div className="edit-profile-page">
        <a href={PATIENT_PROFILE_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Profile
        </a>
        <QueryState query={profile} loadingLabel="Loading your profile…">
          {(data) => <EditProfileForm profile={data} initialTab={searchParams.get('tab')} />}
        </QueryState>
      </div>
    </PatientLayout>
  );
}

export default EditProfilePage;
