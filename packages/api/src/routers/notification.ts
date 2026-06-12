import { z } from "zod";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";

export const notificationRouter = createTRPCRouter({

  // ─── Logged-in user list ───
  list: protectedProcedure
    .input(z.object({
      page:  z.number().int().min(1).default(1),
      limit: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      const [data, total, unread] = await Promise.all([
        db.notification.findMany({
          where:   { userId: ctx.dbUserId! },
          orderBy: { createdAt: "desc" },
          skip:    (input.page - 1) * input.limit,
          take:    input.limit,
        }),
        db.notification.count({ where: { userId: ctx.dbUserId! } }),
        db.notification.count({ where: { userId: ctx.dbUserId!, isRead: false } }),
      ]);
      return { data, total, unread };
    }),

  // ─── Anonymous list ───
  listAnon: publicProcedure
    .input(z.object({ anonUserId: z.string(), take: z.number().int().min(1).max(50).default(20) }))
    .query(({ input }) =>
      db.notification.findMany({
        where:   { anonUserId: input.anonUserId },
        orderBy: { createdAt: "desc" },
        take:    input.take,
      }),
    ),

  // ─── Unread count (auth) ───
  unreadCount: protectedProcedure.query(({ ctx }) =>
    db.notification.count({ where: { userId: ctx.dbUserId!, isRead: false } }),
  ),

  // ─── Unread count (anon) ───
  unreadCountAnon: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(({ input }) =>
      db.notification.count({ where: { anonUserId: input.anonUserId, isRead: false } }),
    ),

  // ─── Mark a notification as read ───
  markRead: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) =>
      db.notification.update({
        where: { id: input.id },
        data:  { isRead: true, readAt: new Date() },
      }),
    ),

  // ─── Mark all read (auth) ───
  markAllRead: protectedProcedure.mutation(({ ctx }) =>
    db.notification.updateMany({
      where: { userId: ctx.dbUserId!, isRead: false },
      data:  { isRead: true, readAt: new Date() },
    }),
  ),

  // ─── Mark all read (anon) ───
  markAllReadAnon: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .mutation(({ input }) =>
      db.notification.updateMany({
        where: { anonUserId: input.anonUserId, isRead: false },
        data:  { isRead: true, readAt: new Date() },
      }),
    ),

  // ─── Register FCM token (auth user) ───
  registerFcmToken: protectedProcedure
    .input(z.object({ token: z.string(), platform: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      db.fcmToken.upsert({
        where:  { token: input.token },
        create: { token: input.token, userId: ctx.dbUserId!, platform: input.platform },
        update: { userId: ctx.dbUserId!, lastUsedAt: new Date(), platform: input.platform },
      }),
    ),

  // ─── Register FCM token (anon) ───
  registerFcmTokenAnon: publicProcedure
    .input(z.object({
      anonUserId: z.string(),
      token:      z.string(),
      platform:   z.string().optional(),
    }))
    .mutation(({ input }) =>
      db.fcmToken.upsert({
        where:  { token: input.token },
        create: { token: input.token, anonUserId: input.anonUserId, platform: input.platform },
        update: { anonUserId: input.anonUserId, lastUsedAt: new Date(), platform: input.platform },
      }),
    ),
});
