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
| GET | `/home` | Homepage: featured clinics, specializations, counts |
| GET | `/clinics/search` | Directory search: `search`, `city`, `specialization` / `specialization_id`, `service` / `service_id`, `sort` (`rating`, `reviews`, `newest`, `name`, `price`), `page` |
| GET | `/clinics/map` | Published clinics with coordinates, for the map |
| GET | `/clinics/{id}` | Clinic profile: services, dentists, branches, hours, reviews |
| GET | `/clinics/{id}/reviews` | Published reviews (paginated) |
| GET | `/clinics/{id}/available-dates` | Dates with open slots: `service_rate_id`, `dentist_id`, `from`, `to` |
| GET | `/clinics/{id}/availability` | Open start times on one date: `service_rate_id`, `dentist_id`, `date` |
| GET | `/dentists` | Dentist directory |
| GET | `/specializations`, `/services`, `/cities` | Filter options |
| POST | `/register` | Patient or clinic-owner sign-up (`role`: `patient` or `clinic_admin`). Privileged roles cannot be self-assigned. |
| POST | `/login`, `/forgot-password`, `/reset-password` | Account access. Forgot-password answers the same whether or not the email exists. |
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
| GET | `/patient/dashboard` | Upcoming visit and counts |
| GET | `/patient/appointments` | Own appointments (`status`, comma-separated) |
| POST | `/patient/appointments` | Request a booking (below) |
| GET | `/patient/appointments/{id}` | One appointment |
| PUT | `/patient/appointments/{id}` | Ask to reschedule: `{ "starts_at": ... }` |
| POST | `/patient/appointments/{id}/cancel` | Cancel (`reason` optional). `DELETE /patient/appointments/{id}` does the same. |
| POST | `/patient/appointments/{id}/review` | Review a completed appointment, once: `rating` 1–5, `comment` optional |
| GET | `/patient/reviews`, `/patient/reviews/eligible` | Own reviews; completed visits still waiting for one |
| GET | `/patient/records`, `/patient/medical-history` | Records the clinic shared, own medical history (no internal clinic notes) |
| GET/PUT/DELETE | `/patient/saved-clinics[/{clinicId}]` | Saved clinics |
| GET/PUT | `/patient/profile` | Contact details, birth date, emergency contact |

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
| appointments.view_assigned, appointments.progress | | ✓ | | |
| patients.view | ✓ | ✓ | ✓ | |
| patients.manage | | | ✓ | |
| records.view, records.write | | ✓ | | |
| inventory.view, inventory.manage | ✓ | | | ✓ |
| feedback.view, reports.view | ✓ | | | |

The clinic owner deliberately **cannot read clinical records**. Dentists see only patients they have appointments with.

| Area | Endpoints |
|---|---|
| Profile | `GET /`, `PUT /`, `PUT /publish`, `GET /dashboard`, `GET /reports/appointments` |
| Branches & hours | `GET/POST /branches`, `PUT /branches/{branch}`, `PUT /branches/{branch}/hours`, `GET/POST /holidays`, `DELETE /holidays/{holiday}`, `GET/POST /schedule-blocks`, `DELETE /schedule-blocks/{id}` |
| Services | `GET/POST /services`, `PUT /services/{serviceRate}` |
| Dentists | `GET /dentists`, `PUT /dentists/{id}`, `PUT /dentists/{id}/schedules` |
| Members | `GET/POST /members` (invite: `email`, `name`, `role`), `PUT /members/{membership}` |
| Appointments | `GET/POST /appointments`, `GET /appointments/{id}`, `POST /appointments/{id}/{confirm, reject, cancel, reschedule, approve-reschedule, check-in, start, complete, no-show}` |
| Patients | `GET/POST /patients`, `GET/PUT /patients/{id}` |
| Clinical records | `GET/POST /patients/{id}/medical-history`, `GET/POST /patients/{id}/records`, `POST /patients/{id}/records/{recordId}/amend` |
| Inventory | `GET/POST /inventory/items`, `GET/PUT /inventory/items/{id}`, `POST /inventory/items/{id}/movements`, `GET /inventory/alerts`, `GET/POST /inventory/categories`, `GET/POST /inventory/suppliers` |
| Reviews | `GET /reviews`, `POST /reviews/{review}/report` |

Clinical records and medical history are **append-only**: a correction is a new amendment that points at the original. Nothing is edited or deleted in place.

Inventory stock changes only through **movements** (`receipt`, `usage`, `adjustment`, `disposal`). Usage takes the batch that expires first. Adjustments need a reason, and stock can't go negative.

## System administration: `/admin/...`

Requires `users.role = system_admin` (created with `php artisan app:create-system-admin`). It does **not** grant access to clinical records.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/dashboard` | Platform counts, recent admin activity |
| GET | `/admin/clinic-applications[/{id}]` | Review queue |
| POST | `/admin/clinic-applications/{id}/start-review`, `/approve`, `/reject` | Decide (`notes` required to reject) |
| GET | `/admin/clinic-applications/{id}/documents/{documentId}/link` | Signed document URL |
| GET | `/admin/clinics` | All clinics |
| POST | `/admin/clinics/{clinic}/suspend`, `/reactivate` | Hide or restore a clinic (`reason` required to suspend) |
| GET | `/admin/users`, PUT `/admin/users/{user}` | Suspend (`reason` required) or reactivate accounts |
| GET | `/admin/reviews`, POST `/admin/reviews/{review}/moderate` | `status`: `approved` or `rejected`, with a required `note` |
| GET | `/admin/audit-logs` | Append-only audit trail (filters: `action`, `user_id`, `clinic_id`, `from`, `to`) |

## Scheduled jobs

Defined in `backend/routes/console.php`. They need `php artisan schedule:run` every minute (cron) or `schedule:work`.

| Command | When | What |
|---|---|---|
| `appointments:send-reminders` | every 15 min | Reminds patients `BOOKING_REMINDER_HOURS_BEFORE` (default 24) hours ahead, once per appointment |
| `inventory:send-alerts` | daily 07:00 Manila | Low stock, near-expiry and expired batches, to members with `inventory.manage` |
| `sanctum:prune-expired` | daily | Deletes expired tokens |
