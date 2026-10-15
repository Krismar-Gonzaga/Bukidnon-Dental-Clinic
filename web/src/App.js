import HomePage from './pages/HomePage';
import FindClinicsPage from './pages/FindClinicsPage';
import DentistsPage from './pages/DentistsPage';
import ServicesPage from './pages/ServicesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import AppointmentHistoryPage from './pages/AppointmentHistoryPage';
import AppointmentDetailsPage from './pages/AppointmentDetailsPage';
import RescheduleAppointmentPage from './pages/RescheduleAppointmentPage';
import FeedbackPage from './pages/FeedbackPage';
import NotificationsPage from './pages/NotificationsPage';
import PatientFindClinicsPage from './pages/PatientFindClinicsPage';
import SavedClinicsPage from './pages/SavedClinicsPage';
import ClinicLocatorPage from './pages/ClinicLocatorPage';
import ClinicDetailsPage from './pages/ClinicDetailsPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';

// TEMPORARY path switch until a router is approved and added.
const PAGES_BY_PATH = {
  '/clinics': FindClinicsPage,
  '/dentists': DentistsPage,
  '/services': ServicesPage,
  '/about': AboutPage,
  '/contact': ContactPage,
  '/login': LoginPage,
  '/register': RegisterPage,
  '/patient/dashboard': PatientDashboardPage,
  '/patient/book': BookAppointmentPage,
  '/patient/appointments': AppointmentHistoryPage,
  '/patient/reviews': FeedbackPage,
  '/patient/notifications': NotificationsPage,
  '/patient/clinics': PatientFindClinicsPage,
  '/patient/saved-clinics': SavedClinicsPage,
  '/patient/clinic-locator': ClinicLocatorPage,
  '/patient/profile': ProfilePage,
  '/patient/profile/edit': EditProfilePage,
  '/patient/profile/password': ChangePasswordPage,
};

// Match /patient/appointments/<id> and /patient/appointments/<id>/reschedule
const APPOINTMENT_DETAILS_PATH = /^\/patient\/appointments\/([^/]+)$/;
const RESCHEDULE_PATH = /^\/patient\/appointments\/([^/]+)\/reschedule$/;
// Match /patient/clinics/<id>
const CLINIC_DETAILS_PATH = /^\/patient\/clinics\/([^/]+)$/;

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  const rescheduleMatch = path.match(RESCHEDULE_PATH);
  if (rescheduleMatch) {
    return (
      <RescheduleAppointmentPage appointmentId={decodeURIComponent(rescheduleMatch[1])} />
    );
  }

  const clinicMatch = path.match(CLINIC_DETAILS_PATH);
  if (clinicMatch) {
    return <ClinicDetailsPage clinicId={decodeURIComponent(clinicMatch[1])} />;
  }

  const detailsMatch = path.match(APPOINTMENT_DETAILS_PATH);
  if (detailsMatch) {
    return <AppointmentDetailsPage appointmentId={decodeURIComponent(detailsMatch[1])} />;
  }

  const Page = PAGES_BY_PATH[path] ?? HomePage;
  return <Page />;
}

export default App;
