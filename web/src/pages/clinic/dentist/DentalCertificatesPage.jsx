import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../../components/portal/PortalUi';
import { previewCertificate, printNewCertificate } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { PatientSelect } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const TYPES = [
  { value: 'medical', title: 'Medical Certificate', note: 'General health clearance for dental procedures', field: 'Notes / Purpose' },
  { value: 'clearance', title: 'Dental Clearance', note: 'Patient cleared for specific activity or procedure', field: 'Purpose / Activity' },
  { value: 'treatment', title: 'Treatment Certificate', note: 'Record of dental treatment completed', field: 'Treatment Summary' },
];

function Preview({ document, onPrint, isPrinting, error }) {
  return (
    <div className="dentist-cert-preview">
      <p className="dentist-cert-clinic">{document.clinic.name}</p>
      <p className="dentist-row-sub">{document.clinic.address}</p>
      <span className="dentist-cert-badge">{document.title}</span>
      <div className="dentist-cert-body">
        <p style={{ margin: '0 0 8px' }}>
          This is to certify that <strong>{document.patient.name}</strong>
          {document.patient.description ? `, ${document.patient.description},` : ''} {document.statement}
        </p>
        <p style={{ margin: 0 }}>
          <strong>{document.purpose}</strong>
        </p>
      </div>
      <div className="dentist-cert-sign" />
      <p className="dentist-row-title" style={{ fontSize: '0.875rem' }}>{document.dentist.name}</p>
      {document.dentist.specialization && <p className="dentist-row-sub" style={{ fontSize: '0.75rem' }}>{document.dentist.specialization}</p>}
      <p className="dentist-row-sub" style={{ fontSize: '0.75rem' }}>PRC: {document.dentist.license_number || 'Not on file'}</p>
      <p className="dentist-muted">Issued: {formatDate(document.issued_at)}</p>
      {!document.dentist.license_number && (
        <p className="dentist-alert clinic-form-gap" role="alert" style={{ textAlign: 'left' }}>
          Your PRC licence number is not on file. Ask your clinic administrator to add it before printing.
        </p>
      )}
      <FormError error={error} />
      <button type="button" className="btn btn-primary clinic-form-gap" style={{ width: '100%' }} disabled={isPrinting || !document.dentist.license_number} onClick={onPrint}>
        <Icon name="download" size={18} />
        {isPrinting ? 'Preparing…' : 'Print Certificate'}
      </button>
      <p className="clinic-file-meta">Printing issues the certificate and adds it to the audit log.</p>
    </div>
  );
}

/** Dental Certificates: preview first; a certificate only exists once it is printed. */
function DentalCertificatesPage() {
  const { clinicId } = useClinicAccess();
  const queryClient = useQueryClient();
  const [type, setType] = useState(TYPES[0].value);
  const [patientId, setPatientId] = useState('');
  const [purpose, setPurpose] = useState('');
  const body = { patient_id: patientId, type, purpose: purpose.trim() };
  const preview = useMutation({ mutationFn: () => previewCertificate(clinicId, body) });
  const print = useMutation({
    mutationFn: () => printNewCertificate(clinicId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'certificates'] }),
  });
  const selected = TYPES.find(({ value }) => value === type);
  // What is on screen must be what gets printed, so any change clears the preview.
  const edit = (setter) => (value) => {
    setter(value);
    preview.reset();
    print.reset();
  };

  return (
    <ClinicLayout section="certificates" title="Dental Certificates" subtitle={null} requires={['documents.issue']} hideSearch>
      <div className="dentist-split">
        <div className="dentist-stack">
          <Card title="Certificate Type">
            <div className="dentist-cert-types">
              {TYPES.map((item) => (
                <button key={item.value} type="button" className={`dentist-cert-type${type === item.value ? ' is-active' : ''}`} aria-pressed={type === item.value} onClick={() => edit(setType)(item.value)}>
                  <Icon name="award" size={22} />
                  <span className="dentist-cert-title">{item.title}</span>
                  <span className="dentist-cert-note">{item.note}</span>
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                preview.mutate();
              }}
            >
              <PatientSelect clinicId={clinicId} value={patientId} onChange={edit(setPatientId)} />
              <Field label={selected.field} as="textarea" rows={3} required maxLength={2000} placeholder="Describe the purpose or treatment summary…" value={purpose} onChange={(event) => edit(setPurpose)(event.target.value)} />
              <FormError error={preview.error} />
              <button type="submit" className="btn btn-primary" disabled={!patientId || !purpose.trim() || preview.isPending}>
                <Icon name="eye" size={18} />
                {preview.isPending ? 'Preparing…' : 'Preview Certificate'}
              </button>
            </form>
          </Card>
        </div>
        <Card>
          {preview.data ? (
            <Preview document={preview.data} isPrinting={print.isPending} error={print.error} onPrint={() => print.mutate()} />
          ) : (
            <div className="dental-prompt">
              <Icon name="award" size={40} />
              <p className="dentist-row-title">Certificate Preview</p>
              <p className="dentist-row-sub">Fill in the form and click &quot;Preview&quot; to see the certificate.</p>
            </div>
          )}
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default DentalCertificatesPage;
