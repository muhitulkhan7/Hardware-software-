# HardwareHub demo deployment

This demo is packaged as a single Next.js container with a persistent SQLite
volume. It is suitable for a VPS, Railway volume, Fly.io volume, or local
Docker Desktop.

## Local demo container

1. Copy `.env.demo.example` to `.env.demo`.
2. Set `SESSION_SECRET` to a long random value.
3. Start the demo:

```sh
docker compose -f docker-compose.demo.yml up --build -d
```

4. Open `http://localhost:3000`.
5. Check readiness at `http://localhost:3000/api/health`.

The SQLite database is stored in the named `hardwarehub-demo-data` volume.
Do not remove that volume when updating the container or the demo data will be
lost.

## Demo accounts

- Admin: `admin@hardwarehub.local` / `DemoAdmin-2026`
- Sales: `cashier@hardwarehub.local` / `DemoCashier-2026`

The Sales account is intentionally limited to Point of Sale, Inventory, and
Sales History. Change or replace these credentials before exposing the demo
outside a controlled review.

## Hosted demo checklist

- Use a persistent volume mounted at `/app/data`.
- Set a unique `SESSION_SECRET` in the host's secret manager.
- Set `APP_URL` to the public HTTPS URL.
- Put the container behind HTTPS before testing camera scanning.
- Keep `DEMO_RESET_ENABLED=false` unless a protected reset workflow is added.
- Back up `/app/data/hardware-store.db` regularly.
