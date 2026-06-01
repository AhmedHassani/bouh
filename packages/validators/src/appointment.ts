import { z } from "zod";

export const createAppointmentSchema = z.object({
  consultantId: z.string(),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().min(30).default(60),
  couponCode: z.string().optional(),
  notes: z.string().optional(),
});

export const updateAppointmentStatusSchema = z.object({
  id: z.string(),
  status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]),
  cancelReason: z.string().optional(),
});

export const appointmentFilterSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "RESCHEDULED"]).optional(),
  consultantId: z.string().optional(),
  clientId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusSchema>;
export type AppointmentFilterInput = z.infer<typeof appointmentFilterSchema>;
