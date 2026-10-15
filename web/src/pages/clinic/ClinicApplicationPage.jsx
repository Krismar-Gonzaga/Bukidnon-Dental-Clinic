import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PortalLayout from '../../layouts/PortalLayout';
import { Badge, DataTable, Field, FormError, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { CLINIC_APPLY_HREF, CLINIC_PORTAL_HREF, getClinicHref } from '../../config/clinicNavigation';
import { useAuth } from '../../auth/AuthContext';
import {
  createApplication,
  deleteApplicationDocument,
  getMyApplications,
  openApplicationDocument,
  submitApplication,
  updateApplication,
  uploadApplicationDocument,
} from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDate } from '../../utils/dateTime';
import '../../components/portal/portal.css';

const APPLICATIONS_KEY = ['my', 'clinicApplications'];

export const DOCUMENT_LABELS = {
  business_permit: "Mayor's / business permit",
  doh_license: 'DOH license to operate',
  prc_id: "Dentist's PRC ID",
  bir_registration: 'BIR registration',
  other: 'Other supporting document',
};

const STATUS_TEXT = {
  draft: 'Not submitted yet. Complete the details and upload all required documents, then submit.',
  pending: 'Submitted. A platform administrator will review it.',
  under_review: 'An administrator is reviewing your documents.',
  approved: 'Approved. Your clinic portal is ready.',
  rejected: 'Changes requested. Read the notes, fix the details or documents, and submit again.',
};

const FIELDS = ['clinic_name', 'description', 'address', 'city', 'province', 'contact_number', 'email', 'representative_name', 'representative_position', 'latitude', 'longitude'];

