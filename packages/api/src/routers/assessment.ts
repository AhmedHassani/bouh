import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createAssessmentSchema, createQuestionSchema, submitAssessmentSchema } from "@repo/validators";
import { createTRPCRouter, publicProcedure, adminProcedure, protectedProcedure } from "../trpc";

export const assessmentRouter = createTRPCRouter({
  list: publicProcedure.query(() =>
    db.assessment.findMany({
      where: { isActive: true },
      include: { _count: { select: { questions: true } } },
    }),
  ),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const assessment = await db.assessment.findUnique({
      where: { id: input.id, isActive: true },
      include: {
        questions: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
        categories: { orderBy: { minScore: "asc" } },
      },
    });
    if (!assessment) throw new TRPCError({ code: "NOT_FOUND" });
    return assessment;
  }),

  // Admin
  create: adminProcedure.input(createAssessmentSchema).mutation(async ({ input }) => {
    const { categories, ...rest } = input;
    return db.assessment.create({
      data: { ...rest, categories: { create: categories } },
    });
  }),

  addQuestion: adminProcedure.input(createQuestionSchema).mutation(async ({ input }) => {
    const { options, ...rest } = input;
    return db.assessmentQuestion.create({
      data: { ...rest, options: { create: options } },
      include: { options: true },
    });
  }),

  deleteQuestion: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => db.assessmentQuestion.delete({ where: { id: input.id } })),

  toggleQuestion: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    const q = await db.assessmentQuestion.findUniqueOrThrow({ where: { id: input.id } });
    return db.assessmentQuestion.update({ where: { id: input.id }, data: { isActive: !q.isActive } });
  }),

  reorderQuestions: adminProcedure
    .input(z.array(z.object({ id: z.string(), order: z.number().int() })))
    .mutation(async ({ input }) => {
      await Promise.all(
        input.map((item) =>
          db.assessmentQuestion.update({ where: { id: item.id }, data: { order: item.order } }),
        ),
      );
      return { success: true };
    }),

  // Client — submit
  submit: protectedProcedure.input(submitAssessmentSchema).mutation(async ({ ctx, input }) => {
    const client = await db.clientProfile.findUnique({ where: { userId: ctx.dbUserId! } });
    if (!client) throw new TRPCError({ code: "FORBIDDEN" });

    const assessment = await db.assessment.findUniqueOrThrow({
      where: { id: input.assessmentId },
      include: { categories: { orderBy: { minScore: "asc" } } },
    });

    const options = await db.questionOption.findMany({
      where: { id: { in: input.answers.map((a) => a.optionId) } },
    });

    const totalScore = options.reduce((sum, o) => sum + o.score, 0);
    const category = assessment.categories.find(
      (c) => totalScore >= c.minScore && totalScore <= c.maxScore,
    );

    const result = await db.assessmentResult.create({
      data: {
        assessmentId: input.assessmentId,
        clientId: client.id,
        totalScore,
        categoryLabel: category?.labelAr,
        answers: {
          create: input.answers.map((a) => {
            const option = options.find((o) => o.id === a.optionId)!;
            return {
              questionId: a.questionId,
              optionId: a.optionId,
              score: option.score,
            };
          }),
        },
      },
      include: { answers: true },
    });

    return { result, category };
  }),

  myResults: protectedProcedure.query(async ({ ctx }) => {
    const client = await db.clientProfile.findUnique({ where: { userId: ctx.dbUserId! } });
    if (!client) return [];
    return db.assessmentResult.findMany({
      where: { clientId: client.id },
      include: { assessment: true },
      orderBy: { completedAt: "desc" },
    });
  }),
});
