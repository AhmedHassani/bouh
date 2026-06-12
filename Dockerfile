# syntax=docker/dockerfile:1.7

# ─── Base image with pnpm ─────────────────────────────────────────────────────
# Use Debian slim everywhere (build + runner) so Prisma's "native" engine is
# debian-openssl-3.0.x in both stages — no musl mismatch.
FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ─── Install deps (cached layer) ──────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json            apps/web/package.json
COPY packages/api/package.json        packages/api/package.json
COPY packages/db/package.json         packages/db/package.json
COPY packages/ui/package.json         packages/ui/package.json
COPY packages/validators/package.json packages/validators/package.json
RUN pnpm install --frozen-lockfile

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules            ./apps/web/node_modules
COPY --from=deps /repo/packages/api/node_modules        ./packages/api/node_modules
COPY --from=deps /repo/packages/db/node_modules         ./packages/db/node_modules
COPY --from=deps /repo/packages/ui/node_modules         ./packages/ui/node_modules
COPY --from=deps /repo/packages/validators/node_modules ./packages/validators/node_modules
COPY . .

# Generate Prisma client, then build web
RUN pnpm --filter @repo/db exec prisma generate
RUN pnpm --filter web build

# ─── Runner ───────────────────────────────────────────────────────────────────
# Use Debian slim (not Alpine) — Prisma's default engine targets debian-openssl,
# which avoids the "linux-musl-openssl-3.0.x engine not found" issue.
FROM node:20-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Next standalone output (monorepo-aware)
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public

# Prisma schema (for `prisma migrate deploy` at startup)
COPY --from=build /repo/packages/db/prisma ./packages/db/prisma

# Next.js standalone tracing already copies @prisma/client + its engine into
# /app/node_modules/.pnpm/@prisma+client*/. No extra COPY needed.

# Entrypoint runs migrations then starts the server
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
CMD ["/usr/local/bin/entrypoint.sh"]
