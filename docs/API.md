# API reference

The Laravel API in `backend/` serves the web app and the mobile app. All paths below are under `/api` (for example `http://localhost:8000/api/home`). The source of truth is `backend/routes/api.php`; run `php artisan route:list --path=api` to see the current list.

## Conventions

**Response envelope.** Every response is JSON:

```json
{ "success": true, "message": "optional", "data": { }, "meta": { "current_page": 1, "last_page": 3, "per_page": 20, "total": 47 } }
{ "success": false, "message": "The given data was invalid.", "errors": { "email": ["..."] } }
```

`meta` appears only on paginated lists. Lists accept `page` and `per_page` (capped by the server).

**Status codes.**

| Code | Meaning |
|---|---|
| 401 | Not signed in, or the token or session expired |
| 403 | Signed in but not allowed: missing permission, suspended account, or wrong role |
| 404 | Not found, **or** belongs to a clinic or user you can't access (the API does not reveal that it exists) |
| 409 | Conflict, e.g. the time slot was just taken |
| 419 | Web only: missing or expired CSRF token |
| 422 | Validation failed; see `errors` |
| 429 | Rate limited; wait and retry |
| 500 | Server error. Details are logged, never returned. |

**Times.** Clinic times use the business time zone `Asia/Manila` (UTC+8). Responses send ISO 8601 with offset, e.g. `"starts_at": "2026-11-03T09:00:00+08:00"`. Appointments also include `appointment_date` (`YYYY-MM-DD`) and `appointment_time` (`HH:MM`) in clinic time. Send `starts_at` either with an offset or as a clinic-local `YYYY-MM-DD HH:MM`. The database stores UTC.

## Authentication

| Client | How it signs in |
|---|---|
| Web app (origin in `SANCTUM_STATEFUL_DOMAINS`) | `GET /sanctum/csrf-cookie` first, then `POST /api/login` with credentials (`withCredentials`). The API sets an **HttpOnly session cookie**; no token is returned to JavaScript. Send the `X-XSRF-TOKEN` header on writes (Axios does this automatically). |
| Mobile app | `POST /api/login` returns `data.token`. Send `Authorization: Bearer <token>`. Tokens expire after `SANCTUM_TOKEN_EXPIRATION` minutes (default 7 days). The app keeps them in the device keystore. |

`POST /login` and `POST /register` return `{ user, role }` (web) or `{ user, token, role }` (mobile). `user.memberships` lists the clinics the user belongs to, with each one's role and permissions.

Suspended accounts get 403 on login and on every authenticated request.

## Rate limits

| Limiter | Limit |
|---|---|
| All API routes | 120/min per user (or per IP when signed out) |
| `POST /login` | 5/min per email+IP, 20/min per IP |
| `POST /register` | 5/min per IP |
| `POST /forgot-password`, `/reset-password` | 3/min per email+IP, 10/min per IP |
| Booking (`POST /patient/appointments`) | 20/min |
| Reviews, review reports | 10/min |
| Document uploads | 30/min |

## Public (no sign-in)

