import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, consultantProcedure } from "../trpc";

export const sessionReportRouter = createTRPCRouter({

  // Get report for a specific appointment (consultant's own session)
  getByAppointment: consultantProcedure
    .input(z.object({ appointmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const appt = await db.appointment.findUnique({
        where: { id: input.appointmentId },
      });
      if (!appt || appt.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.sessionReport.findUnique({
        where: { appointmentId: input.appointmentId },
      });
    }),

  // Create or update a report for an appointment
  upsert: consultantProcedure
    .input(z.object({
      appointmentId: z.string(),
      content:       z.string().min(1).max(50000), // HTML up to 50kb
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const appt = await db.appointment.findUnique({
        where: { id: input.appointmentId },
      });
      if (!appt || appt.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Allow writing for CONFIRMED (to finalize), COMPLETED (to edit), and CANCELLED-with-no-show notes
      if (appt.status === "CANCELLED" || appt.status === "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن كتابة التقرير لهذه الجلسة",
        });
      }

      return db.sessionReport.upsert({
        where:  { appointmentId: input.appointmentId },
        create: {
          appointmentId: input.appointmentId,
          consultantId:  profile.id,
          content:       input.content,
        },
        update: { content: input.content },
      });
    }),

  // Submit report AND complete the session in one atomic action
  submitAndComplete: consultantProcedure
    .input(z.object({
      appointmentId: z.string(),
      content:       z.string().min(1).max(50000),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const appt = await db.appointment.findUnique({
        where: { id: input.appointmentId },
      });
      if (!appt || appt.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (appt.status !== "CONFIRMED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يمكن إنهاء الجلسات المؤكدة فقط",
        });
      }

      // 1. Save report
      await db.sessionReport.upsert({
        where:  { appointmentId: input.appointmentId },
        create: {
          appointmentId: input.appointmentId,
          consultantId:  profile.id,
          content:       input.content,
        },
        update: { content: input.content },
      });

      // 2. Mark appointment as completed
      const completed = await db.appointment.update({
        where: { id: input.appointmentId },
        data:  { status: "COMPLETED" },
      });

      // 3. Create earning (mirrors logic from updateStatus → COMPLETED)
      const gross      = Number(completed.finalPrice);
      const commission = gross * Number((await db.consultantProfile.findUniqueOrThrow({ where: { id: profile.id } })).commissionRate);
      await db.earning.upsert({
        where: { appointmentId: input.appointmentId },
        create: {
          appointmentId:    input.appointmentId,
          consultantId:     profile.id,
          grossAmount:      gross,
          commissionAmount: commission,
          netAmount:        gross - commission,
        },
        update: {},
      });

      return completed;
    }),

  // Delete a report
  delete: consultantProcedure
    .input(z.object({ appointmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const report = await db.sessionReport.findUnique({
        where: { appointmentId: input.appointmentId },
      });
      if (!report || report.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.sessionReport.delete({ where: { id: report.id } });
    }),

  // List all clients that have reports (grouped)
  listClients: consultantProcedure.query(async ({ ctx }) => {
    const profile = await db.consultantProfile.findUniqueOrThrow({
      where: { userId: ctx.dbUserId! },
    });

    // Get all reports for this consultant with appointment+client info
    const reports = await db.sessionReport.findMany({
      where: { consultantId: profile.id },
      include: {
        appointment: {
          include: {
            client:   { include: { user: { select: { id: true, name: true, email: true, avatar: true } } } },
            anonUser: { select: { id: true, nickname: true } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by client (or anon user)
    type ClientGroup = {
      key: string;
      name: string;
      type: "client" | "anon";
      reportCount: number;
      lastReportAt: Date;
      avatar?: string | null;
    };
    const map = new Map<string, ClientGroup>();

    for (const r of reports) {
      const appt = r.appointment;
      const key = appt.clientId ? `c:${appt.clientId}` : `a:${appt.anonUserId}`;
      const name = appt.client?.user.name ?? appt.anonUser?.nickname ?? "غير معروف";
      const existing = map.get(key);
      if (existing) {
        existing.reportCount++;
      } else {
        map.set(key, {
          key,
          name,
          type: appt.client ? "client" : "anon",
          reportCount: 1,
          lastReportAt: r.updatedAt,
          avatar: appt.client?.user.avatar,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.lastReportAt.getTime() - a.lastReportAt.getTime()
    );
  }),

  // List reports for a specific client (anon or registered)
  listByClient: consultantProcedure
    .input(z.object({
      clientType: z.enum(["client", "anon"]),
      clientId:   z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });

      const apptWhere = input.clientType === "client"
        ? { clientId:   input.clientId }
        : { anonUserId: input.clientId };

      const reports = await db.sessionReport.findMany({
        where: {
          consultantId: profile.id,
          appointment:  apptWhere,
        },
        include: {
          appointment: {
            include: {
              client:   { include: { user: { select: { name: true, avatar: true } } } },
              anonUser: { select: { nickname: true } },
            },
          },
        },
        orderBy: { appointment: { scheduledAt: "desc" } },
      });

      return reports;
    }),
});
