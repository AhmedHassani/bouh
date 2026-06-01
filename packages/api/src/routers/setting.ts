import { z } from "zod";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";

const SETTING_KEYS = [
  "whatsapp_support",
  "global_discount_enabled",
  "global_discount_percentage",
] as const;

export const settingRouter = createTRPCRouter({
  getAll: publicProcedure.query(async () => {
    const settings = await db.platformSetting.findMany();
    return Object.fromEntries(settings.map((s) => [s.key, s.value]));
  }),

  update: adminProcedure
    .input(
      z.object({
        key: z.enum(SETTING_KEYS),
        value: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      return db.platformSetting.upsert({
        where: { key: input.key },
        create: { key: input.key, value: input.value },
        update: { value: input.value },
      });
    }),

  updateMany: adminProcedure
    .input(z.array(z.object({ key: z.enum(SETTING_KEYS), value: z.string() })))
    .mutation(async ({ input }) => {
      await Promise.all(
        input.map((item) =>
          db.platformSetting.upsert({
            where: { key: item.key },
            create: { key: item.key, value: item.value },
            update: { value: item.value },
          }),
        ),
      );
      return { success: true };
    }),
});
