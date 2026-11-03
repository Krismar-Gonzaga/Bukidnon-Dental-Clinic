// Demo accounts for the login page's "Auto fill" buttons. They match the
// LOCAL demo data (backend DemoUsersSeeder; password DEMO_USER_PASSWORD,
// default DemoPass2026).
//
// DEVELOPMENT ONLY (`npm start`). The build replaces process.env.NODE_ENV
// with a literal, so a production build (`npm run build`) compiles this to
// an empty array and the credentials are not shipped to real users.
// Keep every credential inside the conditional for that to hold.
export const DEMO_ACCOUNTS =
  process.env.NODE_ENV === 'development'
    ? [
        { label: 'Patient', email: 'demo.patient@example.test' },
        { label: 'Clinic Admin', email: 'demo.clinic-admin@example.test' },
        { label: 'Dentist', email: 'demo.dentist@example.test' },
        { label: 'Receptionist', email: 'demo.staff@example.test' },
        { label: 'Inventory Staff', email: 'demo.inventory@example.test' },
        { label: 'System Admin', email: 'demo.system-admin@example.test' },
      ].map((account) => ({ ...account, password: 'DemoPass2026' }))
    : [];
