import { LOGIN_HREF, MAIN_NAV_ITEMS, REGISTER_HREF } from './navigation';

// Footer content. Hash hrefs are placeholders until those pages exist.
export const FOOTER_TAGLINE =
  'Helping patients find trusted dental clinics and book appointments across Bukidnon.';

export const FOOTER_LINK_GROUPS = [
  {
    title: 'Quick Links',
    links: MAIN_NAV_ITEMS,
  },
  {
    title: 'For Patients',
    links: [
      { label: 'Find Clinics', href: '/clinics' },
      { label: 'Book Appointment', href: '#find-clinics' },
      { label: 'Login', href: LOGIN_HREF },
      { label: 'Register', href: REGISTER_HREF },
    ],
  },
];

// PROVISIONAL contact details: placeholders, not real contact information.
// Replace with confirmed values (or backend/config data) before launch.
export const FOOTER_CONTACT = {
  email: 'hello@bukidnondental.example',
  phone: '+63 900 000 0000',
  location: 'Bukidnon, Philippines',
};

// PROVISIONAL: social profile URLs are not confirmed yet.
export const FOOTER_SOCIAL_LINKS = [
  { label: 'Facebook', icon: 'facebook', href: '#' },
  { label: 'Instagram', icon: 'instagram', href: '#' },
];
