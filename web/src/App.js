import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LinkInterceptor from './components/LinkInterceptor';
import SiteFooter from './components/SiteFooter';
import SiteHeader from './components/SiteHeader';
import RequireAuth, { hasClinicAccess, isClinicApplicant, isPatient, isSystemAdmin } from './auth/RequireAuth';
import HomePage from './pages/HomePage';
import FindClinicsPage from './pages/FindClinicsPage';
import DentistsPage from './pages/DentistsPage';
import ServicesPage from './pages/ServicesPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import LegalPage from './pages/LegalPage';
import NotFoundPage from './pages/NotFoundPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import BookAppointmentPage from './pages/BookAppointmentPage';
import AppointmentHistoryPage from './pages/AppointmentHistoryPage';
import AppointmentDetailsPage from './pages/AppointmentDetailsPage';
import RescheduleAppointmentPage from './pages/RescheduleAppointmentPage';
import FeedbackPage from './pages/FeedbackPage';
import NotificationsPage from './pages/NotificationsPage';
import SavedClinicsPage from './pages/SavedClinicsPage';
import ClinicLocatorPage from './pages/ClinicLocatorPage';
import ClinicMapPage from './pages/ClinicMapPage';
import DentistProfilePage from './pages/DentistProfilePage';
import ClinicDetailsPage from './pages/ClinicDetailsPage';
import ProfilePage from './pages/ProfilePage';
import EditProfilePage from './pages/EditProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AccountProfilePage from './pages/AccountProfilePage';
import ClinicHomePage from './pages/clinic/ClinicHomePage';
import ClinicApplicationPage from './pages/clinic/ClinicApplicationPage';
import ClinicDashboardPage from './pages/clinic/ClinicDashboardPage';
import ClinicAppointmentsPage from './pages/clinic/ClinicAppointmentsPage';
import ClinicSchedulePage from './pages/clinic/ClinicSchedulePage';
import ClinicRecordsPage from './pages/clinic/ClinicRecordsPage';
import ClinicAppointmentDetailPage from './pages/clinic/ClinicAppointmentDetailPage';
import ClinicPatientsPage from './pages/clinic/ClinicPatientsPage';
import ClinicPatientDetailPage from './pages/clinic/ClinicPatientDetailPage';
import ClinicInventoryPage from './pages/clinic/ClinicInventoryPage';
import ClinicInventoryItemPage from './pages/clinic/ClinicInventoryItemPage';
import ClinicServicesPage from './pages/clinic/ClinicServicesPage';
import ClinicDentistsPage from './pages/clinic/ClinicDentistsPage';
import ClinicBranchesPage from './pages/clinic/ClinicBranchesPage';
import ClinicStaffPage from './pages/clinic/ClinicStaffPage';
import ClinicReviewsPage from './pages/clinic/ClinicReviewsPage';
import ClinicReportsPage from './pages/clinic/ClinicReportsPage';
import ClinicSettingsPage from './pages/clinic/ClinicSettingsPage';
import ClinicNotificationsPage from './pages/clinic/ClinicNotificationsPage';
import ClinicWalkInPage from './pages/clinic/ClinicWalkInPage';
import ClinicCheckInPage from './pages/clinic/ClinicCheckInPage';
import ClinicDentistSchedulePage from './pages/clinic/ClinicDentistSchedulePage';
import FrontDeskProfilePage from './pages/clinic/FrontDeskProfilePage';
import ClinicDentistProfilePage from './pages/clinic/ClinicDentistProfilePage';
import ClinicAddDentistPage from './pages/clinic/ClinicAddDentistPage';
import ClinicAddStaffPage from './pages/clinic/ClinicAddStaffPage';
import ClinicSubscriptionPage from './pages/clinic/ClinicSubscriptionPage';
import ClinicPaymentProofPage from './pages/clinic/ClinicPaymentProofPage';
import ClinicAdminSettingsPage from './pages/clinic/ClinicAdminSettingsPage';
import DentistAppointments from './pages/clinic/dentist/DentistAppointments';
import DentistAppointmentDetail from './pages/clinic/dentist/DentistAppointmentDetail';
import DentistPatients from './pages/clinic/dentist/DentistPatients';
import DentistPatientProfile from './pages/clinic/dentist/DentistPatientProfile';
import DentalChartPage from './pages/clinic/dentist/DentalChartPage';
import ClinicalNotesPage, { ClinicalNoteFormPage } from './pages/clinic/dentist/ClinicalNotesPage';
import TreatmentRecordsPage, { TreatmentRecordFormPage } from './pages/clinic/dentist/TreatmentRecordsPage';
import PrescriptionsPage, { PrescriptionFormPage } from './pages/clinic/dentist/PrescriptionsPage';
import DentalCertificatesPage from './pages/clinic/dentist/DentalCertificatesPage';
import ImagingPage from './pages/clinic/dentist/ImagingPage';
import FollowUpsPage from './pages/clinic/dentist/FollowUpsPage';
import DentistSchedulePage from './pages/clinic/dentist/DentistSchedulePage';
import MyDentistProfilePage from './pages/clinic/dentist/DentistProfilePage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage';
import AdminApplicationDetailPage from './pages/admin/AdminApplicationDetailPage';
import AdminClinicsPage from './pages/admin/AdminClinicsPage';
import AdminClinicDetailPage from './pages/admin/AdminClinicDetailPage';
import AdminSubscriptionDetailPage from './pages/admin/AdminSubscriptionDetailPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminAnnouncementsPage from './pages/admin/AdminAnnouncementsPage';
import AdminAnnouncementFormPage from './pages/admin/AdminAnnouncementFormPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import MaintenancePage from './pages/MaintenancePage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminSubscriptionsPage from './pages/admin/AdminSubscriptionsPage';
import AdminAuditLogPage from './pages/admin/AdminAuditLogPage';
import AdminNotificationsPage from './pages/admin/AdminNotificationsPage';
import AdminSettingsPage from './pages/admin/AdminSettingsPage';
import ClinicLayout from './layouts/ClinicLayout';
import ClinicApplicantLayout from './layouts/ClinicApplicantLayout';
import {
  CLINIC_APPLICANT_PASSWORD_HREF,
  CLINIC_APPLICANT_PROFILE_HREF,
  getClinicHref, isDentistMember, isFrontDeskMember,
} from './config/clinicNavigation';
import { ADMIN_ANNOUNCEMENT_NEW_HREF, ADMIN_ANNOUNCEMENTS_HREF, ADMIN_PASSWORD_HREF, ADMIN_PROFILE_HREF, ADMIN_REPORTS_HREF } from './config/adminNavigation';
import { useAuth } from './auth/AuthContext';
import { loadPlatform } from './services/platformApi';
import { usePlatform } from './services/platformStore';
import { getPatientClinicHref, PATIENT_FIND_CLINICS_HREF } from './config/patientNavigation';

