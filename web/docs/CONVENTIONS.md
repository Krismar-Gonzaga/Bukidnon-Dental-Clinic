# Frontend Conventions

How code in `web/src/` is named and organized. Follow the existing pattern when you add something new.

## Folder layout

| Folder | Holds | Example |
|---|---|---|
| `pages/` | One component per screen. It owns the screen's state and passes data down. Pages have a matching `.test.js` (`HomePage` is tested in `App.test.js`) and, when they need page-level styles, a matching `.css`. | `pages/BookAppointmentPage.jsx` |
| `layouts/` | Page frames shared by several screens. | `layouts/PatientLayout.jsx`, `ClinicLayout.jsx`, `AdminLayout.jsx` (all built on `PortalLayout.jsx`) |
| `components/` | Reusable UI used across areas. | `Icon.jsx`, `StarRating.jsx`, `ConfirmDialog.jsx` |
| `components/<area>/` | UI for one area of the app. | `components/patient/`, `components/auth/`, `components/home/` |
| `config/` | App settings that are not business data: routes, labels, step lists, status lists, fixed UI text. | `config/patientNavigation.js`, `config/appointments.js` |
| `services/` | API calls and adapters (API JSON → UI objects). The only place that knows URLs. | `services/patientApi.js`, `services/adapters.js` |
| `auth/` | Signed-in user state, route guard, home route per role. | `auth/AuthContext.jsx`, `auth/RequireAuth.jsx` |
| `mocks/` | Static content with no API (About and Contact copy). Never real business data. | `mocks/aboutContent.js` |
| `utils/` | Plain functions with no React. | `utils/bookingCalendar.js` |
| `hooks/` | Custom React hooks shared by pages. | `hooks/useScheduleSelection.js` |
| `styles/` | Global CSS: design tokens and base styles. | `styles/tokens.css`, `styles/global.css` |

Pages call the API through `services/` using TanStack Query (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)).

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
| API functions | verb + noun in `services/*Api.js`; adapters `to` + UI shape | `getAppointments`, `toClinicProfile` |
| Route constants | `UPPER_SNAKE_CASE` ending in `_HREF` | `PATIENT_HISTORY_HREF` |
| Route builders | `get` + name + `Href` | `getAppointmentDetailsHref(id)` |
| CSS class | kebab-case, prefixed with the component's name | `.appointment-history-card`, `.appointment-history-actions` |
| CSS state class | `is-` prefix | `.is-selected`, `.is-active`, `.is-disabled` |
| CSS variant class | `--` modifier | `.appointment-status-badge--pending` |
| Design token | `--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--font-*` | `--color-primary`, `--space-4` |

Data field names use `camelCase` in the frontend, for example `durationLabel`. The Laravel API uses `snake_case`, for example `appointment_date`. Convert between them in `services/adapters.js`, not in components.

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

`services/adapters.js` maps the backend's statuses onto these four: `confirmed`, `reschedule_requested`, `checked_in` and `in_progress` show as `upcoming`, and `rejected` and `no_show` show as `cancelled`. The original value stays available as `backendStatus`. The clinic portal shows backend statuses directly.

## Routes

Routing uses React Router (`src/App.js`, future flags in `config/router.js`). Always build links from the `config/*Navigation.js` files (`navigation.js`, `patientNavigation.js`, `clinicNavigation.js`, `adminNavigation.js`). Do not type paths by hand. Plain `<a href>` links inside the app are routed client-side by `components/LinkInterceptor.jsx`.

| Path | Who | Pages |
|---|---|---|
| `/`, `/clinics`, `/clinics/:clinicId`, `/dentists`, `/services`, `/about`, `/contact`, `/privacy`, `/terms` | Everyone | Public pages |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | Signed out | Account access |
| `/patient/...` | Patients | dashboard, book (`?clinic=<id>`), appointments, appointments/:id, appointments/:id/reschedule, reviews (`?appointment=<id>`), notifications, clinics, clinics/:id, saved-clinics, clinic-locator, profile, profile/edit, profile/password |
| `/clinic/apply` | Clinic owners | Clinic application and documents |
| `/clinic/:clinicId/...` | Clinic members (menu items depend on permissions) | dashboard, appointments, patients, inventory, services, dentists, branches, staff, reviews, reports, settings, notifications, password |
| `/admin/...` | System administrators | dashboard, applications, clinics, users, reviews, audit-logs, notifications, password |
| `*` | Everyone | `NotFoundPage` |

Guards (`auth/RequireAuth.jsx`) only redirect. The API decides what each user may see and do.

## Styling

- Use the tokens in `styles/tokens.css`. Do not hard-code colors, spacing, or radii in components. When a Figma value is estimated, say so in a comment next to the token.
- Each component imports its own `.css` file. Its class names start with the component's prefix.
- Shared patient styles live in `components/patient/patientPanel.css`:
  - `.patient-panel`: white card.
  - `.patient-btn-sm` and `.patient-btn-outline`: small card buttons.
  - `.patient-back-link`: the "‹ Back to …" link.
- Shared buttons live in `styles/global.css`: `.btn`, `.btn-primary`, `.btn-outline`, `.btn-sm`, `.btn-lg`.
- Patient pages render inside `PatientLayout`. Content is centered with a max width of 768px for lists and the booking flow, 672px for detail, reschedule, review, and edit-profile screens, and 448px for Change Password.
- Success screens (reschedule, review, profile updated, password changed) reuse `components/patient/SuccessCard.jsx`.
- No inline styles. No emoji in place of icons; add an icon to `components/Icon.jsx` instead.

## Static content and UI text

- Business data (clinics, services, prices, dentists, reviews, appointments) comes from the API. Don't add new mock business data.
- The only remaining files in `mocks/` are the About and Contact page copy. Each has a comment saying it is static content.
- Components receive data through props. Pages fetch it with services.
- Fixed UI text taken from Figma is marked `PROVISIONAL` and kept in `config/`, for example `config/booking.js` and `config/reviews.js`. The privacy notice and terms in `config/legal.js` are drafts pending legal review.

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

- Each page has a `.test.js` using React Testing Library. `App.test.js` covers the homepage.
- Tests that depend on today's date pin it with `jest.useFakeTimers().setSystemTime(...)`. Set it before `render`.

If the build or dev server reports an ESLint error that does not match the code, delete `web/node_modules/.cache/.eslintcache` and run again. The project sits in a OneDrive folder, and the lint cache can fall behind saved files.
