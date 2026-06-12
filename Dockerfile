# Stage 1: Prune the monorepo
FROM node:20-alpine AS pruner
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm
COPY . .
# Run turbo prune to generate the pruned version of the monorepo for the web app
RUN npx turbo prune --scope=web --docker

# Stage 2: Install dependencies
FROM node:20-alpine AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm

# First copy the pruned package.json and lock files
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml

# Install dependencies (including packages/db, packages/api etc. dependencies)
RUN pnpm install --frozen-lockfile

# Stage 3: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g pnpm

# Copy installer's node_modules and pruned source code
COPY --from=installer /app .
COPY --from=pruner /app/out/full/ .

# Generate Prisma Client
# We attempt to run the generate script via turbo, or run prisma generate directly inside packages/db
RUN pnpm run generate || (cd packages/db && npx prisma generate)

# Build the Next.js app using turbo
ENV NEXT_TELEMETRY_DISABLED 1
RUN pnpm run build --filter=web

# Stage 4: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Next.js standalone output copies only the necessary files for the app
# In next.config.js, you must set: output: 'standalone'
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy database schema, migrations and prisma binaries for production migrations
COPY --from=builder --chown=nextjs:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Run the Next.js server using the standalone entrypoint
CMD ["node", "apps/web/server.js"]
