import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/api", "@repo/db", "@repo/ui", "@repo/validators"],
  // Allow Next.js to trace files from the monorepo root for Prisma
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Prevent Prisma client from being externalized (required for monorepo with Turbopack)
  serverExternalPackages: [],
};

export default nextConfig;
