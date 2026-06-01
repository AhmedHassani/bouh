import { createTRPCRouter } from "./trpc";
import { userRouter } from "./routers/user";

export const appRouter = createTRPCRouter({
  user: userRouter,
});

export type AppRouter = typeof appRouter;

export { createTRPCRouter, publicProcedure, protectedProcedure } from "./trpc";
export type { Context } from "./trpc";
