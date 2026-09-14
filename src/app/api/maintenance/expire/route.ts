import { ApiError, fail, ok } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { runExpirySweep } from "@/db/store";

export const dynamic = "force-dynamic";

/**
 * POST /api/maintenance/expire
 * Scheduled job entrypoint: enforces message expiration and cleans temporary media.
 * Safe to call from a cron, a queue worker, or the client (runs are idempotent).
 */
export async function POST(request: Request) {
  try {
    const viewer = await getCurrentUser(request);
    const secret = process.env.BEMBLO_MAINTENANCE_SECRET;
    const provided = request.headers.get("x-bemblo-maintenance");
    if (process.env.NODE_ENV === "production") {
      if (!secret || !provided || provided !== secret) {
        throw new ApiError("forbidden", "Maintenance token required.", 403);
      }
    } else if (secret && provided !== secret) {
      if (!viewer) throw new ApiError("forbidden", "Maintenance token required.", 403);
    } else if (!secret && !viewer) {
      throw new ApiError("forbidden", "Sign-in required.", 403);
    }
    const result = await runExpirySweep();
    return ok({ ...result, ranAt: new Date().toISOString() });
  } catch (error) {
    return fail(error);
  }
}
