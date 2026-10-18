import { fail, notFound, ok, readJson, requireString } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { addComment, getMoment, listComments, shareMoment, toggleLike } from "@/db/store";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** GET /api/moments/:id/engagement — comments thread. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const momentId = Number(id);
    const viewer = await getCurrentUser(request);
    const found = await getMoment(viewer?.id ?? null, momentId);
    if (!found) throw notFound("This Moment is not available to you.");
    return ok({ comments: await listComments(viewer?.id ?? null, momentId) });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/moments/:id/engagement — like, unlike, comment or share. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const momentId = Number(id);
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ action?: string; body?: string; parentId?: number }>(request);
    switch (body.action) {
      case "like":
        return ok(await toggleLike(user, momentId, true));
      case "unlike":
        return ok(await toggleLike(user, momentId, false));
      case "comment": {
        const text = requireString(body.body, "Comment", { min: 1, max: 600 });
        const parentId = typeof body.parentId === "number" && Number.isInteger(body.parentId) ? body.parentId : null;
        try {
          return ok(await addComment(user, momentId, text, parentId), 201);
        } catch (error) {
          if (error instanceof Error && error.message === "parent_not_found") throw notFound("That comment is no longer available.");
          throw error;
        }
      }
      case "share":
        return ok(await shareMoment(user, momentId));
      default:
        throw notFound("Unknown action.");
    }
  } catch (error) {
    return fail(error);
  }
}
