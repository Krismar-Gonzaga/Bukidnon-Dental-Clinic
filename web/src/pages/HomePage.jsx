import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import HomeHero from '../components/home/HomeHero';
import ClinicSearchPanel from '../components/home/ClinicSearchPanel';
import FeaturedClinics from '../components/home/FeaturedClinics';
import DentalSpecializations from '../components/home/DentalSpecializations';
import AffordableCare from '../components/home/AffordableCare';
import WhyBookSection from '../components/home/WhyBookSection';
import ClinicsMapSection from '../components/home/ClinicsMapSection';
import Testimonials from '../components/home/Testimonials';
import './HomePage.css';

// Guest home page.
function HomePage() {
  return (
    <div className="home">
      <SiteHeader activeHref="/" />

      <main className="home-main">
        <HomeHero />
        <div className="home-search-wrap">
          <ClinicSearchPanel />
        </div>
        <FeaturedClinics />
        <DentalSpecializations />
        <AffordableCare />
        <WhyBookSection />
        <ClinicsMapSection />
        <Testimonials />
      </main>

      <SiteFooter />
    </div>
  );
}

export default HomePage;
