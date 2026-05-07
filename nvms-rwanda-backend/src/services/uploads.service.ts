import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export function uploadsDir() {
  return path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? "uploads");
}

export async function ensureUploadsDir() {
  await fs.mkdir(uploadsDir(), { recursive: true });
}

export function makeSafeFileName(originalName: string) {
  const ext = path.extname(originalName).slice(0, 10);
  const base = crypto.randomBytes(16).toString("hex");
  return `${base}${ext}`;
}

export function publicBaseUrl() {
  return process.env.PUBLIC_BASE_URL ?? "http://localhost:4000";
}

export function publicUploadUrl(storageKey: string) {
  return `${publicBaseUrl()}/uploads/${encodeURIComponent(storageKey)}`;
}

