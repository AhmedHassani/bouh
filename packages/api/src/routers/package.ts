import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createTRPCRouter, publicProcedure, adminProcedure } from "../trpc";

export const packageRouter = createTRPCRouter({
  // ─── Admin: list all packages (active + inactive) ───
  listAll: adminProcedure.query(() =>
    db.package.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { userPackages: true } },
      },
    }),
  ),

  // ─── Public: list active packages only ───
  list: publicProcedure.query(() =>
    db.package.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ),

  // ─── Admin: create ───
  create: adminProcedure
    .input(z.object({
      nameAr:        z.string().min(2),
      descriptionAr: z.string().optional(),
      sessions:      z.number().int().min(1),
      price:         z.number().min(0),
      icon:          z.string().optional(),
      isFeatured:    z.boolean().default(false),
      sortOrder:     z.number().int().default(0),
    }))
    .mutation(({ input }) =>
      db.package.create({ data: input }),
    ),

  // ─── Admin: update ───
  update: adminProcedure
    .input(z.object({
      id:   z.string(),
      data: z.object({
        nameAr:        z.string().min(2).optional(),
        descriptionAr: z.string().optional().nullable(),
        sessions:      z.number().int().min(1).optional(),
        price:         z.number().min(0).optional(),
        icon:          z.string().optional().nullable(),
        isFeatured:    z.boolean().optional(),
        isActive:      z.boolean().optional(),
        sortOrder:     z.number().int().optional(),
      }),
    }))
    .mutation(({ input }) =>
      db.package.update({
        where: { id: input.id },
        data:  input.data as never,
      }),
    ),

  // ─── Admin: delete ───
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const inUse = await db.userPackage.count({ where: { packageId: input.id } });
      if (inUse > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "لا يمكن حذف باقة مستخدمة — قم بتعطيلها بدلاً من ذلك",
        });
      }
      return db.package.delete({ where: { id: input.id } });
    }),

  // ─── Public: get user's purchased packages ───
  myPackages: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(({ input }) =>
      db.userPackage.findMany({
        where: {
          anonUserId:    input.anonUserId,
          paymentStatus: "PAID",
        },
        include: { package: true },
        orderBy: { purchasedAt: "desc" },
      }),
    ),

  // ─── Public: get count of remaining package sessions ───
  myRemainingSessions: publicProcedure
    .input(z.object({ anonUserId: z.string() }))
    .query(async ({ input }) => {
      const packages = await db.userPackage.findMany({
        where: {
          anonUserId:    input.anonUserId,
          paymentStatus: "PAID",
        },
      });
      return packages.reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0);
    }),

  // ─── Public: purchase package (creates UserPackage; payment flow follows) ───
  purchase: publicProcedure
    .input(z.object({
      anonUserId:    z.string(),
      packageId:     z.string(),
      paymentMethod: z.enum(["REPRESENTATIVE", "ELECTRONIC"]),
    }))
    .mutation(async ({ input }) => {
      const pkg = await db.package.findUnique({ where: { id: input.packageId } });
      if (!pkg || !pkg.isActive) {
        throw new TRPCError({ code: "NOT_FOUND", message: "الباقة غير متاحة" });
      }

      const userPackage = await db.userPackage.create({
        data: {
          packageId:     input.packageId,
          anonUserId:    input.anonUserId,
          totalSessions: pkg.sessions,
          usedSessions:  0,
          pricePaid:     pkg.price,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === "REPRESENTATIVE" ? "PENDING" : "PENDING",
        },
        include: { package: true },
      });

      return userPackage;
    }),

  // ─── Public: start ZainCash payment for a user package ───
  startZainCashPayment: publicProcedure
    .input(z.object({
      userPackageId: z.string(),
      anonUserId:    z.string(),
    }))
    .mutation(async ({ input }) => {
      const { initZainCashPayment } = await import("../lib/zaincash");

      const userPackage = await db.userPackage.findUniqueOrThrow({
        where: { id: input.userPackageId },
        include: { package: true },
      });

      if (userPackage.anonUserId !== input.anonUserId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      if (userPackage.paymentStatus === "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "تم الدفع بالفعل" });
      }

      const appUrl = process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "http://localhost:3000";

      const result = await initZainCashPayment({
        amount:      Number(userPackage.pricePaid),
        orderId:     userPackage.id,
        serviceType: `باقة - ${userPackage.package.nameAr}`,
        successUrl:  `${appUrl}/api/zaincash/package-callback/${userPackage.id}/success`,
        failureUrl:  `${appUrl}/api/zaincash/package-callback/${userPackage.id}/failure`,
      });

      await db.userPackage.update({
        where: { id: userPackage.id },
        data:  { paymentRef: result.transactionId },
      });

      return { paymentUrl: result.paymentUrl };
    }),
});
