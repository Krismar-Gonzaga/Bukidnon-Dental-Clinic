# Frontend Conventions

How code in `web/src/` is named and organized. Follow the existing pattern when you add something new.

## Folder layout

| Folder | Holds | Example |
|---|---|---|
| `pages/` | One component per screen. It owns the screen's state and passes data down. Each page has a matching `.css` and `.test.js`. | `pages/BookAppointmentPage.jsx` |
| `layouts/` | Page frames shared by several screens. | `layouts/PatientLayout.jsx` (patient sidebar and top bar) |
| `components/` | Reusable UI used across areas. | `Icon.jsx`, `StarRating.jsx`, `ConfirmDialog.jsx` |
| `components/<area>/` | UI for one area of the app. | `components/patient/`, `components/auth/`, `components/home/` |
| `config/` | App settings that are not business data: routes, labels, step lists, status lists, fixed UI text. | `config/patientNavigation.js`, `config/appointments.js` |
| `mocks/` | Sample data standing in for the API. Never real business data. | `mocks/appointmentHistory.js` |
| `utils/` | Plain functions with no React. | `utils/bookingCalendar.js` |
| `hooks/` | Custom React hooks shared by pages. | `hooks/useScheduleSelection.js` |
| `styles/` | Global CSS: design tokens and base styles. | `styles/tokens.css`, `styles/global.css` |

