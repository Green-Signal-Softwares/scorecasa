import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import { requirePaid } from "../middlewares/requirePaid";
import leadsRouter from "./leads";
import brokersRouter from "./brokers";
import dashboardRouter from "./dashboard";
import funnelRouter from "./funnel";
import rankingRouter from "./ranking";
import notificationsRouter from "./notifications";
import clientRouter from "./client";
import clientPaymentsRouter from "./client-payments";
import propertiesRouter from "./properties";
import subscriptionsRouter from "./subscriptions";
import ratingsRouter from "./ratings";
import salesHistoryRouter from "./sales-history";
import bureauOcrRouter from "./bureau-ocr";
import storageRouter from "./storage";
import processesRouter from "./processes";
import cpfLookupRouter from "./cpf-lookup";
import openFinanceRouter from "./open-finance";
import caixaLtvRouter from "./caixa-ltv";
import calcRouter from "./calc";
import clientDocumentsRouter from "./client-documents";
import ratesRouter from "./rates";
import plansRouter from "./plans";
import teamRouter from "./team";
import asaasRouter from "./asaas";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/plans", plansRouter);

router.use((req, res, next) => {
  const isAuthRoute = req.path.startsWith("/auth") || req.path === "/auth";
  if (isAuthRoute) {
    next();
    return;
  }
  requirePaid(req as any, res as any, next as any);
});

router.use("/leads", leadsRouter);
router.use("/brokers", brokersRouter);
router.use("/dashboard", dashboardRouter);
router.use("/funnel", funnelRouter);
router.use("/ranking", rankingRouter);
router.use("/notifications", notificationsRouter);
router.use("/client/payments", clientPaymentsRouter);
router.use("/client", clientRouter);
router.use("/properties", propertiesRouter);
router.use("/subscriptions", subscriptionsRouter);
router.use("/ratings", ratingsRouter);
router.use("/sales-history", salesHistoryRouter);
router.use("/bureau-ocr", bureauOcrRouter);
router.use(storageRouter);
router.use("/correspondent/processes", processesRouter);
router.use("/cpf", cpfLookupRouter);
router.use("/client/open-finance", openFinanceRouter);
router.use("/client/documents", clientDocumentsRouter);
router.use("/caixa-ltv", caixaLtvRouter);
router.use("/calc", calcRouter);
router.use("/rates", ratesRouter);
router.use("/team", teamRouter);
router.use("/asaas", asaasRouter);

export default router;
