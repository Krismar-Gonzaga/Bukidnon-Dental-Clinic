import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { BackLink, Card } from '../../../components/clinic/ClinicAdminUi';
import { InitialsTile, PageTabs, Pill } from '../../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { getClinicAppointments } from '../../../services/clinicPortalApi';
import { addMedicalHistory, getChecklist, getDentistPatient, getMedicalHistory, getPatientRecordList, saveChecklist } from '../../../services/dentistApi';
import { formatDate, formatDateTime, toBusinessDateKey } from '../../../utils/dateTime';
import { statusOf } from '../frontDesk';
import { formatDay, hasText, orNone } from './dentistUi';
import { FileGallery } from './ImagingPage';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'medical', label: 'Medical History' },
  { value: 'dental', label: 'Dental History' },
  { value: 'treatment', label: 'Treatment History' },
  { value: 'imaging', label: 'Imaging' },
];

const CHECKLIST = [
  ['allergies_reviewed', 'Patient allergies reviewed'],
  ['conditions_assessed', 'Medical conditions assessed'],
  ['medications_reviewed', 'Medications reviewed for interactions'],
  ['blood_pressure_normal', 'Blood pressure within normal range'],
  ['blood_sugar_safe', 'Blood sugar within safe range'],
  ['latex_free_required', 'Latex-free materials required'],
];

const RECENT_APPOINTMENTS = 5;
const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');
const isNote = (record) => record.record_type !== 'treatment';
const recordDay = (record) => formatDay(record.performed_on ?? toBusinessDateKey(record.created_at));

function FlagPill({ text }) {
  return hasText(text) ? <Pill tone="danger">{text}</Pill> : <Pill tone="success">None</Pill>;
}

