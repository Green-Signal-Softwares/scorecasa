import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import leadsRouter from "./leads";
import brokersRouter from "./brokers";
import dashboardRouter from "./dashboard";
import funnelRouter from "./funnel";
import rankingRouter from "./ranking";
import notificationsRouter from "./notifications";
import clientRouter from "./client";
import propertiesRouter from "./properties";
import subscriptionsRouter from "./subscriptions";
import ratingsRouter from "./ratings";
import salesHistoryRouter from "./sales-history";
import bureauOcrRouter from "./bureau-ocr";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/leads", leadsRouter);
router.use("/brokers", brokersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/funnel", funnelRouter);
router.use("/ranking", rankingRouter);
router.use("/notifications", notificationsRouter);
router.use("/client", clientRouter);
router.use("/properties", propertiesRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/ratings", ratingsRouter);
router.use("/sales-history", salesHistoryRouter);
router.use("/bureau-ocr", bureauOcrRouter);

export default router;
