import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@repo/api";
import type { Context } from "@repo/api";
import { db } from "@repo/db";

async function createContext(req: Request): Promise<Context> {
  // Auth header passed by Clerk token on client
  const authHeader = req.headers.get("authorization");
  const clerkUserId = req.headers.get("x-clerk-user-id");

  if (!clerkUserId) {
    return { userId: null, userRole: null, dbUserId: null };
  }

  const user = await db.user.findUnique({ where: { clerkId: clerkUserId } });

  return {
    userId: clerkUserId,
    userRole: user?.role ?? null,
    dbUserId: user?.id ?? null,
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
