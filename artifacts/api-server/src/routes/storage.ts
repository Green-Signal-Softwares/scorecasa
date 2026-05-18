import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

const STAFF_ROLES = new Set(["admin", "analyst", "correspondent", "broker"]);
const UPLOAD_ROLES = new Set(["admin", "analyst", "correspondent", "broker", "client"]);

async function requireStaff(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !STAFF_ROLES.has(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).sessionUser = user;
  next();
}

// Permite upload por qualquer usuário autenticado (incluindo o cliente
// subindo os próprios documentos do processo Caixa). A URL pré-assinada
// é opaca — não expõe nada sobre outros leads.
async function requireAuthUpload(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).session?.userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || !UPLOAD_ROLES.has(user.role)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  (req as any).sessionUser = user;
  next();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", requireAuthUpload, async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
// Serve objetos privados. Staff vê tudo (autorização já feita nos endpoints
// de negócio). Cliente só vê objeto se houver um `process_documents` cujo
// `file_url` bate com o caminho pedido E (foi o próprio cliente que subiu
// OU o doc está marcado como `visibleToClient` e pertence ao lead dele).
router.get("/storage/objects/*path", requireAuthUpload, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const user = (req as any).sessionUser as { id: number; role: string };
    if (user.role === "client") {
      // ACL: localizar o documento pelo file_url e validar posse.
      const { processDocumentsTable, leadsTable, usersTable } = await import("@workspace/db");
      const docs = await db
        .select()
        .from(processDocumentsTable)
        .where(eq(processDocumentsTable.fileUrl, objectPath))
        .limit(1);
      const doc = docs[0];
      if (!doc) {
        res.status(404).end();
        return;
      }
      const [clientUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .limit(1);
      if (!clientUser?.leadId || clientUser.leadId !== doc.leadId) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      const ownedByClient = doc.uploadedBy === user.id;
      if (!ownedByClient && !doc.visibleToClient) {
        res.status(403).json({ error: "Documento não disponível para o cliente." });
        return;
      }
      // Touch para silenciar eventual unused; (leadsTable é importado para
      // consistência mas não usado aqui pois validamos via clientUser.leadId).
      void leadsTable;
    }
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
