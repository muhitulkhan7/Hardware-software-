#!/bin/sh
set -eu

npx drizzle-kit push --force
npx tsx src/server/db/seed.ts
exec node server.js
