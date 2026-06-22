import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, leadsTable, usersTable, pool, brokersTable } from "@workspace/db";

// Cobre o pivot SBPE no endpoint GET /api/leads/:id/score. Quando o lead
// possui o blocker `alreadyOwnsPropertyInPropertyCity=true`, a resposta deve
// trazer `sbpeRecommendation` não-nulo com bancos, faixa de taxa e parcela
// positiva. A copy da recomendação não pode regredir para "tente MCMV".

function randDigits(n: number): string {
  let s = "";
  while (s.length < n) s += crypto.randomInt(0, 1_000_000_000).toString();
  return s.slice(0, n);
}

function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p + "scorecasa_salt").digest("hex");
}

const tag = `sbpetest-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const brokerEmail = `${tag}-broker@test.local`;

let leadBlockedId = 0;
let leadEligibleId = 0;
let brokerUserId = 0;
let brokerProfileId = 0;

beforeAll(async () => {
  // Criar perfil do corretor
  const [brokerProfile] = await db
    .insert(brokersTable)
    .values({
      name: `Broker Profile ${tag}`,
      email: brokerEmail,
      phone: "11999999999",
      creci: randDigits(6),
      status: "active",
    })
    .returning();
  brokerProfileId = brokerProfile.id;

  // Lead com bloqueador MCMV → deve ativar o pivot SBPE.
  const [blocked] = await db
    .insert(leadsTable)
    .values({
      name: `Lead Blocked ${tag}`,
      cpf: randDigits(11),
      email: `${tag}-blocked@test.local`,
      phone: "11999999999",
      income: 12000,
      propertyValue: 500000,
      hasFgts: true,
      fgtsBalance: 40000,
      employmentType: "clt",
      serasaScore: 780,
      propertyType: "usado",
      propertyCity: "São Paulo",
      propertyState: "SP",
      alreadyOwnsPropertyInPropertyCity: true,
      brokerId: brokerProfileId,
    })
    .returning();
  leadBlockedId = blocked.id;

  // Lead "normal" (sem blocker) usado como controle: não deve ter pivot SBPE.
  const [eligible] = await db
    .insert(leadsTable)
    .values({
      name: `Lead Eligible ${tag}`,
      cpf: randDigits(11),
      email: `${tag}-eligible@test.local`,
      phone: "11999999999",
      income: 5000,
      propertyValue: 250000,
      employmentType: "clt",
      serasaScore: 720,
      propertyType: "usado",
      propertyCity: "São Paulo",
      propertyState: "SP",
      alreadyOwnsPropertyInPropertyCity: false,
      brokerId: brokerProfileId,
    })
    .returning();
  leadEligibleId = eligible.id;

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
  if (brokerUserId) await db.delete(usersTable).where(eq(usersTable.id, brokerUserId));
  if (brokerProfileId) await db.delete(brokersTable).where(eq(brokersTable.id, brokerProfileId));
  if (leadBlockedId) await db.delete(leadsTable).where(eq(leadsTable.id, leadBlockedId));
  if (leadEligibleId) await db.delete(leadsTable).where(eq(leadsTable.id, leadEligibleId));
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

describe("GET /api/leads/:id/score — pivot SBPE quando MCMV está bloqueado", () => {
  it("blocker ativo: sbpeRecommendation não-nulo com bancos, taxa e parcela positiva", async () => {
    const cookies = await loginCookies(brokerEmail);
    const res = await request(app).get(`/api/leads/${leadBlockedId}/score`).set("Cookie", cookies);
    expect(res.status).toBe(200);

    const rec = res.body.sbpeRecommendation;
    expect(rec).toBeTruthy();
    expect(Array.isArray(rec.banks)).toBe(true);
    expect(rec.banks.length).toBeGreaterThanOrEqual(1);

    // Cada banco tem dados mínimos coerentes.
    for (const b of rec.banks) {
      expect(typeof b.bankSlug).toBe("string");
      expect(b.bankSlug.length).toBeGreaterThan(0);
      expect(b.annualRate).toBeGreaterThan(0);
      expect(b.monthlyInstallment).toBeGreaterThan(0);
      expect(b.maxLTV).toBeGreaterThan(0);
      expect(["eligible", "analysis"]).toContain(b.status);
    }

    // Faixa de taxa válida e coerente com os bancos retornados.
    expect(rec.rateRange.min).toBeLessThanOrEqual(rec.rateRange.max);
    expect(rec.rateRange.min).toBe(Math.min(...rec.banks.map((b: any) => b.annualRate)));
    expect(rec.rateRange.max).toBe(Math.max(...rec.banks.map((b: any) => b.annualRate)));

    // Parcela / entrada / loan / termo positivos.
    expect(rec.bestMonthlyInstallment).toBeGreaterThan(0);
    expect(rec.estimatedDownPayment).toBeGreaterThan(0);
    expect(rec.estimatedLoanAmount).toBeGreaterThan(0);
    expect(rec.termYears).toBeGreaterThan(0);
    expect(rec.maxFinancedPct).toBeGreaterThan(0);
  });

  it("blocker ativo: recommendation explica o pivot SBPE e não pede MCMV", async () => {
    const cookies = await loginCookies(brokerEmail);
    const res = await request(app).get(`/api/leads/${leadBlockedId}/score`).set("Cookie", cookies);
    expect(res.status).toBe(200);

    const reco: string = res.body.recommendation;
    expect(typeof reco).toBe("string");
    expect(reco).toMatch(/MCMV bloqueado/i);
    expect(reco).toMatch(/SBPE/i);
    // Regressão guard: a copy não pode voltar a sugerir "tente/avaliar MCMV"
    // ou "pivote para MCMV" quando o blocker está ativo.
    expect(reco).not.toMatch(/tente.*MCMV/i);
    expect(reco).not.toMatch(/avaliar MCMV/i);
    expect(reco).not.toMatch(/pivot[ea].*MCMV/i);
    // scoreMCMV precisa estar zerado pelo blocker.
    expect(res.body.scoreMCMV).toBe(0);
  });

  it("sem blocker: sbpeRecommendation é null (pivot só dispara sob blocker)", async () => {
    const cookies = await loginCookies(brokerEmail);
    const res = await request(app).get(`/api/leads/${leadEligibleId}/score`).set("Cookie", cookies);
    expect(res.status).toBe(200);
    expect(res.body.sbpeRecommendation).toBeNull();
  });
});
