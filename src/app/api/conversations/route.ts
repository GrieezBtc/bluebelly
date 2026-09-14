import { badRequest, fail, ok, readJson, requireString } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createGroupConversation, ensureDirectConversation, listConversations, sweepIfStale } from "@/db/store";

export const dynamic = "force-dynamic";

/** GET /api/conversations?tab=inbox|requests */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await sweepIfStale();
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") === "requests" ? "requests" : "inbox";
    return ok({ conversations: await listConversations(user, tab), tab });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/conversations — start a 1-to-1 or group conversation. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson<{ kind?: string; username?: string; title?: string; usernames?: string[]; imageUrl?: string }>(
      request,
    );
    if (body.kind === "group") {
      const title = requireString(body.title, "Group name", { min: 2, max: 60 });
      const usernames = Array.isArray(body.usernames) ? body.usernames.slice(0, 50) : [];
      if (usernames.length === 0) throw badRequest("Add at least one person to the group.");
      const id = await createGroupConversation(user, usernames, title, body.imageUrl ?? null);
      if (!id) throw badRequest("We could not find those accounts.");
      return ok({ conversationId: id, created: true }, 201);
    }
    const username = requireString(body.username, "Username", { max: 24 }).replace(/^@/, "");
    const result = await ensureDirectConversation(user, username);
    if ("error" in result) {
      if (result.error === "not_found") throw badRequest("We could not find that account.", "not_found");
      if (result.error === "self") throw badRequest("You cannot start a conversation with yourself.", "self");
      throw badRequest(result.message ?? "You cannot message this person right now.", "messages_not_allowed");
    }
    return ok({ conversationId: result.conversationId, created: result.created, request: result.requested }, 201);
  } catch (error) {
    return fail(error);
  }
}
