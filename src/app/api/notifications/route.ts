import { fail, ok, readJson, toInt } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead, sessionPayload } from "@/db/store";

export const dynamic = "force-dynamic";

/** GET /api/notifications — notification centre. */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    return ok({ notifications: await listNotifications(user) });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/notifications — mark one or all as read. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson<{
      id?: number;
      scope?: "general" | "messages" | "all";
    }>(request);

    await markNotificationsRead(
      user,
      toInt(body.id),
      body.scope ?? "all",
    );
    return ok({ notifications: await listNotifications(user), session: await sessionPayload(user) });
  } catch (error) {
    return fail(error);
  }
}
