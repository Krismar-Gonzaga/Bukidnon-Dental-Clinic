import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { AppointmentDecision, FilterSelect, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import { ConfirmDialog } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { CLINIC_APPOINTMENT_STATUSES, getClinicHref } from '../../config/clinicNavigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { appointmentAction, getClinicAppointments } from '../../services/clinicPortalApi';
import { businessTodayKey, formatDate, toBusinessDateKey } from '../../utils/dateTime';
import { hourParts, statusOf } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

const PER_PAGE = 20;
const STATUS_OPTIONS = [{ value: '', label: 'All' }, ...CLINIC_APPOINTMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))];

function AppointmentRow({ appointment, href, canManage, onConfirm, onCheckIn }) {
  const status = statusOf(appointment.backendStatus);
  const { hour, period } = hourParts(appointment.startsAt);
  const isToday = toBusinessDateKey(appointment.startsAt) === businessTodayKey();
  const arrived = appointment.backendStatus === 'checked_in' || appointment.backendStatus === 'in_progress';
  const name = appointment.patient?.name;
  return (
    <li className="frontdesk-appointment">
      <span className="frontdesk-hour">
        {hour}
        <span>{period}</span>
      </span>
      <div className="frontdesk-row-body">
        <p className="frontdesk-appointment-title">
          <a href={href}>{name}</a>
          <Pill tone={status.tone}>{status.label}</Pill>
          {arrived && <Pill tone="info">Checked In</Pill>}
        </p>
        <p className="frontdesk-row-sub">
          {appointment.service} · {appointment.dentist} · {formatDate(appointment.startsAt)}
        </p>
      </div>
      <div className="frontdesk-appointment-actions">
        {canManage && appointment.backendStatus === 'pending' && (
          <button type="button" className="btn btn-outline btn-sm" aria-label={`Confirm ${name}`} onClick={onConfirm}>
            Confirm
          </button>
        )}
        {/* Only on the day: a patient cannot arrive for tomorrow's visit. */}
        {canManage && appointment.backendStatus === 'confirmed' && isToday && (
          <button type="button" className="btn btn-primary btn-sm" aria-label={`Check in ${name}`} onClick={onCheckIn}>
            Check In
          </button>
        )}
        <a href={href} className="frontdesk-chevron" aria-label={`Open appointment for ${name}`}>
          <Icon name="chevronRight" size={18} />
        </a>
      </div>
    </li>
  );
}

/** The front desk's appointment list: today and ahead, or one day from ?date=. */
function FrontDeskAppointments() {
  const { clinicId, can } = useClinicAccess();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const urlDate = searchParams.get('date') ?? '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(urlDate) ? urlDate : '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);
  const [confirming, setConfirming] = useState(null);
  const [checkingIn, setCheckingIn] = useState(null);
  const term = useDebouncedValue(search.trim());
  const canManage = can('appointments.manage');
  const baseHref = getClinicHref(clinicId, 'appointments');

  const params = { from: date || businessTodayKey(), to: date || undefined, status: status || undefined, search: term || undefined };
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'front-desk', params, page],
    queryFn: () => getClinicAppointments(clinicId, { ...params, page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const checkIn = useMutation({
    mutationFn: () => appointmentAction(clinicId, checkingIn.id, 'check-in'),
    onSuccess: () => {
      setCheckingIn(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
    },
  });
  const total = query.data?.meta?.total;

  return (
    <ClinicLayout
      section="appointments"
      title="Appointments"
      subtitle={total == null ? 'Loading appointments…' : `${total} total`}
      requires={['appointments.view_all', 'appointments.view_assigned']}
      hideSearch
      headerActions={
        <>
          <SearchInput
            label="Search patient"
            placeholder="Search patient..."
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
        </>
      }
    >
      <QueryState query={query} loadingLabel="Loading appointments…">
        {({ appointments, meta }) => (
          <>
            {appointments.length === 0 ? (
              <p className="portal-empty">No appointments match.</p>
            ) : (
              <ul className="frontdesk-list">
                {appointments.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    href={`${baseHref}/${appointment.id}`}
                    canManage={canManage}
                    onConfirm={() => setConfirming(appointment)}
                    onCheckIn={() => {
                      checkIn.reset();
                      setCheckingIn(appointment);
                    }}
                  />
                ))}
              </ul>
            )}
            <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Appointment pages" />
          </>
        )}
      </QueryState>
      {confirming && <AppointmentDecision clinicId={clinicId} decision={{ appointment: confirming, action: 'confirm' }} onClose={() => setConfirming(null)} />}
      {checkingIn && (
        <ConfirmDialog
          title="Check In Patient"
          message={`Check in ${checkingIn.patient?.name} for ${checkingIn.service}?`}
          confirmLabel="Check In"
          isBusy={checkIn.isPending}
          error={checkIn.error}
          onConfirm={() => checkIn.mutate()}
          onCancel={() => setCheckingIn(null)}
        />
      )}
    </ClinicLayout>
  );
}

export default FrontDeskAppointments;
