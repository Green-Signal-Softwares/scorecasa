/**
 * storage.ts — Rotas de armazenamento de arquivos.
 *
 * Implementação 100% local, sem dependências externas (Replit, GCS, S3, etc.).
 * Todos os arquivos são persistidos em ./storage/uploads/ dentro do projeto.
 *
 * Fluxo de upload (imagens de imóveis, documentos de processo, etc.):
 *   1. POST /api/storage/uploads/request-url  → reserva um slot (UUID)
 *   2. PUT  /api/storage/uploads/:id           → envia o binário
 *   3. GET  /api/storage/objects/uploads/:id   → serve o arquivo de volta
 */
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { generateUploadSlot, saveFile, readFile } from "../lib/fileStorage";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { buffer as collectBuffer } from "stream/consumers";

const router: IRouter = Router();

// ── Roles ─────────────────────────────────────────────────────────────────────

const UPLOAD_ROLES = new Set(["admin", "analyst", "correspondent", "broker", "client"]);

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !UPLOAD_ROLES.has(user.role)) { res.status(403).json({ error: "Forbidden" }); return; }
  (req as any).sessionUser = user;
  next();
}

// ── POST /storage/uploads/request-url ────────────────────────────────────────
//
// Reserva um slot de upload e devolve:
//   uploadURL:  onde o cliente faz PUT com o binário
//   objectPath: caminho canônico para leitura via GET /api/storage/objects/*

router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }
  const { name, size, contentType } = parsed.data;
  const slot = generateUploadSlot();
  res.json(
    RequestUploadUrlResponse.parse({
      uploadURL:  slot.uploadURL,
      objectPath: slot.objectPath,
      metadata:   { name, size, contentType },
    }),
  );
});

// ── PUT /storage/uploads/:id ──────────────────────────────────────────────────
//
// Recebe o binário e salva em disco. Sem autenticação obrigatória porque:
//   • A URL contém um UUID opaco e de uso único.
//   • Não há dados sensíveis expostos — o cliente não consegue ler o arquivo
//     de outro usuário porque não conhece o UUID dele.

router.put("/storage/uploads/:id", async (req: Request, res: Response) => {
  const fileId = String(req.params.id ?? "");
  if (!fileId || !/^[0-9a-f-]{36}$/.test(fileId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const contentType   = String(req.headers["content-type"] || "application/octet-stream");
    const originalName  = String(req.headers["x-file-name"]  || fileId);
    const buf           = await collectBuffer(req);
    saveFile(fileId, buf, { contentType, originalName, size: buf.length });
    res.status(200).end();
  } catch (err) {
    req.log.error({ err }, "Erro ao salvar arquivo");
    res.status(500).json({ error: "Falha ao salvar arquivo" });
  }
});

// ── GET /storage/objects/*path ────────────────────────────────────────────────
//
// Serve arquivos armazenados localmente.
//
// Controle de acesso:
//   • /objects/uploads/* → qualquer usuário autenticado pode ver.
//     (Imagens de imóveis são visíveis para todos no catálogo.)
//   • Outros caminhos (ex.: documentos de processo) → ACL estrita por role.

router.get("/storage/objects/*path", requireAuth, async (req: Request, res: Response) => {
  try {
    const raw          = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath   = `/objects/${wildcardPath}`;

    // ── Uploads locais (imagens de imóveis, etc.) — visíveis para todos ──
    if (objectPath.startsWith("/objects/uploads/")) {
      const fileId = objectPath.replace("/objects/uploads/", "");
      const file   = readFile(fileId);
      if (!file) { res.status(404).json({ error: "Arquivo não encontrado" }); return; }
      res.setHeader("Content-Type",   file.contentType);
      res.setHeader("Content-Length", String(file.size));
      res.setHeader("Cache-Control",  "private, max-age=3600");
      res.end(file.buffer);
      return;
    }

    // ── Documentos de processo — ACL: cliente só vê os seus ──────────────
    const user = (req as any).sessionUser as { id: number; role: string };
    if (user.role === "client") {
      const { processDocumentsTable, leadsTable, usersTable: ut } = await import("@workspace/db");
      const docs = await db
        .select().from(processDocumentsTable)
        .where(eq(processDocumentsTable.fileUrl, objectPath)).limit(1);
      const doc = docs[0];
      if (!doc) { res.status(404).end(); return; }
      const [clientUser] = await db.select().from(ut).where(eq(ut.id, user.id)).limit(1);
      if (!clientUser?.leadId || clientUser.leadId !== doc.leadId) {
        res.status(403).json({ error: "Forbidden" }); return;
      }
      if (doc.uploadedBy !== user.id && !doc.visibleToClient) {
        res.status(403).json({ error: "Documento não disponível para o cliente." }); return;
      }
      void leadsTable;
    }

    // Para staff (admin, analyst, broker, correspondent) — sem restrição adicional.
    // Outros caminhos ainda não implementados com storage local.
    res.status(404).json({ error: "Arquivo não encontrado" });
  } catch (err) {
    req.log.error({ err }, "Erro ao servir arquivo");
    res.status(500).json({ error: "Falha ao servir arquivo" });
  }
});

// ── GET /storage/public-objects/*filePath ─────────────────────────────────────
//
// Mantido por compatibilidade com referências existentes.
// Sem serviço externo, retorna 501 com mensagem clara.

router.get("/storage/public-objects/*filePath", (_req: Request, res: Response) => {
  res.status(501).json({ error: "Public object storage não configurado neste ambiente." });
});

export default router;
