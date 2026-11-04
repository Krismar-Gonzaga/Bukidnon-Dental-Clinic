import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, PageTabs, Pill } from '../../components/clinic/ClinicUi';
import { Badge, DataTable, Field, FormError, Modal } from '../../components/portal/PortalUi';
import SlotPickerModal from '../../components/portal/SlotPickerModal';
import { EMPTY_RECORD, RecordModal } from '../../components/portal/RecordForm';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref, getRecordTypeLabel } from '../../config/clinicNavigation';
import {
  addMedicalHistory,
  amendRecord,
  bookForPatient,
  createRecord,
  downloadPatientFile,
  getClinicAppointments,
  getClinicDentists,
  getClinicPatient,
  getClinicServices,
  getPatientFiles,
  getPatientMedicalHistory,
  getPatientRecords,
  updateClinicPatient,
  uploadPatientFile,
} from '../../services/clinicPortalApi';
import { formatDate, formatDateTime, formatShortDate } from '../../utils/dateTime';
import { ageFrom } from './ClinicPatientsPage';
import '../../components/clinic/ClinicAdminUi.css';

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MAX_FILE_MB = 10;

const formatSize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function PatientCard({ patient }) {
  const age = ageFrom(patient.birth_date);
  const summary = [age != null ? `${age} yrs` : null, GENDER_LABELS[patient.gender]].filter(Boolean).join(' · ');
  return (
    <Card>
      <div className="clinic-identity">
        <InitialsTile name={patient.name} size="lg" tone="navy" />
        <h2 className="clinic-identity-name">{patient.name}</h2>
        {summary && <p className="clinic-admin-card-sub">{summary}</p>}
        <Pill tone={patient.status === 'inactive' ? 'neutral' : 'success'}>{patient.status === 'inactive' ? 'Inactive' : 'Active'}</Pill>
        <ul className="clinic-identity-list">
          {patient.phone && (
            <li>
              <Icon name="phone" size={16} />
              {patient.phone}
            </li>
          )}
          {patient.email && (
            <li>
              <Icon name="mail" size={16} />
              {patient.email}
            </li>
          )}
          {patient.address && (
            <li>
              <Icon name="mapPin" size={16} />
              {patient.address}
            </li>
          )}
        </ul>
      </div>
    </Card>
  );
}

function SummaryChip({ label, value }) {
  return (
    <>
      <p className="clinic-chip-label">{label}</p>
      <div className="clinic-chip-list">
        <Pill tone={value ? 'warning' : 'neutral'}>{value || 'None'}</Pill>
      </div>
    </>
  );
}

function MedicalSummary({ patient }) {
  const summary = patient.medical_summary;
  return (
    <Card title="Medical Summary">
      <dl className="clinic-stat-rows">
        {summary && (
          <div>
            <dt>Blood Type</dt>
            <dd>{summary.blood_type || '—'}</dd>
          </div>
        )}
        <div>
          <dt>Last Visit</dt>
          <dd>{patient.last_visit_at ? formatDate(patient.last_visit_at) : 'No visits yet'}</dd>
        </div>
        <div>
          <dt>Total Visits</dt>
          <dd>{patient.visits ?? 0}</dd>
        </div>
      </dl>
      {summary && (
        <>
          <SummaryChip label="Conditions" value={summary.conditions} />
          <SummaryChip label="Allergies" value={summary.allergies} />
        </>
      )}
    </Card>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="clinic-detail-tile">
      <div>
        <dt>{label}</dt>
        <dd>{value || '—'}</dd>
      </div>
    </div>
  );
}

