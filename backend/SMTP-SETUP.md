# Admin password reset email

Only an existing database account with role `ADMIN` and email matching `ADMIN_EMAIL` may receive or use a reset link. Other admins, staff and customers are excluded. Unknown addresses still receive the generic response when SMTP is available. Merely setting an address in the environment does not create an account or grant administrator access.

`SMTP_USER` is the sending account, not the reset recipient. It may differ from `ADMIN_EMAIL`. Keep `ADMIN_EMAIL` aligned with the existing database administrator; changing an administrator's login email requires an explicit account update, not just an environment edit. Restart after changing `ADMIN_EMAIL`.

The API logs `configuration_error` when `ADMIN_EMAIL` does not match an existing ADMIN, `ineligible_request` when the submitted address is not allowed, `smtp_accepted` when SMTP accepts the message, and `delivery_failed` with only a safe error code. These events never contain tokens, passwords, reset URLs or provider response text. SMTP acceptance is not proof of inbox delivery. Existing terminal-only logs are not persisted by the application.

Run `npm run reset:check -w backend` to verify the registered ADMIN and SMTP connection without sending. Run `npm run reset:check -w backend -- --send` only when you intend to send one reset email to the configured administrator. The send check launches a temporary backend, verifies unknown-address behavior and actual SMTP acceptance, and leaves the emailed 15-minute link usable. It invalidates earlier reset links as any new reset request does, but does not change the admin account or password.

For this local Gmail setup, the host, port, sender and username have been filled in. The remaining secret is `SMTP_PASSWORD`: enter a Google App Password for the configured sender directly in the backend `.env` file. See [Google's App Password instructions](https://support.google.com/accounts/answer/185833). Do not use `ADMIN_PASSWORD` as the SMTP password.

Email delivery requires a real SMTP account. Set these values in the backend-only `.env` file; never commit credentials or put them in `VITE_*` variables:

```dotenv
SMTP_HOST=your-provider-smtp-host
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-provider-smtp-password
SMTP_FROM="The Gift Zone <your-authorized-sender-address>"
```

Use the port and TLS mode supplied by your provider (implicit TLS commonly uses port 465 with `SMTP_SECURE=true`). Use a provider-issued SMTP password or app password when required, not the administrator login password. If your SMTP username is not an email address, set `SMTP_FROM` explicitly to an authorized sender address.

From the project root, run `npm run smtp:check -w backend`. This checks connection and authentication without sending mail, and does not log credentials. In development (`NODE_ENV=development`), changes to SMTP settings in the backend `.env` file are read on the next request without restarting. Production uses the injected environment and requires a restart after configuration changes. Then request a link through the admin panel and check the recipient inbox and spam folder. SMTP verification does not guarantee inbox delivery; check the provider's delivery logs if necessary. The check command distinguishes missing settings, rejected authentication, and connection failures without printing secrets.

Set `ADMIN_URL` to the address recipients can reach. The localhost default only works on the computer hosting the admin panel.

Missing configuration or unavailable SMTP returns the same safe service-unavailable response for every email address. With a healthy service, registered and unknown addresses receive the same generic success message to protect account privacy. Recipient-specific delivery failures remain generic to avoid exposing registered accounts.
