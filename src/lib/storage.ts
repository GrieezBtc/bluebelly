import { promises as fs } from "node:fs";
import path from "node:path";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { del as blobDel, get as blobGet, head as blobHead } from "@vercel/blob";
import { badRequest } from "@/lib/api";

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

/** Vercel Blob is used whenever a Blob store is connected (BLOB_READ_WRITE_TOKEN present). Otherwise: local disk (dev). */
export function blobEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

const BLOB_PREFIX = "blob:";
export const BLOB_PATH_PREFIX = "uploads/";
const isBlobKey = (key: string) => key.startsWith(BLOB_PREFIX);

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

/**
 * Register a file the browser already uploaded straight to the (private) Blob store.
 * The server never trusts the client: it re-reads the blob's metadata, enforces type/size,
 * and refuses pathnames that were already claimed.
 */
export async function registerBlobUpload(input: {
  ownerId: number;
  pathname: string;
  expiresInMs?: number | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
}) {
  const { pathname } = input;
  if (!pathname.startsWith(BLOB_PATH_PREFIX) || pathname.includes("..")) throw badRequest("Invalid upload.");
  const storageKey = `${BLOB_PREFIX}${pathname}`;

  const existing = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(eq(mediaAssets.storageKey, storageKey)).limit(1);
  if (existing[0]) throw badRequest("That upload was already registered.");

  let meta: Awaited<ReturnType<typeof blobHead>>;
  try {
    meta = await blobHead(pathname);
  } catch {
    throw badRequest("Upload not found. Please try again.");
  }
  const mimeType = (meta.contentType || "").toLowerCase();
  if (meta.size > MAX_UPLOAD_BYTES || !/^(image|video|audio)\//.test(mimeType)) {
    await blobDel(pathname).catch(() => undefined);
    throw badRequest("Only photos, videos and voice notes up to 25 MB can be uploaded.");
  }

  const [asset] = await db
    .insert(mediaAssets)
    .values({
      ownerId: input.ownerId,
      storageKey,
      mimeType,
      sizeBytes: meta.size,
      kind: kindFromMime(mimeType),
      width: input.width ?? null,
      height: input.height ?? null,
      durationSec: input.durationSec ?? null,
      expiresAt: input.expiresInMs ? new Date(Date.now() + input.expiresInMs) : null,
    })
    .returning();
  return asset;
}

/** If `url` is one of our /api/media links, return the asset id only when `ownerId` uploaded it. */
export async function ownedMediaId(ownerId: number, url: string | null | undefined) {
  const match = /^\/api\/media\?id=(\d+)$/.exec(url ?? "");
  if (!match) return null;
  const id = Number(match[1]);
  const rows = await db.select({ id: mediaAssets.id }).from(mediaAssets).where(and(eq(mediaAssets.id, id), eq(mediaAssets.ownerId, ownerId), isNull(mediaAssets.deletedAt))).limit(1);
  if (!rows[0]) throw badRequest("That file is not available. Please upload it again.");
  return id;
}

export type MediaBody = Uint8Array | ReadableStream<Uint8Array>;

export async function readMedia(assetId: number): Promise<{ asset: typeof mediaAssets.$inferSelect; body: MediaBody; size: number } | null> {
  const row = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId)).limit(1);
  const asset = row[0];
  if (!asset || asset.deletedAt) return null;
  try {
    if (isBlobKey(asset.storageKey)) {
      const result = await blobGet(asset.storageKey.slice(BLOB_PREFIX.length), { access: "private" });
      if (!result || result.statusCode !== 200 || !result.stream) return null;
      return { asset, body: result.stream, size: result.blob.size ?? asset.sizeBytes };
    }
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, asset.storageKey));
    return { asset, body: new Uint8Array(buffer), size: buffer.byteLength };
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
    if (isBlobKey(asset.storageKey)) await blobDel(asset.storageKey.slice(BLOB_PREFIX.length));
    else await fs.unlink(path.join(UPLOAD_DIR, asset.storageKey));
  } catch {
    /* already gone */
  }
  await db.update(mediaAssets).set({ deletedAt: new Date() }).where(eq(mediaAssets.id, assetId));
}
