import ProfileInfoCard from './ProfileInfoCard';
import { CONSENT_OPTIONS } from '../../config/profile';
import './ProfileEmergencyContact.css';

const toTelHref = (phone) => `tel:${phone.replace(/\s/g, '')}`;

// My Profile, Emergency Contact tab: the primary contact and consent
// settings. Settings are shown read-only; changing them belongs to Edit.
function ProfileEmergencyContact({ profile, editHref }) {
  const { emergencyContact: contact, consents = {} } = profile;

  return (
    <>
      <ProfileInfoCard
        title="Primary Emergency Contact"
        subtitle="Person to contact in case of emergency during or after a procedure"
        editHref={editHref}
        rows={
          contact
            ? [
                { label: 'Relationship', value: contact.relationship },
                { label: 'Mobile Number', value: contact.phone },
                { label: 'Address', value: contact.address },
              ]
            : []
        }
      >
        {contact ? (
          <div className="profile-contact">
            <span className="profile-contact-avatar" aria-hidden="true">
              {contact.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <p className="profile-contact-name">{contact.name}</p>
              <p className="profile-contact-relationship">{contact.relationship}</p>
              <a href={toTelHref(contact.phone)} className="profile-contact-phone">
                {contact.phone}
              </a>
            </div>
          </div>
        ) : (
          <p className="profile-empty">No emergency contact added yet.</p>
        )}
      </ProfileInfoCard>

      <ProfileInfoCard
        title="Consent & Preferences"
        subtitle="Communication and treatment consent settings"
        editHref={editHref}
      >
        <ul className="profile-consent-list">
          {CONSENT_OPTIONS.map(({ id, label }) => {
            const isOn = Boolean(consents[id]);
            return (
              <li key={id} className="profile-consent-item">
                <span>{label}</span>
                <span className={`profile-switch${isOn ? ' is-on' : ''}`} aria-hidden="true" />
                <span className="visually-hidden">{isOn ? 'On' : 'Off'}</span>
              </li>
            );
          })}
        </ul>
      </ProfileInfoCard>
    </>
  );
}

export default ProfileEmergencyContact;
