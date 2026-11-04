import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { InitialsTile, Pill } from '../../../components/clinic/ClinicUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { getDentistPatients } from '../../../services/dentistApi';
import { formatDate } from '../../../utils/dateTime';
import { hasText } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 12;
const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

function PatientCard({ patient, href }) {
  const allergy = hasText(patient.allergies);
  const medical = hasText(patient.conditions);
  return (
    <a href={href} className="dentist-patient-card">
      <div className="dentist-patient-head">
        <InitialsTile name={patient.name} size="sm" tone="navy" />
        <div>
          <p className="dentist-row-title">{patient.name}</p>
          <p className="dentist-row-sub">{[patient.age, capitalize(patient.gender)].filter(Boolean).join(' · ')}</p>
        </div>
        <Icon name="chevronRight" size={16} />
      </div>
      <p className="dentist-meta-line">
        <Icon name="phone" size={14} />
        {patient.phone || 'No phone on file'}
      </p>
      <p className="dentist-meta-line">
        <Icon name="clock" size={14} />
        Last: {patient.last_visit_at ? formatDate(patient.last_visit_at) : 'No visits yet'}
      </p>
      <div className="dentist-patient-foot">
        {allergy && <Pill tone="danger">Allergy</Pill>}
        {medical && <Pill tone="warning">Medical</Pill>}
        {!allergy && !medical && <Pill tone="success">No flags</Pill>}
        <span className="dentist-patient-visits">{patient.visits === 1 ? '1 visit' : `${patient.visits} visits`}</span>
      </div>
    </a>
  );
}

/** My Patients: the people this dentist treats, with what to watch for at a glance. */
function DentistPatients() {
  const { clinicId } = useClinicAccess();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'dentist', debounced, page],
    queryFn: () => getDentistPatients(clinicId, { search: debounced || undefined, page, per_page: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta?.total;

  return (
    <ClinicLayout
      section="patients"
      title="My Patients"
      subtitle={total != null ? `${total} active patients` : null}
      search={{
        label: 'Search patients',
        placeholder: 'Search patients…',
        value: search,
        onChange: (value) => {
          setSearch(value);
          setPage(1);
        },
      }}
    >
      <QueryState query={query} loadingLabel="Loading your patients…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">{debounced ? 'No patients match this search.' : 'Patients appear here once they have an appointment with you.'}</p>
          ) : (
            <>
              <div className="dentist-patient-grid">
                {items.map((patient) => (
                  <PatientCard key={patient.id} patient={patient} href={`${getClinicHref(clinicId, 'patients')}/${patient.id}`} />
                ))}
              </div>
              <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="patients" label="Patient pages" />
            </>
          )
        }
      </QueryState>
    </ClinicLayout>
  );
}

export default DentistPatients;
