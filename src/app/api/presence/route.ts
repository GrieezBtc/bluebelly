import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { fail, ok } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    const now = new Date();

    await db
      .update(users)
      .set({ lastActiveAt: now })
      .where(eq(users.id, user.id));

    return ok({ lastActiveAt: now.toISOString() });
  } catch (error) {
    return fail(error);
  }
}
