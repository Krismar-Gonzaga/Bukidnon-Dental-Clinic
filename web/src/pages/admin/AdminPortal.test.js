import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import AdminApplicationDetailPage from './AdminApplicationDetailPage';
import AdminUsersPage from './AdminUsersPage';
import * as api from '../../services/adminApi';
import { getNotifications } from '../../services/notificationApi';
import { renderWithProviders } from '../../testUtils';
import { emptyNotifications } from '../../testFixtures';

jest.mock('../../services/adminApi');
jest.mock('../../services/notificationApi');

const ADMIN_USER = { id: 1, name: 'Platform Admin', email: 'admin@example.com', role: 'system_admin', memberships: [] };

const APPLICATION = {
  id: 5,
  status: 'pending',
  clinic_name: 'Quezon Family Dental',
  address: 'Poblacion',
  city: 'Quezon',
  province: 'Bukidnon',
  contact_number: '0917',
  representative_name: 'Dr. Ana Reyes',
  applicant: { id: 9, name: 'Ana Reyes', email: 'ana@example.com' },
  documents: [{ id: 1, document_type: 'business_permit', original_name: 'permit.pdf', uploaded_at: '2026-10-10T10:00:00+08:00' }],
  missing_documents: [],
  submitted_at: '2026-10-10T10:00:00+08:00',
};

beforeEach(() => getNotifications.mockResolvedValue(emptyNotifications));

test('reviewing an application: open a document, request changes only with notes, approve', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.openApplicationDocument.mockResolvedValue();
  api.approveApplication.mockResolvedValue({});
  renderWithProviders(<AdminApplicationDetailPage />, { user: ADMIN_USER, route: '/admin/applications/5', path: '/admin/applications/:applicationId' });

  expect(await screen.findByRole('heading', { name: 'Quezon Family Dental' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  expect(api.openApplicationDocument).toHaveBeenCalledWith('admin', 5, 1);

  expect(screen.getByRole('button', { name: 'Request changes / reject' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Approve clinic' }));
  await waitFor(() => expect(api.approveApplication).toHaveBeenCalledWith('5', undefined));
});

test('approval is blocked while required documents are missing', async () => {
  api.getApplication.mockResolvedValue({ ...APPLICATION, missing_documents: ['doh_license'] });
  renderWithProviders(<AdminApplicationDetailPage />, { user: ADMIN_USER, route: '/admin/applications/5', path: '/admin/applications/:applicationId' });

  expect(await screen.findByText(/Missing: DOH license to operate/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve clinic' })).toBeDisabled();
});

test('suspending a user requires a reason; admins cannot manage themselves', async () => {
  api.getUsers.mockResolvedValue({
    items: [
      { id: 1, name: 'Platform Admin', email: 'admin@example.com', role: 'system_admin', status: 'active', clinic_memberships: 0, created_at: '2026-01-01T00:00:00+08:00' },
      { id: 4, name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'patient', status: 'active', clinic_memberships: 0, created_at: '2026-02-01T00:00:00+08:00' },
    ],
    meta: { last_page: 1 },
  });
  api.updateUser.mockResolvedValue({});
  renderWithProviders(<AdminUsersPage />, { user: ADMIN_USER });

  expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Manage' })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
  const dialog = screen.getByRole('dialog', { name: 'Manage Juan Dela Cruz' });
  fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: 'suspended' } });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Abusive messages' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(4, { status: 'suspended', reason: 'Abusive messages' }));
});
