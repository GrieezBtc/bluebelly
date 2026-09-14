import { fail, ok, readJson, toInt } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { listNotifications, markNotificationsRead, sessionPayload } from "@/db/store";

export const dynamic = "force-dynamic";

/** GET /api/notifications — notification centre. */
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    return ok({ notifications: await listNotifications(user) });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/notifications — mark one or all as read. */
export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const body = await readJson<{ id?: number }>(request);
    await markNotificationsRead(user, toInt(body.id));
    return ok({ notifications: await listNotifications(user), session: await sessionPayload(user) });
  } catch (error) {
    return fail(error);
  }
}