There is no API service layer yet. When integration starts, add one in `src/services/` (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md#where-api-code-goes)).

## Naming

| Thing | Style | Example |
|---|---|---|
| Component file and component | `PascalCase.jsx` | `AppointmentHistoryCard.jsx` |
| Component stylesheet | Same name as the component, `.css` | `AppointmentHistoryCard.css` |
| Page component | Ends in `Page` | `FeedbackPage.jsx` |
| Test file | Same name as the file it tests, `.test.js` | `FeedbackPage.test.js` |
| Hook | `use` + `PascalCase`, file `camelCase.js` | `useScheduleSelection` in `useScheduleSelection.js` |
| Utility, config and mock files | `camelCase.js` | `bookingCalendar.js`, `patientNavigation.js` |
| Functions and variables | `camelCase` | `getOpenTimeSlots`, `selectedDate` |
| Event handlers | `handle` + event or action | `handleSubmit`, `handleClinicSelect` |
| Booleans | `is`, `has`, or `can` prefix | `isSubmitted`, `hasUnreadNotifications`, `canReschedule` |
| Constants and fixed lists | `UPPER_SNAKE_CASE` | `BOOKING_STEPS`, `APPOINTMENT_STATUSES` |
| Mock data exports | `MOCK_` prefix, or a clear domain name inside `mocks/` | `MOCK_APPOINTMENT_HISTORY`, `BOOKING_CLINICS` |
| Route constants | `UPPER_SNAKE_CASE` ending in `_HREF` | `PATIENT_HISTORY_HREF` |
| Route builders | `get` + name + `Href` | `getAppointmentDetailsHref(id)` |
| CSS class | kebab-case, prefixed with the component's name | `.appointment-history-card`, `.appointment-history-actions` |
| CSS state class | `is-` prefix | `.is-selected`, `.is-active`, `.is-disabled` |
| CSS variant class | `--` modifier | `.appointment-status-badge--pending` |
| Design token | `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*` | `--color-primary`, `--space-4` |

Data field names use `camelCase` in the frontend, for example `durationLabel`. The Laravel API uses `snake_case`, for example `appointment_date`. Convert between them in the service layer, not in components (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md#field-mapping)).

## Status values

Appointment statuses shown to patients are defined once, in `config/appointments.js`:

| Value | Label | Meaning |
|---|---|---|
| `pending` | Pending | Requested, waiting for clinic approval |
| `upcoming` | Upcoming | Approved and in the future |
| `completed` | Completed | Visit done; the patient can review it |
| `cancelled` | Cancelled | Cancelled by the patient or clinic |

Other rules in the same file:
- `CANCELLABLE_STATUSES` is `pending` and `upcoming`.
- `RESCHEDULABLE_STATUSES` is `upcoming`.

The backend uses `confirmed` where the frontend shows `upcoming` (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md#status-mapping)).

## Routes

No router library is installed yet. `src/App.js` has a temporary path switch:
- Fixed paths go in the `PAGES_BY_PATH` object.
- Paths with an id use a regular expression: `/patient/appointments/<id>` and `/patient/appointments/<id>/reschedule`.

Always build links from `config/navigation.js` or `config/patientNavigation.js`. Do not type paths by hand.

| Path | Page |
|---|---|
| `/` | `HomePage` |
| `/clinics`, `/dentists`, `/services`, `/about`, `/contact` | Public pages |
| `/login`, `/register` | `LoginPage`, `RegisterPage` |
| `/patient/dashboard` | `PatientDashboardPage` |
| `/patient/book` | `BookAppointmentPage` |
| `/patient/appointments` | `AppointmentHistoryPage` |
| `/patient/appointments/<id>` | `AppointmentDetailsPage` |
| `/patient/appointments/<id>/reschedule` | `RescheduleAppointmentPage` |
| `/patient/reviews` (optional `?appointment=<id>`) | `FeedbackPage` |

Patient paths not built yet, which fall back to the homepage:
- `/patient/notifications`
- `/patient/saved-clinics`
- `/patient/clinic-locator`
- `/patient/profile`

## Styling

- Use the tokens in `styles/tokens.css`. Do not hard-code colors, spacing, or radii in components. When a Figma value is estimated, say so in a comment next to the token.
- Each component imports its own `.css` file. Its class names start with the component's prefix.
- Shared patient styles live in `components/patient/patientPanel.css`:
  - `.patient-panel`: white card.
  - `.patient-btn-sm` and `.patient-btn-outline`: small card buttons.
  - `.patient-back-link`: the "‹ Back to …" link.
- Shared buttons live in `styles/global.css`: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`, `.btn-lg`.
- Patient pages render inside `PatientLayout`. Content is centered with a max width of 768px for lists and the booking flow, and 672px for detail, reschedule, and review screens.
- No inline styles. No emoji in place of icons; add an icon to `components/Icon.jsx` instead.

## Mock data and UI text

- All sample data lives in `mocks/`, with a comment at the top of each file saying it is mock data.
- Components receive data through props, and pages import the mocks. That way, swapping in API data touches the page, not the components.
- Three older homepage sections still import their mocks directly. Move these to props when the homepage is connected:
  - `components/home/ClinicsMapSection.jsx`
  - `components/home/FeaturedClinics.jsx`
  - `components/home/Testimonials.jsx`
- Mocks reuse each other instead of copying values. For example, `mocks/bookingClinics.js` picks clinics from `mocks/directoryClinics.js`.
- Fixed UI text taken from Figma is marked `PROVISIONAL` and kept in `config/`, for example `config/booking.js` and `config/reviews.js`.
- Every place that should call the API but only pretends to is marked with a `// MOCK` comment. See the list in [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md#mock-actions-to-replace).

## Accessibility patterns already used

- Single choices (clinic, dentist, service, date, time, star rating) use native radio inputs that are visually hidden inside styled labels. This makes them keyboard accessible by default.
- When a step or screen changes, focus moves to its heading. The heading has `tabIndex={-1}`.
- `ConfirmDialog` has `role="alertdialog"`, keeps focus inside, closes on Escape, and returns focus to the button that opened it.
- Icon-only links have an `aria-label`. Decorative icons are `aria-hidden`.

## Tests and checks

Run these from `web/` (use `npm.cmd` on Windows):

```
npm.cmd test
npm.cmd run build
```

- Each page has a `.test.js` using React Testing Library.
- Tests that depend on today's date pin it with `jest.useFakeTimers().setSystemTime(...)`. Set it before `render`.

If the build or dev server reports an ESLint error that does not match the code, delete `web/node_modules/.cache/.eslintcache` and run again. The project sits in a OneDrive folder, and the lint cache can fall behind saved files.
