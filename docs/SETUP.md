# Local setup

How to run the API, the web app and the mobile app on one computer.

All three apps use the same Laravel API, and the API is the only part that talks to the database. Never put database credentials or Laravel secrets in `web/` or `mobile/`.

## Requirements

| Tool | Version used | Needed for |
|---|---|---|
| PHP | 8.2+ with `pdo_pgsql`, `pdo_sqlite`, `fileinfo`, `openssl`, `mbstring` | API |
| Composer | 2.x | API |
| Node.js | 22.11+ (mobile requires it; web works on 18+) | Web, mobile |
| PostgreSQL | Supabase project, or local PostgreSQL 15+ | API database |
| Android Studio / Xcode | Current | Mobile emulator (optional) |
| Expo Go | Matching Expo SDK 58 | Mobile on a phone (optional) |

On Windows, run npm as `npm.cmd` and npx as `npx.cmd` if PowerShell blocks the `.ps1` shims.

## 1. API (`backend/`)

```bash
cd backend
composer install
cp .env.example .env          # never commit .env
php artisan key:generate
```

Edit `backend/.env`:

- `DB_*`: your PostgreSQL connection. For Supabase, use the **pooler** host and port from *Project Settings → Database*. Keep `DB_PASSWORD` only in this file.
- `FRONTEND_URL=http://localhost:3000`: password-reset links point here.
- `CORS_ALLOWED_ORIGINS` and `SANCTUM_STATEFUL_DOMAINS`: the web app's origin (defaults are fine for local work).
- `MAIL_MAILER=log`: emails are written to `storage/logs/laravel.log` instead of being sent. See [Email](#email).

Then:

```bash
php artisan migrate                       # additive migrations only; see DATABASE.md
php artisan db:seed                       # optional sample clinics; only on an EMPTY local DB (it inserts duplicates otherwise)
php artisan app:create-system-admin admin@example.com --name="Platform Admin"   # prompts for a password (12+ chars, letters and numbers)
php artisan serve                         # http://127.0.0.1:8000
```

The scheduler sends appointment reminders, front desk check-in alerts (`BOOKING_CHECK_IN_ALERT_MINUTES`, default 20) and inventory alerts. The queue sends notification emails. Run both in separate terminals while you develop:

```bash
php artisan schedule:work
php artisan queue:work
```

### Tests

```bash
php artisan test
```

Tests always run against an in-memory SQLite database (`tests/TestCase.php` refuses anything else), so they never touch Supabase.

## 2. Web app (`web/`)

```bash
cd web
npm ci
cp .env.example .env    # optional; only needed to change the defaults
npm start               # http://localhost:3000
```

| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_API_URL` | `http://localhost:8000/api` | API base URL |
| `REACT_APP_GOOGLE_MAPS_EMBED_KEY` | empty | Google Maps Embed API key. Without it, clinic pages show directions and search links to Google Maps instead of an embedded map. |

Everything in `REACT_APP_*` ends up in the browser bundle, so it is public. Only put browser-restricted keys there (see [SECURITY.md](SECURITY.md#google-maps-key)).

The web app signs in with an HttpOnly session cookie, not a token. For that to work, use the **same host name** for the web app and the API: open `http://localhost:3000` with `http://localhost:8000/api`, or `127.0.0.1` with `127.0.0.1`. Do not mix them.

```bash
npm test -- --watchAll=false
npm run build
```

## 3. Mobile app (`mobile/`)

```bash
cd mobile
npm ci
npx expo start
```

In development the app finds the API by itself: it uses the computer that serves the app (Metro), port 8000. The phone already reaches that computer to load the app, so nothing needs to be configured. Two things are still required:

1. Let the API accept the phone. In `backend/.env` set:

   ```dotenv
   SERVER_HOST=0.0.0.0
   SERVER_PORT=8000
   ```

   Then plain `php artisan serve` listens on all network interfaces. Without it, the API listens on 127.0.0.1 (this computer only) and the phone shows "Can't reach the server" / `Network Error`. Restart `php artisan serve` after changing `.env`: it keeps the address it started with.
2. Allow port 8000 through Windows Firewall. Run once in an **administrator** PowerShell (allows only devices on your local network):

   ```powershell
   New-NetFirewallRule -DisplayName "Laravel dev API (8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private,Public -RemoteAddress LocalSubnet
   ```

| Running on | API address used |
|---|---|
| Phone or emulator in development | `http://<computer running Metro>:8000/api` (detected) |
| Expo tunnel mode, or no Metro host | `http://127.0.0.1:8000/api`: use `adb reverse tcp:8000 tcp:8000` with a USB-connected Android device |
| Release builds | `expo.extra.apiUrl` in `mobile/app.json` (an `https://` URL); required |

Set `expo.extra.apiUrl` only to override the detected address; when set it applies on every platform.

The app checks connectivity with Laravel's `GET /up` health route, which does not touch the database.

```bash
npx tsc --noEmit -p .
npx jest --ci
```

Patients get the patient app. Members of an approved clinic (owners, dentists, receptionists, inventory staff) get the clinic portal with the same sections as the web portal, shown according to their role. System administrators get the admin portal (dashboard, registration queue, verification, users, review moderation, audit logs, settings). Clinic owners whose application is still pending see a notice that sends them to the web portal.

## Email

With `MAIL_MAILER=log`, nothing is delivered. Messages (including password-reset links) appear in `backend/storage/logs/laravel.log`. To send real email, set the `MAIL_*` SMTP values for a provider and test delivery before relying on it. See [DEPLOYMENT.md](DEPLOYMENT.md#email).

Contact form messages go to `MAIL_CONTACT_ADDRESS`, or to `MAIL_FROM_ADDRESS` when it is not set. Set a monitored mailbox before launch: with `MAIL_MAILER=log`, the form says the message was sent but it only reaches the log.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Web login returns **419** | CSRF cookie not set. Web and API host names don't match (`localhost` vs `127.0.0.1`), or `SANCTUM_STATEFUL_DOMAINS` doesn't list the web origin. |
| Browser shows a **CORS** error | The web origin is missing from `CORS_ALLOWED_ORIGINS`. Restart `php artisan serve` after editing `.env`. |
| Mobile shows "You're offline" on a phone | The API was started without `--host=0.0.0.0`, Windows Firewall blocks port 8000, phone and computer are on different networks, or `extra.apiUrl` points at an old address. Test from the phone's browser: `http://<computer IP>:8000/up` should open. |
| Requests take 1–3 seconds | Normal against a remote Supabase pooler from a local machine. |
| `php artisan migrate` fails with `SQLSTATE[25P02] current transaction is aborted` | Postgres aborted the migration's transaction part-way (seen intermittently through the Supabase pooler). Each migration is rolled back as a unit, so run `php artisan migrate` again; it continues from the first pending one. Running migrations through session mode (`DB_PORT=5432 php artisan migrate` in Git Bash) avoids the transaction pooler on port 6543. |
| `could not find driver` | Enable `pdo_pgsql` in `php.ini`. |

## Subscription payment details

Clinics pay by manual transfer and upload proof. Set the receiving accounts in `backend/.env`; the plan price and features are provisional values in `backend/config/subscriptions.php`.

| Variable | Meaning |
| --- | --- |
| `PAYMENT_GCASH_NUMBER` | GCash number shown to clinics |
| `PAYMENT_MAYA_NUMBER` | Maya number shown to clinics |
| `PAYMENT_BANK_ACCOUNT` | Bank account shown to clinics |
| `PAYMENT_ACCOUNT_NAME` | Account name shown with each of them |

`APP_KEY` also encrypts two-factor secrets and recovery codes and patient health details. If it is replaced, those can no longer be read, so back it up and do not rotate it casually.
