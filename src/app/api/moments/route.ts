import { badRequest, fail, ok, paginationFrom, pickEnum, readJson, requireString, toInt } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { createMomentRecord, listFeed } from "@/db/store";
import type { MomentAudience, MomentKind } from "@/db/schema";

export const dynamic = "force-dynamic";

/** GET /api/moments — Moments feed (privacy + block filters applied server-side). */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const url = new URL(request.url);
    const { limit, cursor } = paginationFrom(url.searchParams);
    const authorId = toInt(url.searchParams.get("authorId"));
    const page = await listFeed(user, { limit, cursor, authorId });
    return ok(page);
  } catch (error) {
    return fail(error);
  }
}

const AUDIENCES: MomentAudience[] = ["public", "followers", "only_me"];
const KINDS: MomentKind[] = ["text", "photo", "video"];

/** POST /api/moments — publish a Moment. The audience must be chosen explicitly. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson<{
      kind?: string;
      body?: string;
      audience?: string;
      mediaUrl?: string;
      posterUrl?: string;
      mediaWidth?: number;
      mediaHeight?: number;
    }>(request);

    const kind = pickEnum(body.kind, KINDS, "text");
    const audienceRaw = typeof body.audience === "string" ? body.audience : "";
    if (!AUDIENCES.includes(audienceRaw as MomentAudience)) {
      throw badRequest("Choose who can see this Moment before publishing.", "audience_required");
    }
    const audience = audienceRaw as MomentAudience;
    const text = typeof body.body === "string" ? body.body.trim().slice(0, 2000) : "";
    if (kind === "text" && text.length === 0) throw badRequest("Write something to share.");
    if (kind !== "text" && !body.mediaUrl) throw badRequest("Add your photo or video before publishing.");

    const created = await createMomentRecord({
      authorId: user.id,
      kind,
      body: kind === "text" ? requireString(text, "Moment text", { min: 1, max: 2000 }) : text,
      mediaUrl: body.mediaUrl ?? null,
      posterUrl: body.posterUrl ?? null,
      mediaWidth: body.mediaWidth ?? null,
      mediaHeight: body.mediaHeight ?? null,
      audience,
    });
    return ok({ id: created.id, audience: created.audience, createdAt: created.createdAt.toISOString() }, 201);
  } catch (error) {
    return fail(error);
  }
}
