import { badRequest, fail, ok, readJson, requireString } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { createSupportTicket, listSupportTickets, notifyAdmins } from "@/db/store";
import { SUPPORT_TOPICS, FAQS, HELP_CATEGORIES } from "@/lib/content";
import { validateEmail } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/support — help centre content + your open tickets. */
export async function GET(request: Request) {
  try {
    const viewer = await getCurrentUser(request);
    const tickets = viewer ? await listSupportTickets(viewer.id) : [];
    return ok({
      faqs: FAQS,
      categories: HELP_CATEGORIES,
      topics: SUPPORT_TOPICS,
      tickets: tickets.map((t) => ({
        id: t.id,
        topic: t.topic,
        subject: t.subject,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return fail(error);
  }
}

/** POST /api/support — contact support / report a problem. */
export async function POST(request: Request) {
  try {
    const viewer = await getCurrentUser(request);
    const body = await readJson<{ email?: string; topic?: string; subject?: string; body?: string }>(request);
    const emailCheck = validateEmail(requireString(body.email, "Email", { max: 160 }));
    if (!emailCheck.ok) throw badRequest(emailCheck.message);
    const topic = requireString(body.topic, "Topic", { min: 2, max: 60 });
    if (!SUPPORT_TOPICS.some((t) => t.id === topic)) throw badRequest("Choose a support topic from the list.");
    const subject = requireString(body.subject, "Subject", { min: 4, max: 120 });
    const message = requireString(body.body, "Message", { min: 10, max: 4000 });
    const ticket = await createSupportTicket({
      userId: viewer?.id ?? null,
      email: emailCheck.value,
      topic,
      subject,
      body: message,
    });
    await notifyAdmins(`New support request #${ticket.id}: ${subject.slice(0, 60)}`).catch((error) =>
      console.error("[bemblo:admin-notify]", error),
    );
    return ok(
      {
        id: ticket.id,
        message: `Thanks — your request #${ticket.id} is with Bemblo Support. Average reply time is under 4 hours.`,
      },
      201,
    );
  } catch (error) {
    return fail(error);
  }
}
