import FindClinicsPage from './FindClinicsPage';
import {
  getBookClinicHref,
  getPatientClinicHref,
} from '../config/patientNavigation';

// The clinic directory as seen by a signed-in patient: Book Appointment and
// View Details open the booking flow and the patient clinic page.
function PatientFindClinicsPage() {
  return (
    <FindClinicsPage
      getBookHref={(clinic) => getBookClinicHref(clinic.id)}
      getDetailsHref={(clinic) => getPatientClinicHref(clinic.id)}
    />
  );
}

export default PatientFindClinicsPage;
