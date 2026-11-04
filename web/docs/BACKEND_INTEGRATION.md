# Backend integration

How the web app talks to the Laravel API (`backend/`). For the endpoints themselves, see [docs/API.md](../../docs/API.md).

## Layers

```
pages/ and components/       UI only: no URLs, no Axios
   │  useQuery / useMutation (TanStack Query)
services/*Api.js             one function per endpoint, returns UI-shaped data
   │  services/adapters.js   API JSON → UI objects (toAppointment, toClinicProfile, …)
services/apiClient.js        Axios instance: base URL, cookies, CSRF, 419 retry
```

| File | Covers |
|---|---|
| `services/apiClient.js` | Base URL from `config/api.js` (`REACT_APP_API_URL`). `withCredentials` + `withXSRFToken`. Fetches `/sanctum/csrf-cookie` before the first write and retries once on 419. |
| `services/authService.js` | Login, register, logout, current user, forgot/reset/change password |
| `services/publicApi.js` | Home, directory search, clinic profile, reviews, dentists, availability |
| `services/patientApi.js` | Patient dashboard, appointments, booking, reschedule, cancel, reviews, saved clinics, profile, records |
| `services/notificationApi.js` | Notifications and preferences |
| `services/clinicPortalApi.js` | `/manage/clinics/{clinic}/...` (clinic portal) and clinic applications |
| `services/adminApi.js` | `/admin/...` |
| `services/apiErrors.js` | `getErrorMessage(error)` and `getFieldErrors(error)` for showing 422 errors on forms |

## Authentication

- The web app **never handles a token**. Login creates a Laravel session stored in an HttpOnly cookie, and the browser sends it automatically.
- `auth/AuthContext.jsx` loads `GET /user` on start and exposes `user`, `login`, `logout` and `refresh`.
- `auth/RequireAuth.jsx` guards routes by role. It only keeps people out of screens they can't use: **the API enforces every permission**, so never rely on the guard for security.
- `auth/homeRoutes.js` picks the landing page after login: patient portal, clinic portal (users with a clinic membership) or admin portal.
- The web app and the API must use the same host name in development (`localhost` with `localhost`), or the session cookie isn't sent.

## Data rules

- Show the server's error message (`getErrorMessage`) instead of inventing one. Map 422 `errors` to fields with `getFieldErrors`.
- After a mutation, invalidate the matching query keys so lists refresh.
- Dates and times come from the API in clinic time (`Asia/Manila`). Format them with the helpers in `adapters.js`, not with the browser's time zone.
- Booking sends an `Idempotency-Key` per attempt (`patientApi.bookAppointment`), so a double click or a retry can't book twice.
- Open time slots always come from `GET /clinics/{id}/availability`. The server checks the slot again on booking and may answer 409 if it was just taken.

## Remaining static content

| File | Used by | Why it is static |
|---|---|---|
| `mocks/aboutContent.js` | About page | Marketing copy; no CMS endpoint |
| `mocks/contactContent.js` | Contact page | Contact details. The contact form has **no endpoint** and tells the user the message was not sent. |
| `config/legal.js` | Privacy notice, terms | **Draft** text pending legal review |

Everything else (clinics, dentists, services, appointments, notifications, profile, clinic portal and admin data) comes from the API.

## Known gaps

- The clinic and admin portals were built without Figma designs. Their layout follows the patient portal's components and may change once designs exist.
- Embedded maps need `REACT_APP_GOOGLE_MAPS_EMBED_KEY` (`utils/maps.js`). Without it, pages show directions and search links to Google Maps instead. Clinics without coordinates are located by name and address.
- Profile photo upload and the contact form have no endpoints.
- Email (password reset, reminders) only works once the API has a mail provider configured.

## Tests

`src/testUtils.jsx` provides `renderWithProviders` (router, query client, auth). Page tests mock the `services/*Api.js` modules, so they never call the real API.

```bash
npm.cmd test -- --watchAll=false
```
