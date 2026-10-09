import { FOOTER_CONTACT } from '../config/footer';

// PROVISIONAL CONTENT — Contact page details. Phone and email reuse the
// site-wide placeholder contact values from config/footer.js (not real).
// Hours, reply time, and office address come from the Figma sample content
// and are not confirmed business information. Replace before launch.
export const CONTACT_METHODS = [
  {
    id: 'phone',
    icon: 'phone',
    title: 'Phone',
    primary: FOOTER_CONTACT.phone,
    href: `tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`,
    secondary: 'Mon–Fri, 8AM–5PM',
  },
  {
    id: 'email',
    icon: 'mail',
    title: 'Email',
    primary: FOOTER_CONTACT.email,
    href: `mailto:${FOOTER_CONTACT.email}`,
    secondary: 'We reply within 24 hours',
  },
  {
    id: 'office',
    icon: 'mapPin',
    title: 'Office',
    primary: 'Bukidnon Digital Hub',
    secondary: 'Malaybalay City, Bukidnon',
  },
];
