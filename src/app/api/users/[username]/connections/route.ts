import { fail, notFound, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile, listConnectionsOf } from "@/db/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

/** GET /api/users/:username/connections?kind=followers|following */
export async function GET(request: Request, { params }: Params) {
  try {
    const { username } = await params;
    const viewer = await getCurrentUser(request);
    const profile = await getPublicProfile(viewer?.id ?? null, username);
    if (!profile) throw notFound("That account does not exist.");
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") === "following" ? "following" : "followers";
    const visible = profile.canViewFollowers || !profile.restricted;
    if (!visible) {
      return ok({ kind, restricted: true, users: [] });
    }
    return ok({ kind, restricted: false, users: await listConnectionsOf(profile.user.id, viewer?.id ?? null, kind) });
  } catch (error) {
    return fail(error);
  }
}
