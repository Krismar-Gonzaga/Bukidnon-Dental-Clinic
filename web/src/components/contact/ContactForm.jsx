import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Icon from '../Icon';
import { getErrorMessage, getFieldErrors } from '../../services/apiErrors';
import { sendContactMessage } from '../../services/publicApi';
import './ContactForm.css';

const INITIAL_VALUES = { firstName: '', lastName: '', email: '', subject: '', message: '', website: '' };

// `half` fields share a row on wider screens.
const FIELDS = [
  { name: 'firstName', apiName: 'first_name', label: 'First Name', placeholder: 'Juan', autoComplete: 'given-name', half: true, maxLength: 100 },
  { name: 'lastName', apiName: 'last_name', label: 'Last Name', placeholder: 'Dela Cruz', autoComplete: 'family-name', half: true, maxLength: 100 },
  { name: 'email', apiName: 'email', label: 'Email', placeholder: 'juan@example.com', autoComplete: 'email', type: 'email', maxLength: 255 },
  { name: 'subject', apiName: 'subject', label: 'Subject', placeholder: 'How can we help?', maxLength: 150 },
  { name: 'message', apiName: 'message', label: 'Message', placeholder: 'Your message here...', multiline: true, maxLength: 5000 },
];

// Sends the message to the support address (POST /contact). `website` is a
// hidden field that people never see and bots fill in.
function ContactForm() {
  const [values, setValues] = useState(INITIAL_VALUES);
  const send = useMutation({
    mutationFn: () =>
      sendContactMessage({
        first_name: values.firstName.trim(),
        last_name: values.lastName.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website: values.website,
      }),
    onSuccess: () => setValues(INITIAL_VALUES),
  });
  const fieldErrors = send.error ? getFieldErrors(send.error) : {};

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
  };

  if (send.isSuccess) {
    return (
      <div className="contact-form contact-form-sent" role="status">
        <Icon name="checkCircle" size={64} />
        <h2 className="contact-form-sent-title">Message Sent!</h2>
        <p className="contact-form-sent-text">Thank you for reaching out. We will get back to you within 24 hours.</p>
        <button type="button" className="btn btn-primary" onClick={() => send.reset()}>
          Send Another
        </button>
      </div>
    );
  }

  return (
    <form
      className="contact-form"
      aria-labelledby="contact-form-title"
      onSubmit={(event) => {
        event.preventDefault();
        send.mutate();
      }}
    >
      <h2 id="contact-form-title" className="contact-form-title">
        Send us a Message
      </h2>

      <div className="contact-form-fields">
        {FIELDS.map((field) => {
          const id = `contact-${field.name}`;
          const InputTag = field.multiline ? 'textarea' : 'input';
          const error = fieldErrors[field.apiName];
          return (
            <div key={field.name} className={`contact-form-field${field.half ? ' is-half' : ''}`}>
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
                maxLength={field.maxLength}
                value={values[field.name]}
                onChange={handleChange}
                aria-invalid={Boolean(error)}
                required
              />
              {error && (
                <p className="contact-form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden from people; bots that fill it in are ignored by the server. */}
      <div className="contact-form-trap" aria-hidden="true">
        <label htmlFor="contact-website">Website</label>
        <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={handleChange} />
      </div>

      {send.isError && Object.keys(fieldErrors).length === 0 && (
        <p className="contact-form-error" role="alert">
          {getErrorMessage(send.error)}
        </p>
      )}

      <button type="submit" className="btn btn-primary contact-form-submit" disabled={send.isPending}>
        <Icon name="send" size={18} />
        {send.isPending ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}

export default ContactForm;
