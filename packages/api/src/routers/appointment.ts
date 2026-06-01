import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createAppointmentSchema, appointmentFilterSchema } from "@repo/validators";
import { createTRPCRouter, protectedProcedure, adminProcedure, consultantProcedure } from "../trpc";

const appointmentInclude = {
  client: { include: { user: { select: { name: true, email: true, avatar: true } } } },
  anonUser: { select: { id: true, nickname: true } },
  consultant: { include: { user: { select: { name: true, email: true, avatar: true } } } },
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
        include: { consultant: true },
      });

      const isOwner = appointment.consultant.userId === ctx.dbUserId;
      const isAdminRole = ctx.userRole === "ADMIN" || ctx.userRole === "SUPER_ADMIN";
      if (!isOwner && !isAdminRole) throw new TRPCError({ code: "FORBIDDEN" });

      const updated = await db.appointment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          cancelReason: input.cancelReason,
          cancelledBy: ctx.dbUserId,
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

  // Admin — all appointments
  adminList: adminProcedure.input(appointmentFilterSchema).query(async ({ input }) => {
    const where = {
      ...(input.status && { status: input.status }),
      ...(input.consultantId && { consultantId: input.consultantId }),
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
});
