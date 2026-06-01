import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, consultantProcedure } from "../trpc";
import {
  getOrCreateAnonUserSchema,
  checkAnonCompletedSchema,
  submitAnonAssessmentSchema,
  createAnonAppointmentSchema,
  getTimeSlotsSchema,
} from "@repo/validators";
import { z } from "zod";

// ─── Time Slot Helpers ────────────────────────────────────────────────────────

function generateSlots(
  startTime: string,
  endTime: string,
  slotDuration: number,
  date: Date
): Date[] {
  const slots: Date[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  for (let m = startMinutes; m + slotDuration <= endMinutes; m += slotDuration) {
    const slot = new Date(date);
    slot.setHours(Math.floor(m / 60), m % 60, 0, 0);
    slots.push(slot);
  }
  return slots;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const anonymousRouter = createTRPCRouter({
  // Get or create anonymous user by deviceId + nickname
  getOrCreate: publicProcedure
    .input(getOrCreateAnonUserSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await db.anonymousUser.findUnique({
        where: { deviceId_nickname: { deviceId: input.deviceId, nickname: input.nickname } },
      });
      if (existing) return existing;

      return db.anonymousUser.create({
        data: { deviceId: input.deviceId, nickname: input.nickname },
      });
    }),

  // Check if anon user completed a specific assessment
  checkCompleted: publicProcedure
    .input(checkAnonCompletedSchema)
    .query(async ({ ctx, input }) => {
      const result = await db.anonAssessmentResult.findUnique({
        where: { anonUserId_assessmentId: { anonUserId: input.anonUserId, assessmentId: input.assessmentId } },
        include: {
          assessment: { select: { titleAr: true, titleEn: true } },
        },
      });
      return { completed: !!result, result };
    }),

  // Submit anonymous assessment
  submitAssessment: publicProcedure
    .input(submitAnonAssessmentSchema)
    .mutation(async ({ ctx, input }) => {
      // Verify assessment exists and user is valid
      const [assessment, anonUser] = await Promise.all([
        db.assessment.findUnique({
          where: { id: input.assessmentId },
          include: { categories: true },
        }),
        db.anonymousUser.findUnique({ where: { id: input.anonUserId } }),
      ]);

      if (!assessment) throw new TRPCError({ code: "NOT_FOUND", message: "Assessment not found" });
      if (!anonUser) throw new TRPCError({ code: "NOT_FOUND", message: "Anonymous user not found" });

      // Check if already completed
      const existing = await db.anonAssessmentResult.findUnique({
        where: { anonUserId_assessmentId: { anonUserId: input.anonUserId, assessmentId: input.assessmentId } },
      });
      if (existing) return existing;

      const totalScore = input.answers.reduce((sum: number, a: { score: number }) => sum + a.score, 0);

      // Find matching category
      const category = assessment.categories.find(
        (c) => totalScore >= c.minScore && totalScore <= c.maxScore
      );

      const result = await db.anonAssessmentResult.create({
        data: {
          anonUserId: input.anonUserId,
          assessmentId: input.assessmentId,
          totalScore,
          categoryLabel: category?.labelAr ?? null,
          recommendation: category?.recommendation ?? null,
          answers: {
            create: input.answers.map((a: { questionId: string; optionId: string; score: number }) => ({
              questionId: a.questionId,
              optionId: a.optionId,
              score: a.score,
            })),
          },
        },
        include: { answers: true },
      });

      return result;
    }),

  // Get available time slots for a consultant on a given date
  getTimeSlots: publicProcedure
    .input(getTimeSlotsSchema)
    .query(async ({ ctx, input }) => {
      const date = new Date(input.date);
      const dayOfWeek = date.getDay(); // 0=Sun…6=Sat

      // Get availability for that day
      const availability = await db.availability.findFirst({
        where: {
          consultantId: input.consultantId,
          dayOfWeek,
          isActive: true,
        },
      });

      if (!availability) return { slots: [] };

      // Check if the date is blocked
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const blocked = await db.blockedDate.findFirst({
        where: {
          availabilityId: availability.id,
          date: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (blocked) return { slots: [] };

      // Generate all slots
      const allSlots = generateSlots(
        availability.startTime,
        availability.endTime,
        availability.slotDuration,
        date
      );

      // Get existing appointments for that day
      const existingAppointments = await db.appointment.findMany({
        where: {
          consultantId: input.consultantId,
          scheduledAt: { gte: startOfDay, lte: endOfDay },
          status: { notIn: ["CANCELLED"] },
        },
        select: { scheduledAt: true, duration: true },
      });

      // Filter out booked slots
      const now = new Date();
      const freeSlots = allSlots.filter((slot) => {
        if (slot <= now) return false; // Past slots
        const slotEnd = new Date(slot.getTime() + availability.slotDuration * 60 * 1000);
        return !existingAppointments.some((appt) => {
          const apptEnd = new Date(appt.scheduledAt.getTime() + appt.duration * 60 * 1000);
          return slot < apptEnd && slotEnd > appt.scheduledAt;
        });
      });

      return { slots: freeSlots.map((s) => s.toISOString()) };
    }),

  // Book appointment as anonymous user
  createAppointment: publicProcedure
    .input(createAnonAppointmentSchema)
    .mutation(async ({ ctx, input }) => {
      const anonUser = await db.anonymousUser.findUnique({ where: { id: input.anonUserId } });
      if (!anonUser) throw new TRPCError({ code: "NOT_FOUND", message: "Anonymous user not found" });

      const consultant = await db.consultantProfile.findUnique({
        where: { id: input.consultantId },
      });
      if (!consultant) throw new TRPCError({ code: "NOT_FOUND", message: "Consultant not found" });

      const scheduledAt = new Date(input.scheduledAt);

      // 48h rule for REPRESENTATIVE payment
      if (input.paymentMethod === "REPRESENTATIVE") {
        const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 48) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "الدفع عبر الممثل يتطلب الحجز قبل 48 ساعة على الأقل",
          });
        }
      }

      // Handle coupon
      let couponId: string | undefined;
      let discountAmount = 0;
      if (input.couponCode) {
        const coupon = await db.coupon.findUnique({ where: { code: input.couponCode } });
        if (coupon && coupon.isActive && (!coupon.expiresAt || coupon.expiresAt > new Date())) {
          if (!coupon.usageLimit || coupon.usageCount < coupon.usageLimit) {
            couponId = coupon.id;
            const price = Number(consultant.sessionPrice);
            if (coupon.discountType === "PERCENTAGE") {
              discountAmount = (price * Number(coupon.discountValue)) / 100;
              if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
            } else {
              discountAmount = Number(coupon.discountValue);
            }
            await db.coupon.update({
              where: { id: coupon.id },
              data: { usageCount: { increment: 1 } },
            });
          }
        }
      }

      const originalPrice = Number(consultant.sessionPrice);
      const finalPrice = Math.max(0, originalPrice - discountAmount);

      const appointment = await db.appointment.create({
        data: {
          anonUserId: input.anonUserId,
          consultantId: input.consultantId,
          scheduledAt,
          status: "PENDING",
          originalPrice,
          discountAmount,
          finalPrice,
          paymentMethod: input.paymentMethod,
          paymentStatus: "PENDING",
          couponId,
          assessmentResultId: input.assessmentResultId,
          notes: input.notes,
        },
        include: {
          consultant: { include: { user: { select: { name: true, email: true } } } },
          anonUser: true,
        },
      });

      return appointment;
    }),

  // Get anon user's appointments
  myAppointments: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      return db.appointment.findMany({
        where: { anonUserId: input.anonUserId },
        orderBy: { scheduledAt: "desc" },
        include: {
          consultant: {
            include: {
              user: { select: { name: true, avatar: true } },
              specializations: { include: { specialization: true } },
            },
          },
          coupon: true,
          assessmentResult: {
            select: { totalScore: true, categoryLabel: true, recommendation: true },
          },
        },
      });
    }),

  // Consultant views assessment result for their appointment (privacy-gated)
  getAssessmentForAppointment: consultantProcedure
    .input(z.object({ appointmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      const appointment = await db.appointment.findUnique({
        where: { id: input.appointmentId },
        include: {
          assessmentResult: {
            include: {
              assessment: { select: { titleAr: true, titleEn: true } },
              answers: {
                include: {
                  question: { select: { textAr: true, textEn: true, order: true } },
                  option: { select: { textAr: true, textEn: true, score: true } },
                },
              },
            },
          },
        },
      });

      if (!appointment) throw new TRPCError({ code: "NOT_FOUND" });

      // Ensure this consultant owns the appointment (consultantId is profile.id, not user.id)
      const profile = await db.consultantProfile.findUnique({
        where: { userId: ctx.dbUserId! },
      });
      if (!profile || appointment.consultantId !== profile.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "لا يمكنك الاطلاع على نتائج هذا العميل" });
      }

      return appointment.assessmentResult ?? null;
    }),
});
