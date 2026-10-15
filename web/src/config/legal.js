// PROVISIONAL privacy notice and terms. Written to describe what the system
// actually does, but NOT legal advice and NOT a compliance claim: the clinics
// (as personal information controllers) and project stakeholders must review
// it against the Data Privacy Act of 2012 (RA 10173), its IRR and NPC
// issuances, and their real processing, before launch.
export const LEGAL_PAGES = {
  privacy: {
    title: 'Privacy Notice',
    intro: 'How Bukidnon Dental Portal collects, uses and protects your personal information.',
    updated: 'October 2026',
    sections: [
      {
        heading: 'What we collect',
        body: [
          'Account details you give us: name, email, mobile number, address, and optionally birth date, gender and an emergency contact.',
          'Appointment details: the clinic, dentist, service, date and time you request, and their status.',
          'Health information recorded by your clinic during visits (for example allergies, medications, conditions and treatment notes). This is sensitive personal information and is only available to authorized clinic personnel.',
          'Security records such as sign-in attempts and changes to important data, kept to protect your account.',
        ],
      },
      {
        heading: 'Why we use it',
        body: [
          'To let you find clinics, request and manage appointments, and receive reminders and status updates.',
          'To let the clinics you visit provide care, keep treatment records and run their schedules.',
          'To keep the service secure and to meet legal obligations.',
        ],
      },
      {
        heading: 'Who can see it',
        body: [
          'Only the clinics you book with or are registered with. Each clinic sees only its own patients. Clinic staff see what their role requires; for example receptionists do not see clinical notes.',
          'Platform administrators manage accounts and clinic verification and do not routinely access clinical records.',
          'We do not sell your information. Your location is used only on your device to open directions when you ask, and is not stored.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'You may access and correct your account details in My Profile, and see the allergies, medications and shared treatment notes your clinics recorded.',
          'To request a copy, correction or deletion of other data, or to object to processing, contact the clinic concerned or the portal administrators through the Contact page.',
        ],
      },
      {
        heading: 'How we protect it',
        body: [
          'Passwords are hashed, web sessions use secure HttpOnly cookies, access is checked on the server for every request, and sensitive actions are recorded in an audit log.',
          'Clinic verification documents are stored privately and shared only through short-lived links with administrators.',
        ],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'The rules for using Bukidnon Dental Portal.',
    updated: 'October 2026',
    sections: [
      {
        heading: 'The service',
        body: [
          'The portal helps you find verified dental clinics in Bukidnon and request appointments. An appointment is only confirmed when the clinic confirms it.',
          'The portal does not give medical advice or diagnoses. Treatment decisions are made by your dentist.',
        ],
      },
      {
        heading: 'Your account',
        body: [
          'Give accurate information, keep your password private, and tell us if you suspect someone else used your account.',
          'Cancel or reschedule appointments you cannot attend. Clinics may limit online changes close to the appointment time.',
        ],
      },
      {
        heading: 'Reviews',
        body: [
          'You may review a clinic after a completed visit. Reviews must be honest and must not contain abuse, personal information about others, or advertising. Reported reviews may be hidden by moderators.',
        ],
      },
      {
        heading: 'Clinics',
        body: [
          'Clinics are listed after their documents are verified. Prices and services are published by each clinic and may change; confirm details with the clinic.',
        ],
      },
    ],
  },
};
