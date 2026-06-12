import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, adminProcedure, consultantProcedure } from "../trpc";

export const bonusRouter = createTRPCRouter({
  // ─── Admin: create a bonus ───
  create: adminProcedure
    .input(z.object({
      consultantId: z.string(),
      amount:       z.number().positive(),
      reason:       z.string().optional(),
      markAsPaid:   z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const consultant = await db.consultantProfile.findUnique({ where: { id: input.consultantId } });
      if (!consultant) throw new TRPCError({ code: "NOT_FOUND" });

      return db.bonus.create({
        data: {
          consultantId: input.consultantId,
          amount:       input.amount,
          reason:       input.reason,
          status:       input.markAsPaid ? "PAID" : "PENDING",
          paidAt:       input.markAsPaid ? new Date() : null,
          createdById:  ctx.dbUserId ?? null,
        },
      });
    }),

  // ─── Admin: list bonuses for a specific consultant ───
  listForConsultant: adminProcedure
    .input(z.object({ consultantId: z.string() }))
    .query(({ input }) =>
      db.bonus.findMany({
        where:   { consultantId: input.consultantId },
        orderBy: { createdAt: "desc" },
      }),
    ),

  // ─── Admin: list all bonuses (across consultants) ───
  listAll: adminProcedure
    .input(z.object({
      status: z.enum(["PENDING", "PAID", "CANCELLED"]).optional(),
    }).optional())
    .query(({ input }) =>
      db.bonus.findMany({
        where: input?.status ? { status: input.status } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          consultant: {
            include: { user: { select: { name: true, avatar: true } } },
          },
        },
        take: 100,
      }),
    ),

  // ─── Admin: mark a pending bonus as paid ───
  markPaid: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      db.bonus.update({
        where: { id: input.id },
        data:  { status: "PAID", paidAt: new Date() },
      }),
    ),

  // ─── Admin: cancel/delete a bonus ───
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      db.bonus.delete({ where: { id: input.id } }),
    ),

  // ─── Consultant: my bonuses ───
  myBonuses: consultantProcedure.query(async ({ ctx }) => {
    const profile = await db.consultantProfile.findUniqueOrThrow({
      where: { userId: ctx.dbUserId! },
    });
    const bonuses = await db.bonus.findMany({
      where: { consultantId: profile.id, status: { not: "CANCELLED" } },
      orderBy: { createdAt: "desc" },
    });

    const totalPaid    = bonuses
      .filter((b) => b.status === "PAID")
      .reduce((sum, b) => sum + Number(b.amount), 0);
    const totalPending = bonuses
      .filter((b) => b.status === "PENDING")
      .reduce((sum, b) => sum + Number(b.amount), 0);

    return { bonuses, totalPaid, totalPending };
  }),
});
