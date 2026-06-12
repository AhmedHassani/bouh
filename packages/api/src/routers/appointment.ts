import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createAppointmentSchema, appointmentFilterSchema } from "@repo/validators";
import { createTRPCRouter, protectedProcedure, adminProcedure, consultantProcedure } from "../trpc";

const appointmentInclude = {
  client: { include: { user: { select: { name: true, email: true, avatar: true } } } },
  anonUser: { select: { id: true, nickname: true } },
  consultant: { include: { user: { select: { name: true, email: true, avatar: true } } } },
  transferredFromConsultant: { include: { user: { select: { name: true, avatar: true } } } },
  coupon: true,
} as const;

export const appointmentRouter = createTRPCRouter({
  // Client — book
  create: protectedProcedure.input(createAppointmentSchema).mutation(async ({ ctx, input }) => {
    const client = await db.clientProfile.findUnique({ where: { userId: ctx.dbUserId! } });
    if (!client) throw new TRPCError({ code: "FORBIDDEN", message: "Client profile required" });

    const consultant = await db.consultantProfile.findUniqueOrThrow({
      where: { id: input.consultantId },
    });

    const originalPrice = Number(consultant.sessionPrice);
    let discountAmount = 0;
    let couponId: string | undefined;

    if (input.couponCode) {
      const coupon = await db.coupon.findFirst({
        where: {
          code: input.couponCode.toUpperCase(),
          isActive: true,
          AND: [
            { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
            { OR: [{ usageLimit: null }, { usageCount: { lt: 1000000 } }] },
          ],
        },
      });
      if (!coupon) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid coupon" });

      if (coupon.discountType === "PERCENTAGE") {
        discountAmount = (originalPrice * Number(coupon.discountValue)) / 100;
        if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
      } else {
        discountAmount = Math.min(Number(coupon.discountValue), originalPrice);
      }
      couponId = coupon.id;
      await db.coupon.update({ where: { id: coupon.id }, data: { usageCount: { increment: 1 } } });
    }

    return db.appointment.create({
      data: {
        clientId: client.id,
        consultantId: input.consultantId,
        scheduledAt: new Date(input.scheduledAt),
        duration: input.duration,
        originalPrice,
        discountAmount,
        finalPrice: originalPrice - discountAmount,
        couponId,
        notes: input.notes,
      },
      include: appointmentInclude,
    });
  }),

  // Client — list my bookings
  myBookings: protectedProcedure.input(appointmentFilterSchema).query(async ({ ctx, input }) => {
    const client = await db.clientProfile.findUnique({ where: { userId: ctx.dbUserId! } });
    if (!client) return { data: [], total: 0 };

    const where = {
      clientId: client.id,
      ...(input.status && { status: input.status }),
    };

    const [data, total] = await Promise.all([
      db.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { scheduledAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      db.appointment.count({ where }),
    ]);
    return { data, total };
  }),

  // Consultant — list my appointments
  myAppointments: consultantProcedure.input(appointmentFilterSchema).query(async ({ ctx, input }) => {
    const profile = await db.consultantProfile.findUnique({ where: { userId: ctx.dbUserId! } });
    if (!profile) return { data: [], total: 0 };

    // Opportunistically poll ZainCash for any pending electronic payments
    const pending = await db.appointment.findMany({
      where: {
        consultantId:  profile.id,
        paymentMethod: "ELECTRONIC",
        paymentStatus: "PENDING",
        paymentRef:    { not: null },
      },
      select: { id: true, paymentRef: true },
    });
    if (pending.length > 0) {
      const { verifyZainCashTransaction } = await import("../lib/zaincash");
      await Promise.allSettled(pending.map(async (appt) => {
        if (!appt.paymentRef) return;
        const result = await verifyZainCashTransaction(appt.paymentRef);
        if (result.success) {
          await db.appointment.update({ where: { id: appt.id }, data: { paymentStatus: "PAID" } });
        } else if (result.status && ["failed", "cancelled", "expired"].includes(result.status.toLowerCase())) {
          await db.appointment.update({ where: { id: appt.id }, data: { paymentStatus: "FAILED" } });
        }
      }));
    }

    const where = {
      consultantId: profile.id,
      ...(input.status && { status: input.status }),
    };

    const [data, total] = await Promise.all([
      db.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: { scheduledAt: "desc" },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      db.appointment.count({ where }),
    ]);
    return { data, total };
  }),

  // Consultant / Admin — update status
  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]),
        cancelReason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const appointment = await db.appointment.findUniqueOrThrow({
        where: { id: input.id },
        include: { consultant: true, sessionReport: true },
      });

      const isOwner = appointment.consultant.userId === ctx.dbUserId;
      const isAdminRole = ctx.userRole === "ADMIN" || ctx.userRole === "SUPER_ADMIN";
      if (!isOwner && !isAdminRole) throw new TRPCError({ code: "FORBIDDEN" });

      // Block COMPLETED without a written report (consultant only)
      if (input.status === "COMPLETED" && isOwner && !appointment.sessionReport) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "يجب كتابة تقرير الجلسة قبل إنهائها",
        });
      }

      // Auto-generate Google Meet link when confirming
      let meetingLink = appointment.meetingLink;
      if (input.status === "CONFIRMED" && !meetingLink) {
        const { createGoogleMeetLink } = await import("../lib/google-meet");
        const apptFull = await db.appointment.findUnique({
          where: { id: input.id },
          include: { consultant: { include: { user: true } } },
        });
        const generated = await createGoogleMeetLink({
          title: `جلسة مساحة بوح - ${apptFull?.consultant.user.name ?? "مستشار"}`,
          startTime: new Date(apptFull?.scheduledAt ?? Date.now()),
          durationMinutes: apptFull?.duration ?? 60,
        });
        if (generated) {
          meetingLink = generated;
        }
        // If Google Meet failed, no link is set — admin/consultant can add manually
      }

      const updated = await db.appointment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          cancelReason: input.cancelReason,
          cancelledBy: ctx.dbUserId,
          ...(meetingLink && { meetingLink }),
        },
        include: appointmentInclude,
      });

      // Create earning when completed
      if (input.status === "COMPLETED") {
        const gross = Number(updated.finalPrice);
        const commission = gross * Number(appointment.consultant.commissionRate);
        await db.earning.upsert({
          where: { appointmentId: input.id },
          create: {
            consultantId: appointment.consultantId,
            appointmentId: input.id,
            grossAmount: gross,
            commissionAmount: commission,
            netAmount: gross - commission,
          },
          update: {},
        });
      }

      return updated;
    }),

  // Get single appointment (consultant or admin)
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const appointment = await db.appointment.findUnique({
        where: { id: input.id },
        include: appointmentInclude,
      });
      if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

      const isAdmin = ctx.userRole === "ADMIN" || ctx.userRole === "SUPER_ADMIN";
      if (!isAdmin && appointment.consultant.userId !== ctx.dbUserId) {
        // Allow client too
        const clientProfile = await db.clientProfile.findUnique({ where: { userId: ctx.dbUserId! } });
        if (!clientProfile || appointment.clientId !== clientProfile.id) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }
      return appointment;
    }),

  // Admin — transfer an appointment to a different consultant
  adminTransfer: adminProcedure
    .input(z.object({
      appointmentId:    z.string(),
      newConsultantId:  z.string(),
      reason:           z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const appt = await db.appointment.findUniqueOrThrow({
        where: { id: input.appointmentId },
        include: { consultant: true },
      });

      if (appt.consultantId === input.newConsultantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "نفس المستشار الحالي" });
      }
      if (appt.status === "CANCELLED" || appt.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تحويل موعد منتهٍ" });
      }

      // Check the new consultant exists and is active
      const newConsultant = await db.consultantProfile.findUnique({
        where:   { id: input.newConsultantId },
        include: { user: { select: { isActive: true } } },
      });
      if (!newConsultant || !newConsultant.user.isActive) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "المستشار الجديد غير متاح" });
      }

      // Check the new consultant doesn't have a conflicting appointment
      const conflict = await db.appointment.findFirst({
        where: {
          consultantId: input.newConsultantId,
          status: { in: ["PENDING", "CONFIRMED"] },
          scheduledAt: appt.scheduledAt,
        },
      });
      if (conflict) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لدى المستشار الجديد موعد بنفس الوقت" });
      }

      return db.appointment.update({
        where: { id: input.appointmentId },
        data:  {
          consultantId:                input.newConsultantId,
          // Preserve original transferredFrom if already transferred once
          transferredFromConsultantId: appt.transferredFromConsultantId ?? appt.consultantId,
          transferredAt:               new Date(),
          transferredBy:               ctx.dbUserId ?? null,
          transferReason:              input.reason,
        },
        include: {
          consultant:                { include: { user: { select: { name: true, email: true, avatar: true } } } },
          transferredFromConsultant: { include: { user: { select: { name: true, email: true, avatar: true } } } },
        },
      });
    }),

  // Admin — stats about transferred appointments
  adminTransferStats: adminProcedure.query(async () => {
    const totalTransferred = await db.appointment.count({
      where: { transferredFromConsultantId: { not: null } },
    });
    const recent = await db.appointment.findMany({
      where: { transferredFromConsultantId: { not: null } },
      orderBy: { transferredAt: "desc" },
      take: 10,
      include: {
        consultant:                { include: { user: { select: { name: true, avatar: true } } } },
        transferredFromConsultant: { include: { user: { select: { name: true, avatar: true } } } },
        anonUser: true,
      },
    });
    return { totalTransferred, recent };
  }),

  // Admin — list pending REPRESENTATIVE bookings (awaiting approval)
  adminPendingRepresentative: adminProcedure.query(() =>
    db.appointment.findMany({
      where: {
        paymentMethod: "REPRESENTATIVE",
        adminApproved: false,
        status: { in: ["PENDING"] },
      },
      include: {
        consultant: { include: { user: { select: { name: true, email: true } } } },
        anonUser:   true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ),

  // Admin — approve a representative booking
  adminApproveRepresentative: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await db.appointment.update({
        where: { id: input.id },
        data:  {
          adminApproved:   true,
          adminApprovedBy: ctx.dbUserId ?? null,
          adminApprovedAt: new Date(),
          status:          "CONFIRMED",
        },
      });
      return updated;
    }),

  // Admin — confirm REPRESENTATIVE payment as collected
  adminConfirmRepresentativePayment: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await db.appointment.findUniqueOrThrow({ where: { id: input.id } });
      if (appt.paymentMethod !== "REPRESENTATIVE") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذه الجلسة ليست دفع عند الاستلام" });
      }
      if (appt.paymentStatus === "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تم تأكيد الدفع مسبقاً" });
      }
      return db.appointment.update({
        where: { id: input.id },
        data:  { paymentStatus: "PAID" },
      });
    }),

  // Admin — cancel an appointment
  adminCancelAppointment: adminProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await db.appointment.findUniqueOrThrow({ where: { id: input.id } });
      if (appt.status === "CANCELLED" || appt.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن إلغاء جلسة منتهية" });
      }
      return db.appointment.update({
        where: { id: input.id },
        data:  {
          status:       "CANCELLED",
          cancelReason: input.reason ?? "ألغيت من قبل الإدارة",
          cancelledBy:  ctx.dbUserId ?? undefined,
        },
      });
    }),

  // Admin — reject a representative booking
  adminRejectRepresentative: adminProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return db.appointment.update({
        where: { id: input.id },
        data:  {
          status:       "CANCELLED",
          cancelReason: input.reason ?? "رفض الأدمن الحجز",
          cancelledBy:  ctx.dbUserId ?? undefined,
        },
      });
    }),

  // Admin — all appointments
  adminList: adminProcedure.input(appointmentFilterSchema).query(async ({ input }) => {
    const where: Record<string, unknown> = {
      ...(input.status && { status: input.status }),
      ...(input.paymentMethod && { paymentMethod: input.paymentMethod }),
      ...(input.consultantId && { consultantId: input.consultantId }),
      ...(input.awaitingRepApproval && {
        paymentMethod: "REPRESENTATIVE",
        adminApproved: false,
        status: "PENDING",
      }),
      ...(input.transferredOnly && {
        transferredFromConsultantId: { not: null },
      }),
      ...(input.search && {
        OR: [
          { anonUser:   { nickname: { contains: input.search, mode: "insensitive" } } },
          { client:     { user: { name: { contains: input.search, mode: "insensitive" } } } },
          { consultant: { user: { name: { contains: input.search, mode: "insensitive" } } } },
          { clientPhone:   { contains: input.search } },
          { clientAddress: { contains: input.search, mode: "insensitive" } },
        ],
      }),
    };
    const [data, total] = await Promise.all([
      db.appointment.findMany({
        where,
        include: appointmentInclude,
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      db.appointment.count({ where }),
    ]);
    return { data, total };
  }),

  // Admin — counts per tab (for badge numbers in UI)
  adminCounts: adminProcedure.query(async () => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999);

    const [
      all,
      pendingApproval,
      pendingPayment,
      confirmed,
      today,
      completed,
      cancelled,
      transferred,
    ] = await Promise.all([
      db.appointment.count(),
      db.appointment.count({
        where: { paymentMethod: "REPRESENTATIVE", adminApproved: false, status: "PENDING" },
      }),
      db.appointment.count({
        where: { paymentMethod: "ELECTRONIC", paymentStatus: "PENDING", status: "PENDING" },
      }),
      db.appointment.count({ where: { status: "CONFIRMED" } }),
      db.appointment.count({
        where: { status: "CONFIRMED", scheduledAt: { gte: todayStart, lte: todayEnd } },
      }),
      db.appointment.count({ where: { status: "COMPLETED" } }),
      db.appointment.count({ where: { status: "CANCELLED" } }),
      db.appointment.count({ where: { transferredFromConsultantId: { not: null } } }),
    ]);

    return { all, pendingApproval, pendingPayment, confirmed, today, completed, cancelled, transferred };
  }),
});
