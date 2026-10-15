import { getLoginHref, LOGIN_HREF, MAIN_NAV_ITEMS, PRIVACY_HREF, REGISTER_HREF, TERMS_HREF } from './navigation';
import { PATIENT_BOOK_HREF } from './patientNavigation';

// Footer content. Social hrefs are placeholders until the profiles exist.
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
      { label: 'Book Appointment', href: getLoginHref(PATIENT_BOOK_HREF) },
      { label: 'Login', href: LOGIN_HREF },
      { label: 'Register', href: REGISTER_HREF },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Notice', href: PRIVACY_HREF },
      { label: 'Terms of Use', href: TERMS_HREF },
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