function OverviewTab({ patient, patientId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const save = useMutation({
    mutationFn: () => updateClinicPatient(clinicId, patientId, form),
    onSuccess: () => {
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patient', patientId] });
    },
  });
  const bind = (name) => ({ value: form?.[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const age = ageFrom(patient.birth_date);

  const startEditing = () =>
    setForm({
      full_name: patient.name ?? '',
      email: patient.email ?? '',
      phone: patient.phone ?? '',
      address: patient.address ?? '',
      birth_date: patient.birth_date ?? '',
      emergency_contact_name: patient.emergency_contact_name ?? '',
      emergency_contact_phone: patient.emergency_contact_phone ?? '',
      ...(patient.medical_summary ? { blood_type: patient.medical_summary.blood_type ?? '' } : {}),
    });

  return (
    <Card
      title="Personal Information"
      subtitle={patient.has_portal_account ? 'Has a patient portal account' : 'Walk-in patient (no portal account)'}
      actions={
        can('patients.manage') &&
        !form && (
          <button type="button" className="btn btn-outline btn-sm" onClick={startEditing}>
            Edit details
          </button>
        )
      }
    >
      {form ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="portal-form-grid">
            {!patient.has_portal_account && <Field label="Full name" required {...bind('full_name')} />}
            {!patient.has_portal_account && <Field label="Email" type="email" {...bind('email')} />}
            <Field label="Phone" type="tel" {...bind('phone')} />
            <Field label="Date of birth" type="date" {...bind('birth_date')} />
            {patient.medical_summary && !patient.has_portal_account && (
              <Field label="Blood type" as="select" options={[{ value: '', label: 'Unknown' }, ...BLOOD_TYPES.map((value) => ({ value, label: value }))]} {...bind('blood_type')} />
            )}
            <Field label="Address" className="is-wide" {...bind('address')} />
            <Field label="Emergency contact" {...bind('emergency_contact_name')} />
            <Field label="Emergency phone" type="tel" {...bind('emergency_contact_phone')} />
          </div>
          <FormError error={save.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <dl className="clinic-detail-tiles">
          <InfoTile label="Full name" value={patient.name} />
          <InfoTile label="Age" value={age != null ? `${age} years` : null} />
          <InfoTile label="Gender" value={GENDER_LABELS[patient.gender]} />
          <InfoTile label="Blood type" value={patient.medical_summary?.blood_type} />
          <InfoTile label="Phone" value={patient.phone} />
          <InfoTile label="Email" value={patient.email} />
          <InfoTile label="Address" value={patient.address} />
          <InfoTile label="Emergency contact" value={[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' · ')} />
        </dl>
      )}
    </Card>
  );
}

// Only present when the patient chose to share it; it is their own report, not a clinical record.
function PatientReportedHealth({ reported }) {
  const list = (items, format) => (items?.length ? items.map(format).join('; ') : '—');
  return (
    <>
      <h3 className="portal-subheading">Reported by the patient</h3>
      <dl className="portal-details">
        <dt>Blood type</dt>
        <dd>{reported.blood_type || '—'}</dd>
        <dt>Allergies</dt>
        <dd>{list(reported.allergies, (a) => `${a.name} (${a.severity})${a.reaction ? `: ${a.reaction}` : ''}`)}</dd>
        <dt>Medications</dt>
        <dd>{list(reported.medications, (m) => [m.name, m.dosage, m.purpose].filter(Boolean).join(', '))}</dd>
        <dt>Conditions</dt>
        <dd>{list(reported.conditions, (c) => c)}</dd>
        <dt>Dental anxiety</dt>
        <dd>{reported.anxiety?.level ? `Level ${reported.anxiety.level} of 5` : '—'}</dd>
        <dt>Notes for dentist</dt>
        <dd>{reported.anxiety?.notes || '—'}</dd>
      </dl>
    </>
  );
}

function MedicalHistory({ patientId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const key = ['clinic', clinicId, 'patient', patientId, 'medical'];
  const query = useQuery({ queryKey: key, queryFn: () => getPatientMedicalHistory(clinicId, patientId) });
  const [form, setForm] = useState(null);
  const save = useMutation({
    mutationFn: () => addMedicalHistory(clinicId, patientId, form),
    onSuccess: () => {
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patient', patientId] });
    },
  });
  const bind = (name) => ({ value: form?.[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Card
      title="Medical History"
      subtitle="Each update is kept; the newest entry is current."
      actions={
        can('records.write') &&
        !form && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => {
              const current = query.data?.current ?? {};
              setForm({ allergies: current.allergies ?? '', medications: current.medications ?? '', conditions: current.conditions ?? '', notes: '' });
            }}
          >
            Update
          </button>
        )
      }
    >
      {form ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="portal-form-grid">
            <Field label="Allergies" as="textarea" {...bind('allergies')} />
            <Field label="Medications" as="textarea" {...bind('medications')} />
            <Field label="Conditions" as="textarea" {...bind('conditions')} />
            <Field label="Clinic notes (not shown to the patient)" as="textarea" {...bind('notes')} />
          </div>
          <FormError error={save.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending}>
              Save entry
            </button>
          </div>
        </form>
      ) : (
        <QueryState query={query} loadingLabel="Loading…">
          {({ current, history, patient_reported: reported }) => (
            <>
              {reported && <PatientReportedHealth reported={reported} />}
              {current ? (
                <>
                  <dl className="portal-details">
                    <dt>Allergies</dt>
                    <dd>{current.allergies || '—'}</dd>
                    <dt>Medications</dt>
                    <dd>{current.medications || '—'}</dd>
                    <dt>Conditions</dt>
                    <dd>{current.conditions || '—'}</dd>
                    <dt>Notes</dt>
                    <dd>{current.notes || '—'}</dd>
                    <dt>Recorded</dt>
                    <dd>
                      {formatDateTime(current.recorded_at)} by {current.recorded_by ?? '—'}
                    </dd>
                  </dl>
                  {history.length > 0 && <p className="portal-field-hint portal-spaced-top">{history.length} earlier version(s) kept.</p>}
                </>
              ) : (
                <p className="portal-empty">Nothing recorded by the clinic yet.</p>
              )}
            </>
          )}
        </QueryState>
      )}
    </Card>
  );
}

function EmptyPanel({ icon, title, text }) {
  return (
    <div className="clinic-empty-panel">
      <span className="clinic-empty-icon">
        <Icon name={icon} size={26} />
      </span>
      <p className="clinic-empty-title">{title}</p>
      {text && <p className="clinic-admin-card-sub">{text}</p>}
    </div>
  );
}

function DentalRecordsTab({ patientId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' or the record being corrected
  const key = ['clinic', clinicId, 'patient', patientId, 'records', showHistory];
  const query = useQuery({ queryKey: key, queryFn: () => getPatientRecords(clinicId, patientId, showHistory) });

  const save = useMutation({
    mutationFn: (form) => (editing === 'new' ? createRecord(clinicId, patientId, form) : amendRecord(clinicId, patientId, editing.id, form)),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patient', patientId, 'records'] });
    },
  });

  return (
    <>
      <Card
        title="Dental Records"
        subtitle="Viewing is logged. Records cannot be edited or deleted; corrections are added as amendments."
        actions={
          <div className="clinic-header-actions">
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowHistory((s) => !s)}>
              {showHistory ? 'Hide corrected versions' : 'Show corrected versions'}
            </button>
            {can('records.write') && (
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
                <Icon name="plus" size={16} />
                Add Record
              </button>
            )}
          </div>
        }
      >
        <QueryState query={query} loadingLabel="Loading records…">
          {(records) =>
            records.length === 0 ? (
              <EmptyPanel icon="fileText" title="No dental records" text="Records added after a visit will appear here." />
            ) : (
              <ul className="portal-list">
                {records.map((record) => (
                  <li key={record.id} className="portal-list-item">
                    <div className="portal-section-header">
                      <div>
                        <strong>{getRecordTypeLabel(record.record_type)}</strong>{' '}
                        <span className="portal-table-muted">
                          {formatShortDate(record.created_at)} · {record.dentist ?? record.author}
                        </span>{' '}
                        {record.superseded_at && <Badge tone="warning">corrected</Badge>}
                        {record.amends_record_id && <Badge tone="info">correction</Badge>}
                        {record.is_patient_visible && <Badge tone="success">shared</Badge>}
                      </div>
                      {can('records.write') && !record.superseded_at && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(record)}>
                          Correct
                        </button>
                      )}
                    </div>
                    <dl className="portal-details">
                      {[
                        ['Chief complaint', record.chief_complaint],
                        ['Findings', record.findings],
                        ['Procedures', record.procedures],
                        ['Teeth', record.tooth_numbers],
                        ['Internal notes', record.notes],
                        ['Care instructions', record.care_instructions],
                        ['Correction reason', record.amendment_reason],
                      ]
                        .filter(([, value]) => value)
                        .map(([label, value]) => (
                          <div key={label} className="portal-details-row">
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                    </dl>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryState>
        {editing && (
          <RecordModal
            title={editing === 'new' ? 'New clinical record' : 'Correct record'}
            onClose={() => setEditing(null)}
            initial={editing === 'new' ? EMPTY_RECORD : { ...EMPTY_RECORD, ...editing, amendment_reason: '' }}
            isAmendment={editing !== 'new'}
            isSaving={save.isPending}
            error={save.error}
            onSave={(form) => save.mutate(form)}
          />
        )}
      </Card>
      <MedicalHistory patientId={patientId} />
    </>
  );
}

function HistoryTab({ patient }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [booking, setBooking] = useState(null); // { dentistId, serviceRateId }
  const [isPicking, setIsPicking] = useState(false);
  const appointments = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'patient', patient.id],
    queryFn: () => getClinicAppointments(clinicId, { patient_id: patient.id, per_page: 50 }),
  });
  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId), enabled: can('appointments.manage') });
  const services = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId), enabled: can('appointments.manage') });
  const book = useMutation({
    mutationFn: (slot) =>
      bookForPatient(clinicId, {
        patient_id: patient.id,
        service_rate_id: Number(booking.serviceRateId),
        dentist_id: Number(booking.dentistId),
        branch_id: slot.branchId,
        starts_at: slot.startsAt,
      }),
    onSuccess: () => {
      setIsPicking(false);
      setBooking(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
    },
  });

  const rows = appointments.data?.appointments ?? [];

  return (
    <Card
      title="Appointment History"
      actions={
        can('appointments.manage') && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setBooking({ dentistId: '', serviceRateId: '' })}>
            Book appointment
          </button>
        )
      }
    >
      <QueryState query={appointments} loadingLabel="Loading…">
        {() => (
          <DataTable
            caption="Patient appointments"
            rows={rows}
            emptyText="No appointments at this clinic yet."
            columns={[
              { key: 'dateTime', label: 'When' },
              { key: 'service', label: 'Service' },
              { key: 'dentist', label: 'Dentist' },
              { key: 'status', label: 'Status', render: (a) => <Badge status={a.backendStatus} /> },
              { key: 'open', label: '', render: (a) => <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`}>Open</a> },
            ]}
          />
        )}
      </QueryState>

      {booking && !isPicking && (
        <Modal title="Book appointment" onClose={() => setBooking(null)}>
          <div className="portal-form-grid">
            <Field
              label="Dentist"
              as="select"
              className="is-wide"
              options={[{ value: '', label: 'Choose…' }, ...(dentists.data ?? []).filter((d) => d.is_active).map((d) => ({ value: String(d.id), label: d.name }))]}
              value={booking.dentistId}
              onChange={(e) => setBooking((b) => ({ ...b, dentistId: e.target.value }))}
            />
            <Field
              label="Service"
              as="select"
              className="is-wide"
              options={[{ value: '', label: 'Choose…' }, ...(services.data ?? []).filter((s) => s.is_available).map((s) => ({ value: String(s.id), label: `${s.name} (${s.duration_minutes} min)` }))]}
              value={booking.serviceRateId}
              onChange={(e) => setBooking((b) => ({ ...b, serviceRateId: e.target.value }))}
            />
          </div>
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setBooking(null)}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" disabled={!booking.dentistId || !booking.serviceRateId} onClick={() => setIsPicking(true)}>
              Choose time
            </button>
          </div>
        </Modal>
      )}
      {booking && isPicking && (
        <SlotPickerModal
          title="Choose a time"
          clinicId={clinicId}
          dentistId={booking.dentistId}
          serviceRateId={booking.serviceRateId}
          confirmLabel="Book"
          isSaving={book.isPending}
          error={book.error}
          onClose={() => setIsPicking(false)}
          onConfirm={(slot) => book.mutate(slot)}
        />
      )}
    </Card>
  );
}

function FilesTab({ patientId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const input = useRef(null);
  const key = ['clinic', clinicId, 'patient', patientId, 'files'];
  const query = useQuery({ queryKey: key, queryFn: () => getPatientFiles(clinicId, patientId) });
  const upload = useMutation({
    mutationFn: (file) => uploadPatientFile(clinicId, patientId, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const download = useMutation({ mutationFn: (file) => downloadPatientFile(clinicId, patientId, file) });

  return (
    <Card
      title="Uploaded Files"
      subtitle={`PDF, JPG, PNG or WEBP, up to ${MAX_FILE_MB} MB. Every download is logged.`}
      actions={
        can('records.write') && (
          <>
            <input
              ref={input}
              type="file"
              hidden
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              aria-label="Choose a file to upload"
              onChange={(event) => {
                const [file] = event.target.files;
                event.target.value = '';
                if (file) upload.mutate(file);
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Icon name="upload" size={16} />
              {upload.isPending ? 'Uploading…' : 'Upload File'}
            </button>
          </>
        )
      }
    >
      <FormError error={upload.error || download.error} />
      <QueryState query={query} loadingLabel="Loading files…">
        {(files) =>
          files.length === 0 ? (
            <EmptyPanel icon="fileText" title="No files uploaded" text="X-rays and treatment plans uploaded here stay private to the clinic." />
          ) : (
            <ul className="clinic-file-list">
              {files.map((file) => (
                <li key={file.id} className="clinic-file">
                  <Icon name="fileText" size={22} />
                  <div className="clinic-file-body">
                    <p className="clinic-file-name">{file.name}</p>
                    <p className="clinic-file-meta">
                      {formatSize(file.size)} · {formatDate(file.uploaded_at)}
                    </p>
                  </div>
                  <button type="button" className="clinic-link-button" disabled={download.isPending} aria-label={`Download ${file.name}`} onClick={() => download.mutate(file)}>
                    <Icon name="download" size={16} />
                    Download
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Card>
  );
}

function PatientProfile({ patient, patientId }) {
  const { can } = useClinic();
  const [tab, setTab] = useState('overview');
  const tabs = [
    { value: 'overview', label: 'Overview' },
    can('records.view') && { value: 'records', label: 'Dental Records' },
    can('appointments.view_all', 'appointments.view_assigned') && { value: 'history', label: 'Appt. History' },
    can('records.view') && { value: 'files', label: 'Files' },
  ].filter(Boolean);

  return (
    <div className="clinic-split">
      <div>
        <PatientCard patient={patient} />
        <MedicalSummary patient={patient} />
      </div>
      <div>
        <PageTabs label="Patient sections" value={tab} onChange={setTab} tabs={tabs} />
        {tab === 'overview' && <OverviewTab patient={patient} patientId={patientId} />}
        {tab === 'records' && <DentalRecordsTab patientId={patientId} />}
        {tab === 'history' && <HistoryTab patient={patient} />}
        {tab === 'files' && <FilesTab patientId={patientId} />}
      </div>
    </div>
  );
}

function ClinicPatientDetailPage() {
  const { patientId } = useParams();
  const { clinicId, can } = useClinicAccess();
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patient', patientId],
    queryFn: () => getClinicPatient(clinicId, patientId),
    enabled: can('patients.view'),
  });

  return (
    <ClinicLayout section="patients" title={query.data?.name ?? 'Patient'} subtitle="Patient Profile" requires={['patients.view']} hideSearch>
      <BackLink href={getClinicHref(clinicId, 'patients')}>Back to Patients</BackLink>
      <QueryState query={query} loadingLabel="Loading patient…">
        {(patient) => <PatientProfile patient={patient} patientId={patientId} />}
      </QueryState>
    </ClinicLayout>
  );
}

export default ClinicPatientDetailPage;
