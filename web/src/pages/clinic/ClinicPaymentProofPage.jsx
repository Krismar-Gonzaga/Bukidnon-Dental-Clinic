import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { PageTabs } from '../../components/clinic/ClinicUi';
import { Field, FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getSubscription, submitPaymentProof } from '../../services/clinicPortalApi';
import '../../components/clinic/ClinicAdminUi.css';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf'];

const NEXT_STEPS = [
  'Your payment proof is queued for admin review',
  'Verification typically takes 1–2 business days',
  'You will receive an email once your subscription is renewed',
  'Your clinic dashboard will remain active during the review period',
];

function Submitted({ backHref }) {
  return (
    <Card>
      <div className="clinic-success" role="status">
        <span className="clinic-success-icon">
          <Icon name="checkCircle" size={36} />
        </span>
        <h2 className="clinic-success-title">Payment Proof Submitted!</h2>
        <p className="clinic-success-text">
          Your proof of payment has been successfully submitted. Our <strong>System Administrator</strong> will review and verify your payment before activating or renewing your subscription.
        </p>
        <div className="clinic-steps">
          <strong>What happens next?</strong>
          <ol>
            {NEXT_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        <a href={backHref} className="btn btn-primary clinic-full-button">
          Back to Subscription
        </a>
      </div>
    </Card>
  );
}

function ProofForm({ data, backHref, onSubmitted }) {
  const { clinicId } = useClinicAccess();
  const queryClient = useQueryClient();
  const [method, setMethod] = useState(data.channels[0]?.key ?? '');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState(null);
  const [fileError, setFileError] = useState('');
  const [isOver, setIsOver] = useState(false);
  const channel = data.channels.find(({ key }) => key === method);

  const chooseFile = (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setFileError('Please choose a JPG, PNG or PDF file.');
    } else if (file.size > MAX_BYTES) {
      setFileError('Please choose a file of 5 MB or less.');
    } else {
      setFileError('');
      setProof(file);
    }
  };

  const submit = useMutation({
    mutationFn: () => submitPaymentProof(clinicId, { method, reference: reference.trim(), proof }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'subscription'] });
      onSubmitted();
    },
  });

  return (
    <Card title="Submit Payment Proof">
      <PageTabs label="Payment channel" value={method} onChange={setMethod} tabs={data.channels.map(({ key, label }) => ({ value: key, label }))} />
      {channel && (
        <div className="clinic-channel-box">
          <p className="clinic-section-label">{channel.label} payment details</p>
          <dl className="clinic-stat-rows">
            <div>
              <dt>{channel.number_label}</dt>
              <dd>{channel.number || 'Ask your system administrator'}</dd>
            </div>
            <div>
              <dt>Account Name</dt>
              <dd>{channel.account_name || '—'}</dd>
            </div>
            <div>
              <dt>Reference</dt>
              <dd>Use your Clinic ID ({clinicId}) as reference</dd>
            </div>
          </dl>
        </div>
      )}
      <form
        className="clinic-form-gap"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <p className="clinic-section-label">Upload Screenshot / Receipt</p>
        <label
          className={`clinic-dropzone${isOver ? ' is-over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsOver(true);
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsOver(false);
            chooseFile(event.dataTransfer.files[0]);
          }}
        >
          <Icon name="upload" size={28} />
          {proof ? (
            <span>{proof.name}</span>
          ) : (
            <span>
              Drag and drop or <strong>browse</strong>
            </span>
          )}
          <span className="clinic-file-meta">JPG, PNG, or PDF · Max 5MB</span>
          <input type="file" className="visually-hidden" accept=".jpg,.jpeg,.png,.pdf" onChange={(event) => chooseFile(event.target.files[0])} />
        </label>
        {fileError && (
          <p className="portal-inline-error" role="alert">
            {fileError}
          </p>
        )}
        <div className="clinic-form-gap">
          <Field label="Reference number (optional)" maxLength={120} placeholder="Transaction / reference number" value={reference} onChange={(event) => setReference(event.target.value)} />
        </div>
        <p className="clinic-warning-note clinic-form-gap">
          <Icon name="alertTriangle" size={16} />
          Payment is made outside this app through the channels above. Submit your proof after completing the transfer.
        </p>
        <FormError error={submit.error} />
        <div className="clinic-form-actions">
          <a href={backHref} className="btn btn-outline">
            Cancel
          </a>
          <button type="submit" className="btn btn-primary" disabled={!proof || !method || submit.isPending}>
            {submit.isPending ? 'Submitting…' : 'Submit Proof'}
          </button>
        </div>
      </form>
    </Card>
  );
}

function ClinicPaymentProofPage() {
  const { clinicId, can } = useClinicAccess();
  const [submitted, setSubmitted] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'subscription'], queryFn: () => getSubscription(clinicId), enabled: can('subscription.manage') });
  const backHref = getClinicHref(clinicId, 'subscription');

  return (
    <ClinicLayout section="subscription" title={submitted ? 'Subscription' : 'Submit Proof of Payment'} subtitle={null} requires={['subscription.manage']} hideSearch>
      {!submitted && <BackLink href={backHref}>Back to Subscription</BackLink>}
      <div className="clinic-form-page">
        {submitted ? (
          <Submitted backHref={backHref} />
        ) : (
          <QueryState query={query} loadingLabel="Loading payment details…">
            {(data) =>
              data.has_pending_payment ? (
                <Card>
                  <p className="clinic-info-note">
                    <Icon name="info" size={16} />A payment proof is already waiting for review. You can send another once it has been reviewed.
                  </p>
                </Card>
              ) : (
                <ProofForm data={data} backHref={backHref} onSubmitted={() => setSubmitted(true)} />
              )
            }
          </QueryState>
        )}
      </div>
    </ClinicLayout>
  );
}

export default ClinicPaymentProofPage;
