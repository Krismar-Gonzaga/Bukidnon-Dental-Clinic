# Bukidnon Dental Portal

A multi-clinic dental platform for Bukidnon. Patients find clinics and book, reschedule and review appointments. Clinics manage schedules, patients, clinical records and inventory. Platform administrators verify and supervise clinics.

| Part | Folder | Stack | Who uses it |
|---|---|---|---|
| API | `backend/` | Laravel 12, Sanctum, PostgreSQL (Supabase) | Both apps. The only part that touches the database. |
| Web app | `web/` | React 19 (Create React App), React Router, TanStack Query, Axios | Public visitors, patients, clinic owners/staff/dentists, system administrators |
| Mobile app | `mobile/` | React Native 0.85 / Expo 57, TypeScript, SQLite offline cache | Patients |

```
web (cookie session) ──┐
                       ├──► Laravel API ──► PostgreSQL (Supabase)
mobile (bearer token) ─┘        ├─ queue worker (emails)
                                └─ scheduler (reminders, inventory alerts)
```

## Features

- **Clinic directory**: search by city, specialization and service; clinic profiles with services, dentists, branches, hours, reviews and map.
- **Clinic verification**: owners apply with permits and licences (private uploads), and administrators review, approve, reject or suspend. Only approved, published clinics are listed.
- **Appointments**: real availability from dentist schedules, branch hours, holidays and blocks. Server-side double-booking protection (database exclusion constraint) and idempotent booking. Full lifecycle from request to completion, with reschedule requests and cancellation cut-offs.
- **Patient records**: medical history and visit records. Append-only with amendments, and audited. Patients see only what the clinic shares.
- **Inventory**: items, batches with expiry, a movement ledger (receipt, usage FEFO, adjustment, disposal), and low-stock and expiry alerts.
- **Reviews**: one per completed visit, with reporting and administrator moderation.
- **Notifications**: in-app, plus email once a mail provider is configured. Appointment reminders.
- **Roles**: patient, clinic admin, dentist, staff, inventory staff (per clinic), and system admin. Permissions are enforced by the API.
- **Mobile offline**: browse saved clinic data and queue bookings, cancellations and reviews while offline. They sync when the phone reconnects.

## Quick start

```bash
# API
cd backend && composer install && cp .env.example .env && php artisan key:generate
# edit .env: database connection (see docs/SETUP.md), then:
php artisan migrate && php artisan serve

# Web (new terminal)
cd web && npm ci && npm start            # http://localhost:3000

# Mobile (new terminal)
cd mobile && npm ci && npx expo start
```

On Windows PowerShell, use `npm.cmd` / `npx.cmd`. Full instructions, including the right API address for emulators and phones: **[docs/SETUP.md](docs/SETUP.md)**.

## Documentation

| Document | Contents |
|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Local setup for all three apps, environment variables, troubleshooting |
| [docs/API.md](docs/API.md) | Endpoints, authentication, permissions, booking rules, rate limits |
| [docs/DATABASE.md](docs/DATABASE.md) | Tables, migration rules for the shared database, tenant isolation, mobile offline storage |
| [docs/SECURITY.md](docs/SECURITY.md) | Security controls, **open action items**, privacy notes |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production checklist for API, web and mobile |
| [web/docs/](web/docs/README.md) | Web app conventions and how it uses the API |

## Tests

```bash
cd backend && php artisan test                   # API (in-memory SQLite, never the real DB)
cd web && npm test -- --watchAll=false           # web
cd mobile && npx tsc --noEmit -p . && npx jest   # mobile
```

## Status and known gaps

- Email delivery and push notifications are **not** configured or verified. Emails are written to the log in development.
- Billing and subscriptions are not implemented.
- The privacy policy and terms are drafts pending legal review.
- See [docs/SECURITY.md](docs/SECURITY.md#open-action-items) before any deployment.
