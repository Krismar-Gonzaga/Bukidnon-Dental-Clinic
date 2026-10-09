// MOCK DATA — provisional dentist listings for the Dentists page.
// Not backend data. Names, specialties, ratings, review counts, experience,
// and availability are placeholders taken from or modeled on the Figma sample
// content. `clinicId` refers to mocks/directoryClinics.js. Replace with the
// dentists API response when backend integration is done.
export const DIRECTORY_DENTISTS = [
  {
    id: 'mock-dentist-1',
    name: 'Dr. Maria Braganza',
    specialty: 'Orthodontist',
    clinicId: 'mock-dir-2',
    rating: 4.9,
    reviewCount: 87,
    yearsExperience: 12,
    available: true,
  },
  {
    id: 'mock-dentist-2',
    name: 'Dr. Jose Santos',
    specialty: 'Pediatric Dentist',
    clinicId: 'mock-dir-1',
    rating: 4.8,
    reviewCount: 62,
    yearsExperience: 8,
    available: true,
  },
  {
    id: 'mock-dentist-3',
    name: 'Dr. Ana Cruz',
    specialty: 'Cosmetic Dentist',
    clinicId: 'mock-dir-3',
    rating: 4.7,
    reviewCount: 54,
    yearsExperience: 10,
    available: false,
  },
  {
    id: 'mock-dentist-4',
    name: 'Dr. Ramon Villanueva',
    specialty: 'Oral Surgeon',
    clinicId: 'mock-dir-4',
    rating: 4.6,
    reviewCount: 41,
    yearsExperience: 15,
    available: true,
  },
  {
    id: 'mock-dentist-5',
    name: 'Dr. Lisa Tan',
    specialty: 'General Dentist',
    clinicId: 'mock-dir-5',
    rating: 4.5,
    reviewCount: 33,
    yearsExperience: 6,
    available: true,
  },
];
