# Database

One PostgreSQL database, hosted on Supabase, used by both the web and the mobile app **through the Laravel API only**. No client connects to it directly. The schema is managed by the Laravel migrations in `backend/database/migrations/`.

The mobile app also keeps a small SQLite database on the phone. It is a read cache plus an outbox of changes waiting to sync (see [Mobile offline data](#mobile-offline-data)), not a second source of truth.

## Rules for changing the schema

- **Migrations only.** Never change tables by hand in the Supabase dashboard. If you do, the next developer's migrations fail.
- **Additive and reversible.** Add tables and nullable columns, give every migration a working `down()`, and don't drop or rename columns that a deployed client still reads. The `2026_10_16_*` migrations follow this pattern (e.g. `codify_existing_schema_drift` uses `hasColumn` checks so it is safe on a database that already had the change).
- **Shared database.** The development Supabase project is shared by the team. Never run `migrate:fresh`, `migrate:reset`, `db:wipe` or `db:seed` against it.
- **Tests never use it.** `php artisan test` runs on in-memory SQLite. PostgreSQL-only parts (exclusion constraint, audit trigger) are skipped there, and the application-level checks still run.

```bash
php artisan migrate:status     # what has run
php artisan migrate            # apply new migrations
php artisan migrate:rollback --step=1   # undo the last batch (development only)
```

## Time

All timestamps are stored in **UTC** (`timestamptz`). The business time zone is `Asia/Manila` (`BUSINESS_TIMEZONE`). Clinic hours, schedules and holidays are stored as local times or dates and interpreted in that zone. The API converts at the edges (`App\Support\BusinessTime`).

## Tables by area

### Accounts and access

| Table | Purpose |
|---|---|
| `users` | Everyone who signs in. `role` is the platform role (`patient`, `clinic_admin`, `dentist`, `staff`, `system_admin`). `status` is `active` or `suspended`. `notification_preferences` is JSON. |
| `patients` | Patient profile, 1:1 with a patient user (phone, address, birth date, emergency contact) |
| `clinic_memberships` | **The source of clinic access.** One row per user per clinic, with `role` (`clinic_admin`, `dentist`, `staff`, `inventory_staff`) and `status` (`invited`, `active`, `suspended`). Permissions per role are in `backend/config/permissions.php`. |
| `personal_access_tokens` | Sanctum tokens (mobile). Expired ones are pruned daily. |
| `sessions` | Web sessions (database driver) |
| `password_reset_tokens` | Hashed reset tokens |
| `audit_logs` | **Append-only** record of security-relevant actions: who, what, which clinic, IP, user agent, details. The model refuses updates and deletes, and a PostgreSQL trigger blocks `UPDATE`/`DELETE` too. |

### Clinics and directory

| Table | Purpose |
|---|---|
| `clinics` | Clinic profile. `status` (`draft`, `pending`, `under_review`, `approved`, `rejected`, `suspended`) and `is_published` control public listing. `latitude`/`longitude` are for the map. `owner_id` is the owner. |
| `clinic_branches` | Locations. Each clinic has one `is_main` branch (created for existing clinics by migration). |
| `branch_operating_hours` | Opening hours per branch and weekday |
| `clinic_holidays` | Closed dates (whole clinic or one branch) |
| `specializations`, `clinic_specializations` | Directory filters |
| `services` | Platform-wide service catalog |
| `service_rates` | A clinic's offering of a service: price, currency, `duration_minutes`, availability |
| `reviews` | Patient reviews, one per completed appointment (`appointment_id`), with moderation status. Older reviews have no appointment link. |
| `review_reports` | Reports of reviews, for administrator moderation |
| `patient_saved_clinics` | Patient bookmarks |

### Verification

| Table | Purpose |
|---|---|
| `clinic_applications` | A request to list a clinic: details, `status`, reviewer, decision notes |
| `verification_documents` | Uploaded permits and licences. The files are on the **private** disk (`storage/app/private/clinic-applications/{id}/<uuid>.<ext>`) and can only be downloaded through signed, 5-minute links. |

### Scheduling and appointments

| Table | Purpose |
|---|---|
| `dentists` | Dentist profile linked to a user and clinic |
| `dentist_schedules` | Working hours per dentist, branch and weekday |
| `schedule_blocks` | Time off and other blocked periods |
| `appointments` | `patient_id`, `clinic_id`, `branch_id`, `dentist_id`, `service_rate_id`, `starts_at`/`ends_at` (UTC), `status`, `requested_starts_at`/`requested_ends_at` for reschedule requests, `idempotency_key`, `reminder_sent_at`. The older `appointment_date`/`appointment_time` columns are kept in sync for older clients. |
| `appointment_status_histories` | Every status change: from, to, who, when, reason |

**Double-booking protection.** In PostgreSQL, the exclusion constraint `appointments_no_dentist_overlap` (`EXCLUDE USING gist (dentist_id WITH =, tstzrange(starts_at, ends_at) WITH &&)` for active statuses, via `btree_gist`) makes overlapping active appointments for one dentist impossible. The booking service also locks rows and checks patient overlaps. A unique `(patient_id, idempotency_key)` makes retried requests safe.

### Patient records

| Table | Purpose |
|---|---|
| `clinic_patients` | Links a patient to a clinic, with who registered them. A clinic only sees patients linked to it. |
| `patient_medical_histories` | Allergies, conditions, medications. Each update is a **new row**, and the newest is current. |
| `patient_records` | Visit notes and treatment records. **Never edited in place**: corrections are new rows with `amends_record_id` and an `amendment_reason`, and the original gets `superseded_at`. `is_patient_visible` controls what the patient sees, and then only the care instructions and visit summary, never internal `notes`. |

### Inventory

| Table | Purpose |
|---|---|
| `inventory_categories`, `suppliers` | Per-clinic lookup lists |
| `inventory_items` | Item, unit, `minimum_stock` |
| `inventory_batches` | Stock per batch with `expires_on` and quantity on hand |
| `inventory_movements` | **The ledger.** Every change in stock: `receipt`, `usage` (first-expiry-first-out), `adjustment` (reason required), `disposal`. Who and when are always recorded. |

### Notifications and jobs

| Table | Purpose |
|---|---|
| `notifications` | Laravel database notifications (in-app). `data` holds `kind`, `title`, `message`, `resource`. |
| `jobs`, `job_batches`, `failed_jobs` | Queue for emails (`QUEUE_CONNECTION=database`) |
| `cache`, `cache_locks` | Cache and rate-limit counters |

### Older tables not used by the current code

`tenants`, `subscriptions`, `billing_transactions`, `inventory_records`, `feedback` and `clinic_verifications` come from earlier versions of the project. The current API does not write to them (billing and subscriptions are not implemented). They were left in place because dropping tables on the shared database is destructive. Remove them in a reviewed migration once the team agrees nothing depends on them.

## Tenant isolation

Every clinic-owned row has a `clinic_id` (directly or through its parent). Clinic portal routes are nested under `/manage/clinics/{clinic}` and use scoped route bindings, so an ID from another clinic resolves to 404. Controllers also query through the clinic (`$clinic->appointments()->findOrFail($id)`). Tests in `backend/tests/Feature` try to cross these boundaries on purpose (`Authorization/`, `Appointments/`, `Records/`, `Inventory/`).

## Mobile offline data

`mobile/src/services/offline/` keeps an SQLite file on the phone:

- **Cache**: the latest copy of public clinic data and the signed-in patient's appointments and profile, so screens open offline.
- **Sync queue**: bookings, cancellations, reviews and profile edits made offline. They are replayed in order when the phone reconnects, with the original `Idempotency-Key`, so a replay can't double-book. Each row belongs to the user who created it. Logging out clears that user's cached data and queue.

Availability (open time slots) is never cached: it always comes from the server, and the server checks the slot again when the booking arrives.
