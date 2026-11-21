import { db } from "@/db";
import { reports } from "@/db/schema";
import { ApiError, badRequest, fail, ok, readJson, requireString, toInt } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { notifyAdmins } from "@/db/store";

export const dynamic = "force-dynamic";

const REASONS = [
  "spam",
  "harassment",
  "hate_speech",
  "scam_or_fraud",
  "impersonation",
  "nudity_or_sexual_content",
  "violence",
  "self_harm",
  "intellectual_property",
  "other",
];

/** POST /api/reports — safety reporting for users, Moments, messages and comments. */
export async function POST(request: Request) {
  try {
    const viewer = await getCurrentUser(request);
    const body = await readJson<{
      targetType?: string;
      targetId?: number;
      targetLabel?: string;
      reason?: string;
      details?: string;
    }>(request);
    const targetType = (["user", "moment", "message", "comment"] as const).includes(
      body.targetType as "user" | "moment" | "message" | "comment",
    )
      ? (body.targetType as "user" | "moment" | "message" | "comment")
      : null;
    if (!targetType) throw badRequest("Choose what you are reporting.");
    const reason = requireString(body.reason, "Reason", { min: 2, max: 60 });
    if (!REASONS.includes(reason)) throw badRequest("Choose a reason that matches our guidelines list.");
    const details = typeof body.details === "string" ? body.details.trim().slice(0, 1000) : "";

    const [created] = await db
      .insert(reports)
      .values({
        reporterId: viewer?.id ?? 0,
        targetType,
        targetId: toInt(body.targetId) ?? null,
        targetLabel: typeof body.targetLabel === "string" ? body.targetLabel.slice(0, 160) : null,
        reason,
        details,
      })
      .returning();

    // Tell the admins there is something new in the inbox. Never block the reporter on this.
    await notifyAdmins(`New report #${created.id}: ${reason.replace(/_/g, " ")} (${targetType})`).catch((error) =>
      console.error("[bemblo:admin-notify]", error),
    );

    return ok(
      {
        id: created.id,
        message:
          "Report sent to BlueBelly Safety. Our team reviews reports within 24 hours. We may contact you if we need more details.",
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}

