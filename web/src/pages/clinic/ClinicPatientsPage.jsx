import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { FilterSelect, InitialsTile, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getClinicPatients, registerPatient } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { businessTodayKey, formatDate } from '../../utils/dateTime';
import { useNavigate, useSearchParams } from 'react-router-dom';

const EMPTY_PATIENT = { full_name: '', phone: '', email: '', birth_date: '', gender: '', address: '' };

function RegisterPatientModal({ onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY_PATIENT);
  const save = useMutation({
    mutationFn: () =>
      registerPatient(clinicId, Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''))),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patients'] });
      navigate(`${getClinicHref(clinicId, 'patients')}/${response.data.id}`);
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title="Register walk-in patient" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="portal-form-grid">
          <Field label="Full name" required className="is-wide" {...bind('full_name')} />
          <Field label="Mobile number" type="tel" required {...bind('phone')} />
          <Field label="Email (optional)" type="email" {...bind('email')} />
          <Field label="Date of birth" type="date" {...bind('birth_date')} />
          <Field
            label="Gender"
            as="select"
            options={[{ value: '', label: '—' }, 'male', 'female', 'other'].map((o) => (typeof o === 'string' ? { value: o, label: o } : o))}
            {...bind('gender')}
          />
          <Field label="Address" className="is-wide" {...bind('address')} />
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Register patient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

/** Whole years from a YYYY-MM-DD birth date, in Philippine time. */
export function ageFrom(birthDate, todayKey = businessTodayKey()) {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split('-').map(Number);
  const [nowYear, nowMonth, nowDay] = todayKey.split('-').map(Number);
  return nowYear - year - (nowMonth < month || (nowMonth === month && nowDay < day) ? 1 : 0);
}

function PatientDirectory({ query, search, setSearch, status, setStatus, setPage, perPage, setPerPage }) {
  const { clinicId } = useClinic();

  return (
    <>
      <div className="clinic-toolbar">
        <SearchInput
          label="Search by name or phone"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
        <FilterSelect
          label="Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={(value) => {
            setStatus(value);
            setPage(1);
          }}
        />
      </div>

      {query.isPending ? (
        <LoadingState label="Loading patients…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="clinic-data-card">
          <div className="clinic-data-scroll">
            <table className="clinic-data-table">
              <caption className="visually-hidden">Patients</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Age/Gender</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Last Visit</th>
                  <th scope="col" className="is-center">
                    Visits
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-end">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((patient) => {
                  const age = ageFrom(patient.birth_date);
                  const gender = GENDER_LABELS[patient.gender];
                  return (
                    <tr key={patient.id}>
                      <td>
                        <div className="clinic-cell-person">
                          <InitialsTile name={patient.name} size="sm" tone="navy" />
                          <div>
                            <span className="clinic-cell-title">{patient.name}</span>
                            {patient.email && <span className="clinic-cell-sub">{patient.email}</span>}
                          </div>
                        </div>
                      </td>
                      <td>{[age, gender].filter((part) => part != null && part !== '').join(' · ') || '—'}</td>
                      <td>{patient.phone || '—'}</td>
                      <td>{patient.last_visit_at ? formatDate(patient.last_visit_at) : 'No visits yet'}</td>
                      <td className="is-center">
                        <strong>{patient.visits ?? 0}</strong>
                      </td>
                      <td>
                        <Pill tone={patient.status === 'inactive' ? 'neutral' : 'success'}>{patient.status === 'inactive' ? 'Inactive' : 'Active'}</Pill>
                      </td>
                      <td className="is-end">
                        <a href={`${getClinicHref(clinicId, 'patients')}/${patient.id}`} className="clinic-mini-button is-primary" aria-label={`View ${patient.name}`}>
                          View
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {query.data.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="clinic-empty-row">
                      No patients found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <TableFooter
            meta={query.data.meta}
            perPage={perPage}
            onPerPageChange={(n) => {
              setPerPage(n);
              setPage(1);
            }}
            onPageChange={setPage}
            noun="patients"
            label="Patient pages"
          />
        </div>
      )}
    </>
  );
}

function ClinicPatientsPage() {
  const { clinicId, can } = useClinicAccess();
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(urlSearch);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  useEffect(() => {
    setSearch(urlSearch);
    setPage(1);
  }, [urlSearch]);
  // ?register=1 (dashboard quick action) opens the registration form.
  const [isRegistering, setIsRegistering] = useState(searchParams.get('register') === '1');
  const debounced = useDebouncedValue(search.trim());
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patients', debounced, status, page, perPage],
    queryFn: () => getClinicPatients(clinicId, { search: debounced || undefined, status: status || undefined, page, per_page: perPage }),
    placeholderData: keepPreviousData,
    enabled: can('patients.view'),
  });
  const total = query.data?.meta?.total;
  const canRegister = can('patients.manage');

  return (
    <ClinicLayout
      section="patients"
      title={canRegister ? 'Patient Management' : 'My Patients'}
      subtitle={total == null ? 'Loading patients…' : `${total} ${status || debounced ? 'matching' : 'registered'} ${total === 1 ? 'patient' : 'patients'}`}
      requires={['patients.view']}
      hideSearch
      headerActions={
        canRegister && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsRegistering(true)}>
            <Icon name="userPlus" size={18} />
            Add Patient
          </button>
        )
      }
    >
      <PatientDirectory query={query} search={search} setSearch={setSearch} status={status} setStatus={setStatus} setPage={setPage} perPage={perPage} setPerPage={setPerPage} />
      {isRegistering && canRegister && <RegisterPatientModal onClose={() => setIsRegistering(false)} />}
    </ClinicLayout>
  );
}

export default ClinicPatientsPage;