| Method | Path | Purpose |
|---|---|---|
| GET | `/home` | Homepage: featured clinics, specializations, recent reviews, and counts (`verified_clinics`, `patients`, `municipalities`, `satisfaction_rate`; the rate is null until there are reviews) |
| GET | `/clinics/search` | Directory search: `search`, `city`, `specialization` / `specialization_id`, `service` / `service_id`, `sort` (`rating`, `reviews`, `newest`, `name`, `price`), `page` |
| GET | `/clinics/map` | Published clinics with coordinates, for the map |
| GET | `/clinics/{id}` | Clinic profile: services, dentists, branches, hours, reviews |
| GET | `/clinics/{id}/reviews` | Published reviews (paginated) |
| GET | `/clinics/{id}/available-dates` | Dates with open slots: `service_rate_id`, `dentist_id`, `from`, `to` |
| GET | `/clinics/{id}/availability` | Open start times on one date: `service_rate_id`, `dentist_id`, `date` |
| GET | `/dentists` | Dentist directory, with `rating` and `review_count` (published reviews of their visits), `is_available` (has weekly hours) and `clinics` |
| GET | `/dentists/{id}` | One dentist's public profile with `schedules`; 404 if they are not publicly listed |
| POST | `/contact` | Contact form (`first_name`, `last_name`, `email`, `subject`, `message`), limited to 5 a minute. Emails the support address and audits the event without the content. 503 if the mail could not be sent |
| GET | `/specializations`, `/services`, `/cities` | Filter options |
| POST | `/register` | Patient or clinic-owner sign-up (`role`: `patient` or `clinic_admin`). Privileged roles cannot be self-assigned. |
| POST | `/login`, `/forgot-password`, `/reset-password` | Account access. Forgot-password answers the same whether or not the email exists. |
| GET | `/session` | Start-up session check: the signed-in user (same as `GET /user`), or 200 with no `data` for guests and suspended accounts |
| GET | `/documents/{document}/download` | Streams a private document. Works only with the short-lived signed URL from a `.../link` endpoint. |

Only clinics that are **approved and published** appear in public results or accept bookings.

## Any signed-in user

| Method | Path | Purpose |
|---|---|---|
| GET | `/user` | Current user and clinic memberships |
| POST | `/logout` | Revokes the token (mobile) or ends the session (web) |
| PUT | `/profile` | Name/email |
| POST | `/change-password` | Signs out the account's other devices |
| GET | `/notifications` | In-app notifications; `meta.unread_count` |
| POST | `/notifications/{id}/read`, `/notifications/read-all` | Mark read |
| PUT | `/notification-preferences` | `{ "email": true|false }` |
| POST | `/reviews/{id}/report` | Report a review for moderation |
| GET | `/my/invitations` | Clinic staff invitations |
| POST | `/my/invitations/{id}/accept`, `.../decline` | Respond to an invitation |

Passwords must be at least 8 characters with at least one letter and one number.

## Patient

| Method | Path | Purpose |
|---|---|---|
| GET | `/patient/dashboard` | Upcoming visits and counts (`total`, `upcoming`, `pending`, `completed`, `saved_clinics`, `reviews_given`) |
| GET | `/patient/appointments` | Own appointments (`status`, comma-separated) |
| POST | `/patient/appointments` | Request a booking (below) |
| GET | `/patient/appointments/{id}` | One appointment |
| PUT | `/patient/appointments/{id}` | Ask to reschedule: `{ "starts_at": ... }` |
| POST | `/patient/appointments/{id}/cancel` | Cancel (`reason` optional). `DELETE /patient/appointments/{id}` does the same. |
| POST | `/patient/appointments/{id}/review` | Review a completed appointment, once: `rating` 1–5, `comment` optional |
| GET | `/patient/reviews`, `/patient/reviews/eligible` | Own reviews; completed visits still waiting for one |
| GET | `/patient/records`, `/patient/medical-history` | Records the clinic shared, own medical history (no internal clinic notes) |
| GET/PUT/DELETE | `/patient/saved-clinics[/{clinicId}]` | Saved clinics |
| GET/PUT | `/patient/profile` | Contact details, birth date, civil status, blood type, city, province, zip code, emergency contact and `consents` (`email_follow_up`, `share_medical_history`, `emergency_contact_consent`, `promotions`; all off until the patient turns them on). GET also returns `health` and `photo_version` |
| PUT | `/patient/profile/health` | What the patient reports about their health: `conditions`, `procedures`, `vitals`, `allergies`, `medications`, `anxiety`. Sent sections replace the saved ones. Stored encrypted; the audit log records the sections changed, never the content |
| GET/POST | `/patient/profile/photo` | Own photo (private, needs the session). POST `photo`: JPG, PNG or WebP up to 2 MB, 10 a minute |

### Booking

