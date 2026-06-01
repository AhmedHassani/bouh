import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/api", "@repo/db", "@repo/ui", "@repo/validators"],
};

export default nextConfig;
