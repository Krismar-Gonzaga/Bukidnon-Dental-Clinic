import FindClinicsPage from './FindClinicsPage';
import {
  getBookClinicHref,
  getPatientClinicHref,
} from '../config/patientNavigation';
import { MOCK_PATIENT_ACCOUNT } from '../mocks/patientDashboard';

// The public clinic directory as seen by a signed-in patient: "My Account"
// in the header; Book Appointment and View Details open the booking flow and
// the clinic's page.
// Uses MOCK_PATIENT until real sign-in state exists.
function PatientFindClinicsPage() {
  return (
    <FindClinicsPage
      account={MOCK_PATIENT_ACCOUNT}
      getBookHref={(clinic) => getBookClinicHref(clinic.id)}
      getDetailsHref={(clinic) => getPatientClinicHref(clinic.id)}
    />
  );
}

export default PatientFindClinicsPage;
