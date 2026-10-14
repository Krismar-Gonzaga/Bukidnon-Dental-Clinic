import Icon from '../Icon';
import { BRAND_NAME } from '../../config/app';
import './WhyBookSection.css';

// PROVISIONAL copy: supporting text and benefit descriptions are
// placeholders until final content is confirmed.
const INTRO_TEXT =
  'A simpler, more reliable way to find and book dental care in Bukidnon.';

const BENEFITS = [
  {
    title: 'Verified Clinics',
    description:
      'Every clinic on the portal is verified, so you can book with confidence and receive trusted dental care.',
    icon: 'shieldCheck',
  },
  {
    title: 'Instant Online Booking',
    description:
      'Choose a clinic, pick an available schedule, and book your appointment online in minutes.',
    icon: 'calendar',
  },
  {
    title: 'Smart Reminders',
    description:
      'Get reminders before your upcoming appointments so you never miss a visit.',
    icon: 'bell',
  },
];

function WhyBookSection() {
  return (
    <section className="why-book" aria-labelledby="why-book-title">
      <div className="why-book-inner">
        <div className="why-book-header">
          <h2 id="why-book-title" className="why-book-title">
            Why Book Through {BRAND_NAME}?
          </h2>
          <p className="why-book-text">{INTRO_TEXT}</p>
        </div>

        <ul className="why-book-grid">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="why-book-item">
              <span className="why-book-icon">
                <Icon name={benefit.icon} size={28} />
              </span>
              <h3 className="why-book-item-title">{benefit.title}</h3>
              <p className="why-book-item-text">{benefit.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default WhyBookSection;
