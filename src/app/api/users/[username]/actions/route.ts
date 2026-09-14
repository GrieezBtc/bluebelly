import { applyFollowAction, getPublicProfile } from "@/db/store";
import { ApiError, fail, notFound, ok, readJson } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };
type Action = "follow" | "unfollow" | "accept" | "decline" | "remove_follower" | "block" | "unblock" | "mute" | "unmute";

const ACTIONS: Action[] = ["follow", "unfollow", "accept", "decline", "remove_follower", "block", "unblock", "mute", "unmute"];

/** POST /api/users/:username/actions — the single social-graph mutation endpoint. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { username } = await params;
    const user = await requireUser(request);
    const body = await readJson<{ action?: string }>(request);
    if (!ACTIONS.includes(body.action as Action)) throw notFound("Unknown action.");
    const result = await applyFollowAction(user, username, body.action as Action);
    const profile = await getPublicProfile(user.id, username);
    return ok({ ...result, profile });
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") {
      return fail(notFound("That account does not exist."));
    }
    if (error instanceof Error && error.message === "self") {
      throw new ApiError("self_action", "You cannot follow, mute or block yourself.", 400);
    }
    return fail(error);
  }
}
