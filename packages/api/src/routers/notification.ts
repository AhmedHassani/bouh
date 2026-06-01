import { z } from "zod";
import { db } from "@repo/db";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ page: z.number().int().min(1).default(1), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const user = await db.user.findUniqueOrThrow({ where: { id: ctx.dbUserId! } });
      const [data, total, unread] = await Promise.all([
        db.notification.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        db.notification.count({ where: { userId: user.id } }),
        db.notification.count({ where: { userId: user.id, isRead: false } }),
      ]);
      return { data, total, unread };
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return db.notification.update({
        where: { id: input.id, userId: ctx.dbUserId! },
        data: { isRead: true, readAt: new Date() },
      });
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    return db.notification.updateMany({
      where: { userId: ctx.dbUserId!, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }),
});