function ApplicationForm({ application }) {
  const queryClient = useQueryClient();
  const isEditable = !application || ['draft', 'rejected'].includes(application.status);
  const [form, setForm] = useState(() =>
    Object.fromEntries(FIELDS.map((f) => [f, application?.[f] ?? (f === 'province' ? 'Bukidnon' : '')]))
  );
  const [docType, setDocType] = useState('business_permit');
  const [file, setFile] = useState(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: APPLICATIONS_KEY });

  const cleaned = () =>
    Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, ['latitude', 'longitude'].includes(k) ? (v === '' ? null : Number(v)) : v === '' ? null : v])
    );

  const save = useMutation({
    mutationFn: () => (application ? updateApplication(application.id, cleaned()) : createApplication(cleaned())),
    onSuccess: refresh,
  });
  const upload = useMutation({
    mutationFn: () => uploadApplicationDocument(application.id, docType, file),
    onSuccess: () => {
      setFile(null);
      refresh();
    },
  });
  const remove = useMutation({ mutationFn: (documentId) => deleteApplicationDocument(application.id, documentId), onSuccess: refresh });
  const submit = useMutation({
    mutationFn: async () => {
      await updateApplication(application.id, cleaned());
      return submitApplication(application.id);
    },
    onSuccess: refresh,
  });
  const [openError, setOpenError] = useState('');
  const bind = (name) => ({ value: form[name] ?? '', disabled: !isEditable, onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <div className="portal-stack">
      {application && (
        <Section title={application.clinic_name} actions={<Badge status={application.status} />} subtitle={STATUS_TEXT[application.status]}>
          {application.review_notes && (
            <dl className="portal-details">
              <dt>Reviewer notes</dt>
              <dd>{application.review_notes}</dd>
            </dl>
          )}
          {application.status === 'approved' && application.clinic_id && (
            <a href={getClinicHref(application.clinic_id)} className="btn btn-primary btn-sm">Open clinic portal</a>
          )}
        </Section>
      )}

      <Section title="Clinic details" subtitle="Information the administrators verify against your documents.">
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
          <div className="portal-form-grid">
            <Field label="Clinic name" required className="is-wide" {...bind('clinic_name')} />
            <Field label="Description" as="textarea" className="is-wide" {...bind('description')} />
            <Field label="Street address" className="is-wide" {...bind('address')} />
            <Field label="City / municipality" {...bind('city')} />
            <Field label="Province" {...bind('province')} />
            <Field label="Contact number" type="tel" {...bind('contact_number')} />
            <Field label="Clinic email" type="email" {...bind('email')} />
            <Field label="Authorized representative" {...bind('representative_name')} />
            <Field label="Representative's position" placeholder="e.g. Owner, Managing dentist" {...bind('representative_position')} />
            <Field label="Latitude (optional)" type="number" step="any" {...bind('latitude')} />
            <Field label="Longitude (optional)" type="number" step="any" {...bind('longitude')} />
          </div>
          <FormError error={save.error} />
          {isEditable && (
            <div className="portal-form-actions">
              <button type="submit" className="btn btn-outline" disabled={save.isPending}>
                {application ? 'Save details' : 'Save and continue'}
              </button>
            </div>
          )}
        </form>
      </Section>

      {application && (
        <Section
          title="Verification documents"
          subtitle="PDF, JPG or PNG up to 5 MB. Stored privately; only you and platform administrators can open them."
        >
          <DataTable
            caption="Uploaded documents"
            rows={application.documents}
            emptyText="No documents uploaded yet."
            columns={[
              { key: 'type', label: 'Document', render: (d) => DOCUMENT_LABELS[d.document_type] ?? d.document_type },
              { key: 'original_name', label: 'File' },
              { key: 'uploaded_at', label: 'Uploaded', render: (d) => formatDate(d.uploaded_at) },
              {
                key: 'actions',
                label: '',
                render: (d) => (
                  <div className="portal-actions">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openApplicationDocument('applicant', application.id, d.id).catch((e) => setOpenError(getErrorMessage(e)))}
                    >
                      View
                    </button>
                    {isEditable && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => remove.mutate(d.id)}>Remove</button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          {openError && <p className="portal-inline-error" role="alert">{openError}</p>}
          {application.missing_documents.length > 0 && (
            <p className="portal-field-hint portal-spaced-top">
              Still needed: {application.missing_documents.map((d) => DOCUMENT_LABELS[d]).join(', ')}
            </p>
          )}

          {isEditable && (
            <form className="portal-toolbar portal-spaced-top" onSubmit={(e) => { e.preventDefault(); upload.mutate(); }}>
              <Field
                label="Document type"
                as="select"
                options={Object.entries(DOCUMENT_LABELS).map(([value, label]) => ({ value, label }))}
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              />
              <Field label="File" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="submit" className="btn btn-outline btn-sm" disabled={!file || upload.isPending}>
                {upload.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </form>
          )}
          <FormError error={upload.error || remove.error} />
        </Section>
      )}

      {application && isEditable && (
        <Section title="Submit for verification">
          <button type="button" className="btn btn-primary" disabled={submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? 'Submitting…' : 'Submit application'}
          </button>
          <FormError error={submit.error} />
        </Section>
      )}
    </div>
  );
}

function ClinicApplicationPage() {
  const { memberships } = useAuth();
  const query = useQuery({ queryKey: APPLICATIONS_KEY, queryFn: getMyApplications });

  const navItems = [
    { label: 'Clinic application', href: CLINIC_APPLY_HREF, icon: 'shieldCheck' },
    ...(memberships.length > 0 ? [{ label: 'My clinics', href: CLINIC_PORTAL_HREF, icon: 'building' }] : []),
  ];

  return (
    <PortalLayout title="Clinic Application" navItems={navItems} activeHref={CLINIC_APPLY_HREF} roleLabel="Clinic Admin" navLabel="Clinic owner">
      <QueryState query={query} loadingLabel="Loading your application…">
        {(applications) => {
          // Work on the latest application that is not approved; otherwise show the latest.
          const current = applications.find((a) => a.status !== 'approved') ?? applications[0] ?? null;
          return <ApplicationForm key={current?.id ?? 'new'} application={current} />;
        }}
      </QueryState>
    </PortalLayout>
  );
}

export default ClinicApplicationPage;
