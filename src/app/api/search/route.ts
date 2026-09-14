import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { recordSearch, searchAll, userSummaryList } from "@/db/store";

export const dynamic = "force-dynamic";

/** GET /api/search?q= — users, Moments and recent searches. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const results = await searchAll(user, query);
    if (query.trim().length >= 2) await recordSearch(user, query);
    if (query.trim().length === 0) {
      return ok({ ...results, suggestions: await userSummaryList(user, "suggestions") });
    }
    return ok({ ...results, suggestions: [] });
  } catch (error) {
    return fail(error);
  }
}
