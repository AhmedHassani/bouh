import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@repo/api";
import type { Context } from "@repo/api";
import { db } from "@repo/db";
import { verifyAccessToken } from "@repo/api";

async function createContext(req: Request): Promise<Context> {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    // Dev bypass: auto-create super admin when no token present (development only)
    if (process.env.NODE_ENV === "development") {
      const DEV_CLERK_ID = "dev_super_admin";
      let devUser = await db.user.findUnique({ where: { clerkId: DEV_CLERK_ID } });
      if (!devUser) {
        devUser = await db.user.create({
          data: {
            clerkId: DEV_CLERK_ID,
            email: "admin@dev.local",
            name: "Dev Admin",
            role: "SUPER_ADMIN",
          },
        });
      }
      return { userId: DEV_CLERK_ID, userRole: "SUPER_ADMIN", dbUserId: devUser.id };
    }
    return { userId: null, userRole: null, dbUserId: null };
  }

  const payload = await verifyAccessToken(token);
  if (!payload) {
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
