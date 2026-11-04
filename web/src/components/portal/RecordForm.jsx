import { useCallback, useEffect, useState } from 'react';
import { Checkbox, ConfirmDialog, Field, FormError, Modal } from './PortalUi';
import { RECORD_TYPES } from '../../config/clinicNavigation';

export const EMPTY_RECORD = {
  record_type: 'treatment',
  appointment_id: '',
  chief_complaint: '',
  findings: '',
  procedures: '',
  tooth_numbers: '',
  notes: '',
  care_instructions: '',
  is_patient_visible: false,
};

const CLINICAL_FIELDS = ['chief_complaint', 'findings', 'procedures', 'notes', 'care_instructions'];

/**
 * Clinical record form (new record or correction). Records cannot be edited
 * or deleted once saved, so saving asks for confirmation first.
 * `appointmentOptions` ([{ value, label }]) adds an optional related-visit field.
 */
function RecordForm({ initial, isAmendment, isSaving, error, onSave, onCancel, onDirtyChange, patientName, appointmentOptions }) {
  const [form, setForm] = useState(initial);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState('');
  const bind = (name) => ({ value: form[name] ?? '', onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });
  const isDirty = JSON.stringify(form) !== JSON.stringify(initial);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // A failed save returns to the form so the errors can be fixed.
  useEffect(() => {
    if (error) setConfirming(false);
  }, [error]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!CLINICAL_FIELDS.some((name) => String(form[name] ?? '').trim())) {
      setProblem('Add at least a complaint, findings, procedures, notes or care instructions.');
      return;
    }
    if (isAmendment && !String(form.amendment_reason ?? '').trim()) {
      setProblem('Give the reason for the correction.');
      return;
    }
    setProblem('');
    setConfirming(true);
  };

  const save = () => {
    const { appointment_id: appointmentId, ...rest } = form;
    onSave(appointmentId ? { ...rest, appointment_id: Number(appointmentId) } : rest);
  };

  return (
    <form onSubmit={handleSubmit}>
      <fieldset className="portal-record-fields" disabled={confirming}>
        <div className="portal-form-grid">
          <Field label="Type" as="select" options={RECORD_TYPES} {...bind('record_type')} />
          <Field label="Tooth numbers" placeholder="e.g. 16, 47" maxLength={255} {...bind('tooth_numbers')} />
          {appointmentOptions && (
            <Field
              label="Related visit (optional)"
              as="select"
              className="is-wide"
              options={[{ value: '', label: 'Not linked to a visit' }, ...appointmentOptions]}
              {...bind('appointment_id')}
            />
          )}
          <Field label="Chief complaint" as="textarea" className="is-wide" maxLength={2000} {...bind('chief_complaint')} />
          <Field label="Findings" as="textarea" maxLength={5000} {...bind('findings')} />
          <Field label="Procedures performed" as="textarea" maxLength={5000} {...bind('procedures')} />
          <Field label="Internal notes" as="textarea" maxLength={5000} {...bind('notes')} hint="Never shown to the patient." />
          <Field label="Care instructions" as="textarea" maxLength={5000} {...bind('care_instructions')} />
          <div className="is-wide">
            <Checkbox
              label="Share procedures and care instructions with the patient"
              checked={Boolean(form.is_patient_visible)}
              onChange={(e) => setForm((f) => ({ ...f, is_patient_visible: e.target.checked }))}
            />
          </div>
          {isAmendment && (
            <Field label="Reason for correction" as="textarea" required className="is-wide" maxLength={500} {...bind('amendment_reason')} />
          )}
        </div>
      </fieldset>
      {problem && (
        <p className="portal-inline-error" role="alert">
          {problem}
        </p>
      )}
      <FormError error={error} />

      {confirming ? (
        <div className="portal-confirm-box" role="alert">
          <p className="portal-confirm-message">
            {isAmendment
              ? 'The original stays in the history and this correction replaces it. Corrections cannot be edited or deleted.'
              : `Clinical records cannot be edited or deleted once saved; mistakes are fixed with a correction. Save this record${patientName ? ` for ${patientName}` : ''}?`}
          </p>
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setConfirming(false)} disabled={isSaving}>
              Keep editing
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={isSaving}>
              {isSaving ? 'Saving…' : isAmendment ? 'Yes, save correction' : 'Yes, save record'}
            </button>
          </div>
        </div>
      ) : (
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isAmendment ? 'Save correction' : 'Save record'}
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * RecordForm in a dialog. Closing with unsaved changes asks before
 * discarding them; `children` render above the form (e.g. the patient).
 */
export function RecordModal({ title, onClose, children, ...formProps }) {
  const [isDirty, setIsDirty] = useState(false);
  const [askDiscard, setAskDiscard] = useState(false);
  const handleDirtyChange = useCallback((dirty) => setIsDirty(dirty), []);
  const requestClose = () => (isDirty ? setAskDiscard(true) : onClose());

  return (
    <>
      <Modal title={title} onClose={requestClose} wide>
        {children}
        <RecordForm {...formProps} onCancel={requestClose} onDirtyChange={handleDirtyChange} />
      </Modal>
      {askDiscard && (
        <ConfirmDialog
          title="Discard this record?"
          message="What you have typed has not been saved and will be lost."
          confirmLabel="Discard"
          danger
          onConfirm={onClose}
          onCancel={() => setAskDiscard(false)}
        />
      )}
    </>
  );
}

export default RecordForm;
