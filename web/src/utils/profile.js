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
