import { COOKIES_HREF, MAIN_NAV_ITEMS, PRIVACY_HREF, TERMS_HREF } from './navigation';

// Footer content.
export const FOOTER_TAGLINE = 'Simplifying dental care access for all Bukidnon residents through digital innovation.';

const QUICK_LINKS = ['Home', 'Find Clinics', 'Dentists', 'Services'];

export const FOOTER_LINK_GROUPS = [
  {
    title: 'Quick Links',
    links: MAIN_NAV_ITEMS.filter(({ label }) => QUICK_LINKS.includes(label)),
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: PRIVACY_HREF },
      { label: 'Terms of Service', href: TERMS_HREF },
      { label: 'Cookie Policy', href: COOKIES_HREF },
    ],
  },
];

// PROVISIONAL contact details from the design's sample content. Replace with
// confirmed values (or backend/config data) before launch.
export const FOOTER_CONTACT = {
  email: 'support@bukidnondental.ph',
  phone: '+63 912 345 6789',
  location: 'Bukidnon, Philippines',
};
