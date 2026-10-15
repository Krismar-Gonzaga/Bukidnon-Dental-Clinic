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

  // Medical History tab.
  conditions: ['Hypertension', 'Type 2 Diabetes', 'Asthma (mild)'],
  conditionsNote:
    'Patients with hypertension or diabetes may require special precautions during dental procedures. Always inform your dentist about these conditions.',
  procedures: [
    {
      id: 'proc-1',
      name: 'Tooth Extraction',
      detail: 'Lower right molar (#47)',
      note: 'No complications',
      date: 'March 2024',
    },
    {
      id: 'proc-2',
      name: 'Dental Filling',
      detail: 'Upper left premolar (#25)',
      note: 'Composite resin',
      date: 'November 2023',
    },
    {
      id: 'proc-3',
      name: 'Root Canal Treatment',
      detail: 'Upper right molar (#16)',
      note: 'Completed, crown placed',
      date: 'June 2022',
    },
  ],
  // tone: warning | normal | neutral (tile colors only)
  vitals: [
    {
      id: 'blood-pressure',
      label: 'Blood Pressure',
      value: '130/85 mmHg',
      note: 'Elevated — monitor before procedures',
      tone: 'warning',
    },
    {
      id: 'blood-sugar',
      label: 'Blood Sugar (FBS)',
      value: '6.8 mmol/L',
      note: 'Slightly elevated, pre-diabetic range',
      tone: 'warning',
    },
    { id: 'heart', label: 'Heart Condition', value: 'None reported', tone: 'normal' },
    { id: 'pregnancy', label: 'Pregnancy', value: 'N/A (Male)', tone: 'neutral' },
    { id: 'bleeding', label: 'Bleeding Disorder', value: 'None reported', tone: 'normal' },
    { id: 'surgery', label: 'Recent Surgery', value: 'None in past 6 months', tone: 'normal' },
  ],

  // Allergies & Medications tab. severity: see ALLERGY_SEVERITIES in config/profile.js
  allergies: [
    {
      id: 'allergy-1',
      name: 'Penicillin',
      type: 'Drug',
      severity: 'severe',
      reaction: 'Hives, difficulty breathing',
    },
    {
      id: 'allergy-2',
      name: 'Latex',
      type: 'Material',
      severity: 'moderate',
      reaction: 'Skin rash, itching',
    },
    {
      id: 'allergy-3',
      name: 'Ibuprofen (NSAIDs)',
      type: 'Drug',
      severity: 'mild',
      reaction: 'Gastric irritation',
    },
  ],
  medications: [
    {
      id: 'med-1',
      name: 'Amlodipine',
      dosage: '5mg once daily',
      purpose: 'Hypertension',
      caution: 'May cause gingival enlargement',
    },
    {
      id: 'med-2',
      name: 'Metformin',
      dosage: '500mg twice daily',
      purpose: 'Type 2 Diabetes',
      caution: 'Monitor blood glucose before extractions',
    },
    {
      id: 'med-3',
      name: 'Salbutamol Inhaler',
      dosage: 'As needed',
      purpose: 'Asthma',
      caution: 'Keep inhaler accessible during appointments',
    },
  ],
  // level: 1 to ANXIETY_SCALE_MAX (config/profile.js)
  dentalAnxiety: {
    level: 3,
    levelLabel: 'Moderate',
    sedation: 'Local anesthesia only',
    notes:
      'Sensitive to needles, please explain procedures step by step. Prefers shorter appointments when possible.',
  },

  // Emergency Contact tab. consents: keyed by CONSENT_OPTIONS ids (config/profile.js)
  emergencyContact: {
    name: 'Maria Dela Cruz',
    relationship: 'Mother',
    phone: '+63 918 765 4321',
    address: 'Purok 5, Catumbalon, Valencia City, Bukidnon',
  },
  consents: {
    smsReminders: true,
    emailFollowUp: true,
    shareMedicalHistory: true,
    emergencyContactConsent: true,
    promotions: false,
  },
};
