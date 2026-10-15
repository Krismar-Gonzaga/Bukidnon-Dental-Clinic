import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import SavedClinicCard from '../components/patient/SavedClinicCard';
import { QueryState } from '../components/StatusMessage';
import {
  PATIENT_FIND_CLINICS_HREF,
  PATIENT_SAVED_CLINICS_HREF,
} from '../config/patientNavigation';
import { getSavedClinics, unsaveClinic } from '../services/patientApi';
import { pluralize } from '../utils/patientDashboard';
import './SavedClinicsPage.css';

export const SAVED_CLINICS_KEY = ['patient', 'savedClinics'];

function SavedClinicsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SAVED_CLINICS_KEY, queryFn: getSavedClinics });

  const unsave = useMutation({
    mutationFn: (clinicId) => unsaveClinic(clinicId),
    // Remove it right away; the server confirms in the background.
    onMutate: (clinicId) =>
      queryClient.setQueryData(SAVED_CLINICS_KEY, (current = []) => current.filter(({ id }) => id !== clinicId)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['patient'] }),
  });

  return (
    <PatientLayout title="Saved Clinics" activeHref={PATIENT_SAVED_CLINICS_HREF}>
      <div className="saved-clinics">
        <QueryState query={query} loadingLabel="Loading saved clinics…">
          {(clinics) => (
            <>
              <div className="saved-clinics-toolbar">
                <p className="saved-clinics-count" role="status">
                  {pluralize(clinics.length, 'saved clinic', 'saved clinics')}
                </p>
                <a href={PATIENT_FIND_CLINICS_HREF} className="saved-clinics-find">
                  <Icon name="plus" size={16} />
                  Find More Clinics
                </a>
              </div>

              {clinics.length > 0 ? (
                <ul className="saved-clinics-grid">
                  {clinics.map((clinic) => (
                    <li key={clinic.id}>
                      <SavedClinicCard clinic={clinic} onUnsave={(id) => unsave.mutate(id)} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="saved-clinics-empty">
                  You have no saved clinics yet. Use the heart on a clinic's page to save it.
                </p>
              )}
            </>
          )}
        </QueryState>
      </div>
    </PatientLayout>
  );
}

export default SavedClinicsPage;
