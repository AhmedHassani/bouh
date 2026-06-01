import { z } from "zod";

export const createSpecializationSchema = z.object({
  nameAr: z.string().min(1).max(100),
  nameEn: z.string().min(1).max(100),
  description: z.string().optional(),
  icon: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const updateSpecializationSchema = createSpecializationSchema.partial();

export type CreateSpecializationInput = z.infer<typeof createSpecializationSchema>;
export type UpdateSpecializationInput = z.infer<typeof updateSpecializationSchema>;
