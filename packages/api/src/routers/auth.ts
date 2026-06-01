import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure } from "../trpc";
import { signAccessToken, signRefreshToken, verifyRefreshToken, signGuestToken } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/password";

const REFRESH_TTL_DAYS = 7;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function issueTokenPair(userId: string, role: string) {
  // Create refresh token record
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  const record = await db.refreshToken.create({
    data: { userId, expiresAt, token: "pending" },
  });

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId, role),
    signRefreshToken(userId, record.id),
  ]);

  // Store the signed refresh token string
  await db.refreshToken.update({ where: { id: record.id }, data: { token: refreshToken } });

  return { accessToken, refreshToken, expiresIn: 15 * 60 }; // 15 min in seconds
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const authRouter = createTRPCRouter({
  // ── Login (Admin / Consultant) ──────────────────────────────────────────────
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(6) }))
    .mutation(async ({ input }) => {
      const user = await db.user.findUnique({ where: { email: input.email } });

      if (!user || !user.password || !user.isActive) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      if (user.role === "CLIENT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "هذا الحساب لا يملك صلاحية الدخول" });
      }

      const valid = await verifyPassword(input.password, user.password);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
      }

      await db.auditLog.create({
        data: { userId: user.id, action: "LOGIN", resource: "auth" },
      });

      const tokens = await issueTokenPair(user.id, user.role);
      return {
        ...tokens,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar: user.avatar },
      };
    }),

  // ── Refresh Access Token ────────────────────────────────────────────────────
  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string() }))
    .mutation(async ({ input }) => {
      const payload = await verifyRefreshToken(input.refreshToken);
      if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "رمز التحديث غير صالح" });

      const record = await db.refreshToken.findUnique({ where: { id: payload.jti } });
      if (!record || record.revokedAt || record.expiresAt < new Date()) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً" });
      }

      // Rotate: revoke old, issue new
      await db.refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date() } });

      const user = await db.user.findUniqueOrThrow({ where: { id: record.userId } });
      return issueTokenPair(user.id, user.role);
    }),

  // ── Logout ─────────────────────────────────────────────────────────────────
  logout: protectedProcedure
    .input(z.object({ refreshToken: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.refreshToken) {
        const payload = await verifyRefreshToken(input.refreshToken);
        if (payload?.jti) {
          await db.refreshToken.updateMany({
            where: { id: payload.jti, userId: ctx.dbUserId! },
            data: { revokedAt: new Date() },
          });
        }
      }
      // Revoke all sessions for this user
      await db.refreshToken.updateMany({
        where: { userId: ctx.dbUserId!, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await db.auditLog.create({
        data: { userId: ctx.dbUserId!, action: "LOGOUT", resource: "auth" },
      });

      return { success: true };
    }),

  // ── Me ─────────────────────────────────────────────────────────────────────
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { id: ctx.dbUserId! },
      select: { id: true, name: true, email: true, role: true, avatar: true, isActive: true },
    });
    return user;
  }),

  // ── Admin: create consultant account ───────────────────────────────────────
  createConsultant: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(8),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await db.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مستخدم بالفعل" });

      const hashed = await hashPassword(input.password);

      const user = await db.user.create({
        data: {
          clerkId: `consultant_${Date.now()}`,
          email: input.email,
          name: input.name,
          phone: input.phone,
          password: hashed,
          role: "CONSULTANT",
          consultantProfile: { create: {} },
        },
        select: { id: true, email: true, name: true, role: true },
      });

      return user;
    }),

  // ── Admin: create admin account ────────────────────────────────────────────
  createAdmin: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(2),
        password: z.string().min(8),
        role: z.enum(["ADMIN", "SUPER_ADMIN"]).default("ADMIN"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Only SUPER_ADMIN can create another SUPER_ADMIN
      if (input.role === "SUPER_ADMIN" && ctx.userRole !== "SUPER_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "فقط المدير العام يمكنه إنشاء حساب مدير عام" });
      }

      const existing = await db.user.findUnique({ where: { email: input.email } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "البريد الإلكتروني مستخدم بالفعل" });

      const hashed = await hashPassword(input.password);

      return db.user.create({
        data: {
          clerkId: `admin_${Date.now()}`,
          email: input.email,
          name: input.name,
          password: hashed,
          role: input.role,
        },
        select: { id: true, email: true, name: true, role: true },
      });
    }),

  // ── Guest: issue token for anonymous user ───────────────────────────────────
  guestToken: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .mutation(async ({ input }) => {
      const user = await db.anonymousUser.findUnique({ where: { id: input.anonUserId } });
      if (!user) throw new TRPCError({ code: "NOT_FOUND" });
      const token = await signGuestToken(user.id);
      return { guestToken: token, expiresIn: 30 * 24 * 60 * 60 };
    }),
});
