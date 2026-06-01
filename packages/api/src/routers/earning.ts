import { z } from "zod";
import { db } from "@repo/db";
import { createTRPCRouter, consultantProcedure, adminProcedure } from "../trpc";

export const earningRouter = createTRPCRouter({
  myEarnings: consultantProcedure
    .input(
      z
        .object({
          month: z.number().int().min(1).max(12).optional(),
          year: z.number().int().min(2020).optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });

      const where: Record<string, unknown> = { consultantId: profile.id };

      const [data, total, totals] = await Promise.all([
        db.earning.findMany({
          where,
          include: {
            appointment: {
              include: {
                client: { include: { user: { select: { name: true } } } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: ((input?.page ?? 1) - 1) * (input?.limit ?? 20),
          take: input?.limit ?? 20,
        }),
        db.earning.count({ where }),
        db.earning.aggregate({
          where,
          _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
          _count: true,
        }),
      ]);

      return {
        data,
        total,
        totals: {
          gross: Number(totals._sum.grossAmount ?? 0),
          commission: Number(totals._sum.commissionAmount ?? 0),
          net: Number(totals._sum.netAmount ?? 0),
          sessions: totals._count,
        },
      };
    }),

  adminEarnings: adminProcedure
    .input(z.object({ consultantId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where = input?.consultantId ? { consultantId: input.consultantId } : {};
      const totals = await db.earning.aggregate({
        where,
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
        _count: true,
      });
      return {
        gross: Number(totals._sum.grossAmount ?? 0),
        commission: Number(totals._sum.commissionAmount ?? 0),
        net: Number(totals._sum.netAmount ?? 0),
        sessions: totals._count,
      };
    }),
});
