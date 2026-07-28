export type BillingInterval = "monthly" | "yearly";

export function normalizeBillingInterval(interval: string | null | undefined): BillingInterval {
  return interval === "yearly" ? "yearly" : "monthly";
}

export function getBillingAmount(
  plan: { priceMonthly: number; priceYearly?: number | null },
  interval: string | null | undefined,
): number {
  const normalized = normalizeBillingInterval(interval);
  return normalized === "yearly" ? (plan.priceYearly ?? plan.priceMonthly) : plan.priceMonthly;
}

export function getNextDueDate(interval: string | null | undefined, baseDate: Date = new Date()): Date {
  const next = new Date(baseDate);
  const normalized = normalizeBillingInterval(interval);
  if (normalized === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
