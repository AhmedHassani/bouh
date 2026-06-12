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
import { anonymousRouter } from "./routers/anonymous";
import { authRouter } from "./routers/auth";
import { packageRouter } from "./routers/package";
import { sessionReportRouter } from "./routers/sessionReport";
import { bonusRouter } from "./routers/bonus";
import { sessionRecommendationRouter } from "./routers/sessionRecommendation";
import { chatRouter } from "./routers/chat";
import { reportRouter } from "./routers/report";

export const appRouter = createTRPCRouter({
  auth: authRouter,
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
  anonymous: anonymousRouter,
  package:   packageRouter,
  sessionReport: sessionReportRouter,
  bonus:    bonusRouter,
  sessionRecommendation: sessionRecommendationRouter,
  chat:     chatRouter,
  report:   reportRouter,
});

export type AppRouter = typeof appRouter;

export { createTRPCRouter, publicProcedure, protectedProcedure, adminProcedure, consultantProcedure } from "./trpc";
export type { Context } from "./trpc";
export { verifyAccessToken } from "./lib/jwt";
export { verifyZainCashCallback, verifyZainCashTransaction, verifyZainCashCallbackJWT } from "./lib/zaincash";
