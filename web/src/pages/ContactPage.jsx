import DirectoryPageLayout from '../layouts/DirectoryPageLayout';
import ContactInfoCard from '../components/contact/ContactInfoCard';
import ContactForm from '../components/contact/ContactForm';
import { CONTACT_METHODS } from '../mocks/contactContent';
import './ContactPage.css';

function ContactPage() {
  return (
    <DirectoryPageLayout
      activeHref="/contact"
      title="Contact Us"
      description="Have questions? Our team is ready to help you."
      resultsLabel="Contact options"
      contentClassName="contact-content"
    >
      <div className="contact-grid">
        <ul className="contact-methods" aria-label="Contact details">
          {CONTACT_METHODS.map(({ id, ...method }) => (
            <li key={id}>
              <ContactInfoCard {...method} />
            </li>
          ))}
        </ul>

        <ContactForm />
      </div>
    </DirectoryPageLayout>
  );
}

export default ContactPage;
