import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge, Checkbox, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import SlotPickerModal from '../../components/portal/SlotPickerModal';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import {
  addMedicalHistory,
  amendRecord,
  bookForPatient,
  createRecord,
  getClinicAppointments,
  getClinicDentists,
  getClinicPatient,
  getClinicServices,
  getPatientMedicalHistory,
  getPatientRecords,
  updateClinicPatient,
} from '../../services/clinicPortalApi';
import { formatDateTime, formatShortDate } from '../../utils/dateTime';

const RECORD_TYPES = ['examination', 'treatment', 'consultation'];
const EMPTY_RECORD = {
  record_type: 'treatment',
  chief_complaint: '',
  findings: '',
  procedures: '',
  tooth_numbers: '',
  notes: '',
  care_instructions: '',
  is_patient_visible: false,
};

function Demographics({ patient, patientId }) {
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

  return (
    <Section
      title={patient.name}
      subtitle={patient.has_portal_account ? 'Has a patient portal account' : 'Walk-in patient (no portal account)'}
      actions={
        can('patients.manage') &&
        !form && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() =>
              setForm({
                full_name: patient.name ?? '',
                email: patient.email ?? '',
                phone: patient.phone ?? '',
                address: patient.address ?? '',
                birth_date: patient.birth_date ?? '',
                emergency_contact_name: patient.emergency_contact_name ?? '',
                emergency_contact_phone: patient.emergency_contact_phone ?? '',
              })
            }
          >
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
              Save
            </button>
          </div>
        </form>
      ) : (
        <dl className="portal-details">
          <dt>Phone</dt>
          <dd>{patient.phone || '—'}</dd>
          <dt>Email</dt>
          <dd>{patient.email || '—'}</dd>
          <dt>Date of birth</dt>
          <dd>{patient.birth_date || '—'}</dd>
          <dt>Gender</dt>
          <dd>{patient.gender || '—'}</dd>
          <dt>Address</dt>
          <dd>{patient.address || '—'}</dd>
          <dt>Emergency contact</dt>
          <dd>{[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' · ') || '—'}</dd>
        </dl>
      )}
    </Section>
  );
}

function PatientAppointments({ patient }) {
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
    <Section
      title="Appointments"
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
    </Section>
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
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const bind = (name) => ({ value: form?.[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Section
      title="Medical history"
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
          {({ current, history }) =>
            current ? (
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
                {history.length > 0 && (
                  <p className="portal-field-hint portal-spaced-top">{history.length} earlier version(s) kept.</p>
                )}
              </>
            ) : (
              <p className="portal-empty">Nothing recorded yet.</p>
            )
          }
        </QueryState>
      )}
    </Section>
  );
}

function RecordForm({ initial, isAmendment, isSaving, error, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const bind = (name) => ({ value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <div className="portal-form-grid">
        <Field label="Type" as="select" options={RECORD_TYPES} {...bind('record_type')} />
        <Field label="Tooth numbers" placeholder="e.g. 16, 47" {...bind('tooth_numbers')} />
        <Field label="Chief complaint" as="textarea" className="is-wide" {...bind('chief_complaint')} />
        <Field label="Findings" as="textarea" {...bind('findings')} />
        <Field label="Procedures performed" as="textarea" {...bind('procedures')} />
        <Field label="Internal notes" as="textarea" {...bind('notes')} hint="Never shown to the patient." />
        <Field label="Care instructions" as="textarea" {...bind('care_instructions')} />
        <div className="is-wide">
          <Checkbox
            label="Share procedures and care instructions with the patient"
            checked={Boolean(form.is_patient_visible)}
            onChange={(e) => setForm((f) => ({ ...f, is_patient_visible: e.target.checked }))}
          />
        </div>
        {isAmendment && (
          <Field label="Reason for correction" as="textarea" required className="is-wide" {...bind('amendment_reason')} />
        )}
      </div>
      <FormError error={error} />
      <div className="portal-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : isAmendment ? 'Save correction' : 'Save record'}
        </button>
      </div>
    </form>
  );
}

function ClinicalRecords({ patientId }) {
  const { clinicId, can } = useClinic();
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(null); // 'new' or the record being corrected
  const key = ['clinic', clinicId, 'patient', patientId, 'records', showHistory];
  const query = useQuery({ queryKey: key, queryFn: () => getPatientRecords(clinicId, patientId, showHistory) });

  const save = useMutation({
    mutationFn: (form) =>
      editing === 'new' ? createRecord(clinicId, patientId, form) : amendRecord(clinicId, patientId, editing.id, form),
    onSuccess: () => {
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patient', patientId, 'records'] });
    },
  });

  return (
    <Section
      title="Clinical records"
      subtitle="Viewing is logged. Records cannot be edited or deleted; corrections are added as amendments."
      actions={
        <>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowHistory((s) => !s)}>
            {showHistory ? 'Hide corrected versions' : 'Show corrected versions'}
          </button>
          {can('records.write') && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setEditing('new')}>
              Add record
            </button>
          )}
        </>
      }
    >
      <QueryState query={query} loadingLabel="Loading records…">
        {(records) =>
          records.length === 0 ? (
            <p className="portal-empty">No clinical records yet.</p>
          ) : (
            <ul className="portal-list">
              {records.map((record) => (
                <li key={record.id} className="portal-list-item">
                  <div className="portal-section-header">
                    <div>
                      <strong>{record.record_type}</strong>{' '}
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
        <Modal title={editing === 'new' ? 'New clinical record' : 'Correct record'} onClose={() => setEditing(null)} wide>
          <RecordForm
            initial={editing === 'new' ? EMPTY_RECORD : { ...EMPTY_RECORD, ...editing, amendment_reason: '' }}
            isAmendment={editing !== 'new'}
            isSaving={save.isPending}
            error={save.error}
            onSave={(form) => save.mutate(form)}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </Section>
  );
}

function PatientDetail({ patientId }) {
  const { clinicId, can } = useClinic();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'patient', patientId], queryFn: () => getClinicPatient(clinicId, patientId) });

  return (
    <div className="portal-stack">
      <a href={getClinicHref(clinicId, 'patients')} className="patient-back-link">
        <Icon name="chevronLeft" size={16} />
        Back to patients
      </a>
      <QueryState query={query} loadingLabel="Loading patient…">
        {(patient) => (
          <>
            <Demographics patient={patient} patientId={patientId} />
            {can('appointments.view_all', 'appointments.view_assigned') && <PatientAppointments patient={patient} />}
            {can('records.view') && <MedicalHistory patientId={patientId} />}
            {can('records.view') && <ClinicalRecords patientId={patientId} />}
          </>
        )}
      </QueryState>
    </div>
  );
}

function ClinicPatientDetailPage() {
  const { patientId } = useParams();
  return (
    <ClinicLayout section="patients" title="Patient" requires={['patients.view']}>
      <PatientDetail patientId={patientId} />
    </ClinicLayout>
  );
}

export default ClinicPatientDetailPage;
