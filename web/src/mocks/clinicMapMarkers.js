// MOCK DATA — provisional clinic markers for the homepage map preview.
// Not backend data. Positions are percentages on the placeholder map
// (approximate, not to scale). Replace with clinic coordinates from the
// API when a real map provider is integrated.
export const CLINIC_MAP_MARKERS = [
  {
    id: 'mock-clinic-3',
    name: 'Sample Oral Care Studio',
    location: 'Manolo Fortich',
    position: { x: 46, y: 22 },
  },
  {
    id: 'mock-clinic-2',
    name: 'Sample Family Dental Clinic',
    location: 'Malaybalay City',
    position: { x: 64, y: 46 },
  },
  {
    id: 'mock-clinic-1',
    name: 'Sample Smile Dental Center',
    location: 'Valencia City',
    position: { x: 38, y: 64 },
  },
  {
    id: 'mock-clinic-4',
    name: 'Sample Dental Care Maramag',
    location: 'Maramag',
    position: { x: 30, y: 84 },
  },
];
