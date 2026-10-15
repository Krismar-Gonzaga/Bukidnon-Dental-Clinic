import Icon from '../Icon';
import ProfileInfoCard from './ProfileInfoCard';
import ProfileItem from './ProfileItem';
import ProfileTag from './ProfileTag';
import ProfileDetailTile from './ProfileDetailTile';
import { ALLERGY_SEVERITIES, ANXIETY_SCALE_MAX } from '../../config/profile';
import './ProfileAllergiesMedications.css';

const ANXIETY_STEPS = Array.from({ length: ANXIETY_SCALE_MAX }, (_, index) => index + 1);

// My Profile, Allergies & Medications tab: allergies, current medications,
// and dental anxiety. `editHref` is used by every card's Edit link.
function ProfileAllergiesMedications({ profile, editHref }) {
  const { allergies = [], medications = [], dentalAnxiety } = profile;

  return (
    <>
      <ProfileInfoCard
        title="Known Allergies"
        subtitle="Drug, food, and material sensitivities"
        editHref={editHref}
      >
        {allergies.length > 0 ? (
          <ul className="profile-item-list">
            {allergies.map(({ id, name, type, severity, reaction }) => {
              const severityInfo = ALLERGY_SEVERITIES[severity];
              return (
                <ProfileItem
                  key={id}
                  icon="alertCircle"
                  tone="danger"
                  heading={
                    <>
                      <span className="profile-item-title">{name}</span>
                      <ProfileTag>{type}</ProfileTag>
                      {severityInfo && (
                        <ProfileTag tone={severityInfo.tone}>{severityInfo.label}</ProfileTag>
                      )}
                    </>
                  }
                >
                  <p>Reaction: {reaction}</p>
                </ProfileItem>
              );
            })}
          </ul>
        ) : (
          <p className="profile-empty">No known allergies recorded.</p>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard
        title="Current Medications"
        subtitle="Medicines taken regularly that may interact with dental treatments"
        editHref={editHref}
      >
        {medications.length > 0 ? (
          <ul className="profile-item-list">
            {medications.map(({ id, name, dosage, purpose, caution }) => (
              <ProfileItem
                key={id}
                icon="stethoscope"
                heading={
                  <>
                    <span className="profile-item-title">{name}</span>
                    <span className="profile-medication-dosage">{dosage}</span>
                  </>
                }
              >
                <p className="profile-medication-purpose">For: {purpose}</p>
                {caution && (
                  <p className="profile-medication-caution">
                    <Icon name="alertTriangle" size={13} />
                    {caution}
                  </p>
                )}
              </ProfileItem>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">No current medications recorded.</p>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard
        title="Dental Anxiety"
        subtitle="Helps the dentist prepare and accommodate your needs"
        editHref={editHref}
      >
        {dentalAnxiety ? (
          <dl className="profile-detail-grid">
            <ProfileDetailTile label="Anxiety Level" value={dentalAnxiety.levelLabel}>
              <span
                className="profile-anxiety-meter"
                role="img"
                aria-label={`Level ${dentalAnxiety.level} of ${ANXIETY_SCALE_MAX}`}
              >
                {ANXIETY_STEPS.map((step) => (
                  <span
                    key={step}
                    className={`profile-anxiety-step${
                      step <= dentalAnxiety.level ? ' is-filled' : ''
                    }`}
                  />
                ))}
              </span>
            </ProfileDetailTile>
            <ProfileDetailTile label="Preferred Sedation" value={dentalAnxiety.sedation} />
            {dentalAnxiety.notes && (
              <ProfileDetailTile
                label="Notes for Dentist"
                value={dentalAnxiety.notes}
                className="is-wide profile-anxiety-notes"
              />
            )}
          </dl>
        ) : (
          <p className="profile-empty">No dental anxiety details recorded.</p>
        )}
      </ProfileInfoCard>
    </>
  );
}

export default ProfileAllergiesMedications;
