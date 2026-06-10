import { z } from "zod";
import { db } from "@repo/db";
import { createSpecializationSchema, updateSpecializationSchema } from "@repo/validators";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";

export const specializationRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({ isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return db.specialization.findMany({
        where: input?.isActive !== undefined ? { isActive: input.isActive } : undefined,
        orderBy: { nameAr: "asc" },
        include: {
          _count: { select: { consultants: true } },
        },
      });
    }),

  create: adminProcedure.input(createSpecializationSchema).mutation(async ({ input }) => {
    return db.specialization.create({ data: input });
  }),

  update: adminProcedure
    .input(z.object({ id: z.string(), data: updateSpecializationSchema }))
    .mutation(async ({ input }) => {
      return db.specialization.update({ where: { id: input.id }, data: input.data });
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    return db.specialization.delete({ where: { id: input.id } });
  }),

  toggle: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const spec = await db.specialization.findUniqueOrThrow({ where: { id: input.id } });
    return db.specialization.update({
      where: { id: input.id },
      data: { isActive: !spec.isActive },
    });
  }),
});
