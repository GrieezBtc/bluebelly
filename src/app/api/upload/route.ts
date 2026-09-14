import { badRequest, fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { MAX_UPLOAD_BYTES, kindFromMime, saveUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** POST /api/upload — multipart upload for Moment media, chat media and voice notes. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw badRequest("Attach a file to upload.");
    if (file.size > MAX_UPLOAD_BYTES) throw badRequest("That file is too large. The limit is 25 MB.");
    const mimeType = file.type || "application/octet-stream";
    if (!/^(image|video|audio)\//.test(mimeType)) throw badRequest("Only photos, videos and voice notes can be uploaded.");

    const scope = String(form.get("scope") ?? "moment");
    const ttl = scope === "message" ? 7 * 24 * 60 * 60 * 1000 : null;

    const buffer = Buffer.from(await file.arrayBuffer());
    const asset = await saveUpload({
      ownerId: user.id,
      mimeType,
      bytes: buffer,
      expiresInMs: ttl,
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
