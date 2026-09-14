import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { DEMO_PASSWORD, DEMO_USERNAME, seedDemoData } from "@/db/demo";
import { createSession, setSessionCookie } from "@/lib/auth";
import { fail, forbidden, ok } from "@/lib/api";
import { sessionPayload } from "@/db/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/demo — provisions the demo world (idempotent) and signs in as
 * @ava.rivera so the product can be evaluated instantly.
 */
export async function POST() {
  try {
    if (process.env.BEMBLO_DEMO_MODE !== "true") throw forbidden("Demo mode is disabled.");
    await seedDemoData();
    const [user] = await db.select().from(users).where(eq(users.username, DEMO_USERNAME)).limit(1);
    if (!user) return fail({ code: "demo_unavailable", message: "Demo account unavailable." });
    const session = await createSession(user.id, "web");
    await setSessionCookie(session.token, session.expiresAt);
    return ok({
      user: await sessionPayload(user),
      credentials: { username: DEMO_USERNAME, password: DEMO_PASSWORD },
      token: session.token,
    });
  } catch (error) {
    return fail(error);
  }
}
