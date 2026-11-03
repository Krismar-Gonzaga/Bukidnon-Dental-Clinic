import Icon from '../Icon';
import { BRAND_NAME } from '../../config/app';
import './WhyBookSection.css';

// PROVISIONAL marketing copy from the design. "SMS" from the design is left
// out: the platform sends email and in-app reminders.
const BENEFITS = [
  {
    title: 'Verified Clinics',
    description: 'Every clinic on our platform undergoes a strict verification process for license and safety.',
    icon: 'shieldCheck',
    tone: 'mint',
  },
  {
    title: 'Instant Online Booking',
    description: 'Skip the phone calls. See available slots and book your appointment in under 60 seconds.',
    icon: 'calendar',
    tone: 'blue',
  },
  {
    title: 'Smart Reminders',
    description: 'Get email and in-app reminders before your visit so you never miss an appointment.',
    icon: 'bell',
    tone: 'grey',
  },
];

function WhyBookSection() {
  return (
    <section className="why-book" aria-labelledby="why-book-title">
      <div className="why-book-inner">
        <h2 id="why-book-title" className="why-book-title">
          Why Book Through {BRAND_NAME}?
        </h2>

        <ul className="why-book-grid">
          {BENEFITS.map((benefit) => (
            <li key={benefit.title} className="why-book-item">
              <span className={`why-book-icon is-${benefit.tone}`} aria-hidden="true">
                <Icon name={benefit.icon} size={32} />
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
