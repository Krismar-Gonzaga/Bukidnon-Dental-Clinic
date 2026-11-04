import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { BackLink, Card } from '../../../components/clinic/ClinicAdminUi';
import { Pill } from '../../../components/clinic/ClinicUi';
import { Field, FormError } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { getPrescriptions, issuePrescription, printPrescription } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { PatientSelect } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 20;

function PrescriptionCard({ clinicId, prescription, onPrintError }) {
  const print = useMutation({ mutationFn: () => printPrescription(clinicId, prescription.id), onError: onPrintError });
  return (
    <article className="dentist-list-card">
      <div className="dentist-list-head">
        <span className="dentist-list-icon" aria-hidden="true">
          <Icon name="bookOpen" size={20} />
        </span>
        <div className="dentist-list-head-body">
          <p className="dentist-row-title">
            {prescription.medication} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>— {prescription.dosage}</span>
          </p>
          <p className="dentist-row-sub">
            {prescription.patient?.name} · {formatDate(prescription.issued_at)}
          </p>
        </div>
        <Pill tone="warning">Issued</Pill>
      </div>
      <div className="dentist-list-fields is-three">
        <p><strong>Frequency:</strong> {prescription.frequency}</p>
        <p><strong>Duration:</strong> {prescription.duration}</p>
        <p><strong>Instructions:</strong> {prescription.instructions || '—'}</p>
      </div>
      <div className="dentist-list-foot">
        <button type="button" className="dentist-link" disabled={print.isPending} onClick={() => print.mutate()}>
          <Icon name="download" size={16} />
          Print
        </button>
        <span className="dentist-muted" aria-hidden="true">·</span>
        <a href={`${getClinicHref(clinicId, 'patients')}/${prescription.patient?.id}`} className="dentist-link is-plain">
          Patient Record
        </a>
      </div>
    </article>
  );
}

/** Prescriptions: every one this dentist issued. They are never edited once issued. */
function PrescriptionsPage() {
  const { clinicId, can } = useClinicAccess();
  const [page, setPage] = useState(1);
  const [printError, setPrintError] = useState(null);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'prescriptions', page],
    queryFn: () => getPrescriptions(clinicId, { page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta?.total;

  return (
    <ClinicLayout
      section="prescriptions"
      title="Prescriptions"
      subtitle={total != null ? `${total} ${total === 1 ? 'prescription' : 'prescriptions'} issued` : null}
      requires={['records.view']}
      hideSearch
      headerActions={
        can('documents.issue') && (
          <a href={`${getClinicHref(clinicId, 'prescriptions')}/new`} className="btn btn-primary clinic-header-button">
            <Icon name="plus" size={18} />
            New Prescription
          </a>
        )
      }
    >
      <FormError error={printError} />
      <QueryState query={query} loadingLabel="Loading prescriptions…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">No prescriptions issued yet.</p>
          ) : (
            <>
              {items.map((prescription) => (
                <PrescriptionCard key={prescription.id} clinicId={clinicId} prescription={prescription} onPrintError={setPrintError} />
              ))}
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="prescriptions" label="Prescription pages" />
            </>
          )
        }
      </QueryState>
    </ClinicLayout>
  );
}

export function PrescriptionFormPage() {
  const { clinicId } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('patient') ?? '');
  const [form, setForm] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' });
  const listHref = getClinicHref(clinicId, 'prescriptions');
  const change = (name) => (event) => setForm((f) => ({ ...f, [name]: event.target.value }));
  const save = useMutation({
    mutationFn: () => issuePrescription(clinicId, { patient_id: patientId, ...form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'prescriptions'] });
      navigate(listHref);
    },
  });
  const isComplete = patientId && form.medication.trim() && form.dosage.trim() && form.frequency.trim() && form.duration.trim();

  return (
    <ClinicLayout section="prescriptions" title="New Prescription" subtitle={null} requires={['documents.issue']} hideSearch>
      <div className="dentist-page-back">
        <BackLink href={listHref}>Back to Prescriptions</BackLink>
      </div>
      <div className="dentist-narrower">
        <Card>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <PatientSelect clinicId={clinicId} value={patientId} onChange={setPatientId} />
            <Field label="Medication" required maxLength={255} placeholder="e.g. Amoxicillin" value={form.medication} onChange={change('medication')} />
            <div className="dentist-form-row is-three">
              <Field label="Dosage" required maxLength={100} placeholder="e.g. 500mg" value={form.dosage} onChange={change('dosage')} />
              <Field label="Frequency" required maxLength={100} placeholder="e.g. Every 8 hours" value={form.frequency} onChange={change('frequency')} />
              <Field label="Duration" required maxLength={100} placeholder="e.g. 5 days" value={form.duration} onChange={change('duration')} />
            </div>
            <Field label="Instructions" as="textarea" rows={3} maxLength={2000} placeholder="Special instructions for the patient…" value={form.instructions} onChange={change('instructions')} />
            <FormError error={save.error} />
            <div className="dentist-actions-row">
              <button type="submit" className="btn btn-primary" disabled={!isComplete || save.isPending}>
                <Icon name="checkCircle" size={18} />
                {save.isPending ? 'Saving…' : 'Save Prescription'}
              </button>
              <a href={listHref} className="btn btn-outline">
                Cancel
              </a>
            </div>
          </form>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default PrescriptionsPage;