```http
POST /api/patient/appointments
Idempotency-Key: 7f3c2a-unique-per-attempt
Content-Type: application/json

{ "clinic_id": 1, "service_rate_id": 4, "dentist_id": 2, "branch_id": 1,
  "starts_at": "2026-11-03T09:00:00+08:00", "reason": "Cleaning", "notes": "" }
```

- The server checks the slot again: working hours, holidays, schedule blocks, minimum notice, how far ahead, and overlaps for the dentist and for the patient. A PostgreSQL exclusion constraint also stops two active appointments overlapping for one dentist, even if two requests arrive at the same moment.
- **Idempotency-Key**: send a new unique value per booking attempt and reuse it on retries. A retry with the same key returns the original appointment (200) instead of booking twice (201). The mobile app keeps the key with bookings queued offline.
- New bookings start as `pending` until the clinic confirms.
- Patients can't cancel or reschedule within `BOOKING_PATIENT_CHANGE_CUTOFF_HOURS` (default 24) of the visit.

### Appointment statuses

```
pending ──► confirmed ──► checked_in ──► in_progress ──► completed
   │            │  ▲            └──► no_show
   │            ▼  │
   │   reschedule_requested
   ├──► rejected
   └──► cancelled  (from pending, confirmed, reschedule_requested)
confirmed ──► no_show
```

Every change is recorded in `appointment_status_histories` and the audit log.

## Clinic owners: applications

A clinic is listed only after a system administrator approves its application.

| Method | Path | Purpose |
|---|---|---|
| GET/POST | `/clinic-applications` | Own applications; start a draft |
| GET/PUT | `/clinic-applications/{id}` | View; edit while `draft` or `rejected` |
| POST | `/clinic-applications/{id}/documents` | Upload `file` (PDF/JPG/PNG, max 5 MB) with `document_type` |
| DELETE | `/clinic-applications/{id}/documents/{documentId}` | Remove a document |
| GET | `/clinic-applications/{id}/documents/{documentId}/link` | 5-minute signed download URL |
| POST | `/clinic-applications/{id}/submit` | Submit for review (all required documents needed) |
| POST/GET | `/clinic-verification`, `/clinic-verification/status` | Older one-step version used by the mobile sign-up |

Statuses: `draft` → `pending` → `under_review` → `approved` or `rejected` (and a rejected application can be resubmitted). Approved clinics can later be `suspended` by an administrator.

## Clinic portal: `/manage/clinics/{clinic}/...`

Access comes from the user's **active membership** in that clinic. Each role grants permissions (`backend/config/permissions.php`). Non-members get **404**. Members without the permission get **403**.

| Permission | clinic_admin | dentist | staff | inventory_staff |
|---|:-:|:-:|:-:|:-:|
| clinic.view | ✓ | ✓ | ✓ | ✓ |
| clinic.profile / branches / services / dentists / schedules / staff manage | ✓ | | | |
| appointments.view_all, appointments.manage | ✓ | | ✓ | |
| appointments.view_assigned, appointments.progress, appointments.review_assigned | | ✓ | | |
| documents.issue (prescriptions and certificates) | | ✓ | | |
| patients.view | ✓ | ✓ | ✓ | |
| patients.manage | ✓ | | ✓ | |
| patients.medical_alerts | | | ✓ | |
| records.view, records.write | ✓ | ✓ | | |
| inventory.view, inventory.manage | ✓ | | | ✓ |
| feedback.view, reports.view | ✓ | | | |

Clinic administrators can read clinical records, and every view is written to the audit log. Clinic staff never can. Dentists see only patients they have appointments with.

