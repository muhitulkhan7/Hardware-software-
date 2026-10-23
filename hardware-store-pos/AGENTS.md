# Hardware Store Inventory & POS

Mobile-first Next.js prototype for a hardware store inventory and POS system.

## Commands

- `npm run dev` - start the development server
- `npm run build` - create a production build
- `npm run lint` - run ESLint
- `npm run typecheck` - run the strict TypeScript check
- `npm run test` - run unit tests
- `npm run db:push` - apply the Drizzle schema to SQLite
- `npm run seed` - insert local demo data

The current project includes SQLite/Drizzle persistence, session auth, server
services, Vitest tests, and a Docker demo deployment.

## Hard rules

- Business logic belongs in `src/server/services`; components must not calculate
  pricing, tax, stock, or status.
- Every mutation must validate with Zod and execute in one database transaction.
- Money is integer minor units and must be formatted through `formatMoney()`.
- Never edit a sale, sale item, stock movement, or return after creation.
- Every server action checks the session and role before doing work.
- Do not commit secrets or demo credentials outside the seed script.
- Services return typed `{ ok: true, data } | { ok: false, code, message }` results.
- Reference rule IDs such as `INV-2`, `PAY-3`, and `TXN-1` in tests and commits.

## Conventions

- TypeScript strict mode; do not use `any`.
- Keep the UI mobile-first at approximately 390px wide.
- Use touch targets of at least 44px for primary controls.
- Add loading, error, and empty states to every data screen.
- Keep components presentational; reuse service and shared-library logic.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
