import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets, moments } from "@/db/schema";
import { fail, forbidden, notFound, ok, pickEnum, readJson } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { getMoment, listComments } from "@/db/store";
import { getCurrentUser } from "@/lib/auth";
import { deleteAsset } from "@/lib/storage";
import type { MomentAudience } from "@/db/schema";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/moments/:id — Moment detail with comments. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const momentId = Number(id);
    if (!Number.isFinite(momentId)) throw notFound("Moment not found.");
    const viewer = await getCurrentUser(request);
    const found = await getMoment(viewer?.id ?? null, momentId);
    if (!found) throw notFound("This Moment is not available to you.");
    const comments = await listComments(viewer?.id ?? null, momentId);
    return ok({ moment: found.moment, comments });
  } catch (error) {
    return fail(error);
  }
}

/** PATCH /api/moments/:id — change the audience of your own Moment. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const momentId = Number(id);
    const user = await requireVerifiedUser(request);
    const [moment] = await db.select().from(moments).where(eq(moments.id, momentId)).limit(1);
    if (!moment) throw notFound("Moment not found.");
    if (moment.authorId !== user.id) throw forbidden("Only the author can change this Moment's audience.");
    const body = await readJson<{ audience?: string }>(request);
    const audience = pickEnum<MomentAudience>(body.audience, ["public", "followers", "only_me"], "public");
    const [updated] = await db
      .update(moments)
      .set({ audience, audienceLocked: audience === "only_me" })
      .where(eq(moments.id, momentId))
      .returning();
    return ok({
      moment: {
        id: updated.id,
        audience: updated.audience,
        audienceLocked: updated.audienceLocked,
      },
      message:
        audience === "only_me"
          ? "This Moment is now Only Me. It will stay private until you change it yourself."
          : `Audience updated to ${audience === "public" ? "Public" : "Followers"}.`,
    });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/moments/:id — manual deletion (Moments never expire by themselves). */
export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const momentId = Number(id);
    const user = await requireVerifiedUser(request);
    const [moment] = await db.select().from(moments).where(eq(moments.id, momentId)).limit(1);
    if (!moment) throw notFound("Moment not found.");
    if (moment.authorId !== user.id) throw forbidden("Only the author can delete this Moment.");
    await db.delete(moments).where(and(eq(moments.id, momentId), eq(moments.authorId, user.id)));
    if (moment.mediaId) await deleteAsset(moment.mediaId);
    await db
      .update(mediaAssets)
      .set({ expiresAt: new Date() })
      .where(eq(mediaAssets.id, moment.mediaId ?? -1));
    return ok({ message: "Moment deleted." });
  } catch (error) {
    return fail(error);
  }
}
