// Demo accounts for the sign-in screen's "Auto fill" buttons. They match the
// LOCAL demo data (backend DemoUsersSeeder; password DEMO_USER_PASSWORD,
// default DemoPass2026).
//
// DEVELOPMENT ONLY: __DEV__ is false in release builds, where the bundler
// drops this list, so the credentials are not shipped in the store app.
// Keep every credential inside the conditional for that to hold.
export type DemoAccount = { label: string; email: string; password: string };

export const DEMO_ACCOUNTS: DemoAccount[] = __DEV__
  ? [
      { label: 'Patient', email: 'demo.patient@example.test' },
      { label: 'Clinic Admin', email: 'demo.clinic-admin@example.test' },
      { label: 'Dentist', email: 'demo.dentist@example.test' },
      { label: 'Clinic Staff', email: 'demo.staff@example.test' },
      { label: 'Inventory Staff', email: 'demo.inventory@example.test' },
      { label: 'System Admin', email: 'demo.system-admin@example.test' },
    ].map((account) => ({ ...account, password: 'DemoPass2026' }))
  : [];
