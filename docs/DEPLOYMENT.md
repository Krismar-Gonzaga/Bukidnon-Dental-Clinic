# Deployment

A checklist for putting the system on real servers. Nothing here has been deployed or tested in production yet: treat it as the plan and verify each step.

## Shape

```
 Browser ──HTTPS──► web (static files: web/build)
    │
    └──HTTPS──► api.example.ph (Laravel: PHP-FPM + Nginx/Apache) ──TLS──► Supabase PostgreSQL
Mobile app ──HTTPS──┘          │
                               ├── queue worker (php artisan queue:work)
                               └── scheduler (cron: php artisan schedule:run)
```

Put the web app and the API on the **same parent domain** (e.g. `portal.example.ph` and `api.example.ph`) so the session cookie can be shared with `SESSION_DOMAIN=.example.ph`. The example domains are placeholders.

## 1. Database (Supabase)

- Use a **separate Supabase project for production**. Don't share it with development.
- Use a strong database password stored only in the API server's environment.
- Connect through the pooler (`DB_PORT=6543`, transaction mode) or the direct port 5432. Set `DB_SSLMODE=require` (or `verify-full` with the Supabase CA certificate).
- Turn on Supabase backups (point-in-time recovery if the plan allows it) and test a restore.
- Run migrations from the API server: `php artisan migrate --force`. Review new migrations before each release, since they must stay additive (see [DATABASE.md](DATABASE.md)).

## 2. API (`backend/`)

Server: PHP 8.2+ with `pdo_pgsql`, `fileinfo`, `openssl`, `mbstring`; Composer; Nginx or Apache pointing at `backend/public`.

```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate --force      # first deploy only; keep the key stable afterwards
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan event:cache
php artisan storage:link              # not needed for private documents; harmless
```

Production `.env` (values are examples):

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.ph
FRONTEND_URL=https://portal.example.ph
CORS_ALLOWED_ORIGINS=https://portal.example.ph
SANCTUM_STATEFUL_DOMAINS=portal.example.ph
SESSION_DOMAIN=.example.ph
SESSION_SECURE_COOKIE=true
SESSION_DRIVER=database
QUEUE_CONNECTION=database
LOG_LEVEL=warning
BUSINESS_TIMEZONE=Asia/Manila
DB_SSLMODE=require
```

- `storage/` and `bootstrap/cache/` must be writable by the web server user. `storage/app/private` holds verification documents. **Back it up**, or move the `local` disk to private object storage (S3-compatible) before running more than one server.
- Run a queue worker under a process manager (systemd or Supervisor): `php artisan queue:work --tries=3 --max-time=3600`.
- Add the scheduler to cron: `* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1`.
- Create the first administrator on the server: `php artisan app:create-system-admin you@example.ph`.
- Redirect HTTP to HTTPS at the web server.

### Email

Set `MAIL_MAILER=smtp` (or a provider's driver) with `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`. Use a sending domain with SPF, DKIM and DMARC. Then **test**: request a password reset and book a test appointment, and confirm the messages arrive. Until that is done, don't tell users they will get email reminders.

## 3. Web app (`web/`)

```bash
cd web
npm ci
REACT_APP_API_URL=https://api.example.ph/api REACT_APP_GOOGLE_MAPS_EMBED_KEY=... npm run build
```

Serve `web/build` as static files over HTTPS with a single-page-app fallback (all unknown paths → `index.html`). Build variables are baked in at build time: rebuild to change them.

Recommended headers on the web host: `Content-Security-Policy` (allow `connect-src` to the API origin and `frame-src https://www.google.com` for maps), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and HSTS.

## 4. Mobile app (`mobile/`)

- Set `expo.extra.apiUrl` in `app.json` (or an `app.config.js` per build profile) to `https://api.example.ph/api`. Release builds must use HTTPS.
- Build with EAS (`eas build -p android`). Let EAS manage the release signing key, or keep the keystore outside the repository. Never commit it.
- Update the app name, icons and store listing, and add the privacy policy URL the stores require.

## 5. Before going live

- [ ] Supabase password rotated (see [SECURITY.md](SECURITY.md#open-action-items)) and production uses its own project
- [ ] `APP_DEBUG=false`, new `APP_KEY`, HTTPS everywhere, `SESSION_SECURE_COOKIE=true`
- [ ] CORS and Sanctum domains list only the production web origin
- [ ] Queue worker and scheduler running; a test reminder delivered
- [ ] Email delivery tested end to end
- [ ] Google Maps key restricted by referrer and API
- [ ] Database and document backups configured and a restore tested
- [ ] Privacy policy and terms reviewed by counsel and published
- [ ] First system admin created; test clinic approved end to end; cross-clinic access spot-checked
- [ ] `php artisan test`, `npm test` (web) and `npx jest` (mobile) pass on the release commit

## Updating

```bash
git pull
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache && php artisan route:cache
php artisan queue:restart
```

Rebuild and upload `web/build` after web changes. Release a new mobile build after mobile changes. Keep the API backward compatible for one release, because phones update late.
