import { fail, notFound, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { getPublicProfile, listAuthorMoments, listConnectionsOf, userSummaryList, profileCounts } from "@/db/store";
import { sweepIfStale } from "@/db/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ username: string }> };

/** GET /api/users/:username — profile view enforcing account privacy. */
export async function GET(request: Request, { params }: Params) {
  try {
    const { username } = await params;
    const viewer = await getCurrentUser(request);
    await sweepIfStale();
    const profile = await getPublicProfile(viewer?.id ?? null, username);
    if (!profile) throw notFound("That account does not exist.");
    const url = new URL(request.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 12) || 12, 30);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const page = profile.restricted
      ? { items: [], nextCursor: null }
      : await listAuthorMoments(viewer?.id ?? null, profile.user, { limit, cursor });
    const counts = await profileCounts(profile.user.id);
    const pending = profile.isSelf && viewer ? await userSummaryList(viewer, "pending") : [];
    const followers = profile.canViewFollowers
      ? await listConnectionsOf(profile.user.id, viewer?.id ?? null, "followers")
      : [];
    return ok({
      profile: {
        user: profile.user,
        isSelf: profile.isSelf,
        relation: profile.relation,
        restricted: profile.restricted,
        restrictedReason: profile.restrictedReason,
        followerCount: counts.followers,
        followingCount: counts.following,
        momentCount: counts.moments,
        messageAllowed: profile.messageAllowed,
        messageHint: profile.messageHint,
        canViewFollowers: profile.canViewFollowers,
        profilePrivacy: profile.user.profilePrivacy,
      },
      moments: page.items,
      nextCursor: page.nextCursor,
      followersPreview: followers.slice(0, 12),
      pendingRequests: pending,
    });
  } catch (error) {
    return fail(error);
  }
}
