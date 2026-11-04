// Helpers for patient profile display. birthDate is 'YYYY-MM-DD'.

const parseLocalDate = (isoDate) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export function getAge(birthDate, today = new Date()) {
  const birth = parseLocalDate(birthDate);
  const hadBirthdayThisYear =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  return today.getFullYear() - birth.getFullYear() - (hadBirthdayThisYear ? 0 : 1);
}

export function formatBirthDate(birthDate) {
  return parseLocalDate(birthDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export const getFullName = ({ firstName, lastName }) => `${firstName} ${lastName}`.trim();

/** One stored name, shown as two fields: joining them again gives back the same name. */
export function splitName(name = '') {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
}

export const joinName = ({ firstName = '', lastName = '' }) => `${firstName.trim()} ${lastName.trim()}`.trim();

/** The small labels under the patient's name. */
export function getProfileChips({ bloodType, health }) {
  const allergy = health.allergies.find(({ severity }) => severity === 'severe') ?? health.allergies[0];
  return [
    bloodType && { label: bloodType, tone: 'danger' },
    health.conditions[0] && { label: health.conditions[0], tone: 'warning' },
    allergy && { label: `${allergy.name} Allergy`, tone: 'danger' },
  ].filter(Boolean);
}

/** The alert banner's sentence, or '' when there is nothing to warn a dentist about. */
export function getMedicalAlerts({ health }) {
  const parts = [
    health.allergies.length > 0 && `Allergic to ${health.allergies.map(({ name }) => name).join(', ')}`,
    ...health.medications.map(
      ({ name, dosage, purpose }) =>
        `Taking ${name}${dosage ? ` (${dosage})` : ''}${purpose ? ` for ${purpose.toLowerCase()}` : ''}`
    ),
    ...health.conditions,
  ].filter(Boolean);
  return parts.length > 0 ? `${parts.join(' · ')} — inform your dentist before any procedure.` : '';
}
