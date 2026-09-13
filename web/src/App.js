import React from 'react';
import './App.css';

const clinics = [
  { name: 'Malaybalay Dental Care', location: 'Saye Highway, Malaybalay City, Bukidnon', rating: '4.8 (120 reviews)', specialties: ['Orthodontics', 'Teeth Whitening'] },
  { name: 'Valencia Smile Center', location: 'G. Lavina Ave, Valencia City, Bukidnon', rating: '4.9 (85 reviews)', specialties: ['Pediatric Care', 'Implants'] },
];

const specializations = [
  ['⌁', 'Orthodontist', 'Straighten your smile with braces or aligners.'],
  ['◌', 'Pediatric Dentist', 'Specialized dental care for kids and teens.'],
  ['✚', 'Oral Surgeon', 'Expert surgical solutions for complex issues.'],
  ['✦', 'General Dentist', 'Comprehensive care for your overall oral health.'],
];

const services = [
  ['Dental Cleaning', 'Professional prophylaxis to remove plaque and prevent gum disease.', '₱500 - ₱1,500'],
  ['Tooth Extraction', 'Safe and painless removal of damaged or problematic teeth.', '₱1,000 - ₱3,000'],
  ['Braces Consultation', 'Initial diagnosis and treatment planning for orthodontics.', 'FREE - ₱500'],
  ['Teeth Whitening', 'Advanced bleaching for a radiant, brighter-than-ever smile.', 'Starts at ₱5,000'],
];

const benefits = [
  ['✓', 'Verified Clinics', 'Every clinic on our platform undergoes a strict verification process for license and safety.'],
  ['↗', 'Instant Online Booking', 'Skip the phone calls. See available slots and book your appointment in under 60 seconds.'],
  ['◷', 'Smart Reminders', 'Get SMS and email reminders before your visit so you never miss an appointment.'],
];

const testimonials = [
  ['Booking was so easy through BukidnonDental. I found a clinic in Malaybalay that fits my schedule perfectly.', 'Maria S.', 'Malaybalay Resident'],
  ['The verified clinic badges gave me so much peace of mind. Valencia Smile Center was exceptional!', 'John D.', 'Valencia Business Owner'],
  ['Excellent service. The reminders helped me stay on track with my monthly orthodontic adjustment.', 'Rose P.', 'Student'],
];

function Brand() { return <span className="brand">Bukidnon<span>Dental</span></span>; }

function PrimaryButton({ href = '#top', children, secondary = false, className = '' }) {
  return <a className={`button ${secondary ? 'button-secondary' : 'button-primary'} ${className}`} href={href}>{children}</a>;
}

function SectionHeader({ eyebrow, title, description, action }) {
  return <div className="section-header">
    <div>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
    {action}
  </div>;
}

function Header() {
  const links = [['Home', '#top'], ['Clinics', '#featured-clinics'], ['Dentists', '#specializations'], ['Services', '#services'], ['About', '#why-book'], ['Contact', '#footer']];
  return <header className="site-header"><a className="brand-link" href="#top" aria-label="BukidnonDental homepage"><Brand /></a><nav className="main-navigation" aria-label="Main navigation">{links.map(([label, href]) => <a key={label} className={label === 'Home' ? 'active' : ''} href={href}>{label}</a>)}</nav><div className="account-links"><a href="#top">Login</a><PrimaryButton className="register-button">Register</PrimaryButton></div></header>;
}

function HeroImagePlaceholder() {
  return <div className="hero-visual" role="img" aria-label="Dental clinic interior placeholder"><div className="hero-glow" /><div className="clinic-placeholder"><span>Dental clinic interior</span><div className="placeholder-window" /><div className="placeholder-chair" /><div className="placeholder-counter" /></div></div>;
}

function Hero() {
  return <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">BUKIDNON DENTAL PORTAL</p><h1>Find Trusted Dental Clinics Across Bukidnon</h1><p>Search clinics, compare services, view dentists by specialization, and book appointments online with the most reliable dental network in the province.</p><div className="hero-actions"><PrimaryButton href="#clinic-search"><span aria-hidden="true">⌕</span> Find Clinics</PrimaryButton><PrimaryButton href="#top" secondary>Register Now</PrimaryButton></div></div><HeroImagePlaceholder /></section>;
}

function ClinicSearch() {
  return <section className="search-wrap" id="clinic-search" aria-label="Clinic search"><form className="clinic-search" onSubmit={(event) => event.preventDefault()}><label><span>Clinic Name</span><div className="input-with-icon"><span aria-hidden="true">⌕</span><input type="search" placeholder="Search clinic..." /></div></label><label><span>Location</span><select defaultValue="Malaybalay City" aria-label="Location"><option>Malaybalay City</option></select></label><label><span>Specialization</span><select defaultValue="Orthodontist" aria-label="Specialization"><option>Orthodontist</option></select></label><button type="submit">Search Now</button></form></section>;
}

