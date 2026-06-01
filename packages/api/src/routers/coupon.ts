import { z } from "zod";
import { db } from "@repo/db";
import { createCouponSchema, updateCouponSchema } from "@repo/validators";
import { createTRPCRouter, adminProcedure, publicProcedure } from "../trpc";

export const couponRouter = createTRPCRouter({
  list: adminProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          isActive: z.boolean().optional(),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(100).default(20),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const where = {
        ...(input?.search && { code: { contains: input.search.toUpperCase() } }),
        ...(input?.isActive !== undefined && { isActive: input.isActive }),
      };
      const [data, total] = await Promise.all([
        db.coupon.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: ((input?.page ?? 1) - 1) * (input?.limit ?? 20),
          take: input?.limit ?? 20,
        }),
        db.coupon.count({ where }),
      ]);
      return { data, total };
    }),

  create: adminProcedure.input(createCouponSchema).mutation(async ({ input }) => {
    return db.coupon.create({ data: { ...input, expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined } });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string(), data: updateCouponSchema }))
    .mutation(async ({ input }) => {
      return db.coupon.update({
        where: { id: input.id },
        data: { ...input.data, expiresAt: input.data.expiresAt ? new Date(input.data.expiresAt) : undefined },
      });
    }),

  toggle: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const coupon = await db.coupon.findUniqueOrThrow({ where: { id: input.id } });
    return db.coupon.update({ where: { id: input.id }, data: { isActive: !coupon.isActive } });
  }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return db.coupon.delete({ where: { id: input.id } });
  }),

  validate: publicProcedure
    .input(z.object({ code: z.string(), consultantId: z.string() }))
    .query(async ({ input }) => {
      const coupon = await db.coupon.findFirst({
        where: {
          code: input.code.toUpperCase(),
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (!coupon) return { valid: false, coupon: null };
      if (coupon.usageLimit && coupon.usageCount >= coupon.usageLimit) {
        return { valid: false, coupon: null };
      }
      return { valid: true, coupon };
    }),
});
