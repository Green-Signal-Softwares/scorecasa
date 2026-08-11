export type PaymentViewFilter = "all" | "pending" | "paid";

export type PaymentBucket = "atrasado" | "hoje" | "semana" | "proximos" | "pago";

export interface PaymentItem {
  id: number;
  category: string;
  description: string;
  issuer: string | null;
  amountCents: number;
  dueDate: string;
  recurring: boolean;
  paidAt: string | null;
  paidAmountCents: number | null;
  bucket: PaymentBucket;
  daysToDue: number;
}

export interface PaymentsSection {
  id: "upcoming" | "paid";
  title: string;
  buckets: PaymentBucket[];
  items: PaymentItem[];
}

export function filterPaymentsByView(items: PaymentItem[], filter: PaymentViewFilter) {
  if (filter === "paid") return items.filter((item) => item.bucket === "pago");
  if (filter === "pending") return items.filter((item) => item.bucket !== "pago");
  return items;
}

export function buildPaymentsSections(items: PaymentItem[]): PaymentsSection[] {
  const pendingItems = items.filter((item) => item.bucket !== "pago");
  const paidItems = items.filter((item) => item.bucket === "pago");

  return [
    {
      id: "upcoming",
      title: "Próximos e em atraso",
      buckets: ["atrasado", "hoje", "semana", "proximos"],
      items: pendingItems,
    },
    {
      id: "paid",
      title: "Pagos",
      buckets: ["pago"],
      items: paidItems,
    },
  ];
}
