import { createTRPCRouter } from "./trpc";
import { userRouter } from "./routers/user";
import { consultantRouter } from "./routers/consultant";
import { specializationRouter } from "./routers/specialization";
import { appointmentRouter } from "./routers/appointment";
import { couponRouter } from "./routers/coupon";
import { assessmentRouter } from "./routers/assessment";
import { earningRouter } from "./routers/earning";
import { settingRouter } from "./routers/setting";
import { notificationRouter } from "./routers/notification";
import { adminRouter } from "./routers/admin";

export const appRouter = createTRPCRouter({
  user: userRouter,
  consultant: consultantRouter,
  specialization: specializationRouter,
  appointment: appointmentRouter,
  coupon: couponRouter,
  assessment: assessmentRouter,
  earning: earningRouter,
  setting: settingRouter,
  notification: notificationRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

export { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure, consultantProcedure } from "./trpc";
export type { Context } from "./trpc";
