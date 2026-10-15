import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Badge, DataTable, Field, FormError, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF } from '../../config/adminNavigation';
import {
  approveApplication,
  getApplication,
  openApplicationDocument,
  rejectApplication,
  startApplicationReview,
} from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDate, formatDateTime } from '../../utils/dateTime';
import { DOCUMENT_LABELS } from '../clinic/ClinicApplicationPage';

function AdminApplicationDetailPage() {
  const { applicationId } = useParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['admin', 'application', applicationId], queryFn: () => getApplication(applicationId) });
  const [notes, setNotes] = useState('');
  const [openError, setOpenError] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const startReview = useMutation({ mutationFn: () => startApplicationReview(applicationId), onSuccess: refresh });
  const approve = useMutation({ mutationFn: () => approveApplication(applicationId, notes.trim() || undefined), onSuccess: refresh });
  const reject = useMutation({ mutationFn: () => rejectApplication(applicationId, notes.trim()), onSuccess: refresh });
  const isBusy = startReview.isPending || approve.isPending || reject.isPending;

  return (
    <AdminLayout title="Review application" activeHref={ADMIN_APPLICATIONS_HREF}>
      <div className="portal-stack">
        <a href={ADMIN_APPLICATIONS_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to queue
        </a>
        <QueryState query={query} loadingLabel="Loading application…">
          {(app) => {
            const isOpen = ['pending', 'under_review'].includes(app.status);
            return (
              <>
                <Section title={app.clinic_name} actions={<Badge status={app.status} />} subtitle={app.submitted_at ? `Submitted ${formatDateTime(app.submitted_at)}` : 'Not submitted'}>
                  <dl className="portal-details">
                    <dt>Applicant</dt>
                    <dd>{app.applicant ? `${app.applicant.name} (${app.applicant.email})` : '—'}</dd>
                    <dt>Representative</dt>
                    <dd>{[app.representative_name, app.representative_position].filter(Boolean).join(', ') || '—'}</dd>
                    <dt>Address</dt>
                    <dd>{[app.address, app.city, app.province].filter(Boolean).join(', ') || '—'}</dd>
                    <dt>Contact</dt>
                    <dd>{[app.contact_number, app.email].filter(Boolean).join(' · ') || '—'}</dd>
                    <dt>Description</dt>
                    <dd>{app.description || '—'}</dd>
                    {app.review_notes && (
                      <>
                        <dt>Review notes</dt>
                        <dd>{app.review_notes}</dd>
                      </>
                    )}
                  </dl>
                </Section>

                <Section title="Documents" subtitle="Each link is valid for 5 minutes and every view is logged.">
                  <DataTable
                    caption="Verification documents"
                    rows={app.documents}
                    emptyText="No documents."
                    columns={[
                      { key: 'type', label: 'Document', render: (d) => DOCUMENT_LABELS[d.document_type] ?? d.document_type },
                      { key: 'original_name', label: 'File' },
                      { key: 'uploaded_at', label: 'Uploaded', render: (d) => formatDate(d.uploaded_at) },
                      {
                        key: 'view',
                        label: '',
                        render: (d) => (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => openApplicationDocument('admin', app.id, d.id).catch((e) => setOpenError(getErrorMessage(e)))}
                          >
                            View
                          </button>
                        ),
                      },
                    ]}
                  />
                  {openError && <p className="portal-inline-error" role="alert">{openError}</p>}
                  {app.missing_documents.length > 0 && (
                    <p className="portal-inline-error">Missing: {app.missing_documents.map((d) => DOCUMENT_LABELS[d]).join(', ')}</p>
                  )}
                </Section>

                {isOpen && (
                  <Section title="Decision" subtitle="Approving creates the clinic (hidden until the owner publishes it) and gives the applicant clinic-admin access.">
                    {app.status === 'pending' && (
                      <button type="button" className="btn btn-outline btn-sm" disabled={isBusy} onClick={() => startReview.mutate()}>
                        Mark as under review
                      </button>
                    )}
                    <Field
                      label="Notes for the applicant"
                      as="textarea"
                      className="portal-spaced-top"
                      hint="Required when requesting changes. Explain what to fix."
                      value={notes}
                      maxLength={2000}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <div className="portal-form-actions">
                      <button type="button" className="btn btn-outline" disabled={isBusy || !notes.trim()} onClick={() => reject.mutate()}>
                        Request changes / reject
                      </button>
                      <button type="button" className="btn btn-primary" disabled={isBusy || app.missing_documents.length > 0} onClick={() => approve.mutate()}>
                        Approve clinic
                      </button>
                    </div>
                    <FormError error={startReview.error || approve.error || reject.error} />
                  </Section>
                )}
              </>
            );
          }}
        </QueryState>
      </div>
    </AdminLayout>
  );
}

export default AdminApplicationDetailPage;
