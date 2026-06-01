import { z } from "zod";

export const getOrCreateAnonUserSchema = z.object({
  deviceId: z.string().min(1),
  nickname: z.string().min(2).max(30),
});

export const checkAnonCompletedSchema = z.object({
  anonUserId: z.string(),
  assessmentId: z.string(),
});

export const submitAnonAssessmentSchema = z.object({
  anonUserId: z.string(),
  assessmentId: z.string(),
  answers: z.array(
    z.object({
      questionId: z.string(),
      optionId: z.string(),
      score: z.number().int(),
    })
  ),
});

export const createAnonAppointmentSchema = z.object({
  anonUserId: z.string(),
  consultantId: z.string(),
  scheduledAt: z.string().datetime(),
  paymentMethod: z.enum(["REPRESENTATIVE", "ELECTRONIC"]),
  assessmentResultId: z.string().optional(),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export const getTimeSlotsSchema = z.object({
  consultantId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
});
