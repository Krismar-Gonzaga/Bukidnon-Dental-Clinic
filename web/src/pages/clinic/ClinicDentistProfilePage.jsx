import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill } from '../../components/clinic/ClinicUi';
import ScheduleApprovals from '../../components/clinic/ScheduleApprovals';
import { ConfirmDialog } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref, getClinicStatusLabel } from '../../config/clinicNavigation';
import { getBranches, getClinicDentist, updateDentist } from '../../services/clinicPortalApi';
import { formatDate, formatShortDate, formatTime } from '../../utils/dateTime';
import { ProfileModal, ScheduleModal } from './ClinicDentistsPage';
import '../../components/clinic/ClinicAdminUi.css';

const WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const STATUS_TONES = { pending: 'warning', reschedule_requested: 'warning', confirmed: 'info', completed: 'success', cancelled: 'danger', rejected: 'danger', no_show: 'danger' };

const toClockLabel = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
};

// Earliest start to latest end across the week.
const hoursLabel = (schedules) => {
  if (schedules.length === 0) return 'No hours set';
  const starts = schedules.map((s) => s.starts_at).sort();
  const ends = schedules.map((s) => s.ends_at).sort();
  return `${toClockLabel(starts[0])} – ${toClockLabel(ends[ends.length - 1])}`;
};

