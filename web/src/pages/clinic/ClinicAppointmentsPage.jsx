import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import { TableFooter } from '../../components/admin/AdminData';
import { AppointmentDecision, FilterSelect, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { CLINIC_APPOINTMENT_STATUSES, getClinicHref, getClinicStatusLabel, isFrontDeskMember } from '../../config/clinicNavigation';
import { getClinicAppointments, getClinicDentists } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { businessTodayKey, formatDate, formatTime } from '../../utils/dateTime';
import FrontDeskAppointments from './FrontDeskAppointments';
import { Schedule } from './ClinicSchedulePage';
import './ClinicAppointmentsPage.css';

const STATUS_TONES = {
  pending: 'warning',
  reschedule_requested: 'warning',
  confirmed: 'info',
  checked_in: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'neutral',
  rejected: 'danger',
  no_show: 'danger',
};

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...CLINIC_APPOINTMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))];

function AppointmentTable() {
  const { clinicId, can } = useClinic();
  // ?status= (dashboard, alerts) opens the list filtered; ?date= (dashboard calendar) opens that day.
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date') ?? '';
  const [date, setDate] = useState(/^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [dentistId, setDentistId] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [decision, setDecision] = useState(null);
  const debouncedSearch = useDebouncedValue(search.trim());
  const canManage = can('appointments.manage');
  const canFilterDentists = can('appointments.view_all');

  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId), enabled: canFilterDentists });
  // A picked date shows that day; otherwise today and everything ahead.
  const params = {
    from: date || businessTodayKey(),
    to: date || undefined,
    status: status || undefined,
    dentist_id: dentistId || undefined,
    search: debouncedSearch || undefined,
  };
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', params, page, perPage],
    queryFn: () => getClinicAppointments(clinicId, { ...params, page, per_page: perPage }),
    placeholderData: keepPreviousData,
  });
  const changeFilter = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  return (
    <>
      <div className="clinic-toolbar">
        <SearchInput label="Search patients or services" placeholder="Search patients or services..." value={search} onChange={changeFilter(setSearch)} />
        <FilterSelect label="Status" value={status} onChange={changeFilter(setStatus)} options={STATUS_OPTIONS} />
        {canFilterDentists && (
          <FilterSelect
            label="Dentist"
            value={dentistId}
            onChange={changeFilter(setDentistId)}
            options={[{ value: '', label: 'All dentists' }, ...(dentists.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))]}
          />
        )}
        <label>
          <span className="visually-hidden">Date</span>
          <input type="date" className="clinic-date-filter" value={date} onChange={(e) => changeFilter(setDate)(e.target.value)} />
        </label>
      </div>

      {query.isPending ? (
        <LoadingState label="Loading appointments…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="clinic-data-card">
          <div className="clinic-data-scroll">
            <table className="clinic-data-table">
              <caption className="visually-hidden">Appointments</caption>
              <thead>
                <tr>
                  <th scope="col">Patient</th>
                  <th scope="col">Service</th>
                  <th scope="col">Dentist</th>
                  <th scope="col">Date &amp; Time</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="is-end">
                    <span className="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.appointments.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Patient">
                      <span className="clinic-cell-title">{a.patient?.name}</span>
                      {a.patient?.age != null && <span className="clinic-cell-sub">Age: {a.patient.age}</span>}
                    </td>
                    <td data-label="Service">{a.service}</td>
                    <td data-label="Dentist">{a.dentist}</td>
                    <td data-label="Date &amp; Time">
                      <span className="clinic-appointment-date">{formatDate(a.startsAt)}</span>
                      <span className="clinic-cell-sub">{formatTime(a.startsAt)}</span>
                    </td>
                    <td data-label="Type">{a.type === 'walk_in' ? <Pill tone="purple">Walk-in</Pill> : <Pill tone="warning">Online</Pill>}</td>
                    <td data-label="Status">
                      <Pill tone={STATUS_TONES[a.backendStatus]}>{getClinicStatusLabel(a.backendStatus)}</Pill>
                    </td>
                    <td data-label="" className="is-end">
                      <div className="clinic-row-actions">
                        <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`} className="clinic-mini-button is-primary" aria-label={`View appointment of ${a.patient?.name}`}>
                          View
                        </a>
                        {canManage && a.backendStatus === 'pending' && (
                          <>
                            <button type="button" className="clinic-mini-button is-success" aria-label={`Confirm appointment of ${a.patient?.name}`} onClick={() => setDecision({ appointment: a, action: 'confirm' })}>
                              Confirm
                            </button>
                            <button type="button" className="clinic-mini-button is-danger" aria-label={`Cancel appointment of ${a.patient?.name}`} onClick={() => setDecision({ appointment: a, action: 'cancel' })}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {query.data.appointments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="clinic-empty-row">
                      {date ? 'No appointments match these filters on that date.' : 'No upcoming appointments match these filters. Pick a date to see past ones.'}
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
            noun="appointments"
            label="Appointment pages"
          />
        </div>
      )}
      {decision && <AppointmentDecision clinicId={clinicId} decision={decision} onClose={() => setDecision(null)} />}
    </>
  );
}

function ManagerAppointments() {
  const { can } = useClinicAccess();
  const [view, setView] = useState('table');

  return (
    <ClinicLayout
      section="appointments"
      title={can('appointments.view_all') ? 'Appointment Management' : 'My Appointments'}
      subtitle="Times are in Philippine time"
      requires={['appointments.view_all', 'appointments.view_assigned']}
      hideSearch
      showWalkIn
      headerActions={
        <div className="clinic-view-switch" role="group" aria-label="Appointment view">
          {['table', 'calendar'].map((option) => (
            <button key={option} type="button" className={view === option ? 'is-active' : ''} aria-pressed={view === option} onClick={() => setView(option)}>
              {option === 'table' ? 'Table' : 'Calendar'}
            </button>
          ))}
        </div>
      }
    >
      {view === 'table' ? <AppointmentTable /> : <Schedule />}
    </ClinicLayout>
  );
}

// Clinic staff work from their own list (front desk design).
function ClinicAppointmentsPage() {
  const { membership } = useClinicAccess();
  return isFrontDeskMember(membership) ? <FrontDeskAppointments /> : <ManagerAppointments />;
}

export default ClinicAppointmentsPage;
