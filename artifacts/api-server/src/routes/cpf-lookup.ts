import { Router } from "express";
import { z } from "zod";

const router = Router();

const LookupBody = z.object({
  cpf: z.string(),
  birthDate: z.string(),
});

const FIRST_NAMES_M = ["João", "Carlos", "Lucas", "Pedro", "Rafael", "Bruno", "Felipe", "Gustavo", "Marcos", "Thiago", "André", "Diego"];
const FIRST_NAMES_F = ["Maria", "Ana", "Juliana", "Fernanda", "Patrícia", "Camila", "Larissa", "Beatriz", "Carolina", "Mariana", "Aline", "Valesca"];
const MIDDLES = ["de Souza", "Almeida", "Pereira", "Costa", "Ribeiro", "Lima", "Oliveira", "Carvalho", "Mendes", "Barbosa", "Santos"];
const LAST_NAMES = ["Silva", "Santos", "Oliveira", "Souza", "Pereira", "Rodrigues", "Almeida", "Nascimento", "Lima", "Araújo", "Ferreira", "Gomes"];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

function generateMockProfile(cpf: string, birthDate: string) {
  // Deterministic name from CPF digits
  const digits = cpf.replace(/\D/g, "");
  const seed = digits.split("").reduce((a, d) => a + parseInt(d, 10), 0);
  const isFemale = parseInt(digits[8] ?? "0", 10) % 2 === 0;
  const firstNames = isFemale ? FIRST_NAMES_F : FIRST_NAMES_M;
  const first = pick(firstNames, seed);
  const middle = pick(MIDDLES, seed + 3);
  const last = pick(LAST_NAMES, seed + 7);
  const mother = `${pick(FIRST_NAMES_F, seed + 11)} ${pick(LAST_NAMES, seed + 13)} ${pick(LAST_NAMES, seed + 17)}`;
  return {
    name: `${first} ${middle} ${last}`,
    mothersName: mother,
    birthDate,
    situation: "REGULAR" as const,
  };
}

function isValidCpf(cpf: string): boolean {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  return true;
}

function isValidBirthDate(input: string): boolean {
  // Aceita DD/MM/AAAA ou AAAA-MM-DD
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(input);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!br && !iso) return false;
  const [y, m, d] = br
    ? [parseInt(br[3], 10), parseInt(br[2], 10), parseInt(br[1], 10)]
    : [parseInt(iso![1], 10), parseInt(iso![2], 10), parseInt(iso![3], 10)];
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return false;
  const now = new Date();
  const age = now.getFullYear() - y - (now < new Date(now.getFullYear(), m - 1, d) ? 1 : 0);
  return age >= 16 && age <= 110;
}

router.post("/lookup", async (req, res) => {
  const parsed = LookupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "CPF e data de nascimento são obrigatórios." });
    return;
  }
  const { cpf, birthDate } = parsed.data;

  if (!isValidCpf(cpf)) {
    res.status(400).json({ error: "CPF inválido. Verifique e tente novamente." });
    return;
  }
  if (!isValidBirthDate(birthDate)) {
    res.status(400).json({ error: "Data de nascimento inválida." });
    return;
  }

  // Simula latência de chamada externa
  await new Promise((r) => setTimeout(r, 600));

  // Mock determinístico — em produção substituir por chamada ao provedor (Hub do Desenvolvedor / InfoSimples)
  const profile = generateMockProfile(cpf, birthDate);
  req.log.info({ cpfMasked: cpf.replace(/\d(?=\d{4})/g, "*") }, "cpf lookup (mock)");
  res.json({ found: true, ...profile, source: "mock" });
});

export default router;