function OverviewTab({ clinicId, patientId, summary, history, records }) {
  const appointments = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'patient', patientId],
    queryFn: () => getClinicAppointments(clinicId, { patient_id: patientId, per_page: RECENT_APPOINTMENTS }),
  });
  const plan = records.find((record) => isNote(record) && record.status === 'final' && hasText(record.treatment_plan));

  return (
    <div className="dentist-columns">
      <Card title="Current Treatment Plan">
        <p className="clinic-admin-card-sub">{plan ? plan.treatment_plan : 'No treatment plan on record. Plans written in clinical notes appear here.'}</p>
      </Card>
      <Card title="Allergies & Conditions">
        <p className="dentist-info-label">Allergies</p>
        <p style={{ margin: '4px 0 12px' }}>
          <FlagPill text={summary?.allergies} />
        </p>
        <p className="dentist-info-label">Medical Conditions</p>
        <p style={{ margin: '4px 0 0' }}>
          <FlagPill text={summary?.conditions} />
        </p>
      </Card>
      <Card title="Current Medications">
        <p className="clinic-admin-card-sub">{hasText(history?.current?.medications) ? history.current.medications : 'No current medications on record.'}</p>
      </Card>
      <Card title="Recent Appointments">
        <QueryState query={appointments} loadingLabel="Loading appointments…">
          {({ appointments: rows }) =>
            rows.length === 0 ? (
              <p className="clinic-admin-card-sub">No appointments yet.</p>
            ) : (
              <ul className="dentist-side-list">
                {[...rows].reverse().map((appointment) => {
                  const status = statusOf(appointment.backendStatus);
                  return (
                    <li key={appointment.id} className="dentist-side-row" style={{ justifyContent: 'space-between' }}>
                      <span>
                        <span className="dentist-row-title" style={{ display: 'block', fontSize: '0.8125rem' }}>
                          {appointment.service}
                        </span>
                        <span className="dentist-muted">{formatDate(appointment.startsAt)}</span>
                      </span>
                      <Pill tone={status.tone}>{status.label}</Pill>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryState>
      </Card>
    </div>
  );
}

function HistoryEditor({ clinicId, patientId, current, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    allergies: current?.allergies ?? '',
    conditions: current?.conditions ?? '',
    medications: current?.medications ?? '',
  });
  const change = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const save = useMutation({
    mutationFn: () => addMedicalHistory(clinicId, patientId, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patients'] });
      onClose();
    },
  });
  return (
    <Modal title="Update Medical History" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Known Allergies" as="textarea" rows={2} maxLength={2000} value={form.allergies} onChange={change('allergies')} />
        <Field label="Medical Conditions" as="textarea" rows={2} maxLength={2000} value={form.conditions} onChange={change('conditions')} />
        <Field label="Current Medications" as="textarea" rows={2} maxLength={2000} value={form.medications} onChange={change('medications')} />
        <p className="clinic-file-meta">Earlier entries are kept as history.</p>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Ticked by the dentist. Nothing shows as reviewed until someone has reviewed it. */
function Checklist({ clinicId, patientId }) {
  const queryClient = useQueryClient();
  const key = ['clinic', clinicId, 'patients', patientId, 'checklist'];
  const query = useQuery({ queryKey: key, queryFn: () => getChecklist(clinicId, patientId) });
  const save = useMutation({
    mutationFn: (items) => saveChecklist(clinicId, patientId, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  return (
    <Card title="Pre-procedure Checklist">
      <QueryState query={query} loadingLabel="Loading checklist…">
        {(data) => (
          <>
            {CHECKLIST.map(([id, label]) => {
              const done = Boolean(data.items[id]);
              return (
                <button
                  key={id}
                  type="button"
                  className={`dentist-check${done ? ' is-done' : ''}`}
                  aria-pressed={done}
                  disabled={save.isPending}
                  onClick={() => save.mutate({ ...data.items, [id]: !done })}
                >
                  <Icon name={done ? 'checkCircle' : 'clock'} size={18} />
                  {label}
                </button>
              );
            })}
            <FormError error={save.error} />
            <p className="clinic-file-meta">{data.reviewed_at ? `Last reviewed by ${data.reviewed_by}, ${formatDateTime(data.reviewed_at)}` : 'Not reviewed yet. Tap an item once you have checked it.'}</p>
          </>
        )}
      </QueryState>
    </Card>
  );
}

function MedicalTab({ clinicId, patientId, summary, history }) {
  const [isEditing, setIsEditing] = useState(false);
  const current = history?.current;
  const rows = [
    ['Blood Type', summary?.blood_type ?? 'Not on file'],
    ['Medical Conditions', orNone(current?.conditions)],
    ['Known Allergies', orNone(current?.allergies)],
    ['Current Medications', orNone(current?.medications)],
  ];
  return (
    <div className="dentist-columns">
      <Card
        title="Medical History"
        actions={
          <button type="button" className="clinic-link-button" onClick={() => setIsEditing(true)}>
            Update
          </button>
        }
      >
        <dl className="dentist-details">
          {rows.map(([label, value]) => (
            <div key={label} className="dentist-detail-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Checklist clinicId={clinicId} patientId={patientId} />
      {isEditing && <HistoryEditor clinicId={clinicId} patientId={patientId} current={current} onClose={() => setIsEditing(false)} />}
    </div>
  );
}

function DentalTab({ records }) {
  const notes = records.filter(isNote);
  return (
    <Card title="Dental History">
      {notes.length === 0 ? (
        <p className="clinic-admin-card-sub">No clinical notes yet.</p>
      ) : (
        notes.map((note) => (
          <article key={note.id} className="dentist-entry">
            <div className="dentist-entry-head">
              <p className="dentist-row-title">{recordDay(note)}</p>
              <Pill tone="warning">{note.status === 'draft' ? 'Draft' : 'Finalized'}</Pill>
            </div>
            {note.chief_complaint && <p><strong>Chief Complaint:</strong> {note.chief_complaint}</p>}
            {note.diagnosis && <p><strong>Diagnosis:</strong> {note.diagnosis}</p>}
            {note.procedures && <p><strong>Treatment:</strong> {note.procedures}</p>}
            {note.follow_up_recommendations && <p><strong>Follow-up:</strong> {note.follow_up_recommendations}</p>}
          </article>
        ))
      )}
    </Card>
  );
}

function TreatmentTab({ records }) {
  const treatments = records.filter((record) => !isNote(record));
  return (
    <Card title="Treatment History">
      {treatments.length === 0 ? (
        <p className="clinic-admin-card-sub">No treatments recorded yet.</p>
      ) : (
        treatments.map((record) => (
          <article key={record.id} className="dentist-entry">
            <div className="dentist-entry-head">
              <p className="dentist-row-title">{record.procedures}</p>
              <span className="dentist-muted">{recordDay(record)}</span>
            </div>
            <div className="dentist-list-fields">
              <p><strong>Tooth/Area:</strong> {record.tooth_numbers || '—'}</p>
              <p><strong>Materials:</strong> {record.materials_used || '—'}</p>
              {record.notes && <p className="dentist-list-wide"><strong>Remarks:</strong> {record.notes}</p>}
            </div>
          </article>
        ))
      )}
    </Card>
  );
}

function ProfileBody({ clinicId, patient }) {
  const [tab, setTab] = useState('overview');
  const records = useQuery({ queryKey: ['clinic', clinicId, 'patients', patient.id, 'records'], queryFn: () => getPatientRecordList(clinicId, patient.id) });
  const history = useQuery({ queryKey: ['clinic', clinicId, 'patients', patient.id, 'history'], queryFn: () => getMedicalHistory(clinicId, patient.id) });
  const summary = patient.medical_summary;
  const lastVisit = patient.last_visit_at ? new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date(patient.last_visit_at)) : '—';

  return (
    <>
      <Card>
        <div className="dentist-profile-head">
          <InitialsTile name={patient.name} size="lg" tone="navy" />
          <div className="dentist-profile-main">
            <h2 className="dentist-profile-name">
              {patient.name}
              <Pill tone={patient.status === 'active' ? 'success' : 'neutral'}>{capitalize(patient.status)}</Pill>
            </h2>
            <p className="dentist-row-sub">
              {[patient.age != null ? `${patient.age} years` : null, capitalize(patient.gender), summary?.blood_type ? `Blood Type: ${summary.blood_type}` : null].filter(Boolean).join(' · ')}
            </p>
            <div className="dentist-profile-contact">
              {patient.phone && <p className="dentist-meta-line"><Icon name="phone" size={14} />{patient.phone}</p>}
              {patient.email && <p className="dentist-meta-line"><Icon name="mail" size={14} />{patient.email}</p>}
              {patient.address && <p className="dentist-meta-line"><Icon name="mapPin" size={14} />{patient.address}</p>}
            </div>
          </div>
          <div className="dentist-profile-figures">
            <div className="dentist-figure">
              <strong>{patient.visits}</strong>
              <span>Visits</span>
            </div>
            <div className="dentist-figure">
              <strong>{lastVisit}</strong>
              <span>Last Visit</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="clinic-form-gap">
        <PageTabs label="Patient sections" value={tab} onChange={setTab} tabs={TABS} />
      </div>

      <div className="clinic-form-gap">
        {tab === 'imaging' ? (
          <Card title="Imaging & Attachments">
            <FileGallery clinicId={clinicId} patientId={patient.id} />
          </Card>
        ) : (
          <QueryState query={records} loadingLabel="Loading records…">
            {(list) => (
              <QueryState query={history} loadingLabel="Loading medical history…">
                {(medical) => (
                  <>
                    {tab === 'overview' && <OverviewTab clinicId={clinicId} patientId={patient.id} summary={summary} history={medical} records={list} />}
                    {tab === 'medical' && <MedicalTab clinicId={clinicId} patientId={patient.id} summary={summary} history={medical} />}
                    {tab === 'dental' && <DentalTab records={list} />}
                    {tab === 'treatment' && <TreatmentTab records={list} />}
                  </>
                )}
              </QueryState>
            )}
          </QueryState>
        )}
      </div>
    </>
  );
}

/** Patient Profile: everything this dentist knows about one patient. Reads are logged. */
function DentistPatientProfile() {
  const { clinicId, patientId } = useParams();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'patients', patientId, 'profile'], queryFn: () => getDentistPatient(clinicId, patientId) });

  return (
    <ClinicLayout
      section="patients"
      title="Patient Profile"
      subtitle={null}
      hideSearch
      headerActions={
        <>
          <a href={`${getClinicHref(clinicId, 'dental-chart')}?patient=${patientId}`} className="btn btn-outline clinic-header-button">
            <Icon name="activity" size={18} />
            Dental Chart
          </a>
          <a href={`${getClinicHref(clinicId, 'prescriptions')}/new?patient=${patientId}`} className="btn btn-primary clinic-header-button">
            <Icon name="bookOpen" size={18} />
            Prescribe
          </a>
        </>
      }
    >
      <div className="dentist-page-back">
        <BackLink href={getClinicHref(clinicId, 'patients')}>Back to Patients</BackLink>
      </div>
      <QueryState query={query} loadingLabel="Loading patient…">
        {(patient) => <ProfileBody clinicId={clinicId} patient={patient} />}
      </QueryState>
    </ClinicLayout>
  );
}

export default DentistPatientProfile;