| Area | Endpoints |
|---|---|
| Profile | `GET /`, `PUT /`, `PUT /publish`, `GET /dashboard`, `GET /dashboard/insights` (clinic admin dashboard figures, `reports.view`), `GET /reports/appointments`, `GET /reports/analytics?year=` (`reports.view`; aggregates only, revenue is an estimate) |
| Branches & hours | `GET/POST /branches`, `PUT /branches/{branch}`, `PUT /branches/{branch}/hours`, `GET/POST /holidays`, `DELETE /holidays/{holiday}`, `GET/POST /schedule-blocks`, `DELETE /schedule-blocks/{id}` |
| Services | `GET/POST /services`, `PUT /services/{serviceRate}` |
| Dentists | `GET /dentists`, `PUT /dentists/{id}`, `PUT /dentists/{id}/schedules` |
| Members | `GET/POST /members` (invite: `email`, `name`, `role`), `PUT /members/{membership}` |
| Appointments | `GET/POST /appointments` (`walk_in: true` confirms at once; rows include `type`: `online` or `walk_in`, and `patient.age`), `GET /appointments/calendar?month=YYYY-MM` (booked count per day), `GET /appointments/{id}`, `POST /appointments/{id}/{confirm, reject, cancel, reschedule, approve-reschedule, check-in, start, complete, no-show}` |
| Patients | `GET/POST /patients`, `GET/PUT /patients/{id}` |
| Clinical records | `GET /records` (current records across the clinic; dentists: their patients only; filters `search`, `record_type`, `mine=1`), `GET/POST /patients/{id}/medical-history`, `GET/POST /patients/{id}/records`, `POST /patients/{id}/records/{recordId}/amend` |
| Inventory | `GET/POST /inventory/items`, `GET/PUT /inventory/items/{id}`, `POST /inventory/items/{id}/movements`, `GET /inventory/movements` (stock history across items), `GET /inventory/alerts`, `GET/POST /inventory/categories`, `GET/POST /inventory/suppliers` |
| Reviews | `GET /reviews`, `POST /reviews/{review}/report` |

Clinical records and medical history are **append-only**: a correction is a new amendment that points at the original. Nothing is edited or deleted in place. For dentists, `GET /dashboard` also returns `my_patients` (`total`, `new_this_month`, `new_today`: patients whose first visit with them falls in that period), and `appointments.same_day_last_week` for every role that sees appointments.

Inventory stock changes only through **movements** (`receipt`, `usage`, `adjustment`, `disposal`). Usage takes the batch that expires first. Adjustments need a reason, and stock can't go negative.

## System administration: `/admin/...`

Requires `users.role = system_admin` (created with `php artisan app:create-system-admin`). It does **not** grant access to clinical records.

