import { badRequest, fail, forbidden, notFound, ok, readJson, requireString } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { addComment, deleteComment, editComment, getMoment, listComments, reactToComment, shareMoment, toggleLike } from "@/db/store";
import { isCommentReaction } from "@/lib/reactions";
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
    const body = await readJson<{ action?: string; body?: string; parentId?: number; commentId?: number; reaction?: string | null }>(request);
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
      case "react": {
        if (typeof body.commentId !== "number" || !Number.isInteger(body.commentId)) throw notFound("That comment is no longer available.");
        const reaction = body.reaction === null || body.reaction === undefined ? null : body.reaction;
        if (reaction !== null && !isCommentReaction(reaction)) throw badRequest("Pick one of the six reactions.");
        try {
          return ok(await reactToComment(user, momentId, body.commentId, reaction));
        } catch (error) {
          if (error instanceof Error && error.message === "not_found") throw notFound("That comment is no longer available.");
          throw error;
        }
      }
      case "edit-comment":
      case "delete-comment": {
        if (typeof body.commentId !== "number" || !Number.isInteger(body.commentId)) throw notFound("That comment is no longer available.");
        try {
          if (body.action === "edit-comment") return ok(await editComment(user, momentId, body.commentId, typeof body.body === "string" ? body.body : ""));
          return ok(await deleteComment(user, momentId, body.commentId));
        } catch (error) {
          if (error instanceof Error) {
            if (error.message === "not_found") throw notFound("That comment is no longer available.");
            if (error.message === "not_author") throw forbidden("You cannot change this comment.");
            if (error.message === "empty") throw badRequest("A comment cannot be empty. Delete it instead.");
            if (error.message === "too_long") throw badRequest("That comment is too long.");
          }
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
