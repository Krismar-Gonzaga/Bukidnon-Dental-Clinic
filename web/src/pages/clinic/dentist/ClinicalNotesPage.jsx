import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { BackLink, Card } from '../../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill } from '../../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { correctRecord, getRecordsOfKind, saveNewRecord, updateDraft } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { PatientSelect } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 20;
const NEW_NOTE_TYPE = 'examination';

const NOTE_FIELDS = [
  ['chief_complaint', 'Chief Complaint', 'Enter chief complaint…'],
  ['findings', 'Clinical Findings', 'Enter clinical findings…'],
  ['diagnosis', 'Diagnosis', 'Enter diagnosis…'],
  ['procedures', 'Treatment Performed', 'Enter treatment performed…'],
  ['treatment_plan', 'Treatment Plan', 'Enter treatment plan…'],
  ['follow_up_recommendations', 'Follow-up Recommendations', 'Enter follow-up recommendations…'],
];

const blankNote = () => Object.fromEntries(NOTE_FIELDS.map(([name]) => [name, '']));
const noteValues = (note) => Object.fromEntries(NOTE_FIELDS.map(([name]) => [name, note?.[name] ?? '']));
const statusPill = (note) => <Pill tone="warning">{note.status === 'draft' ? 'Draft' : 'Finalized'}</Pill>;

function NoteFields({ form, onChange }) {
  return NOTE_FIELDS.map(([name, label, placeholder]) => (
    <Field key={name} label={label} as="textarea" rows={3} maxLength={5000} placeholder={placeholder} value={form[name]} onChange={(event) => onChange(name, event.target.value)} />
  ));
}

function hasContent(form) {
  return NOTE_FIELDS.some(([name]) => form[name].trim());
}

/** Finish or change a draft, or correct a final note, which keeps the original on record. */
function NoteEditor({ clinicId, note, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(noteValues(note));
  const [reason, setReason] = useState('');
  const isDraft = note.status === 'draft';
  const save = useMutation({
    mutationFn: (status) =>
      isDraft
        ? updateDraft(clinicId, note.patient_id, note.id, { record_type: note.record_type, ...form, status })
        : correctRecord(clinicId, note.patient_id, note.id, { record_type: note.record_type, ...form, status: 'final', amendment_reason: reason.trim() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'records'] });
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patients'] });
      onClose();
    },
  });

  return (
    <Modal title={isDraft ? 'Edit Draft' : 'Correct Note'} wide onClose={onClose}>
      <NoteFields form={form} onChange={(name, value) => setForm((f) => ({ ...f, [name]: value }))} />
      {!isDraft && <Field label="Reason for correction" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} hint="The original note stays on record." />}
      <FormError error={save.error} />
      <div className="portal-form-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        {isDraft && (
          <button type="button" className="btn btn-outline" disabled={save.isPending} onClick={() => save.mutate('draft')}>
            Save as Draft
          </button>
        )}
        <button type="button" className="btn btn-primary" disabled={save.isPending || !hasContent(form) || (!isDraft && !reason.trim())} onClick={() => save.mutate('final')}>
          {isDraft ? 'Finalize Note' : 'Save Correction'}
        </button>
      </div>
    </Modal>
  );
}

function FullNote({ note, onEdit, onClose }) {
  return (
    <Modal title={`${note.patient?.name} · ${formatDate(note.created_at)}`} wide onClose={onClose}>
      <p>{statusPill(note)}</p>
      <dl className="dentist-details">
        {NOTE_FIELDS.filter(([name]) => note[name]).map(([name, label]) => (
          <div key={name} className="dentist-detail-row">
            <dt>{label}</dt>
            <dd>{note[name]}</dd>
          </div>
        ))}
        {note.amendment_reason && (
          <div className="dentist-detail-row">
            <dt>Corrected because</dt>
            <dd>{note.amendment_reason}</dd>
          </div>
        )}
      </dl>
      <div className="portal-form-actions">
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        <button type="button" className="btn btn-primary" onClick={onEdit}>
          {note.status === 'draft' ? 'Edit Draft' : 'Correct Note'}
        </button>
      </div>
    </Modal>
  );
}