function ClinicCard({ clinic, index }) {
  return <article className="clinic-card"><div className={`clinic-image clinic-image-${index}`} role="img" aria-label={`${clinic.name} image placeholder`}><span>Clinic image placeholder</span></div><div className="clinic-card-body"><div className="clinic-card-top"><div><h3>{clinic.name}</h3><p className="location">⌖ {clinic.location}</p></div><span className="rating">★ {clinic.rating}</span></div><div className="pills">{clinic.specialties.map((specialty) => <span key={specialty}>{specialty}</span>)}</div><div className="card-actions"><PrimaryButton href="#top">Book Appointment</PrimaryButton><PrimaryButton href="#top" secondary>View Details</PrimaryButton></div></div></article>;
}

function FeaturedClinics() {
  return <section className="content-section" id="featured-clinics"><SectionHeader title="Featured Clinics" description="Highly rated dental care centers in your vicinity." action={<a className="view-all" href="#top">View All Clinics <span aria-hidden="true">→</span></a>} /><div className="clinic-grid">{clinics.map((clinic, index) => <ClinicCard key={clinic.name} clinic={clinic} index={index} />)}</div></section>;
}

function Specializations() {
  return <section className="specialization-section" id="specializations"><div className="content-section"><SectionHeader title="Dental Specializations" description="Whatever you need, we have the right specialist for you." /><div className="specialization-grid">{specializations.map(([icon, title, description]) => <article key={title} className="specialization-card"><span className="specialty-icon" aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>;
}

function AffordableCare() {
  return <section className="content-section services-section" id="services"><div className="services-copy"><p className="eyebrow">SERVICES</p><h2>Affordable Care for Everyone</h2><p>We bridge the gap between high-quality dental care and transparency in pricing across Bukidnon.</p><PrimaryButton href="#top" secondary>View Price Guide</PrimaryButton></div><div className="service-grid">{services.map(([title, description, price]) => <article className="service-card" key={title}><div className="service-card-icon" aria-hidden="true">✦</div><h3>{title}</h3><p>{description}</p><strong>{price}</strong></article>)}</div></section>;
}

function BookingBenefits() {
  return <section className="benefits-section" id="why-book"><div className="content-section"><SectionHeader title="Why Book Through BukidnonDental?" /><div className="benefit-grid">{benefits.map(([icon, title, description]) => <article key={title} className="benefit"><span aria-hidden="true">{icon}</span><h3>{title}</h3><p>{description}</p></article>)}</div></div></section>;
}

function ClinicMap() {
  return <section className="map-section" id="find-clinics"><div className="content-section"><SectionHeader title="Find Clinics Near You" description="Interactive map showing dental partners across Bukidnon." /></div><div className="map-placeholder" role="img" aria-label="Bukidnon clinic map placeholder"><div className="map-land land-one" /><div className="map-land land-two" /><div className="map-pin pin-one" /><div className="map-pin pin-two" /><div className="map-pin pin-three" /><div className="map-overlay"><h3>Explore Local Clinics</h3><p>Access our full interactive map to find the nearest clinic to your current location.</p><PrimaryButton href="#top">Open Full Map</PrimaryButton></div></div></section>;
}

function Testimonial() {
  return <section className="content-section testimonials-section"><SectionHeader title="What Patients Say" /><div className="testimonial-grid">{testimonials.map(([quote, name, role]) => <article className="testimonial-card" key={name}><div className="stars" aria-label="5 out of 5 stars">★★★★★</div><blockquote>“{quote}”</blockquote><footer><span className="avatar" aria-hidden="true">{name[0]}</span><div><strong>{name}</strong><p>{role}</p></div></footer></article>)}</div></section>;
}

function Footer() {
  return <footer className="site-footer" id="footer"><div className="footer-content"><div className="footer-brand"><Brand /><p>Simplyfying dental care access for all Bukidnon residents through digital innovation.</p><div className="social-icons" aria-label="Social links"><a href="#top" aria-label="Facebook">f</a><a href="#top" aria-label="Instagram">◎</a><a href="#top" aria-label="LinkedIn">in</a></div></div><div><h2>Quick Links</h2><a href="#top">Home</a><a href="#featured-clinics">Find Clinics</a><a href="#specializations">Dentists</a><a href="#services">Services</a></div><div><h2>Legal</h2><a href="#top">Privacy Policy</a><a href="#top">Terms of Service</a><a href="#top">Cookie Policy</a></div><address><h2>Contact Us</h2><a href="mailto:support@bukidnondental.ph">support@bukidnondental.ph</a><a href="tel:+639123456789">+63 912 345 6789</a><p>Serving Malaybalay, Valencia, and beyond.</p></address></div><p className="copyright">© 2024 BukidnonDental. All rights reserved.</p></footer>;
}

function App() { return <div className="app-shell"><Header /><main><div className="hero-band"><Hero /></div><ClinicSearch /><FeaturedClinics /><Specializations /><AffordableCare /><BookingBenefits /><ClinicMap /><Testimonial /></main><Footer /></div>; }

export default App;
