import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, adminProcedure, consultantProcedure } from "../trpc";

export const sessionRecommendationRouter = createTRPCRouter({

  // ─── Consultant: get my recommendation for a specific session ───
  getMine: consultantProcedure
    .input(z.object({ appointmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const appt = await db.appointment.findUnique({ where: { id: input.appointmentId } });
      if (!appt || appt.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.sessionRecommendation.findUnique({
        where: { appointmentId: input.appointmentId },
      });
    }),

  // ─── Consultant: create or update recommendation ───
  upsert: consultantProcedure
    .input(z.object({
      appointmentId: z.string(),
      content:       z.string().min(1).max(50000),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const appt = await db.appointment.findUnique({ where: { id: input.appointmentId } });
      if (!appt || appt.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (appt.status === "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن إضافة توصية لجلسة لم تُؤكَّد بعد",
        });
      }

      const rec = await db.sessionRecommendation.upsert({
        where:  { appointmentId: input.appointmentId },
        create: {
          appointmentId: input.appointmentId,
          consultantId:  profile.id,
          content:       input.content,
        },
        update: {
          content: input.content,
          isRead:  false,
          readAt:  null,
        },
      });

      // Notify all admins
      try {
        const { notify } = await import("../lib/notify");
        const admins = await db.user.findMany({
          where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          select: { id: true },
        });
        const consultant = await db.consultantProfile.findUnique({
          where:  { id: profile.id },
          select: { user: { select: { name: true } } },
        });
        if (admins.length > 0) {
          await notify({
            type:    "RECOMMENDATION_RECEIVED",
            title:   "توصية جديدة من المستشار",
            body:    `${consultant?.user.name ?? "مستشار"} أرسل توصية تخص أحد العملاء`,
            link:    `/admin/appointments`,
            data:    { appointmentId: input.appointmentId },
            userIds: admins.map((a) => a.id),
          });
        }
      } catch (err) {
        console.error("[notify] recommendation failed:", err);
      }

      return rec;
    }),

  // ─── Consultant: delete own recommendation ───
  delete: consultantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      const rec = await db.sessionRecommendation.findUnique({ where: { id: input.id } });
      if (!rec || rec.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return db.sessionRecommendation.delete({ where: { id: input.id } });
    }),

  // ─── Admin: get recommendation for any appointment ───
  getForAppointment: adminProcedure
    .input(z.object({ appointmentId: z.string() }))
    .query(({ input }) =>
      db.sessionRecommendation.findUnique({
        where:   { appointmentId: input.appointmentId },
        include: {
          consultant: {
            include: { user: { select: { name: true, avatar: true } } },
          },
        },
      }),
    ),

  // ─── Admin: mark as read ───
  markAsRead: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      db.sessionRecommendation.update({
        where: { id: input.id },
        data:  { isRead: true, readAt: new Date() },
      }),
    ),

  // ─── Admin: list all unread recommendations (notification feed) ───
  listUnread: adminProcedure.query(() =>
    db.sessionRecommendation.findMany({
      where:   { isRead: false },
      orderBy: { createdAt: "desc" },
      include: {
        consultant: { include: { user: { select: { name: true, avatar: true } } } },
        appointment: {
          include: {
            anonUser:   true,
            client:     { include: { user: { select: { name: true } } } },
          },
        },
      },
      take: 50,
    }),
  ),
});
