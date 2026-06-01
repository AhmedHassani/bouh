import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/api", "@repo/db", "@repo/ui", "@repo/validators"],
  // Allow Next.js to trace files from the monorepo root for Prisma
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    // Ensure Prisma client is bundled (not externalized) — needed for monorepo
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;
