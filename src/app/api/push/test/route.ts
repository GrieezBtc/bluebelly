import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

export const dynamic = "force-dynamic";

/** POST /api/push/test — send a test notification to every device the signed-in user registered. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const rows = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, user.id));
    if (rows.length) {
      await sendPushToUser(user.id, {
        title: "Bemblo",
        body: "Notifications are working on this device.",
        url: "/notifications",
        tag: "bemblo-test",
      });
    }
    return ok({ devices: rows.length });
  } catch (error) {
    return fail(error);
  }
}
