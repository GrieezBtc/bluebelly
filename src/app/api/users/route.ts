import { fail, ok } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { userSummaryList } from "@/db/store";

export const dynamic = "force-dynamic";

const KINDS = ["suggestions", "followers", "following", "pending", "blocked", "muted"] as const;

/** GET /api/users?kind=followers|following|pending|blocked|muted|suggestions */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const url = new URL(request.url);
    const raw = url.searchParams.get("kind") ?? "suggestions";
    const kind = (KINDS as readonly string[]).includes(raw) ? (raw as (typeof KINDS)[number]) : "suggestions";
    return ok({ kind, users: await userSummaryList(user, kind) });
  } catch (error) {
    return fail(error);
  }
}
