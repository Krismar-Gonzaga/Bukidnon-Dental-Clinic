// MOCK patient profile from the Figma sample. Not real patient data; replace
// with GET /patient/profile when the API is connected.
// The Figma shows two emails (juan.delacruz@email.com in the header and
// juan@email.com elsewhere); one email is used everywhere here.
// tone on tags: danger | warning (colors only)
export const MOCK_PATIENT_PROFILE = {
  firstName: 'Juan',
  lastName: 'Dela Cruz',
  email: 'juan@email.com',
  phone: '+63 912 345 6789',
  birthDate: '1995-03-15',
  gender: 'Male',
  civilStatus: 'Single',
  bloodType: 'O+',
  city: 'Valencia City',
  province: 'Bukidnon',
  zipCode: '8709',
  tags: [
    { label: 'O+', tone: 'danger' },
    { label: 'Hypertensive', tone: 'warning' },
    { label: 'Penicillin Allergy', tone: 'danger' },
  ],
  medicalAlert:
    'Allergic to Penicillin · Taking Amlodipine (5mg) for hypertension · Diabetic (Type 2) — inform your dentist before any procedure.',
  // Taken from the medical alert above; the detailed tabs are not designed yet.
  conditions: ['Hypertension', 'Diabetes (Type 2)'],
  allergies: ['Penicillin'],
  medications: ['Amlodipine (5mg) for hypertension'],
  emergencyContact: null,
};