// Pages that take a route parameter as a prop (plus any fixed props).
const WithParam = ({ param, prop, Page, ...props }) => {
  const params = useParams();
  return <Page {...props} {...{ [prop]: params[param] }} />;
};

const PublicClinicDetails = () => {
  const { clinicId } = useParams();
  return <ClinicDetailsPage clinicId={clinicId} />;
};

// Old portal addresses of the clinic pages: bookmarks and links in sent emails keep working.
const OldPatientClinicRoute = () => {
  const { clinicId } = useParams();
  const { search } = useLocation();
  return <Navigate to={`${clinicId ? getPatientClinicHref(clinicId) : PATIENT_FIND_CLINICS_HREF}${search}`} replace />;
};

const ClinicPasswordLayout = (props) => <ClinicLayout section="password" {...props} />;

const ClinicPasswordPage = () => {
  const { clinicId } = useParams();
  return (
    <ChangePasswordPage
      layout={ClinicPasswordLayout}
      backHref={getClinicHref(clinicId, 'profile')}
      activeHref={getClinicHref(clinicId, 'password')}
    />
  );
};

// A page dentists see in their own design, and everyone else in the clinic admin one.
const ForDentist = ({ dentist: Dentist, other: Other }) => {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));
  return isDentistMember(membership) ? <Dentist /> : <Other />;
};