**Password re-confirmation.** Routes marked † answer **423** `{ "code": "password_confirmation_required" }` until the administrator re-enters their password with `POST /admin/confirm-password` (`password`; 5 attempts a minute; failures are audited as `admin.password_confirm_failed`). A confirmation lasts 15 minutes and belongs to that sign-in only (the web session or the mobile token). The web and mobile apps ask for the password and retry automatically.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | Platform counts, registration queue (5 oldest), security counts for the last 24 h, audited events per day (14 days), recent activity |
| GET | `/admin/system/health` | Live checks (database, cache, document storage, job queue) and production configuration warnings; never returns secrets |
| POST | `/admin/confirm-password` | Re-enter the password (see above) |
| GET | `/admin/clinic-applications[/{id}]` | Review queue (filters: `status`, `search` on clinic name or city, `view=attention`, submitted `from`/`to`, `per_page`). Rows add `reference` (REG-00012), `document_status` (`verified`, `under_review`, `pending`, `missing_info`, `returned`, `suspended`) and `priority` (`high` when documents are missing or it has waited 3+ days, `medium` after a day, `standard`; `null` once decided). The detail includes `history` from the audit log |
| GET | `/admin/clinic-applications/summary` | Verification cards: pending, under review, submitted this/last week, needs attention, verified today, average decision hours (30 days), oldest open id, required documents |
| GET | `/admin/clinic-applications/export` ‡ | CSV of the filtered registrations (same filters; `limit` up to 5,000) |
| POST | `/admin/clinic-applications/{id}/start-review` | Mark as under review |
| POST | `/admin/clinic-applications/{id}/approve` †, `/reject` † | Decide (`notes` required to reject; sent to the applicant) |
| POST | `/admin/clinic-applications/{id}/notes` | Internal note (`note`), kept in the audit log, never shown to the applicant |
| GET | `/admin/clinic-applications/{id}/documents/{documentId}/link` | Signed 5-minute document URL; `download=1` (part of the signature) saves instead of opening |
| GET | `/admin/clinics` | All clinics |
| POST | `/admin/clinics/{clinic}/suspend` †, `/reactivate` † | Hide or restore a clinic (`reason` required to suspend) |
| GET | `/admin/users`, PUT `/admin/users/{user}` † | Change account type, suspend (`reason` required) or reactivate accounts |
| GET | `/admin/reviews`, POST `/admin/reviews/{review}/moderate` † | `status`: `approved` or `rejected`, with a required `note` |
| GET | `/admin/audit-logs` | Append-only audit trail, newest first (filters: `range` `24h`/`7d`/`30d`, or `from`/`to` dates; `category` `security`, `verification`, `clinics`, `accounts`, `records`, `appointments`, `reviews`, `audit`; `role` (account type, or `none` for not signed in); `action` prefix; `user_id`; `clinic_id`). Each entry has a readable `label`, `category`, `outcome` (`success`, `failed`, `blocked`), `user_name`/`user_role`, `subject_label`, `detail` and `sealed` |
| GET | `/admin/audit-logs/summary` | Cards for the same filters: total events and the total of the window before it, failed and blocked sign-ins and their distinct IPs, critical actions, entries awaiting seal and the last integrity report |
| POST | `/admin/audit-logs/integrity` | Seals new entries and re-checks the whole hash chain; returns `status` (`verified` or `failed`), `checked`, `pending` and `problems`. Audited |
| GET | `/admin/audit-logs/export` ‡ | CSV of the filtered entries (newest first; `limit` up to 5,000) |

‡ Exports contain personal data (emails, IP addresses): they need the password re-confirmed (†), are limited to 5 a minute and are themselves audited (`audit.exported`, `clinic_application.exported`). Cells that a spreadsheet would run as a formula are prefixed with an apostrophe.

**Audit integrity.** `audit_logs` is append-only: the model refuses updates and deletes, and on PostgreSQL a trigger refuses them too, except setting `hash`/`prev_hash` once on an unsealed row. `audit:seal` (every 5 minutes, and before each check) seals entries older than 30 seconds in id order: each stores an HMAC-SHA-256, keyed from `APP_KEY`, of its columns and the previous entry's hash. `audit:verify` or the integrity endpoint re-computes the chain and reports edited entries, gaps (deleted entries), removed newest entries (checked against the head kept in the application cache) and unsealed entries inside the chain. Rotating `APP_KEY` breaks verification of entries sealed before the rotation.

## System admin portal

