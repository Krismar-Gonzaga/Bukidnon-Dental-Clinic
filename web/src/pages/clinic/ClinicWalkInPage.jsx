import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../components/portal/PortalUi';
import { getClinicHref } from '../../config/clinicNavigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { bookForPatient, getClinicDentists, getClinicPatients, getClinicServices, registerPatient } from '../../services/clinicPortalApi';
import { getAvailability } from '../../services/publicApi';
import { businessTodayKey } from '../../utils/dateTime';
import '../../components/clinic/ClinicAdminUi.css';
import '../../components/portal/WalkInAction.css';

const EMPTY = { firstName: '', lastName: '', phone: '', serviceRateId: '', dentistId: '', date: businessTodayKey(), slot: '', notes: '' };

/**
 * Register a patient who arrived without a booking; the API confirms it at once.
 * `scheduled` books for a later time instead (Schedule Appointment).
 */
function ClinicWalkInPage({ scheduled = false }) {
  const { clinicId, can } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState(null);
  // A patient registered before a failed booking is reused on the next try.
  const registeredId = useRef(null);
  const backHref = getClinicHref(clinicId, 'appointments');
  const term = useDebouncedValue(search.trim());

  const results = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'walk-in', term],
    queryFn: () => getClinicPatients(clinicId, { search: term, per_page: 6 }),
    enabled: term.length >= 2 && !patient,
  });
  const services = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId) });
  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId) });
  const slots = useQuery({
    queryKey: ['clinic', clinicId, 'slots', form.serviceRateId, form.dentistId, form.date],
    queryFn: () => getAvailability({ clinicId, serviceRateId: form.serviceRateId, dentistId: form.dentistId, date: form.date }),
    enabled: Boolean(form.serviceRateId && form.dentistId && form.date),
  });

  const book = useMutation({
    mutationFn: async () => {
      let patientId = patient?.id ?? registeredId.current;
      if (!patientId) {
        const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
        const registered = await registerPatient(clinicId, { full_name: name, phone: form.phone.trim() });
        patientId = registered.data.id;
        registeredId.current = patientId;
      }
      const slot = slots.data.find(({ startsAt }) => startsAt === form.slot);
      return bookForPatient(clinicId, {
        patient_id: patientId,
        service_rate_id: Number(form.serviceRateId),
        dentist_id: Number(form.dentistId),
        branch_id: slot.branchId,
        starts_at: slot.startsAt,
        notes: form.notes.trim() || undefined,
        ...(scheduled ? {} : { walk_in: true }),
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      navigate(`${backHref}/${response.data.id}`);
    },
    onError: () => slots.refetch(),
  });

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  const bind = (name) => ({ value: form[name], onChange: (event) => set({ [name]: event.target.value }) });
  const hasPatient = Boolean(patient) || Boolean(form.firstName.trim() && form.phone.trim());
  const ready = hasPatient && form.serviceRateId && form.dentistId && form.slot;
  const canRegister = can('patients.manage');
  const items = results.data?.items ?? [];

  return (
    <ClinicLayout section="appointments" title={scheduled ? 'Schedule Appointment' : 'Walk-in Appointment'} subtitle={scheduled ? 'Book an appointment for a patient' : 'Register a walk-in patient'} requires={['appointments.manage']} hideSearch>
      <BackLink href={backHref}>Back to Appointments</BackLink>
      <div className="clinic-form-page">
        <Card>
          <div className="clinic-form-head">
            <span className="clinic-form-head-icon">
              <Icon name="calendarBlank" size={22} />
            </span>
            <div>
              <h2 className="clinic-admin-card-title">{scheduled ? 'Schedule Appointment' : 'Walk-in Registration'}</h2>
              <p className="clinic-admin-card-sub">{scheduled ? 'Choose the patient, service, dentist and an open time' : 'Register a patient who arrived without prior booking'}</p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (ready) book.mutate();
            }}
          >
            <div className="clinic-lookup">
              {patient ? (
                <div className="walkin-selected">
                  <div>
                    <p className="walkin-selected-name">{patient.name}</p>
                    {patient.phone && <p className="walkin-selected-meta">{patient.phone}</p>}
                  </div>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setPatient(null)}>
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <Field label="Patient lookup" type="search" maxLength={100} placeholder="Search existing patient by name or phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
                  {term.length >= 2 && (
                    <div className="walkin-results" aria-live="polite">
                      {results.isFetching && <p className="walkin-results-note">Searching…</p>}
                      {results.isError && <p className="walkin-results-note">The search could not run. Please try again.</p>}
                      {results.isSuccess && items.length === 0 && <p className="walkin-results-note">No patient found. Register them below.</p>}
                      <ul>
                        {items.map((item) => (
                          <li key={item.id}>
                            <button type="button" className="walkin-result" onClick={() => setPatient(item)}>
                              <span className="walkin-selected-name">{item.name}</span>
                              <span className="walkin-selected-meta">{[item.phone, item.email].filter(Boolean).join(' · ')}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            {!patient && canRegister && (
              <>
                <p className="clinic-or-divider">— or register a new patient —</p>
                <div className="portal-form-grid">
                  <Field label="First name" maxLength={120} placeholder="Juan" required={!patient} {...bind('firstName')} />
                  <Field label="Last name" maxLength={120} placeholder="Dela Cruz" {...bind('lastName')} />
                  <Field label="Phone number" type="tel" className="is-wide" maxLength={30} required={!patient} {...bind('phone')} />
                </div>
              </>
            )}

            <div className="portal-form-grid clinic-form-gap">
              <Field
                label="Service"
                as="select"
                required
                options={[{ value: '', label: services.isPending ? 'Loading…' : 'Choose…' }, ...(services.data ?? []).filter((s) => s.is_available).map((s) => ({ value: String(s.id), label: s.name }))]}
                value={form.serviceRateId}
                onChange={(event) => set({ serviceRateId: event.target.value, slot: '' })}
              />
              <Field
                label="Assign dentist"
                as="select"
                required
                options={[{ value: '', label: dentists.isPending ? 'Loading…' : 'Choose…' }, ...(dentists.data ?? []).filter((d) => d.is_active).map((d) => ({ value: String(d.id), label: d.name }))]}
                value={form.dentistId}
                onChange={(event) => set({ dentistId: event.target.value, slot: '' })}
              />
              <Field label="Date" type="date" required min={businessTodayKey()} value={form.date} onChange={(event) => set({ date: event.target.value, slot: '' })} />
              <Field
                label="Time slot"
                as="select"
                required
                disabled={!slots.data}
                hint={slots.data?.length === 0 ? 'No open times on this date.' : undefined}
                options={[{ value: '', label: slots.isFetching ? 'Checking…' : 'Choose…' }, ...(slots.data ?? []).map((s) => ({ value: s.startsAt, label: s.label }))]}
                {...bind('slot')}
              />
              <Field label="Notes / special instructions" as="textarea" className="is-wide" maxLength={2000} placeholder="Any medical alerts, special requests, or notes for the dentist..." {...bind('notes')} />
            </div>
            <FormError error={book.error} />
            <div className="clinic-form-actions">
              <a href={backHref} className="btn btn-outline">
                Cancel
              </a>
              <button type="submit" className="btn btn-primary" disabled={!ready || book.isPending}>
                {book.isPending ? 'Saving…' : scheduled ? 'Schedule Appointment' : 'Register Walk-in'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default ClinicWalkInPage;