const ClinicProfileLayout = (props) => <ClinicLayout section="profile" {...props} />;

const ClinicProfilePage = () => {
  const { clinicId } = useParams();
  const { memberships } = useAuth();
  // Clinic staff get the front desk profile: details, schedule, security, preferences.
  const membership = memberships.find((m) => String(m.clinic_id) === String(clinicId));
  if (isFrontDeskMember(membership)) return <FrontDeskProfilePage />;
  if (isDentistMember(membership)) return <MyDentistProfilePage />;
  return (
    <AccountProfilePage
      layout={ClinicProfileLayout}
      activeHref={getClinicHref(clinicId, 'profile')}
      passwordHref={getClinicHref(clinicId, 'password')}
    />
  );
};

const patient = (element) => <RequireAuth allow={isPatient}>{element}</RequireAuth>;
const clinic = (element) => <RequireAuth allow={hasClinicAccess}>{element}</RequireAuth>;
const admin = (element) => <RequireAuth allow={isSystemAdmin}>{element}</RequireAuth>;

/**
 * Routes. Guards only decide which screens to show; every request is also
 * authorized by the API (roles, clinic membership and permissions).
 */
function App() {
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();
  const { maintenance_mode: maintenance } = usePlatform();

  useEffect(() => {
    loadPlatform();
  }, []);

  // The guest site header and footer are for public pages only:
  // - the patient, clinic and system admin portals have their own sidebar and
  //   top bar (PatientLayout / ClinicShell / PortalLayout);
  // - sign-in, register and password pages (and the /clinic chooser) use the
  //   standalone AuthPageLayout, as in the Figma designs.
  const isPortal =
    /^\/(patient\/|clinic\/|admin(\/|$))/.test(pathname) ||
    /^\/(login|register|forgot-password|reset-password|clinic)\/?$/.test(pathname);
  const activeHref = pathname.startsWith('/clinics/') || pathname.startsWith('/patient/clinics')
    ? '/clinics'
    : pathname;

  // System administrators keep working so they can turn it off; the sign-in page stays open for them.
  if (maintenance && !isLoading && user?.role !== 'system_admin' && pathname !== '/login') {
    return (
      <>
        <LinkInterceptor />
        <MaintenancePage />
      </>
    );
  }

  return (
    <div className="app-shell">
      <LinkInterceptor />
      {!isPortal && <SiteHeader activeHref={activeHref} />}
      <div className="app-route-content">
        <Routes>
        {/* Public */}
        <Route path="/" element={<HomePage />} />
        <Route path="/clinics" element={<FindClinicsPage />} />
        <Route path="/clinics/map" element={<ClinicMapPage />} />
        <Route path="/clinics/:clinicId" element={<PublicClinicDetails />} />
        <Route path="/dentists" element={<DentistsPage />} />
        <Route path="/dentists/:dentistId" element={<WithParam param="dentistId" prop="dentistId" Page={DentistProfilePage} />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<LegalPage page="privacy" />} />
        <Route path="/terms" element={<LegalPage page="terms" />} />
        <Route path="/cookies" element={<LegalPage page="cookies" />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Patient portal */}
        <Route path="/patient/dashboard" element={patient(<PatientDashboardPage />)} />
        <Route path="/patient/book" element={patient(<BookAppointmentPage />)} />
        <Route path="/patient/appointments" element={patient(<AppointmentHistoryPage />)} />
        <Route
          path="/patient/appointments/:appointmentId"
          element={patient(<WithParam param="appointmentId" prop="appointmentId" Page={AppointmentDetailsPage} />)}
        />
        <Route
          path="/patient/appointments/:appointmentId/reschedule"
          element={patient(<WithParam param="appointmentId" prop="appointmentId" Page={RescheduleAppointmentPage} />)}
        />
        <Route path="/patient/reviews" element={patient(<FeedbackPage />)} />
        <Route path="/patient/notifications" element={patient(<NotificationsPage />)} />
        <Route path="/patient/clinics" element={<OldPatientClinicRoute />} />
        <Route path="/patient/clinics/:clinicId" element={<OldPatientClinicRoute />} />
        <Route path="/patient/saved-clinics" element={patient(<SavedClinicsPage />)} />
        <Route path="/patient/clinic-locator" element={patient(<ClinicLocatorPage />)} />
        <Route path="/patient/profile" element={patient(<ProfilePage />)} />
        <Route path="/patient/profile/edit" element={patient(<EditProfilePage />)} />
        <Route path="/patient/profile/password" element={patient(<ChangePasswordPage />)} />

        {/* Clinic owners: application before a clinic exists */}
        <Route path="/clinic/apply" element={<RequireAuth allow={isClinicApplicant}><ClinicApplicationPage /></RequireAuth>} />
        <Route
          path="/clinic/apply/profile"
          element={
            <RequireAuth allow={isClinicApplicant}>
              <AccountProfilePage
                layout={ClinicApplicantLayout}
                activeHref={CLINIC_APPLICANT_PROFILE_HREF}
                passwordHref={CLINIC_APPLICANT_PASSWORD_HREF}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/clinic/apply/password"
          element={
            <RequireAuth allow={isClinicApplicant}>
              <ChangePasswordPage
                layout={ClinicApplicantLayout}
                backHref={CLINIC_APPLICANT_PROFILE_HREF}
                activeHref={CLINIC_APPLICANT_PASSWORD_HREF}
              />
            </RequireAuth>
          }
        />

        {/* Clinic portal */}
        <Route path="/clinic" element={<RequireAuth allow={(u) => hasClinicAccess(u) || u.role !== 'patient'}><ClinicHomePage /></RequireAuth>} />
        <Route path="/clinic/:clinicId" element={clinic(<ClinicDashboardPage />)} />
        <Route path="/clinic/:clinicId/dashboard" element={clinic(<ClinicDashboardPage />)} />
        <Route path="/clinic/:clinicId/appointments" element={clinic(<ForDentist dentist={DentistAppointments} other={ClinicAppointmentsPage} />)} />
        <Route path="/clinic/:clinicId/schedule" element={clinic(<ClinicSchedulePage />)} />
        <Route path="/clinic/:clinicId/records" element={clinic(<ClinicRecordsPage />)} />
        <Route path="/clinic/:clinicId/appointments/walk-in" element={clinic(<ClinicWalkInPage />)} />
        <Route path="/clinic/:clinicId/appointments/new" element={clinic(<ClinicWalkInPage scheduled />)} />
        <Route path="/clinic/:clinicId/check-in" element={clinic(<ClinicCheckInPage />)} />
        <Route path="/clinic/:clinicId/dentist-schedule" element={clinic(<ClinicDentistSchedulePage />)} />
        <Route path="/clinic/:clinicId/appointments/:appointmentId" element={clinic(<ForDentist dentist={DentistAppointmentDetail} other={ClinicAppointmentDetailPage} />)} />
        <Route path="/clinic/:clinicId/patients" element={clinic(<ForDentist dentist={DentistPatients} other={ClinicPatientsPage} />)} />
        <Route path="/clinic/:clinicId/patients/:patientId" element={clinic(<ForDentist dentist={DentistPatientProfile} other={ClinicPatientDetailPage} />)} />
        <Route path="/clinic/:clinicId/dental-chart" element={clinic(<DentalChartPage />)} />
        <Route path="/clinic/:clinicId/clinical-notes" element={clinic(<ClinicalNotesPage />)} />
        <Route path="/clinic/:clinicId/clinical-notes/new" element={clinic(<ClinicalNoteFormPage />)} />
        <Route path="/clinic/:clinicId/treatment-records" element={clinic(<TreatmentRecordsPage />)} />
        <Route path="/clinic/:clinicId/treatment-records/new" element={clinic(<TreatmentRecordFormPage />)} />
        <Route path="/clinic/:clinicId/prescriptions" element={clinic(<PrescriptionsPage />)} />
        <Route path="/clinic/:clinicId/prescriptions/new" element={clinic(<PrescriptionFormPage />)} />
        <Route path="/clinic/:clinicId/certificates" element={clinic(<DentalCertificatesPage />)} />
        <Route path="/clinic/:clinicId/imaging" element={clinic(<ImagingPage />)} />
        <Route path="/clinic/:clinicId/follow-ups" element={clinic(<FollowUpsPage />)} />
        <Route path="/clinic/:clinicId/my-schedule" element={clinic(<DentistSchedulePage />)} />
        <Route path="/clinic/:clinicId/inventory" element={clinic(<ClinicInventoryPage />)} />
        <Route path="/clinic/:clinicId/inventory/:itemId" element={clinic(<ClinicInventoryItemPage />)} />
        <Route path="/clinic/:clinicId/services" element={clinic(<ClinicServicesPage />)} />
        <Route path="/clinic/:clinicId/dentists" element={clinic(<ClinicDentistsPage />)} />
        <Route path="/clinic/:clinicId/dentists/new" element={clinic(<ClinicAddDentistPage />)} />
        <Route path="/clinic/:clinicId/dentists/:dentistId" element={clinic(<ClinicDentistProfilePage />)} />
        <Route path="/clinic/:clinicId/branches" element={clinic(<ClinicBranchesPage />)} />
        <Route path="/clinic/:clinicId/staff" element={clinic(<ClinicStaffPage />)} />
        <Route path="/clinic/:clinicId/staff/new" element={clinic(<ClinicAddStaffPage />)} />
        <Route path="/clinic/:clinicId/reviews" element={clinic(<ClinicReviewsPage />)} />
        <Route path="/clinic/:clinicId/reports" element={clinic(<ClinicReportsPage />)} />
        <Route path="/clinic/:clinicId/settings" element={clinic(<ClinicSettingsPage />)} />
        <Route path="/clinic/:clinicId/notifications" element={clinic(<ClinicNotificationsPage />)} />
        <Route path="/clinic/:clinicId/subscription" element={clinic(<ClinicSubscriptionPage />)} />
        <Route path="/clinic/:clinicId/subscription/payment" element={clinic(<ClinicPaymentProofPage />)} />
        <Route path="/clinic/:clinicId/clinic-settings" element={clinic(<ClinicAdminSettingsPage />)} />
        <Route path="/clinic/:clinicId/password" element={clinic(<ClinicPasswordPage />)} />
        <Route path="/clinic/:clinicId/profile" element={clinic(<ClinicProfilePage />)} />

        {/* System administration */}
        <Route path="/admin" element={admin(<AdminDashboardPage />)} />
        <Route path="/admin/applications" element={admin(<AdminApplicationsPage />)} />
        <Route path="/admin/applications/:applicationId" element={admin(<AdminApplicationDetailPage />)} />
        <Route path="/admin/clinics" element={admin(<AdminClinicsPage />)} />
        <Route path="/admin/clinics/:clinicId" element={admin(<AdminClinicDetailPage />)} />
        <Route path="/admin/users" element={admin(<AdminUsersPage />)} />
        <Route path="/admin/reviews" element={admin(<AdminReviewsPage />)} />
        <Route path="/admin/subscriptions" element={admin(<AdminSubscriptionsPage />)} />
        <Route path="/admin/subscriptions/:clinicId" element={admin(<AdminSubscriptionDetailPage />)} />
        <Route path={ADMIN_REPORTS_HREF} element={admin(<AdminReportsPage />)} />
        <Route path={ADMIN_ANNOUNCEMENTS_HREF} element={admin(<AdminAnnouncementsPage />)} />
        <Route path={ADMIN_ANNOUNCEMENT_NEW_HREF} element={admin(<AdminAnnouncementFormPage />)} />
        <Route path="/admin/announcements/:announcementId/edit" element={admin(<AdminAnnouncementFormPage />)} />
        <Route path="/admin/audit-logs" element={admin(<AdminAuditLogPage />)} />
        <Route path="/admin/notifications" element={admin(<AdminNotificationsPage />)} />
        <Route path="/admin/settings" element={admin(<AdminSettingsPage />)} />
        <Route path={ADMIN_PROFILE_HREF} element={admin(<AdminProfilePage />)} />
        <Route path={ADMIN_PASSWORD_HREF} element={<Navigate to={`${ADMIN_PROFILE_HREF}?tab=security`} replace />} />

        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
      {!isPortal && <SiteFooter />}
    </div>
  );
}

export default App;
