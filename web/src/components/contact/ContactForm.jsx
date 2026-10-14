import { useState } from 'react';
import Icon from '../Icon';
import './ContactForm.css';

const INITIAL_VALUES = {
  firstName: '',
  lastName: '',
  email: '',
  subject: '',
  message: '',
};

// `half` fields share a row on wider screens.
const FIELDS = [
  {
    name: 'firstName',
    label: 'First Name',
    placeholder: 'Juan',
    autoComplete: 'given-name',
    half: true,
  },
  {
    name: 'lastName',
    label: 'Last Name',
    placeholder: 'Dela Cruz',
    autoComplete: 'family-name',
    half: true,
  },
  {
    name: 'email',
    label: 'Email',
    placeholder: 'juan@example.com',
    autoComplete: 'email',
    type: 'email',
  },
  { name: 'subject', label: 'Subject', placeholder: 'How can we help?' },
  {
    name: 'message',
    label: 'Message',
    placeholder: 'Your message here...',
    multiline: true,
  },
];

// Contact form UI only. No messaging endpoint exists yet, so submitting
// never sends anything; it shows a notice and keeps the typed values.
function ContactForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [showNotice, setShowNotice] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setShowNotice(true);
  };

  return (
    <form
      className="contact-form"
      aria-labelledby="contact-form-title"
      onSubmit={handleSubmit}
    >
      <h2 id="contact-form-title" className="contact-form-title">
        Send us a Message
      </h2>

      <div className="contact-form-fields">
        {FIELDS.map((field) => {
          const id = `contact-${field.name}`;
          const InputTag = field.multiline ? 'textarea' : 'input';
          return (
            <div
              key={field.name}
              className={`contact-form-field${field.half ? ' is-half' : ''}`}
            >
              <label htmlFor={id} className="contact-form-label">
                {field.label}
              </label>
              <InputTag
                id={id}
                name={field.name}
                type={field.multiline ? undefined : field.type ?? 'text'}
                rows={field.multiline ? 4 : undefined}
                className="contact-form-input"
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                value={values[field.name]}
                onChange={handleChange}
                required
              />
            </div>
          );
        })}
      </div>

      <button type="submit" className="btn btn-primary contact-form-submit">
        <Icon name="send" size={18} />
        Send Message
      </button>

      <p className="contact-form-notice" role="status">
        {showNotice &&
          'Messaging is not connected yet, so your message was not sent.'}
      </p>
    </form>
  );
}

export default ContactForm;
