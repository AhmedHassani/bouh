import { db } from "@repo/db";
import { createTRPCRouter, adminProcedure } from "../trpc";

export const adminRouter = createTRPCRouter({
  dashboard: adminProcedure.query(async () => {
    const [
      totalClients,
      totalConsultants,
      totalAppointments,
      completedAppointments,
      earningsTotals,
      popularSpecializations,
      recentAppointments,
      topConsultants,
    ] = await Promise.all([
      db.clientProfile.count(),
      db.consultantProfile.count(),
      db.appointment.count(),
      db.appointment.count({ where: { status: "COMPLETED" } }),
      db.earning.aggregate({
        _sum: { grossAmount: true, commissionAmount: true, netAmount: true },
      }),
      db.specialization.findMany({
        include: {
          _count: { select: { consultants: true } },
        },
        orderBy: { consultants: { _count: "desc" } },
        take: 5,
      }),
      db.appointment.findMany({
        include: {
          client: { include: { user: { select: { name: true, email: true } } } },
          anonUser: { select: { id: true, nickname: true } },
          consultant: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      db.consultantProfile.findMany({
        orderBy: { rating: "desc" },
        take: 5,
        include: {
          user: { select: { name: true, avatar: true } },
          _count: { select: { appointments: true } },
        },
      }),
    ]);

    const appointmentsByStatus = await db.appointment.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return {
      stats: {
        totalClients,
        totalConsultants,
        totalAppointments,
        completedAppointments,
        totalRevenue: Number(earningsTotals._sum.grossAmount ?? 0),
        totalCommissions: Number(earningsTotals._sum.commissionAmount ?? 0),
      },
      appointmentsByStatus: Object.fromEntries(
        appointmentsByStatus.map((s) => [s.status, s._count.id]),
      ),
      popularSpecializations,
      recentAppointments,
      topConsultants,
    };
  }),
});
