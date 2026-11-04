import Icon from '../Icon';
import { FIND_CLINICS_HREF } from '../../config/navigation';
import { useHomeData } from '../../hooks/useHomeData';
import './DentalSpecializations.css';

// Marketing copy for the homepage. `match` finds the real specialization, so
// each card opens the directory filtered by it.
const SPECIALIZATIONS = [
  { name: 'Orthodontist', description: 'Straighten your smile with braces or aligners.', icon: 'braces', tone: 'blue', match: 'orthodon' },
  { name: 'Pediatric Dentist', description: 'Specialized dental care for kids and teens.', icon: 'smile', tone: 'mint', match: 'pediatric' },
  { name: 'Oral Surgeon', description: 'Expert surgical solutions for complex issues.', icon: 'scalpel', tone: 'red', match: 'surg' },
  { name: 'General Dentist', description: 'Comprehensive care for your overall oral health.', icon: 'shieldCheck', tone: 'grey', match: 'general' },
];

function DentalSpecializations() {
  const home = useHomeData();
  const known = home.data?.specializations ?? [];
  const hrefFor = (match) => {
    const found = known.find(({ name }) => name.toLowerCase().includes(match));
    return found ? `${FIND_CLINICS_HREF}?specialization=${encodeURIComponent(found.name)}` : FIND_CLINICS_HREF;
  };

  return (
    <section className="specializations" aria-labelledby="specializations-title">
      <div className="specializations-inner">
        <div className="specializations-header">
          <h2 id="specializations-title" className="specializations-title">
            Dental Specializations
          </h2>
          <p className="specializations-text">Whatever your need, we have the right specialist for you.</p>
        </div>

        <ul className="specializations-grid">
          {SPECIALIZATIONS.map((item) => (
            <li key={item.name}>
              <a href={hrefFor(item.match)} className="specialization-card">
                <span className={`specialization-card-icon is-${item.tone}`} aria-hidden="true">
                  <Icon name={item.icon} size={28} />
                </span>
                <h3 className="specialization-card-name">{item.name}</h3>
                <p className="specialization-card-text">{item.description}</p>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default DentalSpecializations;
