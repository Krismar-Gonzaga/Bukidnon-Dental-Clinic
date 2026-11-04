import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ScheduleApprovals from './ScheduleApprovals';
import * as api from '../../services/clinicPortalApi';
import { renderWithProviders } from '../../testUtils';

jest.mock('../../services/clinicPortalApi');

const change = {
  id: 7,
  dentist: { id: 1, name: 'Dr. Ana Reyes' },
  branch: { id: 2, name: 'Main Branch' },
  days: [1, 2],
  starts_at: '08:00',
  ends_at: '12:00',
  note: 'Afternoon classes',
  current: { days: [1, 2, 3, 4, 5], starts_at: '08:00', ends_at: '17:00' },
  outside_hours: 2,
  created_at: '2026-11-04T08:00:00+08:00',
};

const user = { id: 1, name: 'Admin', role: 'clinic_admin', memberships: [] };
const render = () => renderWithProviders(<ScheduleApprovals clinicId="7" />, { user });

test('shows nothing when no change is waiting', async () => {
  api.getScheduleChanges.mockResolvedValue([]);
  render();
  await waitFor(() => expect(api.getScheduleChanges).toHaveBeenCalled());
  expect(screen.queryByText('Schedule Changes to Approve')).not.toBeInTheDocument();
});

test('compares current and requested hours, warns about visits, and approves after asking', async () => {
  api.getScheduleChanges.mockResolvedValue([change]);
  api.approveScheduleChange.mockResolvedValue({});
  render();

  expect(await screen.findByText('Dr. Ana Reyes')).toBeInTheDocument();
  expect(screen.getByText('Mon – Fri')).toBeInTheDocument();
  expect(screen.getByText('Mon – Tue')).toBeInTheDocument();
  expect(screen.getByText(/2 booked visits fall outside these hours/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Approve schedule change for Dr. Ana Reyes' }));
  expect(api.approveScheduleChange).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Approve' }));
  await waitFor(() => expect(api.approveScheduleChange).toHaveBeenCalledWith('7', 7));
});

test('declining needs a reason', async () => {
  api.getScheduleChanges.mockResolvedValue([change]);
  api.rejectScheduleChange.mockResolvedValue({});
  render();

  fireEvent.click(await screen.findByRole('button', { name: 'Decline schedule change for Dr. Ana Reyes' }));
  const dialog = screen.getByRole('dialog');
  const decline = within(dialog).getByRole('button', { name: 'Decline' });
  expect(decline).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Short-staffed' } });
  fireEvent.click(decline);
  await waitFor(() => expect(api.rejectScheduleChange).toHaveBeenCalledWith('7', 7, 'Short-staffed'));
});
