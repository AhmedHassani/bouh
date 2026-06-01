import { z } from "zod";

export const createCouponSchema = z.object({
  code: z.string().min(3).max(30).toUpperCase(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.number().min(0),
  maxDiscount: z.number().min(0).optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  usageLimit: z.number().int().min(1).optional(),
});

export const updateCouponSchema = createCouponSchema.partial().omit({ code: true });

export const applyCouponSchema = z.object({
  code: z.string(),
  consultantId: z.string(),
});

export type CreateCouponInput = z.infer<typeof createCouponSchema>;
export type UpdateCouponInput = z.infer<typeof updateCouponSchema>;
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
