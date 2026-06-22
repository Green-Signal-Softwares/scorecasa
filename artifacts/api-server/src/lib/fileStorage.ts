/**
 * fileStorage.ts
 *
 * Storage local de arquivos — funciona 100% dentro do diretório do projeto.
 * Não depende de nenhum serviço externo (Replit, GCS, S3, etc.).
 *
 * Estrutura no disco:
 *   <STORAGE_DIR>/uploads/<uuid>       ← binário do arquivo
 *   <STORAGE_DIR>/uploads/<uuid>.meta  ← JSON com { contentType, originalName }
 *
 * STORAGE_DIR padrão:
 *   - Dentro do Docker: /workspace/storage  (mapeado para ./storage/ no host)
 *   - Fora do Docker:   ./storage           (relativo ao cwd da API)
 *
 * Para sobrescrever: defina a variável de ambiente STORAGE_DIR.
 */
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export const STORAGE_DIR = process.env.STORAGE_DIR
  ?? path.join(process.cwd(), "storage");

const UPLOADS_DIR = path.join(STORAGE_DIR, "uploads");

/** Garante que os diretórios necessários existem. Chamado lazy na primeira escrita. */
function ensureDirs() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// ── Geração de slot de upload ─────────────────────────────────────────────────

/**
 * Gera um UUID para o arquivo e retorna as duas URLs necessárias:
 *  - uploadURL:  onde o cliente fará o PUT (relativo, resolvido pelo browser)
 *  - objectPath: caminho canônico para servir via GET /api/storage/objects/*
 */
export function generateUploadSlot(): { uploadURL: string; objectPath: string } {
  const fileId = randomUUID();
  return {
    uploadURL:  `/api/storage/uploads/${fileId}`,
    objectPath: `/objects/uploads/${fileId}`,
  };
}

// ── Escrita ───────────────────────────────────────────────────────────────────

export interface FileMeta {
  contentType:  string;
  originalName: string;
  size:         number;
  uploadedAt:   string; // ISO 8601
}

export function saveFile(
  fileId: string,
  buffer: Buffer,
  meta: Omit<FileMeta, "uploadedAt">,
): void {
  ensureDirs();
  const filePath = path.join(UPLOADS_DIR, fileId);
  fs.writeFileSync(filePath, buffer);
  const fullMeta: FileMeta = { ...meta, uploadedAt: new Date().toISOString() };
  fs.writeFileSync(filePath + ".meta", JSON.stringify(fullMeta, null, 2));
}

// ── Leitura ───────────────────────────────────────────────────────────────────

export interface StoredFile {
  buffer:      Buffer;
  contentType: string;
  size:        number;
}

export function readFile(fileId: string): StoredFile | null {
  // Primary location (new system)
  const filePath = path.join(UPLOADS_DIR, fileId);
  if (fs.existsSync(filePath)) {
    return _readFromPath(filePath);
  }

  // Legacy fallback — uploads made before the storage migration (stored in /tmp)
  const legacyPath = path.join("/tmp/scorecasa-uploads/uploads", fileId);
  if (fs.existsSync(legacyPath)) {
    return _readFromPath(legacyPath);
  }

  return null;
}

function _readFromPath(filePath: string): StoredFile {
  const buffer = fs.readFileSync(filePath);
  let contentType = "application/octet-stream";
  try {
    const meta: FileMeta = JSON.parse(fs.readFileSync(filePath + ".meta", "utf-8"));
    contentType = meta.contentType || contentType;
  } catch { /* meta ausente — usa fallback */ }
  return { buffer, contentType, size: buffer.length };
}

// ── Deleção ───────────────────────────────────────────────────────────────────

export function deleteFile(fileId: string): void {
  const filePath = path.join(UPLOADS_DIR, fileId);
  for (const p of [filePath, filePath + ".meta"]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}
