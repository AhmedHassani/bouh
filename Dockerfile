FROM node:20-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Configure pnpm store location
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g pnpm

# Copy package configurations and lock files first to leverage Docker layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/api/package.json ./packages/api/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/validators/package.json ./packages/validators/package.json

# Install dependencies using pnpm cache mount to avoid downloading from scratch
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the project source files
COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres_password@localhost:5432/bouh"
ENV CLERK_SECRET_KEY="sk_test_placeholder"

# Generate Prisma Client
RUN pnpm run db:generate || (cd packages/db && npx prisma generate)

# Build Next.js application using compiler cache mount for fast incremental builds
RUN --mount=type=cache,id=next-cache,target=/app/apps/web/.next/cache pnpm run build --filter=web

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using pnpm
CMD ["pnpm", "--filter", "web", "start"]
