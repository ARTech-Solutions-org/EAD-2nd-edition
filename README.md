# Egypt Arbitration Days 2026 Check-in

A bilingual, responsive attendee-registration and staff check-in system for Egypt Arbitration Days 2026. The project includes the public registration desk, secured staff workspace, registration database schema/migrations, reusable badge and lanyard previews, and print workflows. User-supplied and official EAD artwork is bundled under `client/public/assets/` so local previews do not depend on Manus project storage.

## Requirements

- Node.js 20 or newer
- pnpm 10 (`corepack enable` can enable the package manager shipped with Node)
- MySQL 8-compatible database for persistent registration and staff operations

## Local setup (Windows, macOS, or Linux)

1. Copy `.env.example` to `.env` and replace the placeholders. `DATABASE_URL` must point to a MySQL database you control. For the staff sign-in flow, configure the Manus project ID, OAuth endpoint, JWT secret, and authorized owner ID. Never commit or share `.env`.
2. Install the locked dependency set: `pnpm install --frozen-lockfile`.
3. Apply the checked-in schema migrations: `pnpm db:migrate`.
4. Start the full application: `pnpm dev`, then open `http://localhost:3000` (or the port set in `.env`).

The public page and `/api/health` can start without external credentials, but registration, staff data, and staff authentication require the MySQL and OAuth values described above. No live credentials are included in this project copy. Before the staff area is used, an authorized owner must grant `admin` to at least one trusted account in the `users` table through a trusted provisioning path; the application intentionally has no public self-promotion workflow.

## Useful commands

- `pnpm dev`: full Express/tRPC application with Vite HMR; honors `PORT`.
- `pnpm dev:static`: standalone Vite preview; honors `PORT` and defaults to 3000.
- `pnpm db:migrate`: apply checked-in migrations to `DATABASE_URL`.
- `pnpm db:push`: generate and apply migrations after a schema change.
- `pnpm check`: TypeScript validation.
- `pnpm test`: unit tests.
- `pnpm build`: production client and server build.
- `pnpm start`: serve the production build; honors `PORT`.

## Included project structure

- `client/src/pages/`: public registration and staff workspace.
- `client/src/components/`: shared brand, badge, and UI components.
- `client/public/assets/`: supplied badge reference, front/back artwork, lanyard, EAD wordmark and monogram.
- `client/public/manus-routes.json`: platform page-route manifest.
- `server/`: Express, authentication, tRPC procedures, storage helpers, and database queries.
- `shared/`: registration types and validation schemas.
- `drizzle/`: schema and checked-in SQL migrations.
- `app.config.ts`, `Dockerfile`, and Vite/TypeScript configuration: platform and build settings.

## Security and data

Staff routes and registration-management procedures require an authenticated administrator. Do not expose attendee data publicly. Use a database for persistent registrations; do not store credentials in source control. Public print status is recorded only after a user confirms that the physical badge printed successfully, because browsers report when a print dialog closes but cannot tell whether the user cancelled it.
