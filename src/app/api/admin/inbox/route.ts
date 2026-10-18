import { fail, forbidden, ok } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { getAdminInbox } from "@/db/store";

export const dynamic = "force-dynamic";

/** GET /api/admin/inbox — all reports and support requests. Admins only. */
export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    if (!isAdminUser(user)) throw forbidden("This area is only for Bemblo admins.", "admin_required");
    return ok(await getAdminInbox());
  } catch (error) {
    return fail(error);
  }
}
