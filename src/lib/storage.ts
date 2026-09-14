import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { eq } from "drizzle-orm";

export const UPLOAD_DIR = process.env.BEMBLO_UPLOAD_DIR ?? path.join(process.cwd(), ".data", "uploads");

export type MediaKind = "image" | "video" | "audio";

export function kindFromMime(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  return "audio";
}

export function extFromMime(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "audio/webm": "webm",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  return map[mime] ?? "bin";
}

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

export async function saveUpload(input: {
  ownerId: number;
  mimeType: string;
  bytes: Buffer;
  expiresInMs?: number | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}) {
  await ensureUploadDir();
  const storageKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extFromMime(input.mimeType)}`;
  await fs.writeFile(path.join(UPLOAD_DIR, storageKey), input.bytes);
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      ownerId: input.ownerId,
      storageKey,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      kind: kindFromMime(input.mimeType),
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
      expiresAt: input.expiresInMs ? new Date(Date.now() + input.expiresInMs) : null,
    })
    .returning();
  return asset;
}

export async function readMedia(assetId: number) {
  const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  const asset = row[0];
  if (!asset || asset.deletedAt) return null;
  try {
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, asset.storageKey));
    return { asset, buffer };
  } catch {
    return null;
  }
}

/** Storage cleanup for expired temporary media. Never touches Moment media. */
export async function deleteAsset(assetId: number) {
  const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  const asset = row[0];
  if (!asset) return;
  try {
    await fs.unlink(path.join(UPLOAD_DIR, asset.storageKey));
  } catch {
    /* already gone */
  }
  await db.update(mediaAssets).set({ deletedAt: new Date() }).where(eq(mediaAssets.id, assetId));
}
