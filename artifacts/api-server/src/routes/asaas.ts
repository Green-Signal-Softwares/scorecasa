import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, subscriptionsTable } from "@workspace/db";
import {
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasBaseUrl,
  getAsaasWalletId,
  getAsaasPayment,
} from "../lib/asaas";
import { logger } from "../lib/logger";
import { getNextDueDate } from "../lib/billing";

const router = Router();

function requireAuth(req: any, res: any, next: () => void) {
  if (!(req as any).session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

const CustomerBody = z.object({
  name: z.string().min(2),
  cpfCnpj: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
  externalReference: z.string().optional(),
  notificationDisabled: z.boolean().optional(),
});

const CreditCardSchema = z.object({
  holderName: z.string().min(2),
  number: z.string().min(13).max(19),
  expiryMonth: z.string().length(2),
  expiryYear: z.string().length(4),
  ccv: z.string().min(3).max(4),
});

const CreditCardHolderInfoSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  cpfCnpj: z.string().min(11),
  postalCode: z.string().optional(),
  addressNumber: z.string().optional(),
  phone: z.string().optional(),
  mobilePhone: z.string().optional(),
});

const CreatePaymentBody = z.object({
  subscriptionId: z.number().int().optional(),
  customerId: z.string().min(1).optional(),
  customer: CustomerBody.optional(),
  /** Billing type is always CREDIT_CARD */
  billingType: z.literal("CREDIT_CARD").default("CREDIT_CARD"),
  value: z.number().positive(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().optional(),
  externalReference: z.string().optional(),
  remoteIp: z.string().optional(),
  creditCard: CreditCardSchema,
  creditCardHolderInfo: CreditCardHolderInfoSchema,
});

const PaymentWebhookBody = z.object({
  event: z.string(),
  payment: z
    .object({
      id: z.string().optional(),
      status: z.string().optional(),
      value: z.number().optional(),
      dueDate: z.string().optional(),
      billingType: z.string().optional(),
      externalReference: z.string().optional(),
      clientPaymentDate: z.string().optional(),
      confirmedDate: z.string().optional(),
    })
    .optional(),
});

function parseSubscriptionIdFromReference(ref?: string | null): number | null {
  if (!ref) return null;
  const match = ref.match(/sub:(\d+)/i);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

async function updateSubscriptionFromWebhookEvent(body: z.infer<typeof PaymentWebhookBody>) {
  const event = body.event;
  const payment = body.payment;
  const subId = parseSubscriptionIdFromReference(payment?.externalReference);
  if (!subId) return;

  const [existing] = await db
    .select()
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.id, subId))
    .limit(1);
  if (!existing) return;

  const patch: Partial<typeof subscriptionsTable.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_CONFIRMED_IN_CASH"].includes(event)) {
    patch.status = "active";
    patch.lastPaymentAt = payment?.clientPaymentDate
      ? new Date(payment.clientPaymentDate)
      : payment?.confirmedDate
        ? new Date(payment.confirmedDate)
        : new Date();
    patch.nextDueAt = getNextDueDate(existing.billingInterval);
  }

  if (event === "PAYMENT_OVERDUE") {
    patch.status = "overdue";
  }

  if (event === "PAYMENT_DELETED") {
    patch.status = "inactive";
  }

  if (Object.keys(patch).length <= 1) return;

  await db.update(subscriptionsTable).set(patch).where(eq(subscriptionsTable.id, subId));
}

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    provider: "asaas",
    billingMethod: "CREDIT_CARD",
    baseUrl: getAsaasBaseUrl(),
    walletId: getAsaasWalletId(),
    configured: !!process.env.ASAAS_API_KEY,
  });
});

router.post("/customers", requireAuth, async (req, res) => {
  const parsed = CustomerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  try {
    const customer = await createAsaasCustomer(parsed.data);
    res.status(201).json(customer);
  } catch (error: any) {
    logger.error({ err: error }, "Asaas customer creation failed");
    res.status(502).json({ error: error?.message ?? "Asaas customer creation failed" });
  }
});

router.post("/payments", requireAuth, async (req, res) => {
  const parsed = CreatePaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.issues });
    return;
  }

  const body = parsed.data;

  if (!body.customerId && !body.customer) {
    res.status(400).json({ error: "Provide customerId or customer payload" });
    return;
  }

  try {
    let customerId = body.customerId;
    if (!customerId && body.customer) {
      const customer = await createAsaasCustomer(body.customer);
      customerId = customer.id;
    }

    const externalReference =
      body.externalReference ?? (body.subscriptionId ? `sub:${body.subscriptionId}` : undefined);

    const dueDate = body.dueDate ?? new Date().toISOString().slice(0, 10);

    const payment = await createAsaasPayment({
      customer: customerId!,
      billingType: "CREDIT_CARD",
      value: body.value,
      dueDate,
      description: body.description,
      externalReference,
      remoteIp: body.remoteIp,
      creditCard: body.creditCard,
      creditCardHolderInfo: body.creditCardHolderInfo,
    });

    res.status(201).json({ payment });
  } catch (error: any) {
    logger.error({ err: error }, "Asaas payment creation failed");
    res.status(502).json({ error: error?.message ?? "Asaas payment creation failed" });
  }
});

router.get("/payments/:id", requireAuth, async (req, res) => {
  try {
    const payment = await getAsaasPayment(req.params.id);
    res.json(payment);
  } catch (error: any) {
    logger.error({ err: error }, "Asaas payment fetch failed");
    res.status(502).json({ error: error?.message ?? "Asaas payment fetch failed" });
  }
});

router.post("/webhook", async (req, res) => {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const gotToken = req.headers["asaas-access-token"];

  if (expectedToken && gotToken !== expectedToken) {
    res.status(401).json({ error: "Invalid webhook token" });
    return;
  }

  const parsed = PaymentWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid webhook payload", details: parsed.error.issues });
    return;
  }

  try {
    await updateSubscriptionFromWebhookEvent(parsed.data);
    logger.info({ event: parsed.data.event, paymentId: parsed.data.payment?.id }, "Asaas webhook received");
    res.json({ ok: true });
  } catch (error: any) {
    logger.error({ err: error }, "Asaas webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
