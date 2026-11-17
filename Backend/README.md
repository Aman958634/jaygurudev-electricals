# Jay Gurudevv Electricals Backend

Node.js + Express ES-module API backed by MySQL (`mysql2/promise`), integrated with the existing React/Vite public site and its separate `/admin` content-management console.

## Requirements

- Node.js 20+
- XAMPP MySQL/MariaDB

## Local setup

From a PowerShell terminal:

```powershell
Set-Location C:\Users\AMAN\Downloads\JayGuruDev\Backend
npm install
Copy-Item .env.example .env
```

Edit `.env` before first setup:

- Set `JWT_SECRET` to a unique random value of at least 32 characters.
- Set a unique `ADMIN_PASSWORD` of at least 12 characters.
- Match `DB_PORT` to XAMPP's MySQL port. The template uses requested default `3306`; this workspace's XAMPP instance is configured on `3307`.
- Keep `.env` private; it is excluded by `.gitignore`.

Initialize the schema and create an initial super-admin:

```powershell
npm run init-db
npm run seed-admin
npm run seed-frontend-content
npm start
```

`seed-admin` creates the super-admin if the configured email is new, or updates the matching account's email and bcrypt password hash if it already exists. Email is normalized to lowercase, the account is activated, and no duplicate is created. The password must be 12–128 characters; keep it only in the ignored local `.env`. Re-running this command resets that account's password to the current `ADMIN_PASSWORD` value. `seed-frontend-content` imports the existing frontend catalog and page content and copies its images into `Backend/uploads/`; it is safe to rerun and does not overwrite existing records or files. Use `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the private local `.env` to log in. Passwords can also be rotated via `POST /api/admin/change-password`.

Development mode:

```powershell
npm run dev
```

Check whether the expected backend port is occupied and identify its owning process:

```powershell
npm run backend:status
```

If the process marker and process identity verify that the listener is this project's backend, stop only that PID with:

```powershell
npm run backend:stop
```

The stop command refuses to terminate an unverified or unrelated process. If the backend is already running, reuse it rather than starting a second instance. Startup reports an occupied port clearly and exits without an unhandled error stack.

The API defaults to `http://localhost:5000/api`. The existing frontend runs at `http://localhost:5173`, which is the default allowed browser origin. Set `CLIENT_ORIGIN` to a comma-separated allowlist if using another origin.

The frontend reads its public API base URL from `frontend/.env` as `VITE_API_BASE_URL`; copy `frontend/.env.example` to that file and use `http://localhost:5000/api` for local development. This variable contains no credentials.

Run the frontend from a second PowerShell terminal:

```powershell
Set-Location C:\Users\AMAN\Downloads\JayGuruDev\frontend
npm install
npm run dev
```

Open the public website at `http://localhost:5173` and the protected admin panel at `http://localhost:5173/admin`. Sign in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from the private backend `.env` after the initial `npm run seed-admin`. No admin credentials or JWT secrets are configured in the frontend.

## Validation

```powershell
npm run lint
npm test
npm audit
```

`npm test` includes unit tests and the live MySQL/HTTP integration test. The integration test requires an initialized MySQL schema, starts a temporary local API process, exercises the public and protected endpoints (including CRUD and image delivery), then removes its temporary records/files. Run only the live API test with `npm run test:integration`.

The admin supports product, category, brand, gallery, banner, page, business settings, and enquiry management. Enquiry removal is confirmation-gated in the UI and audited. Uploaded images are checked by both declared media type and file signature.

## Documentation

- [API documentation](./docs/API_DOCUMENTATION.md)
- [Frontend audit and compatibility notes](./docs/FRONTEND_AUDIT.md)
- [Implementation and verification audit](./docs/IMPLEMENTATION_AUDIT.md)

The React/Vite frontend now loads products, categories, brands, gallery items, banners, pages, business settings, and homepage statistics from the API. Wholesale submissions are stored through `POST /api/enquiries` and continue to open the existing WhatsApp enquiry flow. If the API is unavailable, the affected data sections display retryable errors rather than silently presenting the old static catalog.
