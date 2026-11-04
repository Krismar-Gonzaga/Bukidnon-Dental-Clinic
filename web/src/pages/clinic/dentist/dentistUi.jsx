import { useQuery } from '@tanstack/react-query';
import { Field } from '../../../components/portal/PortalUi';
import { getDentistPatients } from '../../../services/dentistApi';
import { formatDate, formatTime } from '../../../utils/dateTime';

// What the dentist pages share.

const PATIENT_OPTIONS_LIMIT = 100;

/** The dentist's patients, for the patient pickers on their forms and filters. */
export function usePatientOptions(clinicId) {
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'options'],
    queryFn: () => getDentistPatients(clinicId, { per_page: PATIENT_OPTIONS_LIMIT }),
  });
  return { ...query, patients: query.data?.items ?? [] };
}

export function PatientSelect({ clinicId, value, onChange, label = 'Patient', disabled = false }) {
  const { patients, isPending } = usePatientOptions(clinicId);
  return (
    <Field
      label={label}
      as="select"
      required
      disabled={disabled || isPending}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      options={[{ value: '', label: isPending ? 'Loading patients…' : 'Select a patient' }, ...patients.map((p) => ({ value: String(p.id), label: p.name }))]}
    />
  );
}

/** A date on its own, for fields stored without a time (YYYY-MM-DD). */
export function formatDay(day) {
  return day ? formatDate(`${day}T12:00:00+08:00`) : '';
}

/** "July 15, 2026 · 9:00 AM" */
export const dateAndTime = (iso) => `${formatDate(iso)} · ${formatTime(iso)}`;

const BYTES_PER_MB = 1024 * 1024;
export const fileSize = (bytes) => {
  const mb = (bytes ?? 0) / BYTES_PER_MB;
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round((bytes ?? 0) / 1024))} KB`;
};

export const FILE_CATEGORIES = [
  { value: 'panoramic_xray', label: 'Panoramic X-ray' },
  { value: 'periapical_xray', label: 'Periapical X-ray' },
  { value: 'intraoral_photo', label: 'Intraoral Photo' },
  { value: 'lab_result', label: 'Lab Result' },
  { value: 'other', label: 'Other' },
];

export const fileTitle = (file) => FILE_CATEGORIES.find(({ value }) => value === file.category)?.label ?? file.name;
export const isImageFile = (file) => String(file.mime_type ?? '').startsWith('image/');

/** "None" unless something is on record. */
export const orNone = (text) => (String(text ?? '').trim() ? text : 'None');
export const hasText = (text) => Boolean(String(text ?? '').trim());
