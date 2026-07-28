import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import app from "../app";
import { db, usersTable, pool } from "@workspace/db";

function hashPassword(p: string): string {
  return crypto.createHash("sha256").update(p + "scorecasa_salt").digest("hex");
}

function randDigits(n: number): string {
  let s = "";
  while (s.length < n) s += crypto.randomInt(0, 1_000_000_000).toString();
  return s.slice(0, n);
}

const tag = `paymentgate-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const email = `${tag}-client@test.local`;
let userId = 0;

beforeAll(async () => {
  const [user] = await db
    .insert(usersTable)
    .values({
      name: `User ${tag}`,
      email,
      cpf: randDigits(11),
      passwordHash: hashPassword("secret123"),
      role: "client",
    })
    .returning();
  userId = user.id;
});

afterAll(async () => {
  if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  await pool.end();
});

describe("Gating de pagamento nas rotas protegidas", () => {
  it("bloqueia acesso a rota protegida sem assinatura ativa", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "secret123" });

    expect(login.status).toBe(200);

    const res = await request(app)
      .get("/api/dashboard")
      .set("Cookie", login.headers["set-cookie"]);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("PAYMENT_REQUIRED");
  });
});
