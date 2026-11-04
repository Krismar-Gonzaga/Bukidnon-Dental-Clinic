// PROVISIONAL marketing copy and contact details for the guest screens: the same sample
// content as the website (web/src/config/footer.js, web/src/mocks/*Content.js). Not
// backend data and not confirmed business information. Replace before launch.
export const BRAND_NAME = 'BukidnonDental';

export const FOOTER_TAGLINE = 'Simplifying dental care access for all Bukidnon residents through digital innovation.';

export const SUPPORT_EMAIL = 'support@bukidnondental.ph';
export const SUPPORT_PHONE = '+63 912 345 6789';

export const CONTACT_METHODS = [
  {
    id: 'phone',
    icon: 'call-outline',
    title: 'Phone',
    primary: SUPPORT_PHONE,
    url: `tel:${SUPPORT_PHONE.replace(/\s/g, '')}`,
    secondary: 'Mon–Fri, 8AM–5PM',
  },
  {
    id: 'email',
    icon: 'mail-outline',
    title: 'Email',
    primary: SUPPORT_EMAIL,
    url: `mailto:${SUPPORT_EMAIL}`,
    secondary: 'We reply within 24 hours',
  },
  {
    id: 'office',
    icon: 'location-outline',
    title: 'Office',
    primary: 'Bukidnon Digital Hub',
    url: null,
    secondary: 'Malaybalay City, Bukidnon',
  },
];

export const ABOUT_HERO = {
  title: 'About BukidnonDental',
  subtitle:
    'Connecting Bukidnon residents with trusted dental professionals through accessible, modern healthcare technology.',
};

export const ABOUT_MISSION = {
  title: 'Our Mission',
  paragraphs: [
    'BukidnonDental was founded with a single vision: to make quality dental care accessible to every resident of Bukidnon. We believe that geographical location should never be a barrier to excellent oral health.',
    'By creating a digital bridge between patients and verified dental clinics across the province, we empower communities with information, convenience, and trust.',
  ],
};

export const ABOUT_VALUES = [
  {
    id: 'trust',
    icon: 'shield-checkmark-outline',
    background: '#dffbf1',
    color: '#006c4f',
    title: 'Trust & Safety',
    description: 'Every clinic on our platform undergoes strict verification for licenses and safety standards.',
  },
  {
    id: 'innovation',
    icon: 'flash-outline',
    background: '#d7e2ff',
    color: '#003f87',
    title: 'Innovation',
    description: 'We harness technology to streamline booking, reminders, and dental records management.',
  },
  {
    id: 'community',
    icon: 'people-outline',
    background: '#dbe4ed',
    color: '#3a434a',
    title: 'Community First',
    description: 'Built for Bukidnon, by Bukidnon — our mission is grounded in serving local communities.',
  },
];

// `match` finds the real specialization, so each card opens the directory filtered by it.
export const SPECIALIZATION_CARDS = [
  {
    name: 'Orthodontist',
    description: 'Straighten your smile with braces or aligners.',
    icon: 'happy-outline',
    background: '#d7e2ff',
    color: '#003f87',
    match: 'orthodon',
  },
  {
    name: 'Pediatric Dentist',
    description: 'Specialized dental care for kids and teens.',
    icon: 'heart-outline',
    background: '#dffbf1',
    color: '#006c4f',
    match: 'pediatric',
  },
  {
    name: 'Oral Surgeon',
    description: 'Expert surgical solutions for complex issues.',
    icon: 'cut-outline',
    background: '#fff1f0',
    color: '#ba1a1a',
    match: 'surg',
  },
  {
    name: 'General Dentist',
    description: 'Comprehensive care for your overall oral health.',
    icon: 'shield-checkmark-outline',
    background: '#e5e8ee',
    color: '#003f87',
    match: 'general',
  },
];

// "SMS" from the design is left out: the platform sends email and in-app reminders.
export const WHY_BOOK = [
  {
    title: 'Verified Clinics',
    description: 'Every clinic on our platform undergoes a strict verification process for license and safety.',
    icon: 'shield-checkmark-outline',
    background: '#67fcc6',
    color: '#005139',
  },
  {
    title: 'Instant Online Booking',
    description: 'Skip the phone calls. See available slots and book your appointment in under 60 seconds.',
    icon: 'calendar-outline',
    background: '#d7e2ff',
    color: '#003f87',
  },
  {
    title: 'Smart Reminders',
    description: 'Get email and in-app reminders before your visit so you never miss an appointment.',
    icon: 'notifications-outline',
    background: '#dbe4ed',
    color: '#3a434a',
  },
];
