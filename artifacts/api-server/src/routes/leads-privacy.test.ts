import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, leadsTable, usersTable, pool } from "@workspace/db";

function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p + "scorecasa_salt").digest("hex");
}

const BCB_FIELDS = [
  "bcbTotalDebt",
  "bcbMonthlyCommitment",
  "bcbOperationsCount",
  "bcbQueryDate",
  "bcbDebtsCurrent",
  "bcbDebtsOverdue",
  "bcbCreditLimits",
  "bcbOperationsJson",
] as const;

const DEBT_FIELDS = [
  "vehicleLoanMonthly",
  "otherLoansMonthly",
  "creditCardLimit",
  "creditCardUsage",
] as const;

const ALL_PRIVATE = [...DEBT_FIELDS, ...BCB_FIELDS] as const;

const PRIVATE_VALUES = {
  vehicleLoanMonthly: 800,
  otherLoansMonthly: 400,
  creditCardLimit: 10000,
  creditCardUsage: 50,
  bcbTotalDebt: 50000,
  bcbMonthlyCommitment: 1500,
  bcbOperationsCount: 5,
  bcbQueryDate: "2026-01-15",
  bcbDebtsCurrent: 45000,
  bcbDebtsOverdue: 5000,
  bcbCreditLimits: 20000,
  bcbOperationsJson: '[{"op":"x"}]',
} as const;

const tag = `privtest-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const clientEmail = `${tag}-client@test.local`;
const brokerEmail = `${tag}-broker@test.local`;

function randDigits(n: number): string {
  let s = "";
  while (s.length < n) s += crypto.randomInt(0, 1_000_000_000).toString();
  return s.slice(0, n);
}

let leadId = 0;
let clientUserId = 0;
let brokerUserId = 0;

beforeAll(async () => {
  const [lead] = await db
    .insert(leadsTable)
    .values({
      name: `Lead ${tag}`,
      cpf: randDigits(11),
      email: `${tag}-lead@test.local`,
      phone: "11999999999",
      income: 8000,
      propertyValue: 250000,
      ...PRIVATE_VALUES,
    })
    .returning();
  leadId = lead.id;

  const [client] = await db
    .insert(usersTable)
    .values({
      name: `Client ${tag}`,
      email: clientEmail,
      cpf: randDigits(11),
      passwordHash: hashPassword("secret123"),
      role: "client",
      leadId,
    })
    .returning();
  clientUserId = client.id;

  const [broker] = await db
    .insert(usersTable)
    .values({
      name: `Broker ${tag}`,
      email: brokerEmail,
      cpf: randDigits(11),
      passwordHash: hashPassword("secret123"),
      role: "broker",
    })
    .returning();
  brokerUserId = broker.id;
});

afterAll(async () => {
  if (clientUserId) await db.delete(usersTable).where(eq(usersTable.id, clientUserId));
  if (brokerUserId) await db.delete(usersTable).where(eq(usersTable.id, brokerUserId));
  if (leadId) await db.delete(leadsTable).where(eq(leadsTable.id, leadId));
  await pool.end();
});

async function loginCookies(email: string): Promise<string[]> {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: "secret123" });
  expect(res.status).toBe(200);
  const cookies = res.headers["set-cookie"];
  expect(cookies).toBeTruthy();
  return Array.isArray(cookies) ? cookies : [cookies as unknown as string];
}

describe("Privacidade dos dados de dívida/BCB do cliente", () => {
  it("GET /api/leads/:id como corretor: BCB todos null, dívidas gerais visíveis", async () => {
    const cookies = await loginCookies(brokerEmail);
    const res = await request(app)
      .get(`/api/leads/${leadId}`)
      .set("Cookie", cookies);
    expect(res.status).toBe(200);

    for (const f of BCB_FIELDS) {
      expect(res.body[f], `BCB field ${f} must be redacted for broker`).toBeNull();
    }
    for (const f of DEBT_FIELDS) {
      expect(res.body[f], `Debt field ${f} must be visible for broker`).toBe(
        PRIVATE_VALUES[f],
      );
    }
  });

  it("GET /api/client/profile como dono: todos os 12 campos preenchidos", async () => {
    const cookies = await loginCookies(clientEmail);
    const res = await request(app)
      .get("/api/client/profile")
      .set("Cookie", cookies);
    expect(res.status).toBe(200);

    for (const f of ALL_PRIVATE) {
      expect(res.body.lead[f], `Owner must see field ${f}`).toBe(
        PRIVATE_VALUES[f],
      );
    }
  });

  it("PUT /api/leads/:id/enrich como corretor não altera nenhum dos 12 campos no banco", async () => {
    const cookies = await loginCookies(brokerEmail);

    const attackPayload: Record<string, unknown> = {
      // Campo legítimo de enrich — deve persistir
      serasaScore: 750,
    };
    for (const f of ALL_PRIVATE) {
      const original = PRIVATE_VALUES[f];
      if (typeof original === "string") {
        attackPayload[f] = "2099-12-31";
      } else if (f === "creditCardUsage") {
        attackPayload[f] = 99;
      } else if (f === "bcbOperationsCount") {
        attackPayload[f] = 999;
      } else {
        attackPayload[f] = 1;
      }
    }

    const res = await request(app)
      .put(`/api/leads/${leadId}/enrich`)
      .set("Cookie", cookies)
      .send(attackPayload);
    expect(res.status).toBe(200);

    const [row] = await db
      .select()
      .from(leadsTable)
      .where(eq(leadsTable.id, leadId))
      .limit(1);
    expect(row).toBeTruthy();

    for (const f of ALL_PRIVATE) {
      expect(
        (row as Record<string, unknown>)[f],
        `Enrich must NOT overwrite private field ${f}`,
      ).toBe(PRIVATE_VALUES[f]);
    }

    // Sanidade: o campo legítimo de enrich foi persistido — prova que o
    // request foi processado e que a defesa é seletiva, não um no-op.
    expect(row.serasaScore).toBe(750);
  });
});
