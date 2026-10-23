# HardwareHub Inventory & POS

HardwareHub is a mobile-first Next.js prototype for a hardware store. It
includes role-based login, inventory, receiving, point of sale, sales history,
returns, and admin reporting. The demo uses BDT and SQLite.

## Requirements

- Node.js 22 or newer
- npm

## Run locally

Install dependencies, create the local schema, seed the demo data, and start
the development server:

```bash
npm ci
copy .env.example .env.local
npm run db:push
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The database is created at `data/hardware-store.db`. That directory is local
runtime data and is intentionally ignored by Git.

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@hardwarehub.local` | `DemoAdmin-2026` |
| Sales | `cashier@hardwarehub.local` | `DemoCashier-2026` |

The Sales account can use Point of Sale, Inventory, and Sales History. Admin
accounts can also access Reports and Settings.

## Validation commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Production and demo deployment

The application needs a server runtime and persistent storage; it is not
suitable for GitHub Pages. A Docker deployment with a persistent SQLite volume
is documented in [DEMO-DEPLOYMENT.md](./DEMO-DEPLOYMENT.md).

Before exposing a deployment:

- Set a unique `SESSION_SECRET` with at least 32 characters.
- Set `APP_URL` to the public HTTPS URL.
- Mount persistent storage at `/app/data`.
- Replace the demo credentials.

## Project structure

- `src/app` - Next.js routes, screens, and API handlers
- `src/components` - presentational UI components
- `src/server/services` - validated transactional business logic
- `src/server/db` - Drizzle schema, client, and demo seed
- `src/schemas` - Zod request validation
- `tests` - unit tests
- `drizzle` - committed SQLite migrations

Business rules stay on the server. Money is stored as integer minor units,
completed transactions are append-only, and mutation endpoints validate input
before executing database transactions.
