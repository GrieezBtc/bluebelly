import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { badRequest } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { BLOB_PATH_PREFIX, MAX_UPLOAD_BYTES, blobEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * POST /api/upload/blob — issues short-lived tokens so the browser can upload straight to the
 * private Blob store (Vercel functions cannot receive request bodies over 4.5 MB).
 * Only signed-in, verified users get a token. The file is not usable until /api/upload registers it.
 */
export async function POST(request: Request) {
  try {
    if (!blobEnabled()) throw badRequest("Blob storage is not configured.");
    const body = (await request.json()) as HandleUploadBody;
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await requireVerifiedUser(request);
        if (!pathname.startsWith(BLOB_PATH_PREFIX) || pathname.includes("..")) throw badRequest("Invalid upload path.");
        return {
          allowedContentTypes: ["image/*", "video/*", "audio/*"],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      // Registration happens through POST /api/upload (works locally and does not depend on a webhook).
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
