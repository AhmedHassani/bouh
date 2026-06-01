import { z } from "zod";

export const createAvailabilitySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotDuration: z.number().int().min(30).default(60),
});

export const blockDateSchema = z.object({
  availabilityId: z.string(),
  date: z.string().datetime(),
  reason: z.string().optional(),
});

export type CreateAvailabilityInput = z.infer<typeof createAvailabilitySchema>;
export type BlockDateInput = z.infer<typeof blockDateSchema>;
