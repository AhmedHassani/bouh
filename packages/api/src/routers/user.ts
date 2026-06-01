import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { clerkId: ctx.userId! },
      include: {
        clientProfile: true,
        consultantProfile: { include: { specializations: { include: { specialization: true } } } },
      },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),

  // Called after Clerk sign-up to create the DB record
  syncUser: protectedProcedure
    .input(z.object({ email: z.string().email(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await db.user.findUnique({ where: { clerkId: ctx.userId! } });
      if (existing) return existing;

      return db.user.create({
        data: {
          clerkId: ctx.userId!,
          email: input.email,
          name: input.name,
          role: "CLIENT",
          clientProfile: { create: {} },
        },
      });
    }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.user.update({ where: { clerkId: ctx.userId! }, data: input });
    }),

  // Admin
  list: adminProcedure
    .input(
      z.object({
        role: z.enum(["CLIENT", "CONSULTANT", "ADMIN", "SUPER_ADMIN"]).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const where = input.role ? { role: input.role } : {};
      const [data, total] = await Promise.all([
        db.user.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        db.user.count({ where }),
      ]);
      return { data, total };
    }),
});
