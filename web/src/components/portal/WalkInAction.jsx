import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, FormError, Modal } from './PortalUi';
import SlotPickerModal from './SlotPickerModal';
import { getClinicHref } from '../../config/clinicNavigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { bookForPatient, getClinicDentists, getClinicPatients, getClinicServices, registerPatient } from '../../services/clinicPortalApi';
import { formatDateTime } from '../../utils/dateTime';
import './WalkInAction.css';

const EMPTY = { mode: 'existing', search: '', patient: null, fullName: '', phone: '', dentistId: '', serviceRateId: '' };

function PatientSearch({ clinicId, form, setForm }) {
  const term = useDebouncedValue(form.search.trim());
  const results = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'walk-in', term],
    queryFn: () => getClinicPatients(clinicId, { search: term, per_page: 6 }),
    enabled: term.length >= 2,
  });

  if (form.patient) {
    return (
      <div className="walkin-selected">
        <div>
          <p className="walkin-selected-name">{form.patient.name}</p>
          {form.patient.phone && <p className="walkin-selected-meta">{form.patient.phone}</p>}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setForm((f) => ({ ...f, patient: null, search: '' }))}>
          Change
        </button>
      </div>
    );
  }

  const items = results.data?.items ?? [];
  return (
    <>
      <Field
        label="Search patient"
        type="search"
        className="is-wide"
        placeholder="Name, email or mobile number"
        maxLength={100}
        value={form.search}
        onChange={(e) => setForm((f) => ({ ...f, search: e.target.value }))}
      />
      {term.length >= 2 && (
        <div className="walkin-results" aria-live="polite">
          {results.isFetching && <p className="walkin-results-note">Searching…</p>}
          {results.isError && <p className="walkin-results-note">The search could not run. Please try again.</p>}
          {results.isSuccess && items.length === 0 && (
            <p className="walkin-results-note">
              No patient found.{' '}
              <button type="button" className="walkin-link" onClick={() => setForm((f) => ({ ...f, mode: 'new', fullName: f.search.trim() }))}>
                Register a new patient
              </button>
            </p>
          )}
          <ul>
            {items.map((p) => (
              <li key={p.id}>
                <button type="button" className="walkin-result" onClick={() => setForm((f) => ({ ...f, patient: p }))}>
                  <span className="walkin-selected-name">{p.name}</span>
                  <span className="walkin-selected-meta">{[p.phone, p.email].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * A button that books a walk-in: choose or register the patient, the dentist
 * and service, then a free slot. The API confirms it at once (walk_in), since
 * the patient is at the clinic. `children` is the button's content.
 */
function WalkInAction({ clinicId, can, className, children, ...buttonProps }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [isPicking, setIsPicking] = useState(false);
  const [booked, setBooked] = useState(null);
  // A patient registered before a failed booking is reused on the next try.
  const registeredId = useRef(null);
  const isOpen = form !== null;
  const canRegister = can('patients.manage');

  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId), enabled: isOpen });
  const services = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId), enabled: isOpen });

  const book = useMutation({
    mutationFn: async (slot) => {
      let patientId = form.patient?.id ?? registeredId.current;
      if (!patientId) {
        const registered = await registerPatient(clinicId, { full_name: form.fullName.trim(), phone: form.phone.trim() });
        patientId = registered.data.id;
        registeredId.current = patientId;
      }
      const response = await bookForPatient(clinicId, {
        patient_id: patientId,
        service_rate_id: Number(form.serviceRateId),
        dentist_id: Number(form.dentistId),
        branch_id: slot.branchId,
        starts_at: slot.startsAt,
        walk_in: true,
      });
      return response.data;
    },
    onSuccess: (appointment) => {
      setBooked(appointment);
      setIsPicking(false);
      setForm(null);
      registeredId.current = null;
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
    },
  });

  const open = () => {
    book.reset();
    registeredId.current = null;
    setBooked(null);
    setForm(EMPTY);
  };
  const close = () => {
    setForm(null);
    setIsPicking(false);
  };
  const setMode = (mode) => {
    registeredId.current = null;
    setForm((f) => ({ ...f, mode, patient: null }));
  };

  const hasPatient = form && (form.mode === 'existing' ? Boolean(form.patient) : form.fullName.trim() && form.phone.trim());
  const ready = hasPatient && form.dentistId && form.serviceRateId;

  return (
    <>
      <button type="button" className={className} onClick={open} {...buttonProps}>
        {children}
      </button>

      {isOpen && !isPicking && (
        <Modal title="Walk-in appointment" onClose={close}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (ready) setIsPicking(true);
            }}
          >
            {canRegister && (
              <div className="walkin-modes" role="group" aria-label="Patient">
                <button type="button" aria-pressed={form.mode === 'existing'} className={form.mode === 'existing' ? 'is-active' : ''} onClick={() => setMode('existing')}>
                  Existing patient
                </button>
                <button type="button" aria-pressed={form.mode === 'new'} className={form.mode === 'new' ? 'is-active' : ''} onClick={() => setMode('new')}>
                  New patient
                </button>
              </div>
            )}
            <div className="portal-form-grid">
              {form.mode === 'existing' ? (
                <div className="is-wide">
                  <PatientSearch clinicId={clinicId} form={form} setForm={setForm} />
                </div>
              ) : (
                <>
                  <Field label="Full name" required className="is-wide" maxLength={255} value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                  <Field label="Mobile number" type="tel" required className="is-wide" maxLength={30} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </>
              )}
              <Field
                label="Dentist"
                as="select"
                className="is-wide"
                required
                options={[{ value: '', label: dentists.isPending ? 'Loading…' : 'Choose…' }, ...(dentists.data ?? []).filter((d) => d.is_active).map((d) => ({ value: String(d.id), label: d.name }))]}
                value={form.dentistId}
                onChange={(e) => setForm((f) => ({ ...f, dentistId: e.target.value }))}
              />
              <Field
                label="Service"
                as="select"
                className="is-wide"
                required
                options={[{ value: '', label: services.isPending ? 'Loading…' : 'Choose…' }, ...(services.data ?? []).filter((s) => s.is_available).map((s) => ({ value: String(s.id), label: `${s.name} (${s.duration_minutes} min)` }))]}
                value={form.serviceRateId}
                onChange={(e) => setForm((f) => ({ ...f, serviceRateId: e.target.value }))}
              />
            </div>
            <FormError error={dentists.error ?? services.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={close}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!ready}>
                Choose time
              </button>
            </div>
          </form>
        </Modal>
      )}

      {isOpen && isPicking && (
        <SlotPickerModal
          title="Choose a time"
          clinicId={clinicId}
          dentistId={form.dentistId}
          serviceRateId={form.serviceRateId}
          confirmLabel="Book walk-in"
          isSaving={book.isPending}
          error={book.error}
          onClose={() => setIsPicking(false)}
          onConfirm={(slot) => book.mutate(slot)}
        />
      )}

      {booked && (
        <Modal title="Walk-in booked" onClose={() => setBooked(null)}>
          <p className="portal-success" role="status">
            {booked.patient?.name ?? 'The patient'} is confirmed for {formatDateTime(booked.starts_at)}.
          </p>
          <div className="portal-form-actions">
            <a href={`${getClinicHref(clinicId, 'appointments')}/${booked.id}`} className="btn btn-outline">
              Open appointment
            </a>
            <button type="button" className="btn btn-primary" onClick={() => setBooked(null)}>
              Done
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export default WalkInAction;
