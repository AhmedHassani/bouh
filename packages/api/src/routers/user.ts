import { TRPCError } from "@trpc/server";
import { db } from "@repo/db";
import { createUserSchema, updateUserSchema } from "@repo/validators";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const userRouter = createTRPCRouter({
  getMe: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.user.findUnique({
      where: { clerkId: ctx.userId },
    });

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return user;
  }),

  create: protectedProcedure.input(createUserSchema).mutation(async ({ input }) => {
    return db.user.create({ data: input });
  }),

  update: protectedProcedure.input(updateUserSchema).mutation(async ({ ctx, input }) => {
    return db.user.update({
      where: { clerkId: ctx.userId },
      data: input,
    });
  }),
});
