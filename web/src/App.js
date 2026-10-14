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
};

// Match /patient/appointments/<id> and /patient/appointments/<id>/reschedule
const APPOINTMENT_DETAILS_PATH = /^\/patient\/appointments\/([^/]+)$/;
const RESCHEDULE_PATH = /^\/patient\/appointments\/([^/]+)\/reschedule$/;

function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';

  const rescheduleMatch = path.match(RESCHEDULE_PATH);
  if (rescheduleMatch) {
    return (
      <RescheduleAppointmentPage appointmentId={decodeURIComponent(rescheduleMatch[1])} />
    );
  }

  const detailsMatch = path.match(APPOINTMENT_DETAILS_PATH);
  if (detailsMatch) {
    return <AppointmentDetailsPage appointmentId={decodeURIComponent(detailsMatch[1])} />;
  }

  const Page = PAGES_BY_PATH[path] ?? HomePage;
  return <Page />;
}

export default App;
