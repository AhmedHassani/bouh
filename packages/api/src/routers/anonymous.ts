import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, consultantProcedure } from "../trpc";
import { hashPassword, verifyPassword } from "../lib/password";
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
      // 1) Exact match on (deviceId, nickname) — fast path
      const existing = await db.anonymousUser.findUnique({
        where: { deviceId_nickname: { deviceId: input.deviceId, nickname: input.nickname } },
      });
      if (existing) return existing;

      // 2) Legacy claim — if any record has the same nickname AND a deviceId
      //    that starts with "legacy-" (i.e. seeded from the old system),
      //    attach this device to it. One-time migration per legacy account.
      const legacy = await db.anonymousUser.findFirst({
        where: { nickname: input.nickname, deviceId: { startsWith: "legacy-" } },
      });
      if (legacy) {
        return db.anonymousUser.update({
          where: { id: legacy.id },
          data:  { deviceId: input.deviceId },
        });
      }

      // 3) Otherwise, create a new anon user
      return db.anonymousUser.create({
        data: { deviceId: input.deviceId, nickname: input.nickname },
      });
    }),

  // ─── Client login (name + phone + password) ─────────────────────────────────
  // Returns the matched account, or NOT_FOUND if (name, phone, password) don't
  // identify a single account. Generic NOT_FOUND covers both "no user with this
  // phone" and "wrong password" (don't leak which one).
  clientLogin: publicProcedure
    .input(z.object({
      name:     z.string().min(2),
      phone:    z.string().min(6),
      password: z.string().min(4),
      deviceId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const user = await db.anonymousUser.findUnique({ where: { phone: input.phone } });
      if (!user || !user.password || user.nickname !== input.name.trim()) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود. يرجى إنشاء حساب جديد." });
      }
      const ok = await verifyPassword(input.password, user.password);
      if (!ok) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الحساب غير موجود. يرجى إنشاء حساب جديد." });
      }
      // Attach this device so future visits on this browser are recognized
      return db.anonymousUser.update({
        where: { id: user.id },
        data:  { deviceId: input.deviceId },
      });
    }),

  // ─── Client registration ────────────────────────────────────────────────────
  clientRegister: publicProcedure
    .input(z.object({
      name:     z.string().min(2),
      phone:    z.string().min(6),
      password: z.string().min(4),
      deviceId: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.anonymousUser.findUnique({ where: { phone: input.phone } });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "رقم الهاتف مسجّل مسبقاً. سجّل دخول بدلاً من إنشاء حساب جديد.",
        });
      }
      const hashed = await hashPassword(input.password);
      return db.anonymousUser.create({
        data: {
          deviceId: input.deviceId,
          nickname: input.name.trim(),
          phone:    input.phone,
          password: hashed,
        },
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

      // 48h rule for REPRESENTATIVE payment + require address+phone
      if (input.paymentMethod === "REPRESENTATIVE") {
        const hoursUntil = (scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60);
        if (hoursUntil < 48) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "الدفع عبر المندوب يتطلب الحجز قبل 48 ساعة على الأقل",
          });
        }
        if (!input.clientAddress?.trim() || !input.clientPhone?.trim()) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "يجب إدخال العنوان ورقم الهاتف للدفع عبر المندوب",
          });
        }
      }

      // PACKAGE payment — must have unused sessions
      let userPackage: { id: string; totalSessions: number; usedSessions: number } | null = null;
      if (input.paymentMethod === "PACKAGE") {
        if (!input.userPackageId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "يجب اختيار باقة" });
        }
        userPackage = await db.userPackage.findUnique({
          where: { id: input.userPackageId },
          select: { id: true, totalSessions: true, usedSessions: true, anonUserId: true, paymentStatus: true },
        }) as never;
        if (!userPackage) {
          throw new TRPCError({ code: "NOT_FOUND", message: "الباقة غير موجودة" });
        }
        const pkg = await db.userPackage.findUnique({ where: { id: input.userPackageId } });
        if (pkg?.anonUserId !== input.anonUserId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        if (pkg?.paymentStatus !== "PAID") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "الباقة غير مدفوعة" });
        }
        if (userPackage!.usedSessions >= userPackage!.totalSessions) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "نفدت جلسات الباقة" });
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
      // If paying via package, price is effectively 0 (already paid in package)
      const finalPrice = input.paymentMethod === "PACKAGE"
        ? 0
        : Math.max(0, originalPrice - discountAmount);

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
          // PACKAGE = already paid; others = pending
          paymentStatus: input.paymentMethod === "PACKAGE" ? "PAID" : "PENDING",
          couponId,
          assessmentResultId: input.assessmentResultId,
          notes: input.notes,
          ...(input.paymentMethod === "PACKAGE" && input.userPackageId && {
            userPackageId: input.userPackageId,
          }),
          ...(input.paymentMethod === "REPRESENTATIVE" && {
            clientAddress: input.clientAddress,
            clientPhone:   input.clientPhone,
          }),
        },
        include: {
          consultant: { include: { user: { select: { name: true, email: true } } } },
          anonUser: true,
        },
      });

      // Increment used sessions on the package
      if (input.paymentMethod === "PACKAGE" && input.userPackageId) {
        await db.userPackage.update({
          where: { id: input.userPackageId },
          data:  { usedSessions: { increment: 1 } },
        });
      }

      // ── Fire notifications: admins + the consultant ──
      try {
        const { notify } = await import("../lib/notify");
        const admins = await db.user.findMany({
          where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
          select: { id: true },
        });
        const consultantUser = await db.consultantProfile.findUnique({
          where:  { id: input.consultantId },
          select: { userId: true, user: { select: { name: true } } },
        });
        const dateStr = new Date(scheduledAt).toLocaleString("ar-IQ-u-nu-latn", {
          day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
        });
        // Admin notification
        if (admins.length > 0) {
          await notify({
            type:   "NEW_APPOINTMENT",
            title:  "حجز جديد",
            body:   `${anonUser.nickname} حجز جلسة مع ${consultantUser?.user.name ?? "مستشار"} — ${dateStr}`,
            link:   `/admin/appointments`,
            data:   { appointmentId: appointment.id },
            userIds: admins.map((a) => a.id),
          });
        }
        // Consultant notification
        if (consultantUser?.userId) {
          await notify({
            type:   "NEW_APPOINTMENT",
            title:  "حجز جديد عليك",
            body:   `${anonUser.nickname} حجز جلسة معك — ${dateStr}`,
            link:   `/consultant/appointments`,
            data:   { appointmentId: appointment.id },
            userId: consultantUser.userId,
          });
        }
      } catch (err) {
        console.error("[notify] new appointment failed:", err);
      }

      return appointment;
    }),

  // ZainCash — start payment for an existing appointment
  startZainCashPayment: publicProcedure
    .input(z.object({
      appointmentId: z.string(),
      anonUserId:    z.string(),
    }))
    .mutation(async ({ input }) => {
      const { initZainCashPayment } = await import("../lib/zaincash");

      const appointment = await db.appointment.findUniqueOrThrow({
        where: { id: input.appointmentId },
        include: { consultant: { include: { user: true } } },
      });

      if (appointment.anonUserId !== input.anonUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      // Prevent double-payment
      if (appointment.paymentStatus === "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تم الدفع بالفعل" });
      }
      // Prevent payment on cancelled/past appointments
      if (appointment.status === "CANCELLED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "هذا الموعد ملغى" });
      }
      if (new Date(appointment.scheduledAt) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "انتهى وقت هذا الموعد" });
      }
      // If there's an existing pending payment, double-check with ZainCash first
      if (appointment.paymentRef) {
        const { verifyZainCashTransaction } = await import("../lib/zaincash");
        const verification = await verifyZainCashTransaction(appointment.paymentRef);
        if (verification.success) {
          await db.appointment.update({ where: { id: appointment.id }, data: { paymentStatus: "PAID" } });
          throw new TRPCError({ code: "BAD_REQUEST", message: "تم الدفع بالفعل" });
        }
      }

      const appUrl = process.env.APP_URL?.startsWith("http://localhost") || process.env.APP_URL?.startsWith("https://")
        ? process.env.APP_URL
        : "http://localhost:3000";

      const result = await initZainCashPayment({
        amount:      Number(appointment.finalPrice),
        orderId:     appointment.id,
        serviceType: `جلسة استشارة - ${appointment.consultant.user.name}`,
        successUrl:  `${appUrl}/api/zaincash/callback/${appointment.id}/success`,
        failureUrl:  `${appUrl}/api/zaincash/callback/${appointment.id}/failure`,
      });

      // Save transaction id for later verification
      await db.appointment.update({
        where: { id: appointment.id },
        data:  { paymentRef: result.transactionId },
      });

      return { paymentUrl: result.paymentUrl };
    }),

  // Get anon user's appointments — also opportunistically polls ZainCash for pending electronic payments
  myAppointments: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Background: reconcile pending electronic payments
      const pending = await db.appointment.findMany({
        where: {
          anonUserId:    input.anonUserId,
          paymentMethod: "ELECTRONIC",
          paymentStatus: "PENDING",
        },
        select: { id: true, paymentRef: true, updatedAt: true, scheduledAt: true },
      });

      if (pending.length > 0) {
        const { verifyZainCashTransaction } = await import("../lib/zaincash");
        const now = Date.now();
        const PAYMENT_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

        await Promise.allSettled(pending.map(async (appt) => {
          // Case 1: never tried to pay (no transaction created yet) → leave as PENDING
          if (!appt.paymentRef) return;

          // Case 2: verify with ZainCash
          const result = await verifyZainCashTransaction(appt.paymentRef);

          if (result.success) {
            await db.appointment.update({ where: { id: appt.id }, data: { paymentStatus: "PAID" } });
            return;
          }

          const status = result.status?.toLowerCase();
          if (status && ["failed", "cancelled", "expired", "declined"].includes(status)) {
            await db.appointment.update({ where: { id: appt.id }, data: { paymentStatus: "FAILED" } });
            return;
          }

          // Case 3: stale PENDING — opened ZainCash but never completed (>20min since last update)
          const ageMs = now - appt.updatedAt.getTime();
          if (ageMs > PAYMENT_TIMEOUT_MS) {
            await db.appointment.update({
              where: { id: appt.id },
              data:  { paymentStatus: "FAILED", status: "CANCELLED" },
            });
          }
        }));
      }

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
