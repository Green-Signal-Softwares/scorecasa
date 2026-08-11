import { logger } from "./logger";

const PLUGGY_API_URL = process.env.PLUGGY_API_URL || "https://api.pluggy.ai";
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;

let cachedApiKey: string | null = null;
let apiKeyExpiresAt: number = 0;

function requiredEnv(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`[Pluggy] Variável obrigatória ausente: ${name}`);
  }
  return value;
}

/**
 * Autentica na API da Pluggy e retorna a X-API-KEY
 */
export async function getPluggyApiKey(): Promise<string> {
  const now = Date.now();
  if (cachedApiKey && apiKeyExpiresAt > now + 60_000) {
    return cachedApiKey;
  }

  try {
    const clientId = requiredEnv(PLUGGY_CLIENT_ID, "PLUGGY_CLIENT_ID");
    const clientSecret = requiredEnv(PLUGGY_CLIENT_SECRET, "PLUGGY_CLIENT_SECRET");

    const res = await fetch(`${PLUGGY_API_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        clientSecret,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Falha na autenticação Pluggy [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as { apiKey: string };
    cachedApiKey = data.apiKey;
    // O token da Pluggy dura 2h -> expiração em 1h50m (6600s)
    apiKeyExpiresAt = now + 6600 * 1000;
    return cachedApiKey;
  } catch (err: any) {
    logger.error({ err: err.message }, "[Pluggy] Erro ao autenticar na API da Pluggy");
    throw err;
  }
}

/**
 * Cria um Connect Token para inicializar o Pluggy Connect Widget no frontend
 */
export async function createPluggyConnectToken(options?: {
  itemId?: string;
  clientUserId?: string;
  webhookUrl?: string;
  oauthRedirectUri?: string;
  avoidDuplicates?: boolean;
}): Promise<{ accessToken: string }> {
  const apiKey = await getPluggyApiKey();

  const payload: any = {};

  if (options?.itemId) payload.itemId = options.itemId;
  if (options?.clientUserId || options?.webhookUrl || options?.oauthRedirectUri || options?.avoidDuplicates) {
    payload.options = {};
    if (options?.clientUserId) payload.options.clientUserId = String(options.clientUserId);
    if (options?.webhookUrl) payload.options.webhookUrl = options.webhookUrl;
    if (options?.oauthRedirectUri) payload.options.oauthRedirectUri = options.oauthRedirectUri;
    if (typeof options?.avoidDuplicates === "boolean") payload.options.avoidDuplicates = options.avoidDuplicates;
  }

  const res = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao gerar Connect Token Pluggy [${res.status}]: ${errText}`);
  }

  const data = (await res.json()) as { accessToken: string };
  return { accessToken: data.accessToken };
}

export interface PluggyItem {
  id: string;
  status: string;
  executionStatus: string;
  connector: {
    id: number;
    name: string;
    primaryColor?: string;
    imageUrl?: string;
    hasWhiteLabel?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Busca detalhes de uma conexão (Item)
 */
export async function getPluggyItem(itemId: string): Promise<PluggyItem> {
  const apiKey = await getPluggyApiKey();

  const res = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao buscar Item Pluggy ${itemId} [${res.status}]: ${errText}`);
  }

  return (await res.json()) as PluggyItem;
}

export interface PluggyAccount {
  id: string;
  itemId?: string;
  name: string;
  type: "BANK" | "CREDIT";
  subtype?: string;
  balance: number;
  currencyCode: string;
  number?: string;
  creditData?: {
    creditLimit?: number;
    availableCreditLimit?: number;
    balanceCloseDate?: string;
    balanceDueDate?: string;
  };
}

/**
 * Busca as contas vinculadas a um Item
 */
export async function getPluggyAccounts(itemId: string): Promise<PluggyAccount[]> {
  const apiKey = await getPluggyApiKey();

  const res = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Falha ao buscar Contas Pluggy para item ${itemId} [${res.status}]: ${errText}`);
  }

  const data = (await res.json()) as { results: PluggyAccount[] };
  return data.results ?? [];
}

export interface PluggyTransaction {
  id: string;
  accountId: string;
  description: string;
  amount: number; // Negativo para débitos/gastos, positivo para depósitos/entradas
  date: string; // ISO date string
  category?: string;
  categoryGroup?: string;
  status?: string; // PENDING, POSTED
  type?: "DEBIT" | "CREDIT";
  creditCardMetadata?: {
    installmentNumber?: number;
    totalInstallments?: number;
  };
  paymentData?: {
    payer?: { name?: string; documentNumber?: string };
    receiver?: { name?: string; documentNumber?: string };
    reason?: string;
  };
}

/**
 * Busca movimentações/faturas e lançamentos futuros da conta bancária
 */
export async function getPluggyTransactions(
  accountId: string,
  from?: string,
  to?: string,
): Promise<PluggyTransaction[]> {
  const apiKey = await getPluggyApiKey();
  const allTx: PluggyTransaction[] = [];
  let after: string | null = null;
  let pages = 0;

  while (pages < 30) {
    pages++;
    const queryParams = new URLSearchParams({ accountId });
    if (from) queryParams.set("dateFrom", from);
    if (to) queryParams.set("dateTo", to);
    if (after) queryParams.set("after", after);

    const res = await fetch(`${PLUGGY_API_URL}/v2/transactions?${queryParams.toString()}`, {
      headers: { "X-API-KEY": apiKey },
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Falha ao buscar transações Pluggy account ${accountId} [${res.status}]: ${errText}`);
    }

    const data = (await res.json()) as { results?: PluggyTransaction[]; next?: string | null };
    allTx.push(...(data.results ?? []));

    const next = data.next || null;
    if (!next) break;

    const nextParams = new URLSearchParams(next.startsWith("?") ? next.slice(1) : next);
    const nextAfter = nextParams.get("after");
    if (!nextAfter || nextAfter === after) break;
    after = nextAfter;
  }

  return allTx;
}

/**
 * Busca todas as movimentações e obrigações futuras de todas as contas do Item
 */
export async function getPluggyItemTransactions(
  itemId: string,
  from?: string,
  to?: string,
): Promise<PluggyTransaction[]> {
  const accounts = await getPluggyAccounts(itemId);
  const allTx: PluggyTransaction[] = [];
  for (const acc of accounts) {
    const txs = await getPluggyTransactions(acc.id, from, to).catch((err) => {
      logger.warn({ err: err?.message, accountId: acc.id }, "[Pluggy] Erro ao buscar transações da conta");
      return [] as PluggyTransaction[];
    });
    allTx.push(...txs);
  }
  return allTx;
}
