import { badRequest, fail, forbidden, notFound, ok, readJson } from "@/lib/api";
import { requireVerifiedUser } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { updateReportStatus } from "@/db/store";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/reports/:id — start review, resolve or dismiss. Admins only. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const user = await requireVerifiedUser(request);
    if (!isAdminUser(user)) throw forbidden("This area is only for BlueBelly admins.", "admin_required");
    const body = await readJson<{ status?: string; note?: string }>(request);
    if (body.status !== "reviewing" && body.status !== "resolved" && body.status !== "dismissed") {
      throw badRequest("Choose a valid status.");
    }
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : "";
    return ok(await updateReportStatus(user, Number(id), body.status, note));
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return fail(notFound("Report not found."));
    return fail(error);
  }
}
