#!/bin/sh
set -e

# Run Prisma migrations (no-op if already applied)
echo "→ running prisma migrate deploy"
cd /app/packages/db
npx --yes prisma@5.22.0 migrate deploy --schema=./prisma/schema.prisma || {
  echo "⚠ prisma migrate failed — attempting db push as fallback (first boot)"
  npx --yes prisma@5.22.0 db push --schema=./prisma/schema.prisma --accept-data-loss=false || true
}

cd /app
echo "→ starting Next.js"
exec node apps/web/server.js
