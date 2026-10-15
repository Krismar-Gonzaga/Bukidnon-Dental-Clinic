import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { getClinicPatients, registerPatient } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useNavigate } from 'react-router-dom';

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

function PatientDirectory() {
  const { clinicId, can } = useClinic();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isRegistering, setIsRegistering] = useState(false);
  const debounced = useDebouncedValue(search);

  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patients', debounced, page],
    queryFn: () => getClinicPatients(clinicId, { search: debounced || undefined, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <Section
      title={can('patients.manage') ? 'Patients' : 'My patients'}
      subtitle="Patients registered with this clinic. Clinical records are only shown to dentists."
      actions={
        can('patients.manage') && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsRegistering(true)}>
            Register walk-in
          </button>
        )
      }
    >
      <div className="portal-toolbar">
        <Field
          label="Search"
          type="search"
          placeholder="Name, email or phone"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {query.isPending ? (
        <LoadingState label="Loading patients…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Patients"
            rows={query.data.items}
            emptyText="No patients found."
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'email', label: 'Email' },
              {
                key: 'account',
                label: 'Account',
                render: (p) => <Badge tone={p.has_portal_account ? 'info' : 'neutral'}>{p.has_portal_account ? 'Portal user' : 'Walk-in'}</Badge>,
              },
              { key: 'open', label: '', render: (p) => <a href={`${getClinicHref(clinicId, 'patients')}/${p.id}`}>Open</a> },
            ]}
          />
          <Pagination currentPage={page} pageCount={query.data.meta.last_page ?? 1} onPageChange={setPage} label="Patient pages" />
        </>
      )}

      {isRegistering && <RegisterPatientModal onClose={() => setIsRegistering(false)} />}
    </Section>
  );
}

function ClinicPatientsPage() {
  return (
    <ClinicLayout section="patients" title="Patients" requires={['patients.view']}>
      <PatientDirectory />
    </ClinicLayout>
  );
}

export default ClinicPatientsPage;
