import React from 'react';
import './App.css';

function App() {
  const portfolioData = {
    name: "Dr. Juan M. Dela Cruz",
    title: "General & Cosmetic Dentist",
    clinic: "Bukidnon Dental Clinic",
    location: "Malaybalay City, Bukidnon",
    bio: "Passionate dental professional with over 10 years of experience in providing quality dental care. Specializing in cosmetic dentistry, orthodontics, and preventive care. Committed to making every smile perfect and healthy.",
    image: "https://via.placeholder.com/200",
    services: [
      "🦷 General Dentistry",
      "✨ Cosmetic Dentistry",
      "😁 Orthodontics",
      "🪥 Preventive Care",
      "⭐ Root Canal Treatment",
      "🦷 Dental Implants"
    ],
    contact: {
      email: "dr.juan@bukidnondental.com",
      phone: "+63 912 345 6789",
      address: "2nd Floor, Dental Health Building, Fortich St., Malaybalay City"
    },
    social: {
      facebook: "https://facebook.com/bukidnondental",
      instagram: "https://instagram.com/bukidnondental",
      website: "https://bukidnondental.com"
    },
    education: [
      "Doctor of Dental Medicine - Centro Escolar University (2014)",
      "Postgraduate in Orthodontics - University of the Philippines (2016)",
      "Certified Implantologist - Philippine Dental Association (2018)"
    ],
    experience: [
      "Senior Dentist - Bukidnon Dental Clinic (2019-Present)",
      "Associate Dentist - SmilePro Dental Center (2015-2019)",
      "Clinical Instructor - Dental Education Program (2016-2018)"
    ]
  };

  return (
    <div className="App">
      {/* Header Section */}
      <header className="header">
        <div className="profile-container">
          <img 
            src={portfolioData.image} 
            alt={portfolioData.name}
            className="profile-image"
          />
        </div>
        <h1 className="name">{portfolioData.name}</h1>
        <p className="title">{portfolioData.title}</p>
        <p className="clinic">{portfolioData.clinic}</p>
        <p className="location">{portfolioData.location}</p>
      </header>

      <main className="main-content">
        {/* Bio Section */}
        <section className="section">
          <h2 className="section-title">About Me</h2>
          <p className="bio">{portfolioData.bio}</p>
        </section>

        {/* Services Section */}
        <section className="section">
          <h2 className="section-title">Services</h2>
          <div className="services-grid">
            {portfolioData.services.map((service, index) => (
              <div key={index} className="service-card">
                <span className="service-text">{service}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Education & Experience Row */}
        <div className="two-columns">
          {/* Education Section */}
          <section className="section">
            <h2 className="section-title">Education</h2>
            {portfolioData.education.map((edu, index) => (
              <div key={index} className="list-item">
                <span className="bullet">📚</span>
                <span className="list-text">{edu}</span>
              </div>
            ))}
          </section>

          {/* Experience Section */}
          <section className="section">
            <h2 className="section-title">Experience</h2>
            {portfolioData.experience.map((exp, index) => (
              <div key={index} className="list-item">
                <span className="bullet">💼</span>
                <span className="list-text">{exp}</span>
              </div>
            ))}
          </section>
        </div>

        {/* Contact Section */}
        <section className="section">
          <h2 className="section-title">Contact Information</h2>
          <div className="contact-grid">
            <a href={`mailto:${portfolioData.contact.email}`} className="contact-item">
              <span className="contact-icon">📧</span>
              <span>{portfolioData.contact.email}</span>
            </a>
            <a href={`tel:${portfolioData.contact.phone}`} className="contact-item">
              <span className="contact-icon">📞</span>
              <span>{portfolioData.contact.phone}</span>
            </a>
            <div className="contact-item">
              <span className="contact-icon">📍</span>
              <span>{portfolioData.contact.address}</span>
            </div>
          </div>
        </section>

        {/* Social Media Section */}
        <section className="section">
          <h2 className="section-title">Connect With Me</h2>
          <div className="social-links">
            <a 
              href={portfolioData.social.facebook} 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-button facebook"
            >
              <span className="social-icon">📘</span>
              Facebook
            </a>
            <a 
              href={portfolioData.social.instagram} 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-button instagram"
            >
              <span className="social-icon">📷</span>
              Instagram
            </a>
            <a 
              href={portfolioData.social.website} 
              target="_blank" 
              rel="noopener noreferrer"
              className="social-button website"
            >
              <span className="social-icon">🌐</span>
              Website
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>© 2026 {portfolioData.clinic}. All rights reserved.</p>
        <p className="footer-tagline">Your smile, our passion ❤️</p>
      </footer>
    </div>
  );
}

export default App;