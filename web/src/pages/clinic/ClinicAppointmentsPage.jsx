import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, DataTable, Field, Section } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { CLINIC_APPOINTMENT_STATUSES, getClinicHref } from '../../config/clinicNavigation';
import { getClinicAppointments, getClinicDentists } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { businessTodayKey, dateFromKey, formatShortDate, formatTime } from '../../utils/dateTime';
import { toDateKey } from '../../utils/bookingCalendar';

const VIEWS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week (7 days)' },
  { value: 'month', label: 'Month (30 days)' },
];
const VIEW_DAYS = { day: 0, week: 6, month: 29 };

const addDays = (key, days) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

function AppointmentQueue() {
  const { clinicId, can } = useClinic();
  const [view, setView] = useState('week');
  const [from, setFrom] = useState(businessTodayKey());
  const [status, setStatus] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search);
  const to = addDays(from, VIEW_DAYS[view]);
  const canFilterDentists = can('appointments.view_all');

  const dentists = useQuery({
    queryKey: ['clinic', clinicId, 'dentists'],
    queryFn: () => getClinicDentists(clinicId),
    enabled: canFilterDentists,
  });

  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', from, to, status, dentistId, debouncedSearch, page],
    queryFn: () =>
      getClinicAppointments(clinicId, {
        from,
        to,
        status: status || undefined,
        dentist_id: dentistId || undefined,
        search: debouncedSearch || undefined,
        page,
        per_page: 25,
      }),
    placeholderData: keepPreviousData,
  });

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <Section
      title={can('appointments.view_all') ? 'Appointments' : 'My appointments'}
      subtitle={`${formatShortDate(`${from}T12:00:00+08:00`)} – ${formatShortDate(`${to}T12:00:00+08:00`)} · times in Philippine time`}
    >
      <div className="portal-toolbar">
        <Field label="View" as="select" options={VIEWS} value={view} onChange={resetPage(setView)} />
        <Field label="Starting" type="date" value={from} onChange={(e) => e.target.value && resetPage(setFrom)(e)} />
        <Field
          label="Status"
          as="select"
          options={[{ value: '', label: 'All statuses' }, ...CLINIC_APPOINTMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))]}
          value={status}
          onChange={resetPage(setStatus)}
        />
        {canFilterDentists && (
          <Field
            label="Dentist"
            as="select"
            options={[{ value: '', label: 'All dentists' }, ...(dentists.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
            value={dentistId}
            onChange={resetPage(setDentistId)}
          />
        )}
        <Field label="Patient" type="search" placeholder="Name or email" value={search} onChange={resetPage(setSearch)} />
      </div>

      {query.isPending ? (
        <LoadingState label="Loading appointments…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          <DataTable
            caption="Appointments"
            rows={query.data.appointments}
            emptyText="No appointments match these filters."
            columns={[
              { key: 'date', label: 'Date', render: (a) => formatShortDate(a.startsAt) },
              { key: 'time', label: 'Time', render: (a) => formatTime(a.startsAt) },
              { key: 'patient', label: 'Patient', render: (a) => a.patient?.name },
              { key: 'service', label: 'Service' },
              { key: 'dentist', label: 'Dentist' },
              { key: 'branch', label: 'Branch' },
              { key: 'status', label: 'Status', render: (a) => <Badge status={a.backendStatus} /> },
              {
                key: 'open',
                label: '',
                render: (a) => (
                  <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`} aria-label={`Open appointment ${a.reference}`}>
                    Open
                  </a>
                ),
              },
            ]}
          />
          <Pagination
            currentPage={page}
            pageCount={query.data.meta.last_page ?? 1}
            onPageChange={setPage}
            label="Appointment pages"
          />
        </>
      )}
    </Section>
  );
}

function ClinicAppointmentsPage() {
  return (
    <ClinicLayout section="appointments" title="Appointments" requires={['appointments.view_all', 'appointments.view_assigned']}>
      <AppointmentQueue />
    </ClinicLayout>
  );
}

export default ClinicAppointmentsPage;
