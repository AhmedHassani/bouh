import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@repo/api";
import type { Context } from "@repo/api";
import { verifyAccessToken } from "@repo/api";

// Dev user IDs — must match real DB records
const DEV_ADMIN_CLERK_ID      = "dev_super_admin";
const DEV_CONSULTANT_CLERK_ID = "manual_1780583138089"; // Ahmed Rahman (CONSULTANT)
const DEV_CONSULTANT_DB_ID    = "cmpzl86d1001vlt84q4oi7zxy";

async function createContext(req: Request): Promise<Context> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    if (process.env.NODE_ENV === "development") {
      // Detect consultant portal from Referer header
      const referer = req.headers.get("referer") ?? "";
      const isConsultantPortal = referer.includes("/consultant/");
      if (isConsultantPortal) {
        return { userId: DEV_CONSULTANT_CLERK_ID, userRole: "CONSULTANT", dbUserId: DEV_CONSULTANT_DB_ID };
      }
      return { userId: DEV_ADMIN_CLERK_ID, userRole: "SUPER_ADMIN", dbUserId: DEV_ADMIN_CLERK_ID };
    }
    return { userId: null, userRole: null, dbUserId: null };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
    if (process.env.NODE_ENV === "development") {
      const referer = req.headers.get("referer") ?? "";
      const isConsultantPortal = referer.includes("/consultant/");
      if (isConsultantPortal) {
        return { userId: DEV_CONSULTANT_CLERK_ID, userRole: "CONSULTANT", dbUserId: DEV_CONSULTANT_DB_ID };
      }
      return { userId: DEV_ADMIN_CLERK_ID, userRole: "SUPER_ADMIN", dbUserId: DEV_ADMIN_CLERK_ID };
    }
    return { userId: null, userRole: null, dbUserId: null };
  }

  return {
    userId: payload.sub,
    userRole: payload.role as Context["userRole"],
    dbUserId: payload.sub,
  };
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`tRPC error on ${path}:`, error)
        : undefined,
  });

export { handler as GET, handler as POST };