Everything here needs the `system_admin` role. Routes marked † also need the password re-confirmed. Figures are aggregates; none carries patient-level data.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/platform` | Public: `platform_name`, `support_email`, `maintenance_mode`, `allow_self_registration` |
| GET | `/admin/clinics/directory` | Clinics plus registrations not yet approved (`kind`: `clinic` or `application`), with admin and plan. Filters: `status`, `search` |
| GET | `/admin/clinics/{clinic}` | Plan, since, renewal, subscription status, verification link and recent activity (labels and dates only) |
| POST | `/admin/clinic-applications/{id}/request-documents` † | Back to the applicant for more documents (`notes` required) |
| GET | `/admin/subscriptions[/{clinic}]` | One row per clinic: plan, amount, due date, `status` (`active`, `pending_payment`, `grace`, `expired`, `none`), `payment_status`. The detail adds the latest proof, payment history and plans |
| PUT | `/admin/subscriptions/{clinic}/plan` † | Change the plan (`plan`). Applies from the next payment; the due date does not move |
| GET | `/admin/subscription-payments/{payment}/proof-link` | 5-minute signed link for the phone (recorded) |
| GET | `/admin/reports` | Overview charts and the Clinics, Users and Subscriptions reports for `month` (YYYY-MM) against the month before |
| GET | `/admin/reports/export` | CSV of one `section`, or all of them. Recorded |
| GET, POST | `/admin/announcements` | List; create (`title`, `content`, `audience`, optional `publish`) |
| GET, PUT | `/admin/announcements/{id}` | Read; edit a draft (409 once published) |
| POST | `/admin/announcements/{id}/publish`, `/archive` | Publish notifies the audience (`all`, `patients`, `dentists`, `staff`, `clinic_admins`) in the app and by email, unless they turned `system_announcements` off |
| GET, PUT † | `/admin/settings` | Platform settings (see below) and the plans on offer |

`GET /admin/audit-logs` also takes `search` (action words, a person, a clinic) and returns `module`. `outcome` can be `pending`.

**What each setting does**

- `maintenance_mode`: every API call answers 503 `{ "code": "maintenance" }` except for system administrators, and sign-in, sign-out, `/session` and `/platform`.
- `allow_self_registration`: off refuses `POST /register` for patients (403). Clinic owners can still register to apply.
- `session_timeout_minutes` (5 to 1,440, default 30): idle lifetime of every web session, and of app tokens for everyone except patients.
- `require_verification`: off approves a registration automatically when it is submitted.
- `required_documents`: which of the four documents a registration must include (at least one).
- `payment_grace_days` (0 to 90, default 7): days past the due date a subscription counts as in its grace period before it counts as expired. It changes the status shown; nothing locks a clinic out.
- `platform_name` and `support_email`: the name on the web app and in emails, and where the contact form goes.

Scheduled job: `admin:send-system-alerts` (every 15 minutes) alerts administrators when the health checks get worse, once per change.

## Scheduled jobs

Defined in `backend/routes/console.php`. They need `php artisan schedule:run` every minute (cron) or `schedule:work`.

| Command | When | What |
|---|---|---|
| `appointments:send-reminders` | every 15 min | Reminds patients `BOOKING_REMINDER_HOURS_BEFORE` (default 24) hours ahead, once per appointment |
| `dentists:send-digest` | daily 07:00 | Tells each dentist how many visits they have today, and about follow-ups due within 3 days (each follow-up once) |
| `appointments:send-check-in-alerts` | every 5 min | Tells the clinic's front desk when a confirmed patient is `BOOKING_CHECK_IN_ALERT_MINUTES` (default 20) past their start time and not checked in, once per appointment |
| `inventory:send-alerts` | daily 07:00 Manila | Low stock, near-expiry and expired batches, to members with `inventory.manage` |
| `sanctum:prune-expired` | daily | Deletes expired tokens |
| `audit:seal` | every 5 min | Adds new audit entries to the tamper-evident hash chain (`audit:verify` re-checks it) |

## Clinic administration modules

All paths are under `/api/manage/clinics/{clinic}` unless they start with `/api/`. Each one checks the clinic permission shown; clinical data needs `records.view` or `records.write`, and reads are written to the audit log.

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET, PUT /settings` | `clinic.settings.manage` | Slot length and booking switches |
| `GET, PUT /role-permissions` | `clinic.permissions.manage` | Modules each staff position can open |
| `GET /audit-logs`, `GET /audit-logs/export` | `clinic.audit.view` | This clinic's audit log and CSV export |
| `GET /audit-logs/export-link` | `clinic.audit.view` | 5-minute signed link to the CSV, for the mobile app |
| `GET /subscription` | `subscription.manage` | Plan, renewal, payment channels and billing history |
| `POST /subscription/payments` | `subscription.manage` | Upload proof: `method`, `proof` (jpg, png or pdf, 5 MB), optional `reference`. 409 while one is pending |
| `POST /subscription/renewal-request` | `subscription.manage` | Tell system administrators the clinic wants to renew |
| `GET /subscription/payments/{id}/invoice`, `/invoice-link` | `subscription.manage` | Invoice PDF of a verified payment, or a 5-minute signed link to it |
| `GET, POST /patients/{id}/files` | `records.view`, `records.write` | List or upload (`file`: pdf, jpg, png or webp, 10 MB) |
| `GET /patients/{id}/files/{fileId}`, `/link` | `records.view` | Download, or a 5-minute signed link. Both are logged |
| `POST /reviews/{id}/reply` | `feedback.respond` | Public clinic reply (`reply`) |
| `GET /dentists/{id}` | `clinic.dentists.manage` or `clinic.schedules.manage` | Dentist profile with stats and recent appointments |
| `POST /members/{id}/reset-password` | `clinic.staff.manage` | Emails a reset link; never returns a password |
| `DELETE /services/{id}` | `clinic.services.manage` | Archives the service; past appointments keep it |
| `DELETE /branches/{id}` | `clinic.branches.manage` | 409 for the main branch or one with upcoming appointments |
| `POST /appointments/{id}/reassign` | `appointments.manage` | Same time, another dentist of this clinic (`dentist_id`) |

