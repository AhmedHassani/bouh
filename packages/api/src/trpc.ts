import { initTRPC, TRPCError } from "@trpc/server";
import { ZodError } from "zod";

export interface Context {
  userId: string | null;
  userRole: "SUPER_ADMIN" | "ADMIN" | "CONSULTANT" | "CLIENT" | null;
  dbUserId: string | null;
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// ─── Auth middleware ──────────────────────────────────────────────────────────

const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  return next({ ctx: { userId: ctx.userId, userRole: ctx.userRole, dbUserId: ctx.dbUserId } });
});

const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.userRole !== "ADMIN" && ctx.userRole !== "SUPER_ADMIN") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx: { userId: ctx.userId, userRole: ctx.userRole, dbUserId: ctx.dbUserId } });
});

const isConsultant = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (ctx.userRole !== "CONSULTANT") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx: { userId: ctx.userId, userRole: ctx.userRole, dbUserId: ctx.dbUserId } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
export const adminProcedure = t.procedure.use(isAdmin);
export const consultantProcedure = t.procedure.use(isConsultant);
