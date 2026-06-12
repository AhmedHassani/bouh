import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import {
  createConsultantSchema,
  updateConsultantSchema,
  consultantFilterSchema,
} from "@repo/validators";
import { createTRPCRouter, publicProcedure, adminProcedure, consultantProcedure, protectedProcedure } from "../trpc";

const consultantInclude = {
  user: { select: { id: true, name: true, email: true, avatar: true, isActive: true, createdAt: true } },
  specializations: {
    include: { specialization: true },
  },
  _count: { select: { appointments: true, reviews: true } },
} as const;

export const consultantRouter = createTRPCRouter({
  // Public — browse consultants
  list: publicProcedure.input(consultantFilterSchema).query(async ({ input }) => {
    const where: Record<string, unknown> = {};
    if (input.isActive !== undefined) where["user"] = { isActive: input.isActive };
    if (input.city) where["city"] = { contains: input.city, mode: "insensitive" };
    if (input.minPrice !== undefined || input.maxPrice !== undefined) {
      where["sessionPrice"] = {
        ...(input.minPrice !== undefined && { gte: input.minPrice }),
        ...(input.maxPrice !== undefined && { lte: input.maxPrice }),
      };
    }
    if (input.minExperience !== undefined) {
      where["yearsOfExperience"] = { gte: input.minExperience };
    }
    if (input.specializationId) {
      where["specializations"] = {
        some: { specializationId: input.specializationId },
      };
    }

    const [data, total] = await Promise.all([
      db.consultantProfile.findMany({
        where,
        include: consultantInclude,
        orderBy: { [input.sortBy]: input.sortOrder },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      db.consultantProfile.count({ where }),
    ]);

    return { data, total, page: input.page, limit: input.limit };
  }),

  // Public — single profile
  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const consultant = await db.consultantProfile.findUnique({
      where: { id: input.id },
      include: {
        ...consultantInclude,
        reviews: {
          where: { isVisible: true },
          include: { client: { include: { user: { select: { name: true, avatar: true } } } } },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });
    if (!consultant) throw new TRPCError({ code: "NOT_FOUND" });
    return consultant;
  }),

  // Admin — create
  create: adminProcedure.input(createConsultantSchema).mutation(async ({ input }) => {
    const { specializationIds, avatar, ...rest } = input;
    const user = await db.user.create({
      data: {
        clerkId: `manual_${Date.now()}`,
        email: rest.email,
        name: rest.name,
        avatar,
        role: "CONSULTANT",
        consultantProfile: {
          create: {
            bio: rest.bio,
            sessionPrice: rest.sessionPrice,
            city: rest.city,
            yearsOfExperience: rest.yearsOfExperience,
            academicQualification: rest.academicQualification,
            certifications: rest.certifications,
            commissionRate: rest.commissionRate,
            specializations: {
              create: specializationIds.map((sid) => ({ specializationId: sid })),
            },
          },
        },
      },
      include: { consultantProfile: true },
    });
    return user;
  }),

  // Admin — update
  update: adminProcedure
    .input(z.object({ id: z.string(), data: updateConsultantSchema }))
    .mutation(async ({ input }) => {
      const { specializationIds, ...rest } = input.data;
      const profile = await db.consultantProfile.update({
        where: { id: input.id },
        data: {
          ...rest,
          ...(specializationIds && {
            specializations: {
              deleteMany: {},
              create: specializationIds.map((sid) => ({ specializationId: sid })),
            },
          }),
        },
        include: consultantInclude,
      });
      return profile;
    }),

  // Admin — toggle active
  toggleActive: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const profile = await db.consultantProfile.findUniqueOrThrow({
      where: { id: input.id },
      include: { user: true },
    });
    return db.user.update({
      where: { id: profile.userId },
      data: { isActive: !profile.user.isActive },
    });
  }),

  // Admin — delete
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const profile = await db.consultantProfile.findUniqueOrThrow({ where: { id: input.id } });
    return db.user.delete({ where: { id: profile.userId } });
  }),

  // Consultant — get own profile
  getMyProfile: consultantProcedure.query(async ({ ctx }) => {
    return db.consultantProfile.findUniqueOrThrow({
      where: { userId: ctx.dbUserId! },
      include: consultantInclude,
    });
  }),

  // Consultant — update own profile
  updateMyProfile: consultantProcedure
    .input(updateConsultantSchema.omit({ commissionRate: true, isActive: true }))
    .mutation(async ({ ctx, input }) => {
      const { specializationIds, ...rest } = input;
      return db.consultantProfile.update({
        where: { userId: ctx.dbUserId! },
        data: {
          ...rest,
          ...(specializationIds && {
            specializations: {
              deleteMany: {},
              create: specializationIds.map((sid) => ({ specializationId: sid })),
            },
          }),
        },
        include: consultantInclude,
      });
    }),

  // Consultant — availability
  getAvailability: protectedProcedure
    .input(z.object({ consultantId: z.string() }))
    .query(async ({ input }) => {
      return db.availability.findMany({
        where: { consultantId: input.consultantId, isActive: true },
        include: { blockedDates: true },
        orderBy: { dayOfWeek: "asc" },
      });
    }),

  setAvailability: consultantProcedure
    .input(
      z.array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string(),
          endTime: z.string(),
          slotDuration: z.number().int().min(30).default(60),
        }),
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({
        where: { userId: ctx.dbUserId! },
      });
      await db.availability.deleteMany({ where: { consultantId: profile.id } });
      return db.availability.createMany({
        data: input.map((slot) => ({ ...slot, consultantId: profile.id })),
      });
    }),

  // Time off — get all
  getTimeOff: consultantProcedure.query(async ({ ctx }) => {
    const profile = await db.consultantProfile.findUniqueOrThrow({ where: { userId: ctx.dbUserId! } });
    return db.consultantTimeOff.findMany({
      where: { consultantId: profile.id },
      orderBy: { startDate: "asc" },
    });
  }),

  // Time off — add range
  addTimeOff: consultantProcedure
    .input(z.object({
      startDate: z.string(), // ISO date string
      endDate:   z.string(),
      note:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({ where: { userId: ctx.dbUserId! } });
      return db.consultantTimeOff.create({
        data: {
          consultantId: profile.id,
          startDate: new Date(input.startDate),
          endDate:   new Date(input.endDate),
          note:      input.note,
        },
      });
    }),

  // Time off — delete
  deleteTimeOff: consultantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await db.consultantProfile.findUniqueOrThrow({ where: { userId: ctx.dbUserId! } });
      return db.consultantTimeOff.delete({
        where: { id: input.id, consultantId: profile.id },
      });
    }),
});
