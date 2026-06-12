import { z } from "zod";
import { db } from "@repo/db";
import { createTRPCRouter, adminProcedure } from "../trpc";

const dateRangeSchema = z.object({
  from: z.string().optional(),
  to:   z.string().optional(),
});

function rangeWhere(input?: { from?: string; to?: string }) {
  const range: { gte?: Date; lte?: Date } = {};
  if (input?.from) range.gte = new Date(input.from);
  if (input?.to)   range.lte = new Date(input.to);
  return Object.keys(range).length ? range : undefined;
}

export const reportRouter = createTRPCRouter({

  // ─── 1. Platform overview — headline KPIs ───
  platformOverview: adminProcedure
    .input(dateRangeSchema.optional())
    .query(async ({ input }) => {
      const createdAt = rangeWhere(input);

      const [
        appointments,
        completed,
        cancelled,
        confirmed,
        pending,
        earningsAgg,
        consultantCount,
        clientCount,
        anonCount,
        couponsUsed,
        packagesSold,
        assessmentResults,
      ] = await Promise.all([
        db.appointment.count({ where: createdAt ? { createdAt } : {} }),
        db.appointment.count({ where: { status: "COMPLETED", ...(createdAt && { createdAt }) } }),
        db.appointment.count({ where: { status: "CANCELLED", ...(createdAt && { createdAt }) } }),
        db.appointment.count({ where: { status: "CONFIRMED", ...(createdAt && { createdAt }) } }),
        db.appointment.count({ where: { status: "PENDING",   ...(createdAt && { createdAt }) } }),
        db.earning.aggregate({
          where: createdAt ? { createdAt } : {},
          _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
          _count: true,
        }),
        db.consultantProfile.count(),
        db.clientProfile.count(),
        db.anonymousUser.count({ where: createdAt ? { createdAt } : {} }),
        db.appointment.count({ where: { couponId: { not: null }, ...(createdAt && { createdAt }) } }),
        db.userPackage.count({ where: { paymentStatus: "PAID", ...(createdAt && { createdAt }) } }),
        db.anonAssessmentResult.count({ where: createdAt ? { completedAt: createdAt } : {} }),
      ]);

      return {
        appointments: { total: appointments, completed, cancelled, confirmed, pending },
        revenue: {
          gross:      Number(earningsAgg._sum.grossAmount ?? 0),
          commission: Number(earningsAgg._sum.commissionAmount ?? 0),
          net:        Number(earningsAgg._sum.netAmount ?? 0),
          sessions:   earningsAgg._count,
        },
        users: {
          consultants: consultantCount,
          clients:     clientCount,
          anonymous:   anonCount,
        },
        couponsUsed,
        packagesSold,
        assessmentResults,
      };
    }),

  // ─── 2. Earnings by consultant (with optional date range) ───
  earningsByConsultant: adminProcedure
    .input(dateRangeSchema.optional())
    .query(async ({ input }) => {
      const where = rangeWhere(input) ? { createdAt: rangeWhere(input) } : {};
      const grouped = await db.earning.groupBy({
        by: ["consultantId"],
        where,
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
        _count: true,
      });

      const consultants = await db.consultantProfile.findMany({
        where: { id: { in: grouped.map((g) => g.consultantId) } },
        include: { user: { select: { name: true, email: true } } },
      });

      return grouped
        .map((g) => {
          const c = consultants.find((x) => x.id === g.consultantId);
          return {
            consultantId: g.consultantId,
            name:    c?.user.name ?? "—",
            email:   c?.user.email ?? "",
            gross:      Number(g._sum.grossAmount ?? 0),
            commission: Number(g._sum.commissionAmount ?? 0),
            net:        Number(g._sum.netAmount ?? 0),
            sessions:   g._count,
          };
        })
        .sort((a, b) => b.gross - a.gross);
    }),

  // ─── 3. Earnings by month (last 12 months) ───
  earningsByMonth: adminProcedure
    .query(async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 11);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const earnings = await db.earning.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true, grossAmount: true, commissionAmount: true, netAmount: true },
      });

      const buckets = new Map<string, { gross: number; commission: number; net: number; count: number }>();
      for (let i = 0; i < 12; i++) {
        const d = new Date(since);
        d.setMonth(since.getMonth() + i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        buckets.set(key, { gross: 0, commission: 0, net: 0, count: 0 });
      }
      for (const e of earnings) {
        const key = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`;
        const b = buckets.get(key);
        if (!b) continue;
        b.gross      += Number(e.grossAmount);
        b.commission += Number(e.commissionAmount);
        b.net        += Number(e.netAmount);
        b.count      += 1;
      }
      return Array.from(buckets.entries()).map(([month, v]) => ({ month, ...v }));
    }),

  // ─── 4. Detailed report for a single consultant ───
  consultantReport: adminProcedure
    .input(z.object({
      consultantId: z.string(),
      from: z.string().optional(),
      to:   z.string().optional(),
    }))
    .query(async ({ input }) => {
      const createdAt = rangeWhere({ from: input.from, to: input.to });

      const [profile, statusCounts, earningsAgg, reviewsAgg, topClients] = await Promise.all([
        db.consultantProfile.findUnique({
          where: { id: input.consultantId },
          include: {
            user: { select: { name: true, email: true, phone: true } },
            specializations: { include: { specialization: true } },
          },
        }),
        db.appointment.groupBy({
          by: ["status"],
          where: { consultantId: input.consultantId, ...(createdAt && { createdAt }) },
          _count: true,
        }),
        db.earning.aggregate({
          where: { consultantId: input.consultantId, ...(createdAt && { createdAt }) },
          _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
          _count: true,
        }),
        db.review.aggregate({
          where: { consultantId: input.consultantId },
          _avg: { rating: true },
          _count: true,
        }),
        db.appointment.groupBy({
          by: ["anonUserId"],
          where: {
            consultantId: input.consultantId,
            anonUserId: { not: null },
            ...(createdAt && { createdAt }),
          },
          _count: true,
          orderBy: { _count: { anonUserId: "desc" } },
          take: 5,
        }),
      ]);

      const topClientUsers = await db.anonymousUser.findMany({
        where: { id: { in: topClients.map((t) => t.anonUserId!).filter(Boolean) } },
        select: { id: true, nickname: true },
      });

      return {
        profile,
        appointments: {
          total: statusCounts.reduce((s, x) => s + x._count, 0),
          byStatus: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
        },
        earnings: {
          gross:      Number(earningsAgg._sum.grossAmount ?? 0),
          commission: Number(earningsAgg._sum.commissionAmount ?? 0),
          net:        Number(earningsAgg._sum.netAmount ?? 0),
          sessions:   earningsAgg._count,
        },
        reviews: {
          avg:   Number(reviewsAgg._avg.rating ?? 0),
          count: reviewsAgg._count,
        },
        topClients: topClients.map((t) => ({
          anonUserId: t.anonUserId!,
          nickname:   topClientUsers.find((u) => u.id === t.anonUserId)?.nickname ?? "—",
          sessions:   t._count,
        })),
      };
    }),

  // ─── 5. Transferred sessions ───
  transferredSessions: adminProcedure
    .input(dateRangeSchema.optional())
    .query(async ({ input }) => {
      const createdAt = rangeWhere(input);
      const data = await db.appointment.findMany({
        where: {
          transferredFromConsultantId: { not: null },
          ...(createdAt && { createdAt }),
        },
        include: {
          consultant:              { include: { user: { select: { name: true } } } },
          transferredFromConsultant:{ include: { user: { select: { name: true } } } },
          anonUser:                { select: { nickname: true } },
          client:                  { include: { user: { select: { name: true } } } },
        },
        orderBy: { transferredAt: "desc" },
        take: 200,
      });

      // Per-consultant transfer counts (received)
      const received = new Map<string, { name: string; count: number }>();
      const sent     = new Map<string, { name: string; count: number }>();
      for (const a of data) {
        const r = received.get(a.consultantId) ?? { name: a.consultant.user.name ?? "—", count: 0 };
        r.count++; received.set(a.consultantId, r);
        if (a.transferredFromConsultantId && a.transferredFromConsultant) {
          const s = sent.get(a.transferredFromConsultantId) ?? { name: a.transferredFromConsultant.user.name ?? "—", count: 0 };
          s.count++; sent.set(a.transferredFromConsultantId, s);
        }
      }

      return {
        total: data.length,
        items: data,
        receivedTop: Array.from(received.entries()).map(([id, v]) => ({ consultantId: id, ...v })).sort((a, b) => b.count - a.count),
        sentTop:     Array.from(sent.entries()).map(([id, v]) => ({ consultantId: id, ...v })).sort((a, b) => b.count - a.count),
      };
    }),

  // ─── 6. Payment methods breakdown ───
  paymentBreakdown: adminProcedure
    .input(dateRangeSchema.optional())
    .query(async ({ input }) => {
      const createdAt = rangeWhere(input);
      const grouped = await db.appointment.groupBy({
        by: ["paymentMethod", "paymentStatus"],
        where: createdAt ? { createdAt } : {},
        _count: true,
        _sum:   { finalPrice: true },
      });
      return grouped.map((g) => ({
        method: g.paymentMethod,
        status: g.paymentStatus,
        count:  g._count,
        total:  Number(g._sum.finalPrice ?? 0),
      }));
    }),

  // ─── 7. Coupons report ───
  couponsReport: adminProcedure
    .input(dateRangeSchema.optional())
    .query(async ({ input }) => {
      const createdAt = rangeWhere(input);
      const appts = await db.appointment.findMany({
        where: { couponId: { not: null }, ...(createdAt && { createdAt }) },
        select: { discountAmount: true, couponId: true, coupon: { select: { code: true } } },
      });

      const totalDiscount = appts.reduce((s, a) => s + Number(a.discountAmount), 0);

      const byCoupon = new Map<string, { code: string; usage: number; discount: number }>();
      for (const a of appts) {
        if (!a.couponId) continue;
        const cur = byCoupon.get(a.couponId) ?? { code: a.coupon?.code ?? "—", usage: 0, discount: 0 };
        cur.usage++;
        cur.discount += Number(a.discountAmount);
        byCoupon.set(a.couponId, cur);
      }

      return {
        totalUses: appts.length,
        totalDiscount,
        topCoupons: Array.from(byCoupon.entries())
          .map(([id, v]) => ({ couponId: id, ...v }))
          .sort((a, b) => b.usage - a.usage)
          .slice(0, 20),
      };
    }),

  // ─── 8. Packages report ───
  packagesReport: adminProcedure
    .query(async () => {
      const purchased = await db.userPackage.findMany({
        where: { paymentStatus: "PAID" },
        include: { package: { select: { id: true, nameAr: true, price: true, sessions: true } } },
      });

      const byPackage = new Map<string, { nameAr: string; sold: number; revenue: number; usedSessions: number; totalSessions: number }>();
      for (const up of purchased) {
        const k = up.packageId;
        const cur = byPackage.get(k) ?? {
          nameAr: up.package.nameAr, sold: 0, revenue: 0, usedSessions: 0, totalSessions: 0,
        };
        cur.sold++;
        cur.revenue       += Number(up.package.price);
        cur.usedSessions  += up.usedSessions;
        cur.totalSessions += up.totalSessions;
        byPackage.set(k, cur);
      }

      return {
        totalSold:    purchased.length,
        totalRevenue: purchased.reduce((s, p) => s + Number(p.package.price), 0),
        items: Array.from(byPackage.entries()).map(([id, v]) => ({ packageId: id, ...v })).sort((a, b) => b.sold - a.sold),
      };
    }),

  // ─── 9. List of consultants — for picker ───
  consultantList: adminProcedure.query(() =>
    db.consultantProfile.findMany({
      select: { id: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ),
});
