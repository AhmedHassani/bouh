import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";
import { notify } from "../lib/notify";
import { broadcast } from "../lib/pusher";

export const chatRouter = createTRPCRouter({

  // ─── Client: get-or-create conversation for a specific appointment ───
  getOrCreateForAppointment: publicProcedure
    .input(z.object({
      anonUserId:    z.string(),
      appointmentId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const appt = await db.appointment.findUnique({
        where:  { id: input.appointmentId },
        select: { id: true, anonUserId: true },
      });
      if (!appt || appt.anonUserId !== input.anonUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      let convo = await db.conversation.findUnique({
        where: { appointmentId: input.appointmentId },
      });
      if (!convo) {
        convo = await db.conversation.create({
          data: {
            appointmentId: input.appointmentId,
            anonUserId:    input.anonUserId,
          },
        });
      }
      return convo;
    }),

  // ─── Client: list my conversations (one per appointment) ───
  myConversations: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(({ input }) =>
      db.conversation.findMany({
        where:   { anonUserId: input.anonUserId },
        orderBy: { lastMessageAt: "desc" },
        include: {
          appointment: {
            include: {
              consultant: { include: { user: { select: { name: true, avatar: true } } } },
            },
          },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    ),

  // ─── Client: get messages for a specific appointment (mark inbound as read) ───
  myMessages: publicProcedure
    .input(z.object({
      anonUserId:    z.string(),
      appointmentId: z.string(),
    }))
    .query(async ({ input }) => {
      const convo = await db.conversation.findUnique({
        where:   { appointmentId: input.appointmentId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });
      if (!convo) return { messages: [], conversationId: null };
      if (convo.anonUserId !== input.anonUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      // Mark unread admin → client messages as read
      if (convo.unreadByAnon > 0) {
        await db.message.updateMany({
          where: { conversationId: convo.id, sender: "ADMIN", isRead: false },
          data:  { isRead: true, readAt: new Date() },
        });
        await db.conversation.update({
          where: { id: convo.id },
          data:  { unreadByAnon: 0 },
        });
      }
      return { conversationId: convo.id, messages: convo.messages };
    }),

  // ─── Client: send a message in a specific appointment's chat ───
  sendAsClient: publicProcedure
    .input(z.object({
      anonUserId:    z.string(),
      appointmentId: z.string(),
      content:       z.string().min(1).max(5000),
    }))
    .mutation(async ({ input }) => {
      const appt = await db.appointment.findUnique({
        where:   { id: input.appointmentId },
        include: { consultant: { include: { user: { select: { name: true } } } } },
      });
      if (!appt || appt.anonUserId !== input.anonUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      let convo = await db.conversation.findUnique({
        where: { appointmentId: input.appointmentId },
      });
      if (!convo) {
        convo = await db.conversation.create({
          data: {
            appointmentId: input.appointmentId,
            anonUserId:    input.anonUserId,
          },
        });
      }

      const message = await db.message.create({
        data: {
          conversationId: convo.id,
          sender:         "CLIENT",
          content:        input.content,
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data:  {
          lastMessageAt: new Date(),
          unreadByAdmin: { increment: 1 },
        },
      });

      // Notify all admins with session context
      const anon = await db.anonymousUser.findUnique({
        where:  { id: input.anonUserId },
        select: { nickname: true },
      });
      const admins = await db.user.findMany({
        where:  { role: { in: ["ADMIN", "SUPER_ADMIN"] } },
        select: { id: true },
      });
      if (admins.length > 0) {
        await notify({
          type:    "CHAT_MESSAGE",
          title:   `رسالة من ${anon?.nickname ?? "عميل"}`,
          body:    `بخصوص جلسة ${appt.consultant.user.name}: ${input.content.slice(0, 80)}`,
          link:    `/admin/chat?conversation=${convo.id}`,
          data:    { conversationId: convo.id, appointmentId: input.appointmentId },
          userIds: admins.map((a) => a.id),
        });
      }

      // Realtime broadcast
      await broadcast(`conversation-${convo.id}`, "new-message", message);
      await broadcast(`admin-chat`, "conversation-updated", { conversationId: convo.id });

      return message;
    }),

  // ─── Admin: list all conversations ───
  adminList: adminProcedure.query(() =>
    db.conversation.findMany({
      orderBy: { lastMessageAt: "desc" },
      include: {
        anonUser:    true,
        appointment: {
          include: {
            consultant: { include: { user: { select: { name: true, avatar: true } } } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      take: 100,
    }),
  ),

  // ─── Admin: total unread (sidebar badge) ───
  adminTotalUnread: adminProcedure.query(async () => {
    const agg = await db.conversation.aggregate({
      _sum: { unreadByAdmin: true },
    });
    return agg._sum.unreadByAdmin ?? 0;
  }),

  // ─── Admin: get a specific conversation + mark inbound as read ───
  adminGetConversation: adminProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => {
      const convo = await db.conversation.findUnique({
        where:   { id: input.conversationId },
        include: {
          anonUser:    true,
          appointment: {
            include: {
              consultant: { include: { user: { select: { name: true, avatar: true } } } },
            },
          },
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });

      if (convo.unreadByAdmin > 0) {
        await db.message.updateMany({
          where: { conversationId: convo.id, sender: "CLIENT", isRead: false },
          data:  { isRead: true, readAt: new Date() },
        });
        await db.conversation.update({
          where: { id: convo.id },
          data:  { unreadByAdmin: 0 },
        });
      }
      return convo;
    }),

  // ─── Admin: send a message ───
  sendAsAdmin: adminProcedure
    .input(z.object({
      conversationId: z.string(),
      content:        z.string().min(1).max(5000),
    }))
    .mutation(async ({ ctx, input }) => {
      const convo = await db.conversation.findUnique({
        where:   { id: input.conversationId },
        include: { appointment: { include: { consultant: { include: { user: { select: { name: true } } } } } } },
      });
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });

      const message = await db.message.create({
        data: {
          conversationId: convo.id,
          sender:         "ADMIN",
          senderUserId:   ctx.dbUserId ?? null,
          content:        input.content,
        },
      });

      await db.conversation.update({
        where: { id: convo.id },
        data:  {
          lastMessageAt: new Date(),
          unreadByAnon:  { increment: 1 },
        },
      });

      // Notify the anonymous client
      await notify({
        type:       "CHAT_MESSAGE",
        title:      `رد من الإدارة (${convo.appointment.consultant.user.name})`,
        body:       input.content.slice(0, 100),
        link:       `/consultants?openChat=${convo.appointmentId}`,
        data:       { conversationId: convo.id, appointmentId: convo.appointmentId },
        anonUserId: convo.anonUserId,
      });

      // Realtime broadcast (mirrors client→admin path)
      await broadcast(`conversation-${convo.id}`, "new-message", message);
      await broadcast(`admin-chat`, "conversation-updated", { conversationId: convo.id });

      return message;
    }),

  // ─── System: trigger reminders for upcoming sessions (call periodically) ───
  triggerReminders: publicProcedure.query(async () => {
    const now      = new Date();
    const inThirty = new Date(now.getTime() + 30 * 60 * 1000);
    const inThirtyOne = new Date(now.getTime() + 31 * 60 * 1000);

    const upcoming = await db.appointment.findMany({
      where: {
        status:      "CONFIRMED",
        scheduledAt: { gte: inThirty, lte: inThirtyOne },
      },
      include: {
        consultant: { include: { user: { select: { id: true, name: true } } } },
        anonUser:   true,
      },
    });

    let sent = 0;
    for (const appt of upcoming) {
      const exists = await db.notification.findFirst({
        where: {
          type: "APPOINTMENT_REMINDER",
          data: { path: ["appointmentId"], equals: appt.id },
        },
      });
      if (exists) continue;

      const clientName = appt.anonUser?.nickname ?? "العميل";
      if (appt.consultant.userId) {
        await notify({
          type:   "APPOINTMENT_REMINDER",
          title:  "جلسة قريبة",
          body:   `لديك جلسة مع ${clientName} بعد 30 دقيقة`,
          link:   `/consultant/appointments`,
          data:   { appointmentId: appt.id },
          userId: appt.consultant.userId,
        });
        sent++;
      }
    }
    return { sent, checked: upcoming.length };
  }),
});
