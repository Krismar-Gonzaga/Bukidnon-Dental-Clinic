import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import Icon from '../components/Icon';
import StarRating from '../components/StarRating';
import { ErrorState, LoadingState } from '../components/StatusMessage';
import { DENTISTS_HREF, getLoginHref, getPublicClinicHref } from '../config/navigation';
import { getBookClinicHref } from '../config/patientNavigation';
import { getDentist } from '../services/publicApi';
import { formatClockTime, WEEKDAY_SHORT } from '../utils/dateTime';
import './DentistProfilePage.css';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "Mon–Fri 9:00 AM – 5:00 PM" rows from weekly schedules; every day is shown. */
export function workingHours(schedules = []) {
  const byDay = {};
  schedules.forEach(({ day_of_week: day, starts_at: start, ends_at: end }) => {
    const current = byDay[day];
    byDay[day] = { start: current && current.start < start ? current.start : start, end: current && current.end > end ? current.end : end };
  });
  const rows = [];
  WEEK_ORDER.forEach((day) => {
    const hours = byDay[day];
    const text = hours ? `${formatClockTime(hours.start)} – ${formatClockTime(hours.end)}` : 'Closed';
    const last = rows[rows.length - 1];
    if (last && last.text === text) last.to = day;
    else rows.push({ from: day, to: day, text });
  });
  return rows.map(({ from, to, text }) => ({ days: from === to ? WEEKDAY_SHORT[from] : `${WEEKDAY_SHORT[from]}–${WEEKDAY_SHORT[to]}`, text }));
}

function DentistProfilePage({ dentistId }) {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['dentist', dentistId], queryFn: () => getDentist(dentistId) });

  if (query.isPending || query.isError) {
    return (
      <main className="dentist-profile-state">
        {query.isPending ? (
          <LoadingState label="Loading dentist…" />
        ) : (
          <>
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
            <a href={DENTISTS_HREF}>Back to Dentists</a>
          </>
        )}
      </main>
    );
  }

  const dentist = query.data;
  const clinic = dentist.clinics[0];
  const initial = dentist.name.replace(/^Dr\.?\s+/i, '').charAt(0).toUpperCase();
  const bookPath = clinic ? getBookClinicHref(clinic.id, dentist.id) : null;
  const bookHref = user?.role === 'patient' ? bookPath : bookPath && getLoginHref(bookPath);
  const hasRating = typeof dentist.rating === 'number';

  return (
    <main className="dentist-profile">
      <div className="dentist-profile-banner" />
      <div className="dentist-profile-container">
        <header className="dentist-profile-head">
          <span className="dentist-profile-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="dentist-profile-identity">
            <div className="dentist-profile-title">
              <h1 className="dentist-profile-name">{dentist.name}</h1>
              {dentist.available && <span className="dentist-profile-accepting">Accepting Patients</span>}
            </div>
            <p className="dentist-profile-meta">{[dentist.specialty, clinic?.name].filter(Boolean).join(' · ')}</p>
            {hasRating ? (
              <p className="dentist-profile-rating">
                <StarRating rating={dentist.rating} size={15} />
                {dentist.rating.toFixed(1)} ({dentist.reviewCount} {dentist.reviewCount === 1 ? 'review' : 'reviews'})
              </p>
            ) : (
              <p className="dentist-profile-rating">No reviews yet</p>
            )}
          </div>
          {bookHref && (
            <a href={bookHref} className="btn btn-primary dentist-profile-book">
              Book Appointment
            </a>
          )}
        </header>

        <div className="dentist-profile-grid">
          <div className="dentist-profile-column">
            <section className="dentist-profile-card" aria-labelledby="dentist-about">
              <h2 id="dentist-about" className="dentist-profile-card-title">
                About
              </h2>
              <p className="dentist-profile-text">{dentist.bio || 'This dentist has not added a description yet.'}</p>
            </section>

            <section className="dentist-profile-card" aria-labelledby="dentist-credentials">
              <h2 id="dentist-credentials" className="dentist-profile-card-title">
                Credentials
              </h2>
              <dl className="dentist-profile-credentials">
                <div>
                  <Icon name="award" size={20} />
                  <div>
                    <dt>Education</dt>
                    <dd>{dentist.qualifications || 'Not provided'}</dd>
                  </div>
                </div>
                <div>
                  <Icon name="clock" size={20} />
                  <div>
                    <dt>Experience</dt>
                    <dd>
                      {dentist.yearsExperience} {dentist.yearsExperience === 1 ? 'year' : 'years'}
                    </dd>
                  </div>
                </div>
                {clinic && (
                  <div>
                    <Icon name="building" size={20} />
                    <div>
                      <dt>Clinic</dt>
                      <dd>{clinic.name}</dd>
                    </div>
                  </div>
                )}
              </dl>
            </section>
          </div>

          <div className="dentist-profile-column">
            <section className="dentist-profile-card" aria-labelledby="dentist-hours">
              <h2 id="dentist-hours" className="dentist-profile-card-title">
                Working Hours
              </h2>
              <dl className="dentist-profile-hours">
                {workingHours(dentist.schedules).map((row) => (
                  <div key={row.days}>
                    <dt>{row.days}</dt>
                    <dd>{row.text}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {clinic && (
              <section className="dentist-profile-card" aria-labelledby="dentist-clinic">
                <h2 id="dentist-clinic" className="dentist-profile-card-title">
                  Clinic
                </h2>
                <a href={getPublicClinicHref(clinic.id)} className="dentist-profile-clinic-name">
                  {clinic.name}
                </a>
                <p className="dentist-profile-clinic-address">{clinic.address}</p>
                <a href={getPublicClinicHref(clinic.id)} className="dentist-profile-link" aria-label={`View ${clinic.name}`}>
                  View Clinic
                  <Icon name="arrowRight" size={14} />
                </a>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default DentistProfilePage;