/** Clinical Notes: what was found and decided at each visit. */
function ClinicalNotesPage() {
  const { clinicId } = useClinicAccess();
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(null);
  const notesHref = getClinicHref(clinicId, 'clinical-notes');
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'records', 'notes', page],
    queryFn: () => getRecordsOfKind(clinicId, 'notes', { page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta?.total;

  return (
    <ClinicLayout
      section="clinical-notes"
      title="Clinical Notes"
      subtitle={total != null ? `${total} ${total === 1 ? 'note' : 'notes'} on record` : null}
      requires={['records.view']}
      hideSearch
      headerActions={
        <a href={`${notesHref}/new`} className="btn btn-primary clinic-header-button">
          <Icon name="plus" size={18} />
          New Note
        </a>
      }
    >
      <QueryState query={query} loadingLabel="Loading notes…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">No clinical notes yet.</p>
          ) : (
            <>
              {items.map((note) => (
                <article key={note.id} className="dentist-list-card">
                  <div className="dentist-list-head">
                    <InitialsTile name={note.patient?.name} size="sm" tone="navy" />
                    <div className="dentist-list-head-body">
                      <p className="dentist-row-title">{note.patient?.name}</p>
                      <p className="dentist-row-sub">{formatDate(note.created_at)}</p>
                    </div>
                    {statusPill(note)}
                  </div>
                  <div className="dentist-list-fields">
                    <p><strong>Complaint:</strong> {note.chief_complaint || '—'}</p>
                    <p><strong>Diagnosis:</strong> {note.diagnosis || '—'}</p>
                    <p className="dentist-list-wide"><strong>Treatment:</strong> {note.procedures || '—'}</p>
                  </div>
                  <div className="dentist-list-foot">
                    <button type="button" className="dentist-link" onClick={() => setViewing(note)}>
                      View Full Note
                    </button>
                    <span className="dentist-muted" aria-hidden="true">·</span>
                    <a href={`${getClinicHref(clinicId, 'patients')}/${note.patient_id}`} className="dentist-link is-plain">
                      Patient Profile
                    </a>
                  </div>
                </article>
              ))}
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="notes" label="Note pages" />
            </>
          )
        }
      </QueryState>
      {viewing && (
        <FullNote
          note={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
          }}
        />
      )}
      {editing && <NoteEditor clinicId={clinicId} note={editing} onClose={() => setEditing(null)} />}
    </ClinicLayout>
  );
}

/** New Clinical Note: kept as a private draft, or finalized into the patient's record. */
export function ClinicalNoteFormPage() {
  const { clinicId } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('patient') ?? '');
  const [form, setForm] = useState(blankNote);
  const notesHref = getClinicHref(clinicId, 'clinical-notes');
  const save = useMutation({
    mutationFn: (status) => saveNewRecord(clinicId, patientId, { record_type: NEW_NOTE_TYPE, ...form, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'records'] });
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patients'] });
      navigate(notesHref);
    },
  });
  const canSave = patientId && hasContent(form) && !save.isPending;

  return (
    <ClinicLayout section="clinical-notes" title="New Clinical Note" subtitle={null} requires={['records.write']} hideSearch>
      <div className="dentist-page-back">
        <BackLink href={notesHref}>Back to Notes</BackLink>
      </div>
      <div className="dentist-narrow">
        <Card>
          <PatientSelect clinicId={clinicId} value={patientId} onChange={setPatientId} />
          <NoteFields form={form} onChange={(name, value) => setForm((f) => ({ ...f, [name]: value }))} />
          <FormError error={save.error} />
          <div className="dentist-actions-row">
            <button type="button" className="btn btn-outline" disabled={!canSave} onClick={() => save.mutate('draft')}>
              Save as Draft
            </button>
            <button type="button" className="btn btn-primary" disabled={!canSave} onClick={() => save.mutate('final')}>
              <Icon name="checkCircle" size={18} />
              Finalize Note
            </button>
          </div>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default ClinicalNotesPage;
