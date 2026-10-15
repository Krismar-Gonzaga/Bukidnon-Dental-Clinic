import Icon from '../Icon';
import ProfileInfoCard from './ProfileInfoCard';
import ProfileItem from './ProfileItem';
import ProfileTag from './ProfileTag';
import ProfileDetailTile from './ProfileDetailTile';
import './ProfileMedicalHistory.css';

// My Profile, Medical History tab: conditions, past dental procedures, and
// vital notes. `editHref` is used by every card's Edit link.
function ProfileMedicalHistory({ profile, editHref }) {
  const { conditions = [], conditionsNote, procedures = [], vitals = [] } = profile;

  return (
    <>
      <ProfileInfoCard
        title="Medical Conditions"
        subtitle="Existing or prior diagnoses relevant to dental care"
        editHref={editHref}
      >
        {conditions.length > 0 ? (
          <ul className="profile-tag-list" aria-label="Medical conditions">
            {conditions.map((condition) => (
              <li key={condition}>
                <ProfileTag tone="warning">{condition}</ProfileTag>
              </li>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">No medical conditions recorded.</p>
        )}
        {conditionsNote && (
          <p className="profile-medical-note" role="note">
            <Icon name="alertCircle" size={16} />
            <span>{conditionsNote}</span>
          </p>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard
        title="Previous Dental Procedures"
        subtitle="Relevant past treatments"
        editHref={editHref}
      >
        {procedures.length > 0 ? (
          <ul className="profile-item-list">
            {procedures.map(({ id, name, detail, note, date }) => (
              <ProfileItem
                key={id}
                icon="stethoscope"
                heading={<span className="profile-item-title">{name}</span>}
                aside={date}
              >
                <p>{detail}</p>
                {note && <p className="profile-item-note">{note}</p>}
              </ProfileItem>
            ))}
          </ul>
        ) : (
          <p className="profile-empty">No previous procedures recorded.</p>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard
        title="Vital & Systemic Notes"
        subtitle="Information that may affect anesthesia or treatment"
        editHref={editHref}
      >
        {vitals.length > 0 ? (
          <dl className="profile-detail-grid">
            {vitals.map(({ id, label, value, note, tone }) => (
              <ProfileDetailTile key={id} label={label} value={value} note={note} tone={tone} />
            ))}
          </dl>
        ) : (
          <p className="profile-empty">No vital notes recorded.</p>
        )}
      </ProfileInfoCard>
    </>
  );
}

export default ProfileMedicalHistory;
