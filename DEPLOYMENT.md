# Deploy The Gift Zone

## Keep passwords private

Commit source code and `.env.example` only. Never upload `backend/.env`, database
files/backups, private keys, or `uploads/` to GitHub. These are excluded by
`.gitignore`. On the hosting service, enter real values in its private environment
settings. `VITE_*` values are public browser configuration and must never contain
database, email, payment, admin, or JWT secrets.

The database URL shared during development contains a password. Rotate that
password in Neon before public launch, then update both the hosting environment
and your local `backend/.env`. Do not put the new password in this document.

## One web service, one HTTPS domain

The production build can serve all three apps from the Express backend:

- `/` — storefront
- `/admin/` — administrator login and dashboard
- `/api/` — API, with `/api/health` for health checks
- `/uploads/` — uploaded images on persistent storage

Use a Node web service with a persistent disk. The project root is the repository
root; do not set it to `backend` because the build also needs both frontend apps.

Build command:

```sh
npm ci --include=dev
npm run build:deploy
```

Start command:

```sh
npm start
```

The host supplies `PORT`. Configure a health check at `/api/health`. Keep one
backend instance unless uploads are moved to shared storage and rate limiting is
configured with a shared store. The current limit counters are per process.

## Hosting environment

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `SERVE_WEB` | `true` |
| `DATABASE_URL` | Your private Neon PostgreSQL connection URL with SSL |
| `JWT_SECRET` | A private random string of at least 32 characters |
| `FRONTEND_URL` | Your exact HTTPS origin, such as `https://gifts.example.com` |
| `ADMIN_URL` | The same origin followed by `/admin` |
| `PUBLIC_API_URL` | Your HTTPS origin without a trailing slash |
| `TRUST_PROXY` | Number of trusted proxy hops; use the value required by your host, not a guess |
| `UPLOAD_DIR` | Absolute path to the mounted persistent disk |
| `ADMIN_EMAIL` | Existing administrator email; also used for password reset eligibility |
| `ADMIN_PASSWORD` | Initial password used only by manual seeding; remove after setup |

`ADMIN_URL` includes the admin path for reset links. CORS uses the origins of the
frontend/admin URLs. Session cookies are HTTP-only and secure in production. This
single-origin deployment uses the existing `SameSite=Lax` cookies; no cross-site
cookie configuration is needed. Browser API requests use relative `/api` URLs.

Generate a JWT secret locally with:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy the result directly into the host's private environment settings. Changing
`JWT_SECRET` signs everyone out. Changing `ADMIN_PASSWORD` does **not** reset an
existing password; use the admin password-reset flow.

## Database and admin setup

The current Neon database has already been synchronized. Do not run seeding or
schema changes automatically on each server start. For a new database, review the
schema changes and then run these commands once with that database's environment:

```sh
npm run db:push
npm run db:seed
```

Do not use Prisma's `--accept-data-loss` or `--force-reset` flags on live data.
The seed keeps existing product edits and passwords, creates missing demo catalog
records, and initializes the configured administrator when needed. Use reviewed,
versioned migrations and database backups for subsequent production schema changes.

## Email, SMS, OAuth and payments

- Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, and
  optionally `SMTP_FROM` for admin reset emails. Test using `npm run smtp:check -w backend`.
- Phone login currently sends SMS using `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  and `TWILIO_PHONE_NUMBER`. Production will not print OTPs instead of sending them.
- Google and Facebook require their private credentials and provider callback
  URLs at `https://YOUR_DOMAIN/api/auth/google/callback` and
  `https://YOUR_DOMAIN/api/auth/facebook/callback`.
- Configure Razorpay credentials only when ready to test payments. Payment webhook
  reconciliation and real refunds still need implementation before live payments.

## Check after deploying

1. Confirm `/api/health` reports a connected database.
2. Sign in at `/admin/`, reload a nested page such as `/admin/orders`, and sign out.
3. Verify storefront catalog, images, and product-detail links.
4. Upload an image and verify it survives a service restart.
5. Test password-reset email, SMS, and any enabled OAuth provider.
6. Complete a test order and verify stock, payment status, and order history.

Local tests and builds do not verify hosting, DNS, real email/SMS delivery or live
payments. Complete these checks on the final HTTPS domain before accepting orders.
