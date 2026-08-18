/**
 * Asaas payment gateway integration — ScoreCasa
 * Billing method: CREDIT_CARD only
 *
 * Env vars:
 *   ASAAS_API_KEY     — required for live/sandbox API calls. If unconfigured, falls back to local dev mock mode.
 *   ASAAS_SANDBOX     — set to "true" to use sandbox (default: production)
 */

export function getAsaasBaseUrl(): string {
  // ASAAS_BASE_URL takes precedence (set in .env.example as sandbox URL)
  if (process.env.ASAAS_BASE_URL) return process.env.ASAAS_BASE_URL;
  // Fallback: ASAAS_SANDBOX=true → sandbox
  const sandbox = process.env.ASAAS_SANDBOX === "true";
  return sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

export function getAsaasWalletId(): string {
  return process.env.ASAAS_WALLET_ID ?? "";
}

function getApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) return "";
  return key;
}

async function asaasRequest<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getAsaasBaseUrl()}${path}`;
  console.log(`[asaasRequest] ${method} ${url}`, JSON.stringify(body));
  const resp = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      access_token: getApiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  console.log(`[asaasRequest] response status: ${resp.status}`, text);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  if (!resp.ok) {
    const msg =
      (json as any)?.errors?.[0]?.description ??
      (json as any)?.message ??
      `Asaas error ${resp.status}`;
    throw new Error(msg);
  }

  return json as T;
}

// ── Customer ──────────────────────────────────────────────────────────────────

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
}

export async function createAsaasCustomer(
  data: AsaasCustomerInput,
): Promise<AsaasCustomer> {
  const key = process.env.ASAAS_API_KEY;
  if (!key || key.trim() === "" || key === "mock") {
    console.log("[Asaas MOCK] Creating customer for:", data.name);
    return {
      id: `cus_mock_${Date.now()}`,
      name: data.name,
      email: data.email,
      cpfCnpj: data.cpfCnpj,
    };
  }
  return asaasRequest<AsaasCustomer>("POST", "/customers", data);
}

// ── Credit Card ───────────────────────────────────────────────────────────────

export interface AsaasCreditCard {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
}

export interface AsaasCreditCardHolderInfo {
  name: string;
  email?: string;
  cpfCnpj: string;
  postalCode?: string;
  addressNumber?: string;
  phone?: string;
  mobilePhone?: string;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export interface AsaasPaymentInput {
  customer: string;
  billingType: "CREDIT_CARD";
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  postalService?: boolean;
  remoteIp?: string;
  creditCard: AsaasCreditCard;
  creditCardHolderInfo: AsaasCreditCardHolderInfo;
}

export interface AsaasPayment {
  id: string;
  status: string;
  billingType: string;
  value: number;
  dueDate: string;
  netValue?: number;
  description?: string;
  externalReference?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  transactionReceiptUrl?: string;
}

export async function createAsaasPayment(
  data: AsaasPaymentInput,
): Promise<AsaasPayment> {
  const key = process.env.ASAAS_API_KEY;
  if (!key || key.trim() === "" || key === "mock") {
    console.log("[Asaas MOCK] Processing payment for amount:", data.value);
    return {
      id: `pay_mock_${Date.now()}`,
      status: "CONFIRMED",
      billingType: "CREDIT_CARD",
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
    };
  }
  return asaasRequest<AsaasPayment>("POST", "/payments", data);
}

export async function getAsaasPayment(id: string): Promise<AsaasPayment> {
  const key = process.env.ASAAS_API_KEY;
  if (!key || key.trim() === "" || key === "mock" || id.startsWith("pay_mock_")) {
    return {
      id,
      status: "CONFIRMED",
      billingType: "CREDIT_CARD",
      value: 0,
      dueDate: new Date().toISOString().slice(0, 10),
    };
  }
  return asaasRequest<AsaasPayment>("GET", `/payments/${id}`);
}

/** Not needed for CREDIT_CARD, kept for compatibility */
export async function getAsaasPixQrCode(_paymentId: string): Promise<null> {
  return null;
}
