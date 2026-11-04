# Security

What the system does to protect accounts, clinic data and patient records, and what still has to be done before real patients use it.

These controls support privacy obligations such as the Philippine Data Privacy Act of 2012 (RA 10173), but having them does **not** make the system compliant. Compliance also needs a privacy officer, registration where required, privacy notices and consent reviewed by counsel, data-sharing agreements with clinics, breach procedures and staff training. The privacy policy and terms in the web app (`web/src/config/legal.js`) are **drafts** awaiting legal review.

## Open action items

1. **Rotate the Supabase database password.** An earlier commit put `backend/.env` with real credentials into the public GitHub history. The file is no longer tracked, but the old password is still in the history. Change it in Supabase (*Project Settings → Database → Reset database password*), then update your local `backend/.env`. Rewriting history doesn't help once the password is public: forks and clones keep it, so rotation is what fixes it.
2. Generate a new `APP_KEY` for every deployed environment. Never reuse a local key.
3. Configure and **test** email delivery before relying on reminders or password resets (`MAIL_MAILER=log` sends nothing).
4. Push notifications are not implemented. Reminders are in-app and email only.
5. Get legal review of the privacy policy, terms and consent wording.

## Secrets

- Secrets live only in `backend/.env` on the server: database password, `APP_KEY`, mail credentials. `.env` files are ignored by git in `backend/`, `web/` and `mobile/`. Only `.env.example` files with placeholders are committed.
- The web and mobile apps hold **no** server credentials. Everything in `REACT_APP_*` and in `mobile/app.json` is public, because it is bundled into the app.
- Supabase is used only as a PostgreSQL host. No Supabase anon or service-role key is used by any client.
- `mobile/android/app/debug.keystore` is the standard React Native debug keystore (public, for development builds only). Release builds must use a private upload key managed through EAS or kept outside the repository.

### Google Maps key

The web app can show an embedded map when `REACT_APP_GOOGLE_MAPS_EMBED_KEY` is set. This key is visible to anyone who loads the page, so restrict it in Google Cloud Console:

- Application restriction: **HTTP referrers**, limited to the production and development web origins.
- API restriction: **Maps Embed API** only.

## Authentication

| | Web | Mobile |
|---|---|---|
| Credential | Laravel session in an **HttpOnly** cookie (JavaScript can't read it) | Sanctum bearer token |
| Stored in | Browser cookie jar | Device keystore (`expo-secure-store`: Android Keystore / iOS Keychain). Older builds kept it in AsyncStorage; it is moved on first launch. |
| CSRF | Required (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) | Not applicable (no cookies) |
| Expiry | `SESSION_LIFETIME` (120 min idle) | `SANCTUM_TOKEN_EXPIRATION` (7 days); expired tokens pruned daily |
| Sign-out | Session invalidated, CSRF token rotated | Token deleted on the server; local session cleared. On any 401 the app clears the session. |

- Passwords are hashed with bcrypt and must have 8+ characters including a letter and a number. System admin accounts need 12+.
- Changing the password signs out the account's other devices, web and mobile. A password reset signs out all of them.
- **Two-factor sign-in** (authenticator app) is available to every role, on web and mobile. It is optional per account. App codes work once, secrets and recovery codes are encrypted at rest, turning it off needs the password and a code, and turning it on signs out other devices.
- **Signed-in devices**: every account can see where it is signed in and sign out of any device. Session ids and tokens are never sent to clients. The web sessions in this list need `SESSION_DRIVER=database`.
- Password changes and two-factor changes notify the account holder; these alerts cannot be turned off.
- A dentist's schedule changes need approval from someone with `clinic.schedules.manage`. Patients keep booking against the current hours until then, and no one can decide their own request.
- Forgot-password answers the same whether or not the email exists.
- Suspended accounts are refused at login and on every request (`active` middleware).
- Registration can only create `patient` or `clinic_admin` accounts. Status and other privileged fields can't be mass-assigned.

## Authorization

- **Every check runs on the server.** The web and mobile apps hide buttons a user can't use, but that is convenience only.
- Platform roles: `role:system_admin` guards `/admin/*`.
- Clinic access comes only from an **active** `clinic_memberships` row. The `clinic.permission` middleware returns **404** to non-members, so they can't confirm a clinic's private resources exist, and **403** to members without the permission.
- Least privilege: receptionists can't read clinical records (only allergy and condition alerts, and each view is logged), and system administrators can't either. Clinic administrators can read them, and every read is logged. Dentists see only patients they have appointments with. Only dentists with a licence on file issue prescriptions and certificates.
- Object-level checks (against IDOR): every lookup is scoped to the signed-in patient or to the clinic in the URL, so changing an ID in a request returns 404. `backend/tests/Feature` includes tests that try exactly that for appointments, records, inventory, applications, documents and notifications.

**Platform settings.** Changing system settings or a clinic's plan needs the password re-confirmed and is written to the audit log with the names of the settings changed. Maintenance Mode and Session Timeout are enforced by the server, not the apps. Clinic Activity on the admin clinic page shows labels and dates only, and leaves out patient-record events.

## Data protection

- **Audit log**: sign-ins (including failed and blocked ones), bookings and status changes, clinical record **views** and writes, document access, verification decisions, membership and permission changes, and suspensions go to `audit_logs`. The table is append-only (model guard plus PostgreSQL trigger).
- **Clinical records** are amended, never overwritten or deleted. A draft note can be changed until it is finalized, is visible only to its author, and never reaches the patient. Patients see only what the clinic marks as visible, and never internal notes. Prescriptions and certificates can't be changed once issued.
- **Notifications** never contain clinical details, because they can be read on a lock screen: a new allergy says that a note exists, not what it is.
- **Uploads** (verification documents): PDF/JPG/PNG only, checked by extension **and** detected MIME type, max 5 MB, stored under random names on the private disk. They are downloadable only through a signed link that expires after 5 minutes, issued after an ownership or admin check.
- **Errors**: API errors use a fixed JSON format. With `APP_DEBUG=false`, 500 responses say only "Something went wrong" and no stack traces or SQL reach the client.
- **Response headers** (API): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store, private`, plus HSTS over HTTPS.
- **Logging**: tokens, passwords and reset links are never logged on purpose. Note that with `MAIL_MAILER=log`, the full email (including reset links) is written to `laravel.log`. Use that only in development.
- **Mobile offline data**: the SQLite cache holds the signed-in patient's own appointments and profile. It is cleared on logout. It is not encrypted at rest beyond the OS's app sandbox, so don't add clinical records to the offline cache without adding encryption.

## Network

- **CORS**: only origins in `CORS_ALLOWED_ORIGINS` may make credentialed browser requests. Native mobile apps aren't affected by CORS.
- **Rate limits** on login, registration, password reset, booking, reviews and uploads (see [API.md](API.md#rate-limits)).
- **HTTPS is required in production**: set `SESSION_SECURE_COOKIE=true`, use `https://` URLs, and terminate TLS at the web server or load balancer.

## Reporting a problem

Report suspected vulnerabilities privately to the project maintainers, not in a public GitHub issue. Include steps to reproduce, and don't access other people's data to prove the issue.
