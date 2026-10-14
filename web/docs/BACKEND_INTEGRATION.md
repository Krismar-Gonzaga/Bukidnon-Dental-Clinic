# Backend Integration Guide

How to replace the frontend's mock data with the Laravel API (`backend/`).

Everything about the backend here was read from `backend/routes/api.php`, the controllers in `backend/app/Http/Controllers/Api/`, and the appointments migration on 2026-10-14. Nothing in `backend/` was changed. Check the backend again before relying on this, and ask the backend owner to confirm the request and response formats.

## Where API code goes

There is no API layer in the frontend yet. When integration starts:

1. Add `src/services/apiClient.js`. It holds the Axios instance with the API base URL and the `Authorization: Bearer <token>` header (Laravel Sanctum).
   - Read the base URL from an environment variable.
   - Never hard-code tokens or log them.
2. Add one service file per area, for example:
   - `src/services/appointmentsService.js`
   - `src/services/clinicsService.js`
   - `src/services/feedbackService.js`
3. Each service function calls the API and returns data shaped like the current mocks, using the [field mapping](#field-mapping) below. Pages then swap a mock import for a service call; components stay unchanged.
4. Pages handle loading and error states. These do not exist yet, because the mocks load instantly.

## Backend endpoints (current state)

All endpoints are under `/api`. Those marked "token" need a logged-in user.

### Public

| Method and path | Use in frontend |
|---|---|
| `GET /home` | Homepage sections |
| `GET /clinics/search` | Find Clinics page; booking step 1 (clinic list) |
| `GET /clinics/{id}` | Clinic details (includes reviews) |
| `GET /specializations` | Search filters |
| `GET /cities` | Search filters |
| `POST /register` | Register page (`role` may be `patient` or `clinic_admin`) |
| `POST /login` | Login page |

### Logged-in user (token)

| Method and path | Use in frontend |
|---|---|
| `POST /logout` | Sidebar "Log Out" |
| `GET /user` | Name and role in the sidebar and top bar |
| `PUT /profile`, `POST /change-password` | My Profile (not built yet) |

### Patient (token)

| Method and path | Use in frontend | Status |
|---|---|---|
| `GET /patient/appointments` | Dashboard, Appointment History, Appointment Details | Works |
| `POST /patient/appointments` | Book Appointment, Confirm step | Works |
| `PUT /patient/appointments/{id}` | Reschedule | Works |
| `DELETE /patient/appointments/{id}` | Cancel Request / Cancel Appointment | Works |
| `POST /patient/feedback` | Feedback & Ratings | Broken: `FeedbackController` does not exist |
| `GET /patient/profile`, `PUT /patient/profile` | My Profile (not built yet) | Works |

The staff, dentist, clinic-admin, and system-admin route groups point to controllers or methods that do not exist yet. Report these to the backend owner; they are not needed for the patient screens.

## Mock files and what replaces them

| Mock file | Used by | Replace with |
|---|---|---|
| `mocks/patientDashboard.js` (`MOCK_PATIENT`) | All patient pages: sidebar name and role | `GET /user` |
| `mocks/patientDashboard.js` (stats, appointments, notifications) | Dashboard | Stats and appointments: work them out from `GET /patient/appointments`. Notifications: no endpoint yet |
| `mocks/appointmentHistory.js` | History, Details, Reschedule, Feedback | `GET /patient/appointments` |
| `mocks/bookingClinics.js` (from `directoryClinics.js`) | Booking step 1 | `GET /clinics/search` |
| `mocks/bookingDentists.js` (from `directoryDentists.js`) | Booking step 2 | No endpoint yet (see gaps) |
| `mocks/services.js` | Booking step 3, Services page | No clinic-services endpoint in the routes yet (see gaps) |
| `mocks/bookingSchedule.js` | Booking step 4, Reschedule | No availability endpoint yet (see gaps) |
| `mocks/directoryClinics.js` | Find Clinics | `GET /clinics/search` |
| `mocks/directoryDentists.js` | Dentists page | No endpoint yet |
| `mocks/featuredClinics.js`, `testimonials.js`, `clinicMapMarkers.js` | Homepage | `GET /home` |

## Mock actions to replace

Each of these pretends to succeed and saves nothing. Search the code for `MOCK` to find them.

| File | Action | Call |
|---|---|---|
| `pages/BookAppointmentPage.jsx` (`// MOCK submit`) | Confirm Appointment | `POST /patient/appointments` |
| `pages/RescheduleAppointmentPage.jsx` (`// MOCK reschedule`) | Confirm Reschedule | `PUT /patient/appointments/{id}` with the new date and time |
| `pages/AppointmentDetailsPage.jsx` (`handleConfirmCancel`) | Yes, Cancel | `DELETE /patient/appointments/{id}` |
| `pages/FeedbackPage.jsx` (`// MOCK submit`) | Submit Review | `POST /patient/feedback` (backend broken) |
| `components/auth/LoginForm.jsx` | Sign in | `POST /login` |
| `components/auth/RegisterForm.jsx` | Register | `POST /register` |
| `layouts/PatientLayout.jsx` | Log Out | `POST /logout` |
| `components/contact/ContactForm.jsx` | Send message | No endpoint yet |

## Field mapping

### Appointment

What the frontend expects, from `mocks/appointmentHistory.js`, next to the backend `appointments` table:

| Frontend field | Example | Backend source | Notes |
|---|---|---|---|
| `id` | `'hist-1'` | `id` | Backend id is a number; use it as a string in links |
| `reference` | `'000006'` | `id` | Display number. Suggest zero-padding `id` to 6 digits; confirm with backend |
| `service` | `'Root Canal Treatment'` | `service_id` | The list response loads only `clinic`, not `service`. Backend needs to add `service` to `with(...)` |
| `dentist` | `'Dr. Laura Reyes'` | none | The `appointments` table has no dentist column |
| `clinic` | `'Don Carlos Dental Clinic'` | `clinic.name` | Loaded through `with('clinic')` |
| `status` | `'upcoming'` | `status` | See [status mapping](#status-mapping) |
| `date` | `'July 25, 2026'` | `appointment_date` (`YYYY-MM-DD`) | Format for display with `formatLongDate` in `utils/bookingCalendar.js` |
| `time` | `'9:00 AM'` | `appointment_time` (`HH:MM:SS`) | Convert to 12-hour text |

### Booking request

The booking flow collects these and should send them to `POST /patient/appointments`:

| Frontend state | Request field | Backend rule |
|---|---|---|
| `clinicId` | `clinic_id` | required, must exist |
| `serviceId` | `service_id` | optional, must exist |
| `dentistId` | none | Not accepted by the backend (see gaps) |
| selected date (`YYYY-MM-DD` key from `toDateKey`) | `appointment_date` | required, today or later |
| `time` (`'10:00 AM'`) | `appointment_time` | required; send 24-hour `HH:MM`, confirm the format with backend |

### Status mapping

| Backend (`appointments.status`) | Frontend status | Label |
|---|---|---|
| `pending` | `pending` | Pending |
| `confirmed` | `upcoming` | Upcoming |
| `completed` | `completed` | Completed |
| `cancelled` | `cancelled` | Cancelled |

Convert in the service layer, so components keep using the frontend values from `config/appointments.js`.

## Gaps to raise with the backend owner

These block a full integration. They are backend decisions; do not change `backend/` from the frontend task.

1. **Feedback:** `POST /patient/feedback` points to a `FeedbackController` that does not exist. The frontend sends an appointment, a 1–5 star rating, and optional text.
2. **Dentist on appointments:** the table has no dentist column, and `POST /patient/appointments` does not accept a dentist. The booking flow has a Select Dentist step, and History and Details show the dentist.
3. **Dentists list:** there is no endpoint for a clinic's dentists (booking step 2) or the Dentists page. Each dentist needs a name, specialty, and whether they are available.
4. **Clinic services:** there is no route listing a clinic's services with duration and price range (booking step 3). A `ServiceController` exists but is not in `routes/api.php`.
5. **Availability:** there is no endpoint for open dates and time slots. The frontend currently shows today through the end of the month and hides time slots that have already passed today.
6. **Who may cancel or reschedule what:** `PUT` and `DELETE /patient/appointments/{id}` do not check the status. The frontend only allows cancelling `pending` or `upcoming` appointments and rescheduling `upcoming` ones. The backend should enforce the same rules.
7. **Rescheduling a confirmed appointment:** the backend keeps the status unchanged. Decide whether a reschedule should go back to `pending` for clinic approval.
8. **Appointments linked by email:** patient appointments are matched by `patient_email`, not by user id, so changing the account email loses the history.
9. **Notifications:** no endpoint yet (dashboard panel, bell dot, Notifications page).
10. **Controller folder case:** the namespace says `API` but the folder is `Api`. This breaks on case-sensitive hosting (Linux).

## Integration order (suggested)

1. Login, register, and `GET /user`: replace `MOCK_PATIENT` and store the token.
2. `GET /patient/appointments`: History, Details, and Dashboard.
3. Cancel (`DELETE`) and Reschedule (`PUT`).
4. Booking (`POST`), once the dentist, services, and availability gaps are decided.
5. Feedback, once the controller exists.
