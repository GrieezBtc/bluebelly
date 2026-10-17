import { and, eq } from "drizzle-orm";
import { badRequest, fail, ok, readJson } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";

export const dynamic = "force-dynamic";

/** GET /api/push — VAPID public key + whether this user has any device subscribed. */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    return ok({
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || null,
      devices: rows.length,
    });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/push — register this device's PushSubscription. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }>(request);
    const sub = body.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) throw badRequest("Invalid push subscription.");
    if (!sub.endpoint.startsWith("https://")) throw badRequest("Invalid push endpoint.");
    const values = {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: (request.headers.get("user-agent") ?? "").slice(0, 200),
    };
    // A device may switch accounts: re-point the endpoint to the current user.
    await db
      .insert(pushSubscriptions)
      .values(values)
      .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values });
    return ok({ subscribed: true });
  } catch (error) {
    return fail(error);
  }
}

/** DELETE /api/push — remove this device's subscription. */
export async function DELETE(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const body = await readJson<{ endpoint?: string }>(request);
    if (!body.endpoint) throw badRequest("Missing endpoint.");
    await db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.endpoint, body.endpoint), eq(pushSubscriptions.userId, user.id)));
    return ok({ subscribed: false });
  } catch (error) {
    return fail(error);
  }
}
