import Icon from '../Icon';
import './DentalSpecializations.css';

// Static marketing copy for the homepage (not backend data).
const SPECIALIZATIONS = [
  {
    name: 'Orthodontist',
    description: 'Straighten your smile with braces or aligners.',
    icon: 'braces',
  },
  {
    name: 'Pediatric Dentist',
    description: 'Specialized dental care for kids and teens.',
    icon: 'smile',
  },
  {
    name: 'Oral Surgeon',
    description: 'Expert surgical solutions for complex issues.',
    icon: 'scalpel',
  },
  {
    name: 'General Dentist',
    description: 'Comprehensive care for your overall oral health.',
    icon: 'tooth',
  },
];

function DentalSpecializations() {
  return (
    <section
      className="specializations"
      aria-labelledby="specializations-title"
    >
      <div className="specializations-inner">
        <div className="specializations-header">
          <h2 id="specializations-title" className="specializations-title">
            Dental Specializations
          </h2>
          <p className="specializations-text">
            Whatever your need, we have the right specialist for you.
          </p>
        </div>

        <ul className="specializations-grid">
          {SPECIALIZATIONS.map((item) => (
            <li key={item.name} className="specialization-card">
              <span className="specialization-card-icon">
                <Icon name={item.icon} size={30} />
              </span>
              <h3 className="specialization-card-name">{item.name}</h3>
              <p className="specialization-card-text">{item.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default DentalSpecializations;
