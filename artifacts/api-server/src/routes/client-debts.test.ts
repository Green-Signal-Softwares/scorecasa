import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, leadsTable, usersTable, pool } from "@workspace/db";

function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p + "scorecasa_salt").digest("hex");
}

function randDigits(n: number): string {
  let s = "";
  while (s.length < n) s += crypto.randomInt(0, 1_000_000_000).toString();
  return s.slice(0, n);
}

const tag = `debtstest-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const clientEmail = `${tag}-client@test.local`;
const brokerEmail = `${tag}-broker@test.local`;

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

describe("PUT /api/client/debts — edição manual de dívidas", () => {
  it("rejeita valor negativo em vehicleLoanMonthly com 400 e campo em fields", async () => {
    const cookies = await loginCookies(clientEmail);
    const res = await request(app)
      .put("/api/client/debts")
      .set("Cookie", cookies)
      .send({ vehicleLoanMonthly: -100 });
    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.fields)).toBe(true);
    expect(res.body.fields).toContain("vehicleLoanMonthly");
  });

  it("rejeita creditCardUsage = 150 com 400", async () => {
    const cookies = await loginCookies(clientEmail);
    const res = await request(app)
      .put("/api/client/debts")
      .set("Cookie", cookies)
      .send({ creditCardUsage: 150 });
    expect(res.status).toBe(400);
    expect(res.body.fields).toContain("creditCardUsage");
  });

  it("payload válido: atualiza linha, recalcula score e retorna perfil", async () => {
    const cookies = await loginCookies(clientEmail);

    const [before] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);

    const payload = {
      vehicleLoanMonthly: 500,
      otherLoansMonthly: 200,
      creditCardLimit: 8000,
      creditCardUsage: 40,
      bcbTotalDebt: 15000,
      bcbMonthlyCommitment: 900,
      bcbOperationsCount: 4,
      bcbQueryDate: "2026-02-10",
    };

    const res = await request(app)
      .put("/api/client/debts")
      .set("Cookie", cookies)
      .send(payload);
    expect(res.status).toBe(200);

    // Resposta traz o perfil completo do cliente
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.id).toBe(clientUserId);
    expect(res.body.lead).toBeTruthy();
    expect(res.body.lead.id).toBe(leadId);

    // Campos enviados foram persistidos
    for (const [k, v] of Object.entries(payload)) {
      expect(res.body.lead[k], `lead.${k} no payload de resposta`).toBe(v);
    }

    // Score recalculado: presente, dentro do range e (provavelmente) diferente do anterior
    expect(typeof res.body.lead.approvalChance).toBe("number");
    expect(res.body.lead.approvalChance).toBeGreaterThanOrEqual(0);
    expect(res.body.lead.approvalChance).toBeLessThanOrEqual(100);
    expect(typeof res.body.lead.scoreCaixa).toBe("number");
    expect(res.body.lead.scoreCaixa).toBeGreaterThanOrEqual(300);
    expect(res.body.lead.scoreCaixa).toBeLessThanOrEqual(1000);

    // Persistência efetiva no banco
    const [row] = await db.select().from(leadsTable).where(eq(leadsTable.id, leadId)).limit(1);
    for (const [k, v] of Object.entries(payload)) {
      expect((row as Record<string, unknown>)[k], `coluna ${k} no banco`).toBe(v);
    }
    expect(row.approvalChance).toBe(res.body.lead.approvalChance);
    expect(row.scoreCaixa).toBe(res.body.lead.scoreCaixa);
    // updatedAt foi tocado
    expect(row.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it("usuário não-cliente (corretor) recebe 403", async () => {
    const cookies = await loginCookies(brokerEmail);
    const res = await request(app)
      .put("/api/client/debts")
      .set("Cookie", cookies)
      .send({ vehicleLoanMonthly: 100 });
    expect(res.status).toBe(403);
  });
});
