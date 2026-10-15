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
| Expo Go | Matching Expo SDK 57 | Mobile on a phone (optional) |

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

The scheduler sends appointment reminders and inventory alerts. The queue sends notification emails. Run both in separate terminals while you develop:

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

The app needs to know where the API is. The address depends on where the app runs:

| Running on | API address | How |
|---|---|---|
| Android emulator | `http://10.0.2.2:8000/api` | Default. `10.0.2.2` is the host computer. |
| iOS simulator | `http://127.0.0.1:8000/api` | Default. |
| Physical phone (Expo Go or a build) | `http://<computer LAN IP>:8000/api` | Set `expo.extra.apiUrl` in `mobile/app.json`, then start the API with `php artisan serve --host=0.0.0.0 --port=8000`. Phone and computer must be on the same Wi-Fi. |

`expo.extra.apiUrl` in `app.json` overrides the defaults on **every** platform. Clear it (or set it to the right address) when you switch between an emulator and a phone. It currently holds a LAN address from one developer's network.

On Windows, allow PHP through the firewall on private networks, or the phone cannot reach port 8000.

```bash
npx tsc --noEmit -p .
npx jest --ci
```

The mobile app is the **patient** app. Clinic owners, staff, dentists and system administrators who sign in on mobile see a notice that sends them to the web portal.

## Email

With `MAIL_MAILER=log`, nothing is delivered. Messages (including password-reset links) appear in `backend/storage/logs/laravel.log`. To send real email, set the `MAIL_*` SMTP values for a provider and test delivery before relying on it. See [DEPLOYMENT.md](DEPLOYMENT.md#email).

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Web login returns **419** | CSRF cookie not set. Web and API host names don't match (`localhost` vs `127.0.0.1`), or `SANCTUM_STATEFUL_DOMAINS` doesn't list the web origin. |
| Browser shows a **CORS** error | The web origin is missing from `CORS_ALLOWED_ORIGINS`. Restart `php artisan serve` after editing `.env`. |
| Mobile shows "You're offline" on a phone | `extra.apiUrl` isn't set to the computer's LAN IP, the API isn't bound to `0.0.0.0`, or the firewall blocks port 8000. |
| Requests take 1–3 seconds | Normal against a remote Supabase pooler from a local machine. |
| `could not find driver` | Enable `pdo_pgsql` in `php.ini`. |
