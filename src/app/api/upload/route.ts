import { badRequest, fail, ok, readJson } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, blobEnabled, kindFromMime, registerBlobUpload, saveUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MESSAGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** GET /api/upload — tells the browser how to upload: straight to Vercel Blob, or through this server (local dev). */
export async function GET() {
  return ok({ mode: blobEnabled() ? "blob" : "local" });
}

/**
 * POST /api/upload
 *  - JSON  { pathname, scope, width, height, duration }  → register a file the browser already uploaded to Blob.
 *  - multipart form (file, scope, ...)                   → local-disk upload used when no Blob store is connected.
 */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const isJson = (request.headers.get("content-type") ?? "").includes("application/json");

    if (isJson) {
      if (!blobEnabled()) throw badRequest("Blob storage is not configured.");
      const body = await readJson<{ pathname?: string; scope?: string; width?: number; height?: number; duration?: number }>(request);
      if (!body.pathname) throw badRequest("Missing upload.");
      const asset = await registerBlobUpload({
        ownerId: user.id,
        pathname: body.pathname,
        allowDocuments: body.scope === "message",
        expiresInMs: body.scope === "message" ? MESSAGE_TTL_MS : null,
        width: Number(body.width) || null,
        height: Number(body.height) || null,
        durationSec: Number(body.duration) || null,
      });
      return ok(
        {
          id: asset.id,
          url: `/api/media?id=${asset.id}`,
          kind: kindFromMime(asset.mimeType),
          mimeType: asset.mimeType,
          width: asset.width,
          height: asset.height,
          sizeBytes: asset.sizeBytes,
        },
        201,
      );
    }

    // Local-disk path (development / no Blob store).
    if (blobEnabled()) throw badRequest("Uploads go directly to storage. Please refresh the page and try again.");
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Attach a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw badRequest("That file is too large. The limit is 25 MB.");
    const mimeType = file.type || "application/octet-stream";
    const scope = String(form.get("scope") ?? "moment");
    if (kindFromMime(mimeType) === "document" && scope !== "message") {
      throw badRequest("Documents can only be uploaded in messages.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await saveUpload({
      ownerId: user.id,
      mimeType,
      bytes: buffer,
      expiresInMs: scope === "message" ? MESSAGE_TTL_MS : null,
      width: Number(form.get("width")) || null,
      height: Number(form.get("height")) || null,
      durationSec: Number(form.get("duration")) || null,
    });

    return ok(
      {
        id: asset.id,
        url: `/api/media?id=${asset.id}`,
        kind: kindFromMime(mimeType),
        mimeType,
        width: asset.width,
        height: asset.height,
        sizeBytes: asset.sizeBytes,
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
