import { fireEvent, render, screen, within } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { MOCK_PATIENT_PROFILE } from '../mocks/patientProfile';
import { getAge } from '../utils/profile';

test('shows the profile header, tags, medical alert, and actions', () => {
  render(<ProfilePage />);
  expect(screen.getByRole('heading', { level: 1, name: 'My Profile' })).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getByRole('link', { name: 'My Profile' })).toHaveAttribute(
    'aria-current',
    'page'
  );

  const header = screen.getByRole('region', { name: 'Profile summary' });
  expect(within(header).getByRole('heading', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
  const tags = within(header).getByRole('list', { name: 'Health tags' });
  expect(within(tags).getAllByRole('listitem')).toHaveLength(3);
  expect(within(header).getByRole('link', { name: 'Edit Profile' })).toHaveAttribute(
    'href',
    '/patient/profile/edit'
  );
  expect(within(header).getByRole('link', { name: 'Password' })).toHaveAttribute(
    'href',
    '/patient/profile/password'
  );
  expect(screen.getByText('Important Medical Alerts')).toBeInTheDocument();
});

test('overview shows personal, contact, and activity details', () => {
  render(<ProfilePage />);
  const personal = screen.getByRole('region', { name: 'Personal Information' });
  expect(personal).toHaveTextContent('March 15, 1995');
  expect(personal).toHaveTextContent(`${getAge('1995-03-15')} years old`);
  expect(personal).toHaveTextContent('O+');

  const contact = screen.getByRole('region', { name: 'Contact Details' });
  expect(contact).toHaveTextContent('juan@email.com');
  expect(contact).toHaveTextContent('8709');

  const activity = screen.getByRole('region', { name: 'Activity Summary' });
  expect(activity).toHaveTextContent('Total Appointments');
  expect(activity).toHaveTextContent('6');
});

const openTab = (name) => {
  fireEvent.click(screen.getByRole('tab', { name }));
  return screen.getByRole('tabpanel');
};

const expectEditLink = (card, tabId) => {
  expect(within(card).getByRole('link', { name: /^Edit / })).toHaveAttribute(
    'href',
    `/patient/profile/edit?tab=${tabId}`
  );
};

test('Medical History tab shows conditions, procedures, and vital notes', () => {
  render(<ProfilePage />);
  const panel = openTab('Medical History');

  const conditions = within(panel).getByRole('region', { name: 'Medical Conditions' });
  const conditionList = within(conditions).getByRole('list', { name: 'Medical conditions' });
  expect(within(conditionList).getAllByRole('listitem')).toHaveLength(3);
  expect(within(conditions).getByRole('note')).toHaveTextContent('special precautions');
  expectEditLink(conditions, 'medical');

  const procedures = within(panel).getByRole('region', { name: 'Previous Dental Procedures' });
  expect(within(procedures).getAllByRole('listitem')).toHaveLength(3);
  expect(procedures).toHaveTextContent('Lower right molar (#47)');
  expect(procedures).toHaveTextContent('March 2024');

  const vitals = within(panel).getByRole('region', { name: 'Vital & Systemic Notes' });
  expect(vitals).toHaveTextContent('130/85 mmHg');
  expect(vitals).toHaveTextContent('Elevated — monitor before procedures');
  expect(vitals).toHaveTextContent('None in past 6 months');
});

test('Allergies & Medications tab shows allergies, medications, and anxiety', () => {
  render(<ProfilePage />);
  const panel = openTab('Allergies & Medications');

  const allergies = within(panel).getByRole('region', { name: 'Known Allergies' });
  expect(within(allergies).getAllByRole('listitem')).toHaveLength(3);
  expect(allergies).toHaveTextContent('Severe');
  expect(allergies).toHaveTextContent('Reaction: Hives, difficulty breathing');
  expectEditLink(allergies, 'allergies');

  const medications = within(panel).getByRole('region', { name: 'Current Medications' });
  expect(medications).toHaveTextContent('5mg once daily');
  expect(medications).toHaveTextContent('For: Type 2 Diabetes');
  expect(medications).toHaveTextContent('May cause gingival enlargement');

  const anxiety = within(panel).getByRole('region', { name: 'Dental Anxiety' });
  expect(within(anxiety).getByRole('img', { name: 'Level 3 of 5' })).toBeInTheDocument();
  expect(anxiety).toHaveTextContent('Local anesthesia only');
  expect(anxiety).toHaveTextContent('Sensitive to needles');
});

test('Emergency Contact tab shows the contact and consent settings', () => {
  render(<ProfilePage />);
  const panel = openTab('Emergency Contact');

  const contact = within(panel).getByRole('region', { name: 'Primary Emergency Contact' });
  expect(contact).toHaveTextContent('Maria Dela Cruz');
  expect(within(contact).getByRole('link', { name: '+63 918 765 4321' })).toHaveAttribute(
    'href',
    'tel:+639187654321'
  );
  expect(contact).toHaveTextContent('Purok 5, Catumbalon, Valencia City, Bukidnon');
  expectEditLink(contact, 'emergency');

  const consents = within(panel).getByRole('region', { name: 'Consent & Preferences' });
  const items = within(consents).getAllByRole('listitem');
  expect(items).toHaveLength(5);
  expect(items[0]).toHaveTextContent('SMS appointment remindersOn');
  expect(items[4]).toHaveTextContent('Promotional offers and dental health tipsOff');
});

test('section tabs show empty messages when nothing is recorded', () => {
  render(<ProfilePage profile={{ ...MOCK_PATIENT_PROFILE, conditions: [], emergencyContact: null }} />);
  expect(openTab('Medical History')).toHaveTextContent('No medical conditions recorded.');
  expect(openTab('Emergency Contact')).toHaveTextContent('No emergency contact added yet.');
});

test('age counts only birthdays already reached', () => {
  expect(getAge('1995-03-15', new Date(2026, 2, 14))).toBe(30);
  expect(getAge('1995-03-15', new Date(2026, 2, 15))).toBe(31);
});
