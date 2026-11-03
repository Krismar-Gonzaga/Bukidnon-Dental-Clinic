import AboutStatCard from '../components/about/AboutStatCard';
import AboutValueCard from '../components/about/AboutValueCard';
import { useHomeData } from '../hooks/useHomeData';
import { ABOUT_HERO, ABOUT_MISSION, ABOUT_VALUES } from '../mocks/aboutContent';
import './AboutPage.css';

const count = (value) => (value == null ? '—' : new Intl.NumberFormat('en-PH').format(value));

/** The four figures, counted from real records (GET /home). */
export function aboutStats(stats) {
  return [
    { id: 'clinics', icon: 'building', value: count(stats?.verified_clinics), label: 'Partner Clinics' },
    { id: 'patients', icon: 'users', value: count(stats?.patients), label: 'Patients Served' },
    { id: 'satisfaction', icon: 'award', value: stats?.satisfaction_rate == null ? '—' : `${stats.satisfaction_rate}%`, label: 'Satisfaction Rate' },
    { id: 'municipalities', icon: 'mapPin', value: count(stats?.municipalities), label: 'Municipalities' },
  ];
}

function AboutPage() {
  const home = useHomeData();

  return (
    <div className="about">
      <main className="about-main">
        <section className="about-hero" aria-labelledby="about-hero-title">
          <div className="about-container">
            <h1 id="about-hero-title" className="about-hero-title">
              {ABOUT_HERO.title}
            </h1>
            <p className="about-hero-text">{ABOUT_HERO.subtitle}</p>
          </div>
        </section>

        <section className="about-mission" aria-labelledby="about-mission-title">
          <div className="about-container about-mission-inner">
            <div className="about-mission-copy">
              <h2 id="about-mission-title" className="about-section-title">
                {ABOUT_MISSION.title}
              </h2>
              {ABOUT_MISSION.paragraphs.map((paragraph) => (
                <p key={paragraph} className="about-mission-text">
                  {paragraph}
                </p>
              ))}
            </div>

            <ul className="about-stats" aria-label="BukidnonDental at a glance">
              {aboutStats(home.data?.stats).map(({ id, ...stat }) => (
                <li key={id}>
                  <AboutStatCard {...stat} />
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="about-values" aria-labelledby="about-values-title">
          <div className="about-container">
            <h2
              id="about-values-title"
              className="about-section-title about-values-title"
            >
              Our Core Values
            </h2>
            <ul className="about-values-grid">
              {ABOUT_VALUES.map(({ id, ...value }) => (
                <li key={id}>
                  <AboutValueCard {...value} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default AboutPage;