/** A dentist's page for the clinic: details, weekly hours and recent appointments. */
function ClinicDentistProfilePage() {
  const { dentistId } = useParams();
  const { clinicId, can } = useClinicAccess();
  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);
  const queryKey = ['clinic', clinicId, 'dentist', dentistId];
  const query = useQuery({ queryKey, queryFn: () => getClinicDentist(clinicId, dentistId), enabled: can('clinic.dentists.manage', 'clinic.schedules.manage') });
  const branches = useQuery({ queryKey: ['clinic', clinicId, 'branches'], queryFn: () => getBranches(clinicId), enabled: can('clinic.schedules.manage') });
  const canEdit = can('clinic.dentists.manage');
  const dentist = query.data;

  const toggle = useMutation({
    mutationFn: () => updateDentist(clinicId, dentistId, { is_active: !dentist.is_active }),
    onSuccess: () => {
      setModal(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
    },
  });

  return (
    <ClinicLayout
      section="dentists"
      title={dentist?.name ?? 'Dentist'}
      subtitle={dentist?.specialization ?? 'General Dentist'}
      requires={['clinic.dentists.manage', 'clinic.schedules.manage']}
      hideSearch
      headerActions={
        dentist &&
        canEdit && (
          <div className="clinic-header-actions">
            <button type="button" className={`clinic-action-button ${dentist.is_active ? 'is-danger' : ''}`} onClick={() => setModal('toggle')}>
              <Icon name={dentist.is_active ? 'alertCircle' : 'checkCircle'} size={18} />
              {dentist.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setModal('edit')}>
              <Icon name="pencil" size={18} />
              Edit Profile
            </button>
          </div>
        )
      }
    >
      <BackLink href={getClinicHref(clinicId, 'dentists')}>Back to Dentists</BackLink>
      <QueryState query={query} loadingLabel="Loading dentist…">
        {(data) => (
          <div className="clinic-split">
            <div>
              <Card>
                <div className="clinic-identity">
                  <InitialsTile name={data.name} id={data.id} size="lg" />
                  <h2 className="clinic-identity-name">{data.name}</h2>
                  <p className="clinic-admin-card-sub">{data.specialization ?? 'General Dentist'}</p>
                  <Pill tone={data.is_active ? 'success' : 'neutral'}>{data.is_active ? 'Active' : 'Inactive'}</Pill>
                  <ul className="clinic-identity-list">
                    {data.email && (
                      <li>
                        <Icon name="mail" size={16} />
                        {data.email}
                      </li>
                    )}
                    {data.phone && (
                      <li>
                        <Icon name="phone" size={16} />
                        {data.phone}
                      </li>
                    )}
                    <li>
                      <Icon name="clock" size={16} />
                      {hoursLabel(data.schedules ?? [])}
                    </li>
                    {data.qualifications && (
                      <li>
                        <Icon name="award" size={16} />
                        {data.qualifications}
                      </li>
                    )}
                  </ul>
                </div>
              </Card>
              <Card title="Stats">
                <dl className="clinic-stat-rows">
                  <div>
                    <dt>Today's Appointments</dt>
                    <dd>{data.appointments_today}</dd>
                  </div>
                  <div>
                    <dt>Total Appointments</dt>
                    <dd>{data.appointments_total}</dd>
                  </div>
                  <div>
                    <dt>Experience</dt>
                    <dd>{data.years_experience} yrs</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>{data.joined_at ? formatShortDate(data.joined_at) : '—'}</dd>
                  </div>
                </dl>
              </Card>
            </div>

            <div>
              {can('clinic.schedules.manage') && <ScheduleApprovals clinicId={clinicId} dentistId={dentistId} />}
              <Card
                title="Weekly Schedule"
                actions={
                  can('clinic.schedules.manage') && (
                    <button type="button" className="clinic-link-button" onClick={() => setModal('schedule')}>
                      Edit schedule
                    </button>
                  )
                }
              >
                <div className="clinic-week">
                  {WEEK.map(({ day, label }) => {
                    const working = (data.schedules ?? []).some((s) => s.day_of_week === day);
                    return (
                      <div key={day} className={`clinic-week-day${working ? ' is-on' : ''}`}>
                        <strong>{label}</strong>
                        {working ? 'Working' : 'Off'}
                      </div>
                    );
                  })}
                </div>
                <p className="clinic-admin-card-sub">Hours: {hoursLabel(data.schedules ?? [])}</p>
              </Card>

              <Card title="Assigned Appointments" actions={<span className="clinic-admin-card-sub">{data.appointments_total} total</span>}>
                <div className="clinic-data-scroll">
                  <table className="clinic-data-table">
                    <caption className="visually-hidden">Assigned appointments</caption>
                    <thead>
                      <tr>
                        <th scope="col">Patient</th>
                        <th scope="col">Service</th>
                        <th scope="col">Date</th>
                        <th scope="col">Time</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.appointments.map((a) => (
                        <tr key={a.id}>
                          <td data-label="Patient">
                            <span className="clinic-cell-title">{a.patient}</span>
                          </td>
                          <td data-label="Service">{a.service}</td>
                          <td data-label="Date">{formatDate(a.starts_at)}</td>
                          <td data-label="Time">{formatTime(a.starts_at)}</td>
                          <td data-label="Status">
                            <Pill tone={STATUS_TONES[a.status] ?? 'info'}>{getClinicStatusLabel(a.status)}</Pill>
                          </td>
                        </tr>
                      ))}
                      {data.appointments.length === 0 && (
                        <tr>
                          <td colSpan={5} className="clinic-empty-row">
                            No appointments yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </QueryState>

      {modal === 'edit' && <ProfileModal dentist={dentist} onClose={() => setModal(null)} />}
      {modal === 'schedule' && <ScheduleModal dentist={dentist} branches={branches.data ?? []} onClose={() => setModal(null)} />}
      {modal === 'toggle' && (
        <ConfirmDialog
          title={`${dentist.is_active ? 'Deactivate' : 'Activate'} ${dentist.name}?`}
          message={dentist.is_active ? 'Patients will no longer be able to book with this dentist. Existing appointments stay as they are.' : 'Patients will be able to book with this dentist again.'}
          confirmLabel={dentist.is_active ? 'Deactivate' : 'Activate'}
          danger={dentist.is_active}
          isBusy={toggle.isPending}
          error={toggle.error}
          onConfirm={() => toggle.mutate()}
          onCancel={() => setModal(null)}
        />
      )}
    </ClinicLayout>
  );
}

export default ClinicDentistProfilePage;