Signed in as any user:

| Method and path | Purpose |
| --- | --- |
| `GET, PUT /api/notification-preferences` | `email` and `categories` switches. A category missing from the saved value counts as on |
| `GET /api/two-factor` | `enabled`, `confirmed_at`, `recovery_codes_left`. Never the secret |
| `POST /api/two-factor/setup` | `password`; returns `secret`, `otpauth_url` and `qr_svg` |
| `POST /api/two-factor/confirm` | `code`; turns it on, signs out other devices and returns `recovery_codes` once |
| `POST /api/two-factor/disable` | `password` and `code` (an app code or a recovery code) |
| `POST /api/two-factor/recovery-codes` | `password`; new codes replace the old ones, returned once |
| `GET /api/sessions` | Where this account is signed in: `id` (opaque), `type` (`web` or `app`), `device`, `ip_address`, `last_active_at`, `current` |
| `DELETE /api/sessions/{id}` | Sign out of one device. 422 for the current one, 404 for anything not on this account |
| `POST /api/sessions/sign-out-others` | `password`; signs out everything except this device |

`POST /api/login` accepts `two_factor_code` and, from the app, `device_name` (a label for the devices list). It answers **423** when the account needs a code and 422 (`errors.two_factor_code`) when the code is wrong or an app code was already used.

System administrators (`/api/admin`): `GET /subscription-payments?status=`, `GET /subscription-payments/{id}/proof`, and `POST /subscription-payments/{id}/verify` or `/reject` (`note`). Verify and reject need a recent password confirmation.

## Dentist portal

