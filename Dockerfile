# syntax=docker/dockerfile:1.7

# ─── Base image with pnpm ─────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
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
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
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
# The generated Prisma client (engine binaries) — standalone tracing usually
# already includes these, but copy explicitly to be safe.
COPY --from=build /repo/node_modules/.pnpm/@prisma+client*/node_modules/.prisma /app/node_modules/.prisma

# Entrypoint runs migrations then starts the server
COPY deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 3000
CMD ["/usr/local/bin/entrypoint.sh"]
