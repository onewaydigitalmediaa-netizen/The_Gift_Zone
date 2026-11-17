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
| `ADMIN_URL` | The exact admin browser origin; use the same origin as the storefront for a same-origin setup |
| `ADMIN_APP_PATH` | `/admin` when the admin is mounted under the storefront domain; blank when the admin has its own Vercel domain |
| `PUBLIC_API_URL` | Your HTTPS origin without a trailing slash |
| `TRUST_PROXY` | Number of trusted proxy hops; use the value required by your host, not a guess |
| `COOKIE_DOMAIN` | Optional shared parent domain such as `.gifts.example.com` when storefront, admin, and API use sibling subdomains |
| `UPLOAD_DIR` | Absolute path to the mounted persistent disk |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read-write token for direct uploads |
| `ADMIN_EMAIL` | Existing administrator email; also used for password reset eligibility |
| `ADMIN_PASSWORD` | Initial password used only by manual seeding; remove after setup |

`ADMIN_APP_PATH` is appended to reset links. CORS uses the origins of the
frontend/admin URLs. Session cookies are HTTP-only and secure in production. This
single-origin deployment uses the existing `SameSite=Lax` cookies; no cross-site
cookie configuration is needed. Browser API requests use relative `/api` URLs.
If you deploy the three Vercel projects on sibling custom subdomains, set
`COOKIE_DOMAIN` to their shared parent domain so the HTTP-only session and OAuth
state cookies are available on all three hosts. Vercel preview domains do not
share a cookie domain; test preview login independently or use one same-origin
custom domain.

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

## Three Vercel projects

Connect the repository to three Vercel projects. Keep each project's Root
Directory at the repository root so npm workspaces and shared configuration are
available.

| Project | Root Directory | Build Command | Output Directory |
| --- | --- | --- | --- |
| Backend API | `backend` | `npm run build` | leave blank |
| Storefront | `frontend` | `npm run build` | `dist` |
| Admin | `admin panel` | `npm run build` | `dist` |

For all three projects use install command `cd .. && npm ci --include=dev`.
Set the backend Framework Preset to **Express**. Vercel detects the exported
Express app in `backend/src/server.js`; there is no long-running start command.
The Vite projects use their `vercel.ts` files for SPA deep links and `/api` and
`/uploads` rewrites.

Set `API_ORIGIN` on the storefront and admin projects to the deployed backend
URL. Keep `VITE_API_URL` empty so browser requests use same-origin `/api`
rewrites. Set `VITE_STORE_URL` to the storefront origin in the admin project.
For a separate admin Vercel domain, leave `VITE_ADMIN_BASE_PATH` unset (the
default is `/`). If you mount admin under the storefront domain at `/admin/`, set
`VITE_ADMIN_BASE_PATH=/admin/` and `ADMIN_APP_PATH=/admin`.

Backend production variables: `NODE_ENV=production`, `FRONTEND_URL` equal to the
storefront origin, `ADMIN_URL` equal to the admin origin,
`ADMIN_APP_PATH` matching the admin deployment path, `PUBLIC_API_URL` equal to the backend origin,
`TRUST_PROXY=1`, `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`,
`ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN`, `BLOB_PUBLIC_READ_WRITE_TOKEN`, and any enabled SMTP, Twilio, OAuth,
or Razorpay variables. Configure Preview values separately; use a separate Neon
preview database if preview schema changes are expected.

Create a **private** Vercel Blob store for customer images. The API issues
short-lived, user-scoped upload tokens. Customer images are served through
`/uploads/private/*` only after the session owner or an admin is checked. Product
and banner uploads require an admin session and use the public Blob access mode
when `BLOB_PUBLIC_READ_WRITE_TOKEN` is configured. Configure a separate public
Blob store for catalog/banner media and a private store for customer images;
never expose a Blob token as a `VITE_*` variable.

Direct browser uploads avoid sending 5 MB images through a Vercel Function.
Existing local disk uploads are not automatically copied to Blob; migrate any
images that must remain available after deployment with a reviewed script.