Under `/manage/clinics/{clinic}`. A dentist only reaches patients who have an appointment with them; anything else is 404. Reads of clinical data are logged.

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET /dentist/overview` | appointments.view_assigned | Today, counts, pending requests, upcoming patients, follow-ups due, this week's totals |
| `GET /dentist/schedule` | appointments.view_assigned | Current days and hours, this week, `pending_change`, `last_decision` |
| `POST /dentist/schedule/changes` | appointments.view_assigned | Propose `days`, `starts_at`, `ends_at`, optional `note`, `branch_id`. **Nothing changes until approved.** One open request per dentist (409 otherwise). 422 if a day is already worked at another branch |
| `DELETE /dentist/schedule/changes/{id}` | appointments.view_assigned | Withdraw an undecided request |
| `GET /schedule-changes` | clinic.schedules.manage | Requests to decide; `status` (default pending), `dentist_id`. Each has `current` and `outside_hours` |
| `POST /schedule-changes/{id}/approve` | clinic.schedules.manage | Applies the hours at that branch. Other branches keep theirs and booked visits are not moved |
| `POST /schedule-changes/{id}/reject` | clinic.schedules.manage | `reason` is required and goes to the dentist |
| `POST /dentist/schedule/request-change` | appointments.view_assigned | `message`; goes to the clinic admins |
| `GET, PUT /dentist/profile` | appointments.view_assigned | Their own details. Licence numbers and email are ignored here: the clinic admin sets licence numbers through `PUT /dentists/{id}` |
| `POST /appointments/{id}/confirm`, `/reject` | appointments.manage or appointments.review_assigned | Dentists answer requests made to them |
| `POST /appointments/{id}/start` | appointments.manage or appointments.progress | A dentist can also start a confirmed visit on its own day; check-in and start are both recorded |
| `PUT /appointments/{id}/treatment-notes` | records.write | `notes`. Returned only to those with records.view |
| `GET /patients/{id}/dental-chart` | records.view | 32 teeth with `status`, `notes`, `charted`; `summary`; `last_updated_at`. A tooth not yet charted reads as healthy with `charted: false` |
| `PUT /patients/{id}/dental-chart/{tooth}` | records.write | `status`: healthy, caries, filled, crown, missing, planned; `notes` |
| `GET, PUT /patients/{id}/checklist` | records.view / records.write | Pre-procedure checklist. Every item starts unticked |
| `GET /records?kind=notes` or `kind=treatments` | records.view | The two record pages; also `patient_id` |
| `POST /patients/{id}/records` | records.write | Also takes `diagnosis`, `treatment_plan`, `follow_up_recommendations`, `materials_used`, `performed_on`, `status` (`draft` or `final`, default final) |
| `PUT /patients/{id}/records/{recordId}` | records.write | Change or finalize a draft. Author only. Final records still use `/amend` |
| `GET /prescriptions` | records.view | A dentist sees the ones they issued |
| `POST /prescriptions` | documents.issue | `patient_id`, `medication`, `dosage`, `frequency`, `duration`, `instructions`. 422 without a licence on file. Never edited afterwards |
| `GET /prescriptions/{id}/print-link` | records.view | A 5-minute signed link to the printable page |
| `POST /certificates/preview` | documents.issue | `patient_id`, `type` (medical, clearance, treatment), `purpose`. Issues nothing |
| `POST /certificates` | documents.issue | Issues it and returns a signed print `url`. 422 without a licence on file |
| `GET /files` | records.view | Files across the member's patients; `patient_id`, `category` |
| `GET, POST /follow-ups`, `PUT /follow-ups/{id}` | records.view / records.write | `purpose`, `due_on`, `priority` (routine, high), `status` (scheduled, confirmed, completed, cancelled), `notes`. The list's `meta.summary` has `total`, `high_priority`, `confirmed` |

## Front desk (clinic staff)

All paths are under `/api/manage/clinics/{clinic}`.

| Endpoint | Permission | Notes |
|---|---|---|
| `GET /appointments/queue` | `appointments.view_all` | Today's checked-in and ongoing patients: `id`, `queue_number`, `patient`, `service`, `dentist`, `status`, `checked_in_at`. Numbers follow check-in order, so they stay the same as people are served |
| `PUT /appointments/{id}/front-desk-notes` | `appointments.manage` | `notes`, scheduling notes only. Saved as `front_desk_notes` on the appointment |
| `GET /me` | `clinic.view` | The signed-in member's details at this clinic: `name`, `email`, `phone`, `address`, `position_label`, `clinic_name`, `status`, `work_schedule` |
| `PUT /me` | `clinic.view` | `phone`, `address` only. Name and email change through `/api/profile` |

`PUT /members/{membership}` also accepts `work_schedule` (`days`: 0 to 6, `starts_at`, `ends_at`), set by the clinic admin. The staff member can only read it.

`GET /appointments/{id}` adds `patient_last_visit_at`. Its `medical_flags` are returned to members with `records.view` or `patients.medical_alerts`. With `patients.medical_alerts` alone, a member sees only the allergy and condition lines, never clinical notes, and each read is written to the audit log as `records.alerts_viewed`.
