# THE GIFT ZONE — Full-stack gifting e-commerce starter

**Theme:** `#8B004E` · `#E91584` · `#FF6BB1` · `#FFBBD9` · `#FFE4F1` · `#6B8E23` · `#2D4D1E`

An original, responsive gifting-commerce starter inspired by the user-provided Presto Gifts interface references, **not** Presto's copyrighted code, product descriptions, logos or photography. All 200 included product thumbnails are original vector placeholders; replace them in the admin panel with product photos you own or are authorized to use.

## Folder structure

```text
the gift zone/
├── frontend/         # React 19 + Vite customer storefront
├── backend/          # Express, Prisma, PostgreSQL, secured REST APIs
├── admin panel/      # React admin UI (separate Vite app)
├── scripts/          # Original sample image generation
├── .env.example      # Credentials template
└── README.md
```

## Quick start (macOS / Windows / Linux)

Requirements: **Node.js 20+**, npm, and internet access to install packages. Open a terminal at the root `the gift zone` folder.

1. Install packages:

   ```bash
   npm install
   ```

2. Create the backend environment:

   **Mac / Linux:**
   ```bash
   cp .env.example backend/.env
   ```

   **Windows PowerShell:**
   ```powershell
   Copy-Item .env.example backend/.env
   ```

   Edit `backend/.env` and set a **new random JWT_SECRET of at least 32 characters**, a real `ADMIN_EMAIL` and a long unique `ADMIN_PASSWORD`. The example password is **intentionally not accepted** by the seed script.

3. Set `DATABASE_URL` to your private Neon PostgreSQL URL, then generate the database client, create tables and seed starter content (for a new database):

   ```bash
   npm run db:generate -w backend
   npm run db:push
   npm run db:seed
   ```

4. Run the frontend, backend and admin panel together:

   ```bash
   npm run dev
   ```

   - **Customer storefront:** http://localhost:5173
   - **Backend API:** http://localhost:4000/api/health
   - **Admin panel:** http://localhost:5174

5. Admin login: use the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in `backend/.env`.

## What's included

### Storefront

- Responsive pink/hibiscus + olive branding and restrained glassmorphism
- Slidable side navigation, product search, promotional banners, large collections section, featured products, wishlist, basket, and checkout
- **20 product categories × exactly 10 sample products = 200 products**, each with its own original SVG illustration
- Filter, price sort, search, pagination, category and product detail pages
- Personalized product text and image upload (images can be supplied by signed-in customers)
- Product variants, gift extras, delivery pincode input, greeting notes, product reviews
- Phone OTP signup/login, Google sign-in, Facebook login, account details, addresses, order history, loyalty wallet, referral links and reminders
- Bulk order form, gift finder, tracking, promotional coupons, support and franchise inquiry
- Razorpay integration hooks and working local Cash on Delivery order flow

### Backend

- Express REST API with Prisma + PostgreSQL persistence (Neon)
- Session cookies signed with JWT (httpOnly), protected admin endpoints and two roles: ADMIN and STAFF
- Stock management, server-authoritative order pricing, coupons, wallet redemption and reward earning after delivery
- Admin order status transitions, tracking ID and courier management, review moderation, ticket and bulk-lead status
- Neon keeps data across restarts. Run `npm run db:seed` again only to create missing starter records; existing product/category edits and passwords are preserved.

### Admin panel

- Sales KPIs, revenue chart, orders, leads and customers
- Full catalog management: add/edit/archive products, SKU, pricing, stock, gallery, categories, product personalization, variants and add-ons
- Category, homepage banner, and promotional coupon management
- Order processing, courier details and tracking updates, customers, wallet adjustments, support, bulk enquiries, reviews, and store settings
- Image uploads and a responsive mobile-friendly interface

## Authentication setup

- **Phone OTP:** Configure `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER` for the SMS API. In local development, if Twilio is not configured, the 6-digit OTP is printed only to the **backend terminal** (not exposed to the browser). Production returns an error when SMS is not configured.
- **Google OAuth:** Create web OAuth credentials and configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; register the authorized redirect URI `http://localhost:4000/api/auth/google/callback`.
- **Facebook Login:** Create a Meta application, configure `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`; register `http://localhost:4000/api/auth/facebook/callback`. Check Meta's current privacy, app review and supported permissions requirements before launch.
- **Admin login:** Uses a secure stored password hash. No weak default user is created automatically.
- The production authentication cookie uses `Secure`; run over HTTPS and prefer the same-site reverse proxy for the frontend and API.

## Payments and orders

- **Cash on Delivery:** Implemented end to end for local testing; server validates stock, calculates prices, applies discounts and creates persistent orders.
- **Razorpay:** Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, then test the complete authorization and payment verification in Razorpay test mode. A proper production integration should additionally verify provider webhooks for payment status reconciliation, handle refunds, and observe the provider's fulfillment requirements.
- Stock, wallet credit and coupon usage are controlled on the server; never rely on client-submitted product prices.

## Changes after setup

- Change product content, pricing and pictures from `http://localhost:5174/products`.
- Change homepage banners, collection categories and offer coupons from the dedicated admin tabs.
- Settings controls shipping threshold, flat delivery charge, loyalty earning percentage, redemption cap, help contacts and announcement.
- Upload your own product images from the product editor. Accepted formats: JPEG, PNG, WEBP up to 5 MB.
- Additional categories/products created by admins are database records, not tied to seed JSON.

## Build and tests

```bash
npm run test -w backend       # Catalog integrity tests
npm run build                 # Production frontend/admin static bundles
```

For hosting setup, private environment variables, and the single-domain production build, follow [DEPLOYMENT.md](./DEPLOYMENT.md). The app uses Neon PostgreSQL. Uploads require persistent storage; multiple backend instances additionally require shared storage and shared rate limiting. Keep database backups and test the final HTTPS deployment before accepting orders.

## What is NOT included or ready for production

- Live credentials, Twilio SMS costs, Google/Facebook approval, payment-provider account, courier contract, carrier delivery estimates, tax and invoice integration
- Real Presto product inventory, proprietary photos, prices, copyrighted artwork or exact private functions
- Reviewed legal terms, refunds/shipping rules, privacy policy, email notifications, live customer support team and actual WhatsApp number
- Automated courier label generation, inventory across physical warehouses, enterprise-scale analytics, payment webhook reconciliation, production deployment, or independent production security audit

**Replace demo policies with reviewed policies and test all third-party integrations before accepting real orders.**
