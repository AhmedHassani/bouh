FROM node:20-alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy the entire project files
COPY . .

# Set environment variables for build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://postgres:postgres_password@localhost:5432/bouh"
ENV CLERK_SECRET_KEY="sk_test_placeholder"

# Install all dependencies
RUN pnpm install

# Generate Prisma Client
RUN pnpm run db:generate || (cd packages/db && npx prisma generate)

# Build the Next.js application
RUN pnpm run build --filter=web

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using pnpm
CMD ["pnpm", "--filter", "web", "start"]
